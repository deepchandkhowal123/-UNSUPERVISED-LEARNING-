"""SQLite for local development and PostgreSQL for persistent deployments."""
import sqlite3
import json
import re
import threading
from contextlib import contextmanager
from . import config

_local = threading.local()
_pool = None
_pool_lock = threading.Lock()


def _get_pool():
    global _pool
    if _pool is None:
        with _pool_lock:
            if _pool is None:
                from psycopg.rows import dict_row
                from psycopg_pool import ConnectionPool
                _pool = ConnectionPool(
                    conninfo=config.DATABASE_URL,
                    min_size=1,
                    max_size=5,
                    kwargs={"row_factory": dict_row},
                    open=False,
                )
                _pool.open(wait=False)
    return _pool


class _PostgresCursor:
    def __init__(self, cursor):
        self._cursor = cursor

    @staticmethod
    def _sql(query, params):
        if isinstance(params, dict):
            query = re.sub(r":([A-Za-z_][A-Za-z0-9_]*)", r"%(\1)s", query)
        else:
            query = query.replace("?", "%s")
        return query.replace(
            "ROUND(AVG(risk_score),2)",
            "ROUND(AVG(risk_score)::numeric,2)",
        )

    def execute(self, query, params=()):
        self._cursor.execute(self._sql(query, params), params)
        return self

    def executemany(self, query, seq):
        rows = list(seq)
        if rows:
            self._cursor.executemany(self._sql(query, rows[0]), rows)
        return self

    def __getattr__(self, name):
        return getattr(self._cursor, name)


def get_conn():
    if config.DATABASE_URL:
        raise RuntimeError("PostgreSQL connections are managed through cursor().")
    if not hasattr(_local, "conn"):
        conn = sqlite3.connect(str(config.DB_PATH), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA foreign_keys=ON;")
        _local.conn = conn
    return _local.conn


@contextmanager
def cursor():
    if config.DATABASE_URL:
        with _get_pool().connection() as conn:
            c = conn.cursor()
            try:
                yield _PostgresCursor(c)
            finally:
                c.close()
        return
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
CREATE TABLE IF NOT EXISTS auth_sessions (
    token_hash TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    role TEXT NOT NULL,
    display_name TEXT NOT NULL,
    permissions TEXT NOT NULL,
    expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions(expires_at);
CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    generated_by TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at);
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
                if config.DATABASE_URL:
                    s = s.replace(
                        "INTEGER PRIMARY KEY AUTOINCREMENT",
                        "BIGSERIAL PRIMARY KEY",
                    )
                c.execute(s)


def db_size():
    with cursor() as c:
        c.execute("SELECT COUNT(*) AS n FROM entities")
        ents = c.fetchone()["n"]
        c.execute("SELECT COUNT(*) AS n FROM relationships")
        rels = c.fetchone()["n"]
    return ents, rels
