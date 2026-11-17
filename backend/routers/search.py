"""Unified search across entities + relationships."""
import json
from fastapi import APIRouter, Depends, Query
from ..database import cursor
from ..auth import get_current_user, User

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("")
def search(q: str, size: int = Query(30, le=100), user: User = Depends(get_current_user)):
    like = f"%{q}%"
    with cursor() as c:
        c.execute(
            "SELECT id, name, type, risk_score, country FROM entities "
            "WHERE name LIKE ? OR id LIKE ? OR country LIKE ? ORDER BY risk_score DESC LIMIT ?",
            (like, like, like, size))
        ents = [dict(r) for r in c.fetchall()]
        c.execute(
            "SELECT r.id, r.source_id, r.target_id, r.rel_type, r.amount, r.occurred_at, "
            "es.name AS source_name, et.name AS target_name "
            "FROM relationships r LEFT JOIN entities es ON r.source_id=es.id "
            "LEFT JOIN entities et ON r.target_id=et.id "
            "WHERE r.rel_type LIKE ? OR es.name LIKE ? OR et.name LIKE ? "
            "ORDER BY r.amount DESC LIMIT ?",
            (like, like, like, size))
        rels = [dict(r) for r in c.fetchall()]
    return {"query": q, "entities": ents, "relationships": rels,
            "total": len(ents) + len(rels)}
