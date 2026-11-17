"""Audit logging helper."""
from .database import cursor
from .models import now, User


def log(user, action: str, target: str = None, details: str = None):
    """Write an audit entry. `user` may be a models.User or None."""
    username = getattr(user, "username", None) if user else None
    role = getattr(user, "role", None) if user else None
    with cursor() as c:
        c.execute(
            "INSERT INTO audit_log (ts, username, role, action, target, details) VALUES (?,?,?,?,?,?)",
            (now(), username, role, action, target, details),
        )
