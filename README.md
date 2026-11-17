# NetworkTrace — Intelligence Network Analysis Platform

A self-contained intelligence-analysis platform for mapping and investigating networks of people, organizations, accounts, and assets. Built with **FastAPI + NetworkX + scikit-learn** on the backend and a **vanilla JS single-page app** on the frontend. No build step, no Node toolchain — runs straight from VS Code.

> **v1.3** — Pro-grade redesign. Sophisticated **indigo** accent (`#6366f1`) replaces generic blue. Dark mode → **"Obsidian"** (`#0a0b0e` deep slate-black, brighter `#f5f7fa` text for high contrast). Light mode → **"Clean"** (`#fafbfc` warm white, deep `#0f1419` slate text). Glassmorphism topbar (`backdrop-filter: blur`), gradient brand logo + avatar chips, refined layered shadows, 12px card radius, gradient accent bars on hover, polished login hero with mesh gradient + glow, refined focus rings. Both themes verified — 0 console errors.

> **v1.2** — Full visual redesign. Refined "Midnight Slate" dark theme (slate-tinted, no harsh black) and "Warm Linen" light theme (warm off-white, rich charcoal text). Layered soft shadows, 12px card radius, polished sidebar with avatar + active accent bar, refined login hero with mesh gradient + glow, modern buttons/inputs/focus rings, smoother motion. Theme-color meta + early-paint synced to new palette.

> **v1.1** — UI overhaul (SVG icon system, donut/bar/line/gauge charts, split login, collapsible + mobile sidebar, notifications panel), upgraded graph explorer (zoom/pan/drag/glow/labels + controls), and new backend functions (entity timeline & relationships, analyst notes, saved searches, bulk tag, recalc-risk, graph relationship-types & multi-paths, system/stats, analytics/risk-factors, auth logout). CORS hardened, request logging + global error handler added.

---

## Features

- **Graph engine** (NetworkX): betweenness, PageRank, eigenvector centrality, greedy-modularity community detection, weak/strong components, bridges, articulation points, shortest paths, BFS subgraphs.
- **ML engine** (scikit-learn): Isolation Forest & Local Outlier Factor anomaly detection, Jaccard / Adamic-Adar / Preferential-Attachment link prediction, KMeans clustering.
- **16 working modules**: Overview, Network Explorer (interactive force-directed canvas), Entity Intelligence, Entity Detail, Community Detection, AI Analytics, Anomaly Detection, Temporal Analysis, GeoINT, Compare Entities, Investigations, Evidence, Watchlist, Reports, Audit Logs, Settings.
- **Pro UX**: redesigned analyst command-center overview, crisp SVG icon system, dark / light / auto theme toggle (topbar + Settings), command palette (`Ctrl+K`) for view jump + entity search, keyboard shortcuts (`?` help, `g`+letter nav, `t` theme, `s` collapse sidebar, `/` search, `b` bookmark), keyboard-operable navigation, breadcrumb navigation, loading skeletons, KPI sparklines, reusable **donut / bar / line / gauge** charts, risk×type heatmap, live activity feed, **notifications panel** with accurate critical-risk totals and recent audit, and a responsive mobile toolbar, dashboard grid, and collapsible sidebar.
- **Graph explorer v2**: force-directed canvas with **zoom (scroll), pan (drag background), node drag, high-risk glow, label toggle, zoom/reset controls**.
- **Entity notes**: append analyst notes to any entity (server-stored, audited).
- **Saved searches**: save and re-apply entity filter sets per user.
- **Bulk tag**: managers can update risk / metadata for many entities at once.
- **Recalc risk**: recompute an entity's risk from graph degree + anomaly signals.
- **Watchlist**: bookmark any entity from the table or detail page (★ star or `B` key); stored in localStorage with a live sidebar badge.
- **Entity comparison**: side-by-side profile + metrics (risk, degree, volume, flags) for any two entities.
- **RBAC**: 5 demo roles (admin / manager / investigator / analyst / viewer) with permission-gated endpoints.
- **Case management**: investigations with status workflow + evidence attachments.
- **Reporting**: JSON report generation + CSV entity export.
- **Audit trail**: every authenticated action is logged; paginated retrieval.
- **Hardened backend**: CORS-safe config, per-request logging middleware, global exception handler (no traceback leaks).
- **Synthetic dataset**: ~1,600 entities and ~6,000 relationships across 9 entity types and 15 jurisdictions, generated deterministically from a fixed seed.

---

## Project structure

```
networktrace/
├── backend/
│   ├── __init__.py
│   ├── main.py              # FastAPI app + lifespan + static serving
│   ├── config.py            # settings (host, port, data scale)
│   ├── database.py          # SQLite schema + helpers
│   ├── models.py            # Pydantic schemas
│   ├── auth.py              # token auth + RBAC
│   ├── audit.py             # audit logging
│   ├── requirements.txt
│   ├── services/
│   │   ├── data_generator.py  # synthetic dataset generation
│   │   ├── graph_engine.py    # NetworkX analysis (cached)
│   │   └── ml_engine.py       # sklearn anomaly/link/cluster
│   └── routers/
│       ├── auth.py  entities.py  graph.py  analytics.py
│       ├── search.py  investigations.py  reports.py  system.py
├── frontend/
│   ├── index.html           # SPA shell + login screen
│   ├── css/style.css        # dark intelligence dashboard theme
│   └── js/
│       ├── app.js           # API client, router, auth, UI helpers, canvas graph
│       └── views/           # 14 view modules
├── index.py                 # Vercel FastAPI entrypoint
├── requirements.txt         # Root dependency manifest for Vercel
├── run.sh                   # Linux / macOS launcher
├── run.bat                  # Windows launcher
├── README.md
└── .gitignore
```

---

## Quick start (VS Code)

### Option A — one-command launcher

**Linux / macOS**
```bash
cd networktrace
chmod +x run.sh
./run.sh
```

**Windows**
```bat
cd networktrace
run.bat
```

The script installs dependencies and starts the server. On first launch it seeds the SQLite database (~5 seconds).

### Option B — manual

```bash
cd networktrace
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

Then open **http://127.0.0.1:8000** in your browser.

### Vercel deployment

The root `index.py` exposes the FastAPI app to Vercel. Configure a persistent PostgreSQL database and set `DATABASE_URL`, `NT_ADMIN_USERNAME`, and a strong `NT_ADMIN_PASSWORD` in Vercel Project Settings before deploying. Production disables the public demo accounts and stores sessions and generated reports in PostgreSQL.

```bash
vercel --prod
```

Local development continues to use SQLite and the built-in demo accounts. Vercel deployments require `DATABASE_URL` and `NT_ADMIN_PASSWORD`; generated CSV exports use temporary storage only while the download is being prepared.

---

## VS Code tips

1. Open the `networktrace/` folder (File → Open Folder).
2. Recommended **Python** extension (Microsoft).
3. Pick the Python interpreter you installed dependencies into (Ctrl+Shift+P → "Python: Select Interpreter").
4. To debug: create `.vscode/launch.json`:
   ```json
   {
     "version": "0.2.0",
     "configurations": [{
       "name": "NetworkTrace",
       "type": "python",
       "request": "launch",
       "module": "uvicorn",
       "args": ["backend.main:app", "--reload", "--port", "8000"],
       "cwd": "${workspaceFolder}"
     }]
   }
   ```
5. Hit **F5** to start in the debugger. Open http://127.0.0.1:8000.

---

## Demo accounts

Password equals the username.

| Username        | Role           | Permissions                              |
|-----------------|----------------|------------------------------------------|
| `admin`         | admin          | everything                               |
| `manager`       | manager        | read, search, investigate, evidence, report, manage |
| `investigator`  | investigator   | read, search, investigate, evidence, report |
| `analyst`       | analyst        | read, search, investigate                |
| `viewer`        | viewer         | read                                     |

On the login screen you can also click any demo chip for one-click sign-in.

---

## API reference

All endpoints are under `/api` and require a `Authorization: Bearer <token>` header (except `/api/auth/login` and `/api/auth/accounts`).

| Method | Path | Description |
|--------|------|-------------|
| POST   | `/api/auth/login` | Authenticate, returns token + user |
| POST   | `/api/auth/logout` | Revoke current token |
| GET    | `/api/auth/me` | Current user + token expiry |
| GET    | `/api/auth/me` | Current user |
| GET    | `/api/entities` | Paginated, filterable entity list; `min_risk` / `max_risk` are 0–100 and minimum must not exceed maximum |
| GET    | `/api/entities/{id}` | Entity detail |
| PATCH  | `/api/entities/{id}` | Update entity (name / risk / metadata) |
| GET    | `/api/entities/{id}/neighbors` | Linked entities |
| GET    | `/api/entities/{id}/subgraph` | BFS neighborhood for visualization |
| GET    | `/api/entities/{id}/timeline` | Per-entity monthly activity |
| GET    | `/api/entities/{id}/relationships` | Paginated relationships (in/out/both) |
| POST   | `/api/entities/{id}/notes` | Add analyst note |
| GET    | `/api/entities/{id}/notes` | List notes |
| DELETE | `/api/entities/notes/{note_id}` | Delete note |
| POST   | `/api/entities/bulk/tag` | Bulk update risk/metadata (manage) |
| POST   | `/api/entities/{id}/recalc-risk` | Recompute risk from graph signals (investigate) |
| GET    | `/api/graph/stats` | Network statistics |
| GET    | `/api/graph/centrality` | Betweenness / PageRank / eigenvector |
| GET    | `/api/graph/communities` | Detected communities |
| GET    | `/api/graph/structural` | Bridges + articulation points |
| GET    | `/api/graph/path?src=&tgt=` | Shortest path |
| GET    | `/api/graph/paths?src=&tgt=&k=` | Multiple shortest paths |
| GET    | `/api/graph/relationship-types` | Relationship types + counts |
| GET    | `/api/analytics/overview` | Dashboard summary |
| GET    | `/api/analytics/anomalies?method=` | IF / LOF anomalies |
| GET    | `/api/analytics/link-prediction` | Predicted hidden links |
| GET    | `/api/analytics/clusters?k=` | KMeans clusters |
| GET    | `/api/analytics/timeline` | Monthly activity |
| GET    | `/api/analytics/geo` | Country distribution |
| GET    | `/api/analytics/top-flows` | Highest-value transfers |
| GET    | `/api/analytics/risk-factors` | Per-type risk/degree correlation |
| GET    | `/api/search?q=` | Unified search |
| GET/POST | `/api/investigations` | List / create cases |
| GET/PATCH | `/api/investigations/{id}` | Case detail / status |
| POST   | `/api/investigations/evidence` | Attach evidence |
| POST   | `/api/reports/generate` | Generate JSON report |
| GET    | `/api/reports/{id}/download` | Download report |
| POST   | `/api/reports/export/entities` | CSV export |
| GET    | `/api/system/status` | System status |
| GET    | `/api/system/stats` | Rich system statistics (db size, counts, uptime) |
| GET/POST/DELETE | `/api/system/saved-searches` | Saved searches CRUD (per user) |
| POST   | `/api/system/regenerate` | Re-seed dataset (manage perm) |
| GET    | `/api/system/audit` | Audit log |

Interactive docs at **http://127.0.0.1:8000/docs** (Swagger UI).

---

## Configuration

Environment variables (all optional):

| Variable | Default | Meaning |
|----------|---------|---------|
| `NT_HOST` | `127.0.0.1` | Bind host |
| `NT_PORT` | `8000` | Bind port |
| `NT_NUM_ENTITIES` | `1600` | Synthetic entity count |
| `NUM_RELATIONSHIPS` | `6000` | Synthetic relationship count |
| `NT_SEED` | `42` | RNG seed (deterministic data) |
| `NT_SECRET` | `networktrace-dev-secret` | Token signing secret |

---

## Tech stack

- **Backend**: FastAPI, Uvicorn, SQLite (stdlib `sqlite3`), Pydantic v2
- **Graph**: NetworkX 3.x
- **ML**: scikit-learn (IsolationForest, LOF, KMeans), NumPy
- **Frontend**: vanilla HTML/CSS/JS — no framework, no bundler

---

## Notes

- The dataset is **fully synthetic** and deterministic (seed = 42). No real persons or organizations are represented.
- The database (`backend/networktrace.db`) is created on first run. Delete it and restart, or use Settings → Regenerate, to rebuild.
- This is a development-quality build intended for learning, prototyping and demos — not production use.
