"""ML analytics endpoints."""
from fastapi import APIRouter, Depends, Query
from ..auth import get_current_user, User
from ..services import ml_engine as ml
from ..services import graph_engine as ge

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/anomalies")
def anomalies(method: str = "isolation_forest", limit: int = Query(50, le=200),
              user: User = Depends(get_current_user)):
    return ml.detect_anomalies(method, limit)


@router.get("/link-prediction")
def link_pred(entity_id: str = None, limit: int = 30, user: User = Depends(get_current_user)):
    return ml.link_prediction(entity_id, limit)


@router.get("/clusters")
def clusters(k: int = 8, user: User = Depends(get_current_user)):
    return ml.clusters(k)


@router.get("/risk-distribution")
def risk_dist(user: User = Depends(get_current_user)):
    return ml.risk_distribution()


@router.get("/top-flows")
def top_flows(limit: int = 20, user: User = Depends(get_current_user)):
    return {"items": ml.top_flows(limit)}


@router.get("/overview")
def overview(user: User = Depends(get_current_user)):
    """Dashboard summary combining stats + risk + top entities."""
    st = ge.stats()
    dist = ml.risk_distribution()
    top = ge.centrality(10)
    flows = ml.top_flows(8)
    return {"stats": st, "risk_distribution": dist, "top_entities": top, "top_flows": flows}


@router.get("/timeline")
def timeline(user: User = Depends(get_current_user)):
    """Monthly relationship volume + flow amount for temporal view."""
    from ..database import cursor
    with cursor() as c:
        c.execute(
            "SELECT substr(occurred_at,1,7) AS month, COUNT(*) AS n, "
            "COALESCE(SUM(amount),0) AS total "
            "FROM relationships GROUP BY month ORDER BY month")
        rows = [dict(r) for r in c.fetchall()]
    return {"items": rows}


@router.get("/geo")
def geo(user: User = Depends(get_current_user)):
    """Country-level entity + risk distribution for GeoINT view."""
    from ..database import cursor
    with cursor() as c:
        c.execute(
            "SELECT country, COUNT(*) AS entities, ROUND(AVG(risk_score),2) AS avg_risk, "
            "SUM(CASE WHEN risk_score>=70 THEN 1 ELSE 0 END) AS high_risk "
            "FROM entities GROUP BY country ORDER BY entities DESC")
        rows = [dict(r) for r in c.fetchall()]
    return {"items": rows}


@router.get("/heatmap")
def heatmap(user: User = Depends(get_current_user)):
    """Entity-type x risk-bucket matrix for the overview heatmap."""
    from ..database import cursor
    buckets = [("low", 0, 30), ("medium", 30, 55), ("high", 55, 75), ("critical", 75, 101)]
    with cursor() as c:
        c.execute("SELECT type, COUNT(*) AS n FROM entities GROUP BY type ORDER BY n DESC")
        types = [r["type"] for r in c.fetchall()]
        matrix = {}
        for t in types:
            matrix[t] = {}
            for label, lo, hi in buckets:
                c.execute("SELECT COUNT(*) AS n FROM entities WHERE type=? AND risk_score>=? AND risk_score<?",
                          (t, lo, hi))
                matrix[t][label] = c.fetchone()["n"]
    return {"types": types, "buckets": [b[0] for b in buckets], "matrix": matrix}


@router.get("/risk-factors")
def risk_factors(user: User = Depends(get_current_user)):
    """Correlation-style summary per entity type using graph degree."""
    g = ge.build_graph()
    ents = ge.entity_map()
    by_type = {}
    for eid, e in ents.items():
        by_type.setdefault(e["type"], []).append((eid, e))
    out = []
    for t, members in by_type.items():
        n = len(members)
        risks = [e["risk_score"] for _, e in members]
        degs = [g.degree(eid) for eid, _ in members]
        avg_degree = round(sum(degs) / max(1, n), 2)
        avg_risk = round(sum(risks) / max(1, n), 2)
        high = sum(1 for r in risks if r >= 70)
        high_pct = round(100.0 * high / max(1, n), 2)
        out.append({"type": t, "count": n, "avg_degree": avg_degree,
                    "avg_risk": avg_risk, "high_risk_pct": high_pct})
    out.sort(key=lambda x: x["count"], reverse=True)
    return {"items": out}
