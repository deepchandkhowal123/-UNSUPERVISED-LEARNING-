"""NetworkTrace backend entry point.

Run from project root:
    uvicorn backend.main:app --reload --port 8000
or:
    python -m backend.main
"""
import time
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

from . import config
from .database import init_db, db_size
from .services import data_generator as dg
from .services import graph_engine as ge
from .routers import ROUTERS


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Boot: schema + seed data if empty
    init_db()
    ents, rels = db_size()
    if ents == 0:
        print(f"[boot] Seeding database ({config.NUM_ENTITIES} entities)...")
        dg.generate()
        ents, rels = db_size()
    ge.build_graph()
    print(f"[boot] Ready: {ents} entities, {rels} relationships")
    yield
    print("[boot] shutdown")


app = FastAPI(
    title="NetworkTrace API",
    version=config.APP_VERSION,
    description="Intelligence-network analysis platform — graph + ML analytics",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Lightweight per-request log: method + path + status + ms."""
    start = time.time()
    response = await call_next(request)
    ms = (time.time() - start) * 1000.0
    print(f"[req] {request.method} {request.url.path} -> {response.status_code} ({ms:.1f}ms)",
          flush=True)
    return response


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all for unexpected errors: return JSON 500 without leaking tracebacks."""
    return JSONResponse(
        {"detail": "Internal server error", "path": request.url.path},
        status_code=500,
    )


for r in ROUTERS:
    app.include_router(r)


@app.get("/api/health")
def health():
    ents, rels = db_size()
    return {"status": "ok", "app": config.APP_NAME,
            "version": config.APP_VERSION, "entities": ents, "relationships": rels}


# --- Serve frontend (single-page app) ---
FE = config.FRONTEND_DIR


@app.get("/")
def root():
    return FileResponse(str(FE / "index.html"))


# Static mounts for /css and /js
if (FE / "css").exists():
    app.mount("/css", StaticFiles(directory=str(FE / "css")), name="css")
if (FE / "js").exists():
    app.mount("/js", StaticFiles(directory=str(FE / "js")), name="js")


# SPA fallback: unknown non-API paths serve index.html
@app.exception_handler(404)
async def spa_fallback(request, exc):
    path = request.url.path
    if path.startswith("/api"):
        return JSONResponse({"detail": "Not found", "path": path}, status_code=404)
    idx = FE / "index.html"
    if idx.exists():
        return FileResponse(str(idx))
    return JSONResponse({"detail": "Frontend not built"}, status_code=404)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host=config.HOST, port=config.PORT, reload=True)
