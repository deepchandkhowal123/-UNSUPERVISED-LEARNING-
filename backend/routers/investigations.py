"""Investigations + evidence case management."""
import json
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from ..database import cursor
from ..models import InvestigationCreate, EvidenceCreate, now, User
from ..auth import get_current_user
from ..audit import log

router = APIRouter(prefix="/api/investigations", tags=["investigations"])


@router.get("")
def list_investigations(status: str = None, page: int = Query(1, ge=1),
                        size: int = Query(20, ge=1, le=100),
                        user: User = Depends(get_current_user)):
    where, args = [], []
    if status:
        where.append("status = ?"); args.append(status)
    clause = (" WHERE " + " AND ".join(where)) if where else ""
    offset = (page - 1) * size
    with cursor() as c:
        c.execute(f"SELECT COUNT(*) AS n FROM investigations{clause}", args)
        total = c.fetchone()["n"]
        c.execute(f"SELECT * FROM investigations{clause} ORDER BY created_at DESC LIMIT ? OFFSET ?",
                  args + [size, offset])
        rows = []
        for r in c.fetchall():
            d = dict(r)
            d["entity_ids"] = json.loads(d.get("entity_ids") or "[]")
            rows.append(d)
    return {"items": rows, "total": total, "page": page, "size": size}


@router.post("")
def create_inv(body: InvestigationCreate, user: User = Depends(get_current_user)):
    iid = "INV-" + uuid.uuid4().hex[:8].upper()
    ts = now()
    with cursor() as c:
        c.execute(
            "INSERT INTO investigations (id,title,status,priority,description,assigned_to,created_by,created_at,updated_at,entity_ids) "
            "VALUES (?,?,?,?,?,?,?,?,?,?)",
            (iid, body.title, "open", body.priority, body.description, user.username,
             user.username, ts, ts, json.dumps(body.entity_ids)))
    log(user, "investigation.create", iid, body.model_dump_json())
    return {"id": iid, "title": body.title, "status": "open", "created_at": ts}


@router.get("/{iid}")
def get_inv(iid: str, user: User = Depends(get_current_user)):
    with cursor() as c:
        c.execute("SELECT * FROM investigations WHERE id = ?", (iid,))
        row = c.fetchone()
        if not row:
            raise HTTPException(404, "Investigation not found")
        d = dict(row)
        d["entity_ids"] = json.loads(d.get("entity_ids") or "[]")
        c.execute("SELECT * FROM evidence WHERE investigation_id = ? ORDER BY created_at DESC", (iid,))
        d["evidence"] = [dict(e) for e in c.fetchall()]
    return d


@router.patch("/{iid}/status")
def update_status(iid: str, status: str, user: User = Depends(get_current_user)):
    if status not in ("open", "in_progress", "closed", "archived"):
        raise HTTPException(400, "invalid status")
    with cursor() as c:
        c.execute("UPDATE investigations SET status=?, updated_at=? WHERE id=?", (status, now(), iid))
        if c.rowcount == 0:
            raise HTTPException(404, "not found")
    log(user, "investigation.status", iid, status)
    return {"id": iid, "status": status}


@router.post("/evidence")
def add_evidence(body: EvidenceCreate, user: User = Depends(get_current_user)):
    eid = "EV-" + uuid.uuid4().hex[:8].upper()
    ts = now()
    with cursor() as c:
        c.execute("INSERT INTO evidence (id,investigation_id,entity_id,kind,content,created_by,created_at) VALUES (?,?,?,?,?,?,?)",
                  (eid, body.investigation_id, body.entity_id, body.kind, body.content, user.username, ts))
    log(user, "evidence.add", eid, body.model_dump_json())
    return {"id": eid, "created_at": ts}
