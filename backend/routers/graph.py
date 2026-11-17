"""Graph analysis endpoints."""
import networkx as nx
from fastapi import APIRouter, Depends, Query
from ..auth import get_current_user, User
from ..services import graph_engine as ge

router = APIRouter(prefix="/api/graph", tags=["graph"])


@router.get("/stats")
def stats(user: User = Depends(get_current_user)):
    return ge.stats()


@router.get("/centrality")
def centrality(limit: int = Query(50, le=200), user: User = Depends(get_current_user)):
    return {"items": ge.centrality(limit)}


@router.get("/communities")
def communities(user: User = Depends(get_current_user)):
    return {"items": ge.communities()}


@router.get("/structural")
def structural(user: User = Depends(get_current_user)):
    return ge.structural_items()


@router.get("/path")
def path(src: str, tgt: str, user: User = Depends(get_current_user)):
    return ge.shortest_path(src, tgt)


@router.get("/relationship-types")
def relationship_types(user: User = Depends(get_current_user)):
    """Aggregate counts + total amount per relationship type, ordered by count desc."""
    from ..database import cursor
    with cursor() as c:
        c.execute(
            "SELECT rel_type, COUNT(*) AS count, COALESCE(SUM(amount),0) AS total_amount "
            "FROM relationships GROUP BY rel_type ORDER BY count DESC")
        rows = [{"rel_type": r["rel_type"], "count": r["count"],
                 "total_amount": r["total_amount"]} for r in c.fetchall()]
    return {"items": rows}


@router.get("/paths")
def paths(src: str, tgt: str, k: int = 3, user: User = Depends(get_current_user)):
    """Up to `k` (max 5) shortest simple paths between two entities (undirected)."""
    k = max(1, min(5, k))
    g = ge.build_graph()
    ents = ge.entity_map()
    und = g.to_undirected()
    paths_out = []
    try:
        if src in und and tgt in und and src != tgt:
            gen = nx.all_shortest_paths(und, src, tgt)
            for i, p in enumerate(gen):
                if i >= k:
                    break
                paths_out.append([
                    {"id": nid,
                     "name": ents.get(nid, {}).get("name", nid),
                     "type": ents.get(nid, {}).get("type", "?")}
                    for nid in p
                ])
    except Exception:
        paths_out = []
    return {"paths": paths_out, "count": len(paths_out)}
