"""Entity CRUD + listing endpoints."""
import json
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from ..database import cursor
from ..models import Entity, EntityUpdate, NoteCreate, BulkTagUpdate, now, User
from ..auth import get_current_user, require_permission
from ..audit import log
from ..services import graph_engine as ge
from ..services import ml_engine as ml

router = APIRouter(prefix="/api/entities", tags=["entities"])


def _row_to_entity(row):
    d = dict(row)
    try:
        d["metadata"] = json.loads(d.get("metadata") or "{}")
    except Exception:
        d["metadata"] = {}
    return d


@router.get("")
def list_entities(
    type: str = None,
    country: str = None,
    min_risk: float = Query(None, ge=0, le=100),
    max_risk: float = Query(None, ge=0, le=100),
    q: str = None,
    sort: str = "risk_score",
    order: str = "desc",
    page: int = Query(1, ge=1),
    size: int = Query(25, ge=1, le=200),
    user: User = Depends(get_current_user),
):
    if min_risk is not None and max_risk is not None and min_risk > max_risk:
        raise HTTPException(422, "Minimum risk cannot exceed maximum risk")
    where, args = [], []
    if type:
        where.append("type = ?"); args.append(type)
    if country:
        where.append("country = ?"); args.append(country)
    if min_risk is not None:
        where.append("risk_score >= ?"); args.append(min_risk)
    if max_risk is not None:
        where.append("risk_score <= ?"); args.append(max_risk)
    if q:
        where.append("(name LIKE ? OR id LIKE ?)"); args += [f"%{q}%", f"%{q}%"]
    allowed_sort = {"risk_score", "name", "created_at", "last_seen", "id"}
    sort = sort if sort in allowed_sort else "risk_score"
    order = "DESC" if order.lower() == "desc" else "ASC"
    clause = (" WHERE " + " AND ".join(where)) if where else ""
    offset = (page - 1) * size
    with cursor() as c:
        c.execute(f"SELECT COUNT(*) AS n FROM entities{clause}", args)
        total = c.fetchone()["n"]
        c.execute(f"SELECT * FROM entities{clause} ORDER BY {sort} {order} LIMIT ? OFFSET ?",
                  args + [size, offset])
        rows = [_row_to_entity(r) for r in c.fetchall()]
    return {"items": rows, "total": total, "page": page, "size": size,
            "pages": (total + size - 1) // size}


@router.get("/{entity_id}")
def get_entity(entity_id: str, user: User = Depends(get_current_user)):
    with cursor() as c:
        c.execute("SELECT * FROM entities WHERE id = ?", (entity_id,))
        row = c.fetchone()
    if not row:
        raise HTTPException(404, "Entity not found")
    return _row_to_entity(row)


@router.patch("/{entity_id}")
def update_entity(entity_id: str, body: EntityUpdate, user: User = Depends(get_current_user)):
    with cursor() as c:
        c.execute("SELECT * FROM entities WHERE id = ?", (entity_id,))
        row = c.fetchone()
        if not row:
            raise HTTPException(404, "Entity not found")
        cur_meta = json.loads(row["metadata"] or "{}")
        if body.name is not None:
            c.execute("UPDATE entities SET name = ? WHERE id = ?", (body.name, entity_id))
        if body.risk_score is not None:
            c.execute("UPDATE entities SET risk_score = ? WHERE id = ?", (body.risk_score, entity_id))
        if body.country is not None:
            c.execute("UPDATE entities SET country = ? WHERE id = ?", (body.country, entity_id))
        if body.metadata is not None:
            cur_meta.update(body.metadata)
            c.execute("UPDATE entities SET metadata = ? WHERE id = ?", (json.dumps(cur_meta), entity_id))
    ge.build_graph(force=True)
    log(user, "entity.update", entity_id, body.model_dump_json())
    with cursor() as c:
        c.execute("SELECT * FROM entities WHERE id = ?", (entity_id,))
        return _row_to_entity(c.fetchone())


@router.get("/{entity_id}/neighbors")
def entity_neighbors(entity_id: str, limit: int = 50, user: User = Depends(get_current_user)):
    return ge.neighbors(entity_id, limit)


@router.get("/{entity_id}/subgraph")
def entity_subgraph(entity_id: str, depth: int = 2, limit: int = 120, user: User = Depends(get_current_user)):
    return ge.subgraph(entity_id, depth, limit)


@router.get("/types/summary")
def type_summary(user: User = Depends(get_current_user)):
    with cursor() as c:
        c.execute("SELECT type, COUNT(*) AS n, ROUND(AVG(risk_score),2) AS avg_risk FROM entities GROUP BY type ORDER BY n DESC")
        return [dict(r) for r in c.fetchall()]


# --- Entity timeline (monthly relationship volume + amount) ---
@router.get("/{entity_id}/timeline")
def entity_timeline(entity_id: str, user: User = Depends(get_current_user)):
    with cursor() as c:
        c.execute(
            "SELECT substr(occurred_at,1,7) AS month, COUNT(*) AS count, "
            "COALESCE(SUM(amount),0) AS amount "
            "FROM relationships WHERE source_id = ? OR target_id = ? "
            "GROUP BY month ORDER BY month",
            (entity_id, entity_id))
        rows = [{"month": r["month"], "count": r["count"], "amount": r["amount"]}
                for r in c.fetchall()]
    return {"items": rows}


# --- Paginated relationships involving the entity (in/out/both) ---
@router.get("/{entity_id}/relationships")
def entity_relationships(
    entity_id: str,
    dir: str = "all",
    rel_type: str = None,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    user: User = Depends(get_current_user),
):
    if dir not in ("all", "in", "out"):
        dir = "all"
    where, args, select_args = [], [], []
    if dir == "out":
        where.append("r.source_id = ?"); args.append(entity_id)
        counter_join = "r.target_id"
        direction_expr = "'out'"
    elif dir == "in":
        where.append("r.target_id = ?"); args.append(entity_id)
        counter_join = "r.source_id"
        direction_expr = "'in'"
    else:
        where.append("(r.source_id = ? OR r.target_id = ?)"); args += [entity_id, entity_id]
        counter_join = "CASE WHEN r.source_id = ? THEN r.target_id ELSE r.source_id END"
        direction_expr = "CASE WHEN r.source_id = ? THEN 'out' ELSE 'in' END"
        select_args = [entity_id, entity_id]
    if rel_type:
        where.append("r.rel_type = ?"); args.append(rel_type)
    clause = (" WHERE " + " AND ".join(where)) if where else ""
    offset = (page - 1) * size
    base_select = (
        f"SELECT r.id, r.rel_type, r.amount, r.currency, r.weight, r.occurred_at, "
        f"{direction_expr} AS direction, "
        f"e.id AS counterpart_id, e.name AS counterpart_name, "
        f"e.type AS counterpart_type, e.risk_score AS counterpart_risk "
        f"FROM relationships r JOIN entities e ON e.id = {counter_join}"
    )
    with cursor() as c:
        c.execute(f"SELECT COUNT(*) AS n FROM relationships r{clause}", args)
        total = c.fetchone()["n"]
        c.execute(f"{base_select}{clause} ORDER BY r.occurred_at DESC LIMIT ? OFFSET ?",
                  select_args + args + [size, offset])
        rows = [dict(r) for r in c.fetchall()]
    return {"items": rows, "total": total, "page": page, "size": size,
            "pages": (total + size - 1) // size}


# --- Notes on entities ---
@router.post("/{entity_id}/notes")
def create_note(entity_id: str, body: NoteCreate, user: User = Depends(get_current_user)):
    with cursor() as c:
        c.execute("SELECT id FROM entities WHERE id = ?", (entity_id,))
        if not c.fetchone():
            raise HTTPException(404, "Entity not found")
        note_id = uuid.uuid4().hex
        ts = now()
        c.execute(
            "INSERT INTO entity_notes (id, entity_id, author, content, created_at) "
            "VALUES (?,?,?,?,?)",
            (note_id, entity_id, user.username, body.content, ts))
    log(user, "entity.note", entity_id, body.content[:200])
    return {"id": note_id, "entity_id": entity_id, "author": user.username,
            "content": body.content, "created_at": ts}


@router.get("/{entity_id}/notes")
def list_notes(entity_id: str, user: User = Depends(get_current_user)):
    with cursor() as c:
        c.execute(
            "SELECT id, entity_id, author, content, created_at FROM entity_notes "
            "WHERE entity_id = ? ORDER BY created_at DESC",
            (entity_id,))
        rows = [dict(r) for r in c.fetchall()]
    return {"items": rows}


@router.delete("/notes/{note_id}")
def delete_note(note_id: str, user: User = Depends(get_current_user)):
    with cursor() as c:
        c.execute("SELECT id FROM entity_notes WHERE id = ?", (note_id,))
        if not c.fetchone():
            raise HTTPException(404, "Note not found")
        c.execute("DELETE FROM entity_notes WHERE id = ?", (note_id,))
    log(user, "entity.note_delete", note_id)
    return {"ok": True}


# --- Bulk tagging (manage permission) ---
@router.post("/bulk/tag")
def bulk_tag(body: BulkTagUpdate, user: User = Depends(require_permission("manage"))):
    if not body.entity_ids:
        raise HTTPException(400, "No entity ids provided")
    if body.risk_score is None and body.metadata is None:
        raise HTTPException(400, "Nothing to update")
    updated = 0
    with cursor() as c:
        for eid in body.entity_ids:
            c.execute("SELECT metadata FROM entities WHERE id = ?", (eid,))
            row = c.fetchone()
            if not row:
                continue
            if body.risk_score is not None:
                c.execute("UPDATE entities SET risk_score = ? WHERE id = ?",
                          (body.risk_score, eid))
            if body.metadata is not None:
                try:
                    cur_meta = json.loads(row["metadata"] or "{}")
                except Exception:
                    cur_meta = {}
                cur_meta.update(body.metadata)
                c.execute("UPDATE entities SET metadata = ? WHERE id = ?",
                          (json.dumps(cur_meta), eid))
            updated += 1
    ge.build_graph(force=True)
    log(user, "entity.bulk_tag", ",".join(body.entity_ids[:10]),
        f"updated={updated} risk={body.risk_score} meta={'yes' if body.metadata else 'no'}")
    return {"updated": updated}


# --- Recompute risk from graph + ML signals (investigate permission) ---
@router.post("/{entity_id}/recalc-risk")
def recalc_risk(entity_id: str, user: User = Depends(require_permission("investigate"))):
    with cursor() as c:
        c.execute("SELECT risk_score FROM entities WHERE id = ?", (entity_id,))
        row = c.fetchone()
        if not row:
            raise HTTPException(404, "Entity not found")
        old = row["risk_score"]
    g = ge.build_graph()
    degree = g.degree(entity_id) if entity_id in g else 0
    bump_extra = 0
    try:
        anom = ml.detect_anomalies("isolation_forest", 50)
        anom_ids = {a["entity_id"] for a in anom.get("anomalies", [])[:20]}
        if entity_id in anom_ids:
            bump_extra = 5
    except Exception:
        bump_extra = 0
    bump = min(40, degree * 2) + bump_extra
    new_risk = round(max(0.0, min(100.0, old + bump)), 1)
    with cursor() as c:
        c.execute("UPDATE entities SET risk_score = ? WHERE id = ?", (new_risk, entity_id))
    ge.build_graph(force=True)
    log(user, "entity.recalc_risk", entity_id,
        f"old={old} new={new_risk} degree={degree} bump={bump}")
    return {"id": entity_id, "old": old, "new": new_risk}
