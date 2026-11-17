"""Central configuration for NetworkTrace backend."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent  # networktrace/
BACKEND_DIR = BASE_DIR / "backend"
FRONTEND_DIR = BASE_DIR / "frontend"
IS_VERCEL = os.environ.get("VERCEL") == "1"
if IS_VERCEL:
    DATA_DIR = Path(os.environ.get("NT_DATA_DIR", "/tmp/networktrace"))
    DB_PATH = DATA_DIR / "networktrace.db"
    REPORTS_DIR = DATA_DIR / "reports"
    EXPORTS_DIR = DATA_DIR / "exports"
else:
    DB_PATH = BACKEND_DIR / "networktrace.db"
    REPORTS_DIR = BASE_DIR / "reports"
    EXPORTS_DIR = BASE_DIR / "exports"

for d in (REPORTS_DIR, EXPORTS_DIR):
    d.mkdir(parents=True, exist_ok=True)

# In-memory session token store lives in auth.py; nothing persistent needed.
APP_NAME = "NetworkTrace"
APP_VERSION = "1.1.0"
SECRET = os.environ.get("NT_SECRET", "networktrace-dev-secret")

# CORS / static serving
HOST = os.environ.get("NT_HOST", "127.0.0.1")
PORT = int(os.environ.get("NT_PORT", "8000"))

# Synthetic data scale
NUM_ENTITIES = int(os.environ.get("NT_NUM_ENTITIES", "1600"))
NUM_RELATIONSHIPS = int(os.environ.get("NUM_RELATIONSHIPS", "6000"))
SEED = int(os.environ.get("NT_SEED", "42"))
