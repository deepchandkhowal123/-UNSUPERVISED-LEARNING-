"""sklearn-powered ML: anomaly detection, link prediction, clustering."""
import json
import random
import numpy as np
from collections import defaultdict

from ..database import cursor
from . import graph_engine as ge


def _features():
    """Build a feature matrix: [risk, degree_in, degree_out, total_amount, type_encoded, flag_count]."""
    g = ge.build_graph()
    ents = ge.entity_map()
    ids = list(ents.keys())
    type_index = {t: i for i, t in enumerate(sorted({e["type"] for e in ents.values()}))}
    amt_by_src = defaultdict(float)
    with cursor() as c:
        c.execute("SELECT source_id, amount FROM relationships")
        for r in c.fetchall():
            amt_by_src[r["source_id"]] += r["amount"] or 0
    X, ids_out = [], []
    for nid in ids:
        e = ents[nid]
        flags = len(e.get("metadata", {}).get("flags", []))
        row = [
            e["risk_score"],
            g.in_degree(nid),
            g.out_degree(nid),
            np.log1p(amt_by_src.get(nid, 0)),
            type_index.get(e["type"], 0),
            flags,
        ]
        X.append(row)
        ids_out.append(nid)
    return np.array(X, dtype=float), ids_out, ents


def detect_anomalies(method: str = "isolation_forest", limit: int = 50):
    try:
        from sklearn.ensemble import IsolationForest
        from sklearn.neighbors import LocalOutlierFactor
    except Exception as e:
        return {"error": f"scikit-learn not available: {e}", "anomalies": []}
    X, ids, ents = _features()
    if len(X) < 4:
        return {"anomalies": []}
    scores = np.zeros(len(ids))
    if method == "isolation_forest":
        m = IsolationForest(n_estimators=120, contamination=0.08, random_state=42)
        labels = m.fit_predict(X)
        # anomaly score: -decision_function (higher = more anomalous)
        scores = -m.decision_function(X)
        mask = labels == -1
    elif method == "lof":
        m = LocalOutlierFactor(n_neighbors=20, contamination=0.08)
        labels = m.fit_predict(X)
        scores = -m.negative_outlier_factor_
        mask = labels == -1
    else:
        m = IsolationForest(n_estimators=100, contamination=0.10, random_state=42)
        labels = m.fit_predict(X)
        scores = -m.decision_function(X)
        mask = labels == -1

    rows = []
    for i, nid in enumerate(ids):
        if not mask[i]:
            continue
        e = ents[nid]
        rows.append({
            "entity_id": nid, "name": e["name"], "type": e["type"],
            "risk_score": e["risk_score"], "score": round(float(scores[i]), 4),
            "method": method,
            "reason": _explain(e, X[i]),
        })
    rows.sort(key=lambda r: r["score"], reverse=True)
    return {"method": method, "count": len(rows), "anomalies": rows[:limit]}


def _explain(e, feats):
    reasons = []
    if feats[0] >= 70:
        reasons.append("high baseline risk")
    if feats[1] >= 12:
        reasons.append(f"high inbound degree ({int(feats[1])})")
    if feats[2] >= 12:
        reasons.append(f"high outbound degree ({int(feats[2])})")
    if feats[3] >= 9:
        reasons.append("large aggregate transaction volume")
    if feats[5] >= 1:
        reasons.append(f"{int(feats[5])} compliance flag(s)")
    return "; ".join(reasons) if reasons else "unusual feature combination"


def link_prediction(entity_id: str = None, limit: int = 30):
    import networkx as nx
    g = ge.build_graph().to_undirected()
    ents = ge.entity_map()
    # candidate non-edges
    candidates = []
    nodes = list(g.nodes())
    rng = random.Random(7)
    if entity_id and entity_id in g:
        focal = entity_id
    else:
        # pick high-degree node
        focal = max(nodes, key=lambda n: g.degree(n)) if nodes else None
    if not focal:
        return {"predictions": [], "focal": None}
    focal_neighbors = set(g.neighbors(focal))
    sample = rng.sample(nodes, min(len(nodes), 400))
    for m in sample:
        if m == focal or g.has_edge(focal, m):
            continue
        common = len(focal_neighbors & set(g.neighbors(m)))
        if common == 0 and rng.random() < 0.7:
            continue
        candidates.append((focal, m))
        if len(candidates) >= limit * 3:
            break
    preds = []
    for s, t in candidates[:limit * 3]:
        try:
            aa = sum(1 / np.log(g.degree(z)) for z in nx.common_neighbors(g, s, t) if g.degree(z) > 1)
            jc = nx.jaccard_coefficient(g, [(s, t)])
            jc_val = next(jc)[2]
            pa = g.degree(s) * g.degree(t)
        except Exception:
            continue
        preds.append({"source_id": s, "target_id": t,
                      "s_name": ents.get(s, {}).get("name"), "t_name": ents.get(t, {}).get("name"),
                      "jaccard": round(jc_val, 4), "adamic_adar": round(aa, 4),
                      "preferential": int(pa), "score": round(jc_val + 0.3 * min(aa, 5) + np.log1p(pa) / 20, 4)})
    preds.sort(key=lambda p: p["score"], reverse=True)
    return {"focal": focal, "focal_name": ents.get(focal, {}).get("name"),
            "predictions": preds[:limit]}


def clusters(k: int = 8):
    from sklearn.cluster import KMeans
    X, ids, ents = _features()
    if len(X) < k:
        return {"clusters": []}
    km = KMeans(n_clusters=k, n_init=5, random_state=42)
    labels = km.fit_predict(X)
    groups = defaultdict(list)
    for nid, lab in zip(ids, labels):
        groups[int(lab)].append(nid)
    out = []
    for lab, members in groups.items():
        risks = [ents[m]["risk_score"] for m in members]
        types = [ents[m]["type"] for m in members]
        out.append({
            "cluster_id": lab, "size": len(members),
            "avg_risk": round(sum(risks) / len(risks), 2),
            "dominant_type": max(set(types), key=types.count),
            "sample": [{"id": m, "name": ents[m]["name"], "type": ents[m]["type"],
                        "risk_score": ents[m]["risk_score"]} for m in members[:6]],
        })
    out.sort(key=lambda c: c["size"], reverse=True)
    return {"k": k, "clusters": out}


def risk_distribution():
    ents = ge.entity_map()
    buckets = {"low (0-30)": 0, "medium (30-55)": 0, "high (55-75)": 0, "critical (75+)": 0}
    for e in ents.values():
        r = e["risk_score"]
        if r < 30: buckets["low (0-30)"] += 1
        elif r < 55: buckets["medium (30-55)"] += 1
        elif r < 75: buckets["high (55-75)"] += 1
        else: buckets["critical (75+)"] += 1
    return buckets


def top_flows(limit: int = 20):
    """Highest-value transfer relationships (potential layering)."""
    with cursor() as c:
        c.execute("SELECT source_id, target_id, amount, currency, occurred_at, rel_type "
                  "FROM relationships WHERE amount > 0 ORDER BY amount DESC LIMIT ?", (limit,))
        ents = ge.entity_map()
        rows = []
        for r in c.fetchall():
            rows.append({
                "source_id": r["source_id"], "target_id": r["target_id"],
                "s_name": ents.get(r["source_id"], {}).get("name"),
                "t_name": ents.get(r["target_id"], {}).get("name"),
                "amount": r["amount"], "currency": r["currency"],
                "occurred_at": r["occurred_at"], "rel_type": r["rel_type"]})
    return rows
