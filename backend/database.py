"""SQLite database layer (stdlib sqlite3 — no extra deps)."""
import sqlite3
import json
import threading
from contextlib import contextmanager
from . import config

_local = threading.local()


def get_conn() -> sqlite3.Connection:
    if not hasattr(_local, "conn"):
        conn = sqlite3.connect(str(config.DB_PATH), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA foreign_keys=ON;")
        _local.conn = conn
    return _local.conn


@contextmanager
def cursor():
    conn = get_conn()
    c = conn.cursor()
    try:
        yield c
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        c.close()


SCHEMA = """
CREATE TABLE IF NOT EXISTS entities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    subtype TEXT,
    risk_score REAL DEFAULT 0,
    country TEXT,
    region TEXT,
    created_at TEXT,
    last_seen TEXT,
    metadata TEXT
);
CREATE TABLE IF NOT EXISTS relationships (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    rel_type TEXT NOT NULL,
    weight REAL DEFAULT 1.0,
    amount REAL DEFAULT 0,
    currency TEXT,
    occurred_at TEXT,
    metadata TEXT,
    FOREIGN KEY (source_id) REFERENCES entities(id),
    FOREIGN KEY (target_id) REFERENCES entities(id)
);
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    username TEXT,
    role TEXT,
    action TEXT,
    target TEXT,
    details TEXT
);
CREATE TABLE IF NOT EXISTS investigations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    priority TEXT DEFAULT 'medium',
    description TEXT,
    assigned_to TEXT,
    created_by TEXT,
    created_at TEXT,
    updated_at TEXT,
    entity_ids TEXT
);
CREATE TABLE IF NOT EXISTS evidence (
    id TEXT PRIMARY KEY,
    investigation_id TEXT,
    entity_id TEXT,
    kind TEXT,
    content TEXT,
    created_by TEXT,
    created_at TEXT
);
CREATE TABLE IF NOT EXISTS entity_notes (
    id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL,
    author TEXT,
    content TEXT NOT NULL,
    created_at TEXT,
    FOREIGN KEY (entity_id) REFERENCES entities(id)
);
CREATE TABLE IF NOT EXISTS saved_searches (
    id TEXT PRIMARY KEY,
    owner TEXT NOT NULL,
    name TEXT NOT NULL,
    query TEXT,
    filters TEXT,
    created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_rel_source ON relationships(source_id);
CREATE INDEX IF NOT EXISTS idx_rel_target ON relationships(target_id);
CREATE INDEX IF NOT EXISTS idx_rel_type ON relationships(rel_type);
CREATE INDEX IF NOT EXISTS idx_ent_type ON entities(type);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(ts);
CREATE INDEX IF NOT EXISTS idx_note_entity ON entity_notes(entity_id);
CREATE INDEX IF NOT EXISTS idx_saved_search_owner ON saved_searches(owner);
"""


def init_db():
    with cursor() as c:
        for stmt in SCHEMA.split(";"):
            s = stmt.strip()
            if s:
                c.execute(s)


def db_size():
    with cursor() as c:
        c.execute("SELECT COUNT(*) AS n FROM entities")
        ents = c.fetchone()["n"]
        c.execute("SELECT COUNT(*) AS n FROM relationships")
        rels = c.fetchone()["n"]
    return ents, rels
