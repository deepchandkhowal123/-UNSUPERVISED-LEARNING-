"""NetworkX-powered graph analysis with lazy load + caching."""
import json
import threading
from datetime import datetime
import networkx as nx

from ..database import cursor

_lock = threading.Lock()
_CACHE = {"graph": None, "built_at": None, "entities": None}


def _row_to_entity(row):
    d = dict(row)
    try:
        d["metadata"] = json.loads(d.get("metadata") or "{}")
    except Exception:
        d["metadata"] = {}
    return d


def _load_entities():
    with cursor() as c:
        c.execute("SELECT * FROM entities")
        rows = c.fetchall()
    ents = {r["id"]: _row_to_entity(r) for r in rows}
    return ents


def build_graph(force: bool = False) -> nx.DiGraph:
    with _lock:
        if _CACHE["graph"] and not force:
            return _CACHE["graph"]
        ents = _load_entities()
        g = nx.DiGraph()
        for eid, e in ents.items():
            g.add_node(eid, **{k: v for k, v in e.items() if k != "metadata"})
        with cursor() as c:
            c.execute("SELECT * FROM relationships")
            for r in c.fetchall():
                if r["source_id"] in ents and r["target_id"] in ents:
                    g.add_edge(r["source_id"], r["target_id"],
                               id=r["id"], rel_type=r["rel_type"], weight=r["weight"],
                               amount=r["amount"], currency=r["currency"], occurred_at=r["occurred_at"])
        _CACHE["graph"] = g
        _CACHE["entities"] = ents
        _CACHE["built_at"] = datetime.utcnow().isoformat() + "Z"
        return g


def entity_map():
    if _CACHE["entities"] is None:
        build_graph()
    return _CACHE["entities"]


def stats():
    g = build_graph()
    ents = entity_map()
    undirected = g.to_undirected()
    try:
        comp_count = nx.number_connected_components(undirected)
        largest_cc = max((len(c) for c in nx.connected_components(undirected)), default=0)
    except Exception:
        comp_count, largest_cc = 0, 0
    try:
        scc_count = nx.number_strongly_connected_components(g)
    except Exception:
        scc_count = 0
    type_counts = {}
    for e in ents.values():
        type_counts[e["type"]] = type_counts.get(e["type"], 0) + 1
    avg_risk = round(sum(e["risk_score"] for e in ents.values()) / max(1, len(ents)), 2)
    high_risk = sum(1 for e in ents.values() if e["risk_score"] >= 70)
    return {
        "nodes": g.number_of_nodes(),
        "edges": g.number_of_edges(),
        "density": round(nx.density(g), 5),
        "components": comp_count,
        "largest_component": largest_cc,
        "scc_count": scc_count,
        "type_counts": type_counts,
        "avg_risk": avg_risk,
        "high_risk_count": high_risk,
        "avg_degree": round(g.number_of_edges() / max(1, g.number_of_nodes()), 2),
        "built_at": _CACHE["built_at"],
    }


def _safe_centrality(g, func, *args, **kwargs):
    try:
        return func(g, *args, **kwargs)
    except Exception:
        return {}


def centrality(limit: int = 50):
    g = build_graph()
    ents = entity_map()
    betw = _safe_centrality(g, nx.betweenness_centrality, k=min(200, g.number_of_nodes()), weight="weight")
    pr = _safe_centrality(g, nx.pagerank, alpha=0.85)
    try:
        eig = nx.eigenvector_centrality_numpy(g.to_undirected())
    except Exception:
        eig = {}
    rows = []
    for nid, deg in g.degree():
        e = ents.get(nid, {})
        rows.append({
            "entity_id": nid,
            "name": e.get("name", nid),
            "type": e.get("type", "?"),
            "risk_score": e.get("risk_score", 0),
            "betweenness": round(betw.get(nid, 0), 6),
            "pagerank": round(pr.get(nid, 0), 6),
            "eigenvector": round(eig.get(nid, 0), 6),
            "degree": deg,
        })
    rows.sort(key=lambda r: r["pagerank"], reverse=True)
    return rows[:limit]


def communities():
    g = build_graph()
    ents = entity_map()
    und = g.to_undirected()
    try:
        comms = nx.community.greedy_modularity_communities(und, resolution=1)
    except Exception:
        comms = []
    out = []
    for i, members in enumerate(comms):
        members = list(members)
        if len(members) < 2:
            continue
        risks = [ents[m]["risk_score"] for m in members if m in ents]
        # top by degree
        degs = sorted(((g.degree(m), m) for m in members), reverse=True)
        top = degs[0][1] if degs else members[0]
        out.append({
            "community_id": i,
            "size": len(members),
            "members": members[:25],
            "top_entity": top,
            "avg_risk": round(sum(risks) / max(1, len(risks)), 2),
        })
    out.sort(key=lambda c: c["size"], reverse=True)
    return out[:20]


def neighbors(entity_id: str, limit: int = 50):
    g = build_graph()
    ents = entity_map()
    if entity_id not in g:
        return {"entity": None, "neighbors": []}
    e = ents.get(entity_id)
    out_n = []
    for nbr in g.neighbors(entity_id):
        data = g.get_edge_data(entity_id, nbr)
        ne = ents.get(nbr, {})
        out_n.append({"id": nbr, "name": ne.get("name"), "type": ne.get("type"),
                      "risk_score": ne.get("risk_score", 0), "direction": "out",
                      "rel_type": data.get("rel_type"), "amount": data.get("amount", 0)})
    for nbr in g.predecessors(entity_id):
        data = g.get_edge_data(nbr, entity_id)
        ne = ents.get(nbr, {})
        out_n.append({"id": nbr, "name": ne.get("name"), "type": ne.get("type"),
                      "risk_score": ne.get("risk_score", 0), "direction": "in",
                      "rel_type": data.get("rel_type"), "amount": data.get("amount", 0)})
    return {"entity": e, "neighbors": out_n[:limit]}


def shortest_path(src: str, tgt: str):
    g = build_graph()
    ents = entity_map()
    try:
        path = nx.shortest_path(g.to_undirected(), src, tgt)
    except Exception:
        return {"path": None, "length": 0}
    return {"path": path, "length": len(path) - 1,
            "entities": [ents.get(p, {"id": p}) for p in path]}


def subgraph(entity_id: str, depth: int = 2, limit: int = 120):
    """BFS subgraph around an entity."""
    g = build_graph()
    ents = entity_map()
    und = g.to_undirected()
    if entity_id not in und:
        return {"nodes": [], "edges": [], "center": entity_id}
    visited = {entity_id}
    frontier = {entity_id}
    edges = []
    for _ in range(depth):
        nxt = set()
        for n in frontier:
            for m in und.neighbors(n):
                if m not in visited:
                    nxt.add(m)
                    edges.append((n, m))
                    if len(visited) + len(nxt) > limit:
                        break
            if len(visited) + len(nxt) > limit:
                break
        visited |= nxt
        frontier = nxt
        if not frontier:
            break
    nodes = []
    for nid in visited:
        e = ents.get(nid, {"id": nid})
        nodes.append({"id": nid, "name": e.get("name"), "type": e.get("type"),
                      "risk_score": e.get("risk_score", 0), "country": e.get("country")})
    edge_objs = []
    for s, t in edges:
        d = g.get_edge_data(s, t) or g.get_edge_data(t, s) or {}
        edge_objs.append({"source": s, "target": t, "rel_type": d.get("rel_type"),
                          "amount": d.get("amount", 0), "weight": d.get("weight", 1)})
    return {"nodes": nodes, "edges": edge_objs, "center": entity_id}


def structural_items():
    """Bridges + articulation points (undirected)."""
    g = build_graph()
    ents = entity_map()
    und = g.to_undirected()
    bridges, artic = [], []
    try:
        bridges = list(nx.bridges(und))[:50]
        artic = list(nx.articulation_points(und))[:50]
    except Exception:
        pass
    return {
        "bridges": [{"source": s, "target": t,
                     "s_name": ents.get(s, {}).get("name"), "t_name": ents.get(t, {}).get("name")}
                    for s, t in bridges],
        "articulation_points": [{"id": a, "name": ents.get(a, {}).get("name"),
                                 "type": ents.get(a, {}).get("type"),
                                 "degree": g.degree(a)} for a in artic],
    }
