"""Audit log + system status endpoints."""
import time
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from ..database import cursor, db_size
from ..auth import get_current_user, User, require_permission
from ..audit import log
from ..config import APP_NAME, APP_VERSION, DB_PATH
from ..models import SavedSearchCreate, now
from ..services import data_generator as dg
from ..services import graph_engine as ge

router = APIRouter(prefix="/api/system", tags=["system"])

_START = time.time()


@router.get("/status")
def status(user: User = Depends(get_current_user)):
    ents, rels = db_size()
    return {"app": APP_NAME, "version": APP_VERSION, "entities": ents,
            "relationships": rels, "user": user.username, "role": user.role}


@router.post("/regenerate")
def regenerate(user: User = Depends(require_permission("manage"))):
    ents, rels = dg.generate()
    ge.build_graph(force=True)
    log(user, "system.regenerate", None, f"entities={ents} rels={rels}")
    return {"ok": True, "entities": ents, "relationships": rels}


@router.get("/audit")
def audit(limit: int = Query(100, le=500),
          page: int = Query(None, ge=1),
          size: int = Query(50, ge=1, le=200),
          user: User = Depends(get_current_user)):
    with cursor() as c:
        if page is not None:
            offset = (page - 1) * size
            c.execute("SELECT COUNT(*) AS n FROM audit_log")
            total = c.fetchone()["n"]
            c.execute("SELECT * FROM audit_log ORDER BY id DESC LIMIT ? OFFSET ?",
                      (size, offset))
            items = [dict(r) for r in c.fetchall()]
            return {"items": items, "total": total, "page": page, "size": size,
                    "pages": (total + size - 1) // size}
        c.execute("SELECT * FROM audit_log ORDER BY id DESC LIMIT ?", (limit,))
        return {"items": [dict(r) for r in c.fetchall()]}


@router.get("/stats")
def stats(user: User = Depends(get_current_user)):
    """Aggregate system stats: counts, db size, type breakdowns, cache + uptime."""
    ents, rels = db_size()
    with cursor() as c:
        c.execute("SELECT COUNT(*) AS n FROM audit_log")
        audit_entries = c.fetchone()["n"]
        c.execute("SELECT COUNT(*) AS n FROM investigations")
        invs = c.fetchone()["n"]
        c.execute("SELECT COUNT(*) AS n FROM entity_notes")
        notes = c.fetchone()["n"]
        c.execute("SELECT COUNT(*) AS n FROM saved_searches")
        saved = c.fetchone()["n"]
        c.execute("SELECT type, COUNT(*) AS n FROM entities GROUP BY type")
        type_counts = {r["type"]: r["n"] for r in c.fetchall()}
        c.execute("SELECT rel_type, COUNT(*) AS n FROM relationships GROUP BY rel_type")
        rel_type_counts = {r["rel_type"]: r["n"] for r in c.fetchall()}
    db_bytes = DB_PATH.stat().st_size if DB_PATH.exists() else 0
    cache_built_at = ge._CACHE.get("built_at") if hasattr(ge, "_CACHE") else None
    return {
        "entities": ents, "relationships": rels, "audit_entries": audit_entries,
        "investigations": invs, "notes": notes, "saved_searches": saved,
        "db_bytes": db_bytes, "type_counts": type_counts,
        "rel_type_counts": rel_type_counts, "cache_built_at": cache_built_at,
        "uptime_seconds": round(time.time() - _START, 1),
    }


# --- Saved searches (per-user) ---
@router.get("/saved-searches")
def list_saved_searches(user: User = Depends(get_current_user)):
    with cursor() as c:
        c.execute(
            "SELECT id, owner, name, query, filters, created_at FROM saved_searches "
            "WHERE owner = ? ORDER BY created_at DESC",
            (user.username,))
        rows = [dict(r) for r in c.fetchall()]
    return {"items": rows}


@router.post("/saved-searches")
def create_saved_search(body: SavedSearchCreate, user: User = Depends(get_current_user)):
    sid = uuid.uuid4().hex
    ts = now()
    with cursor() as c:
        c.execute(
            "INSERT INTO saved_searches (id, owner, name, query, filters, created_at) "
            "VALUES (?,?,?,?,?,?)",
            (sid, user.username, body.name, body.query, body.filters, ts))
    log(user, "saved_search.create", sid, body.name)
    return {"id": sid, "owner": user.username, "name": body.name,
            "query": body.query, "filters": body.filters, "created_at": ts}


@router.delete("/saved-searches/{sid}")
def delete_saved_search(sid: str, user: User = Depends(get_current_user)):
    with cursor() as c:
        c.execute("SELECT owner FROM saved_searches WHERE id = ?", (sid,))
        row = c.fetchone()
        if not row:
            raise HTTPException(404, "Saved search not found")
        if row["owner"] != user.username and user.role != "admin":
            raise HTTPException(403, "Not allowed to delete this saved search")
        c.execute("DELETE FROM saved_searches WHERE id = ?", (sid,))
    log(user, "saved_search.delete", sid)
    return {"ok": True}
