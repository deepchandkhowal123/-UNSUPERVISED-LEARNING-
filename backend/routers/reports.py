"""Report generation: JSON + CSV exports saved to disk."""
import json
import csv
import uuid
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from ..config import REPORTS_DIR, EXPORTS_DIR
from ..models import ReportRequest, User
from ..auth import get_current_user, require_permission
from ..audit import log
from ..services import graph_engine as ge
from ..services import ml_engine as ml
from ..database import cursor, db_size

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.post("/generate")
def generate(body: ReportRequest, user: User = Depends(require_permission("report"))):
    rid = "RPT-" + uuid.uuid4().hex[:8].upper()
    payload = {"id": rid, "title": body.title, "generated_by": user.username,
               "sections": {}}
    if "summary" in body.sections:
        ents, rels = db_size()
        payload["sections"]["summary"] = {"entities": ents, "relationships": rels,
                                          "stats": ge.stats()}
    if "entities" in body.sections:
        with cursor() as c:
            c.execute("SELECT id,name,type,risk_score,country FROM entities ORDER BY risk_score DESC LIMIT 100")
            payload["sections"]["entities"] = [dict(r) for r in c.fetchall()]
    if "graph" in body.sections:
        payload["sections"]["graph"] = {"centrality": ge.centrality(20),
                                        "communities": ge.communities()[:10]}
    if "anomalies" in body.sections:
        payload["sections"]["anomalies"] = ml.detect_anomalies("isolation_forest", 30)
    path = REPORTS_DIR / f"{rid}.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    log(user, "report.generate", rid, body.title)
    return {"id": rid, "path": str(path), "sections": list(payload["sections"].keys())}


@router.get("/{rid}/download")
def download(rid: str, user: User = Depends(get_current_user)):
    path = REPORTS_DIR / f"{rid}.json"
    if not path.exists():
        raise HTTPException(404, "Report not found")
    return FileResponse(str(path), media_type="application/json",
                        filename=f"{rid}.json")


@router.get("")
def list_reports(user: User = Depends(get_current_user)):
    items = []
    for p in sorted(REPORTS_DIR.glob("*.json"), key=lambda x: x.stat().st_mtime, reverse=True):
        try:
            with open(p, encoding="utf-8") as f:
                d = json.load(f)
            items.append({"id": d.get("id"), "title": d.get("title"),
                          "generated_by": d.get("generated_by"),
                          "size": p.stat().st_size,
                          "modified": p.stat().st_mtime})
        except Exception:
            continue
    return {"items": items}


@router.post("/export/entities")
def export_entities(user: User = Depends(get_current_user)):
    """CSV export of all entities."""
    path = EXPORTS_DIR / f"entities_{uuid.uuid4().hex[:6]}.csv"
    with cursor() as c, open(path, "w", newline="", encoding="utf-8") as f:
        rows = c.execute("SELECT id,name,type,subtype,risk_score,country,region,created_at,last_seen FROM entities").fetchall()
        w = csv.writer(f)
        w.writerow([k for k in rows[0].keys()] if rows else ["id"])
        for r in rows:
            w.writerow([v for v in r])
    log(user, "export.entities", str(path))
    return FileResponse(str(path), media_type="text/csv", filename=path.name)
