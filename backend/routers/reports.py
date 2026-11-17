"""Report generation: JSON reports in the database and CSV exports."""
import json
import csv
import uuid
from fastapi import APIRouter, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.responses import FileResponse, Response
from ..config import EXPORTS_DIR
from ..models import ReportRequest, User, now
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
    serialized = json.dumps(jsonable_encoder(payload), indent=2, ensure_ascii=False)
    created_at = now()
    with cursor() as c:
        c.execute(
            "INSERT INTO reports (id,title,generated_by,payload,created_at) VALUES (?,?,?,?,?)",
            (rid, body.title, user.username, serialized, created_at),
        )
    log(user, "report.generate", rid, body.title)
    return {"id": rid, "path": f"/api/reports/{rid}/download",
            "sections": list(payload["sections"].keys())}


@router.get("/{rid}/download")
def download(rid: str, user: User = Depends(get_current_user)):
    with cursor() as c:
        c.execute("SELECT payload FROM reports WHERE id = ?", (rid,))
        row = c.fetchone()
    if not row:
        raise HTTPException(404, "Report not found")
    return Response(
        content=row["payload"],
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{rid}.json"'},
    )


@router.get("")
def list_reports(user: User = Depends(get_current_user)):
    with cursor() as c:
        c.execute(
            "SELECT id,title,generated_by,payload,created_at "
            "FROM reports ORDER BY created_at DESC"
        )
        rows = c.fetchall()
    items = [{"id": row["id"], "title": row["title"],
              "generated_by": row["generated_by"],
              "size": len(row["payload"].encode("utf-8")),
              "modified": row["created_at"]} for row in rows]
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
