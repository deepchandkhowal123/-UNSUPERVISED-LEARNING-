"""Bearer-token authentication backed by the configured database."""
import hashlib
import json
import secrets
from datetime import datetime, timedelta
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from . import config
from .database import cursor
from .models import User

bearer = HTTPBearer(auto_error=False)

# Predefined demo accounts (password == username for easy demo login).
_LOCAL_DEMO_USERS = {
    "analyst": {"password": "analyst", "role": "analyst", "display_name": "Field Analyst",
                "permissions": ["read", "search", "investigate"]},
    "investigator": {"password": "investigator", "role": "investigator", "display_name": "Lead Investigator",
                     "permissions": ["read", "search", "investigate", "evidence", "report"]},
    "manager": {"password": "manager", "role": "manager", "display_name": "Operations Manager",
                "permissions": ["read", "search", "investigate", "evidence", "report", "manage"]},
    "admin": {"password": "admin", "role": "admin", "display_name": "System Administrator",
              "permissions": ["read", "search", "investigate", "evidence", "report", "manage", "admin"]},
    "viewer": {"password": "viewer", "role": "viewer", "display_name": "Read-only Viewer",
               "permissions": ["read"]},
}

if config.IS_VERCEL:
    if not config.ADMIN_PASSWORD:
        raise RuntimeError("NT_ADMIN_PASSWORD is required for Vercel deployments.")
    DEMO_USERS = {
        config.ADMIN_USERNAME: {
            "password": config.ADMIN_PASSWORD,
            "role": "admin",
            "display_name": "System Administrator",
            "permissions": ["read", "search", "investigate", "evidence", "report", "manage", "admin"],
        }
    }
else:
    DEMO_USERS = _LOCAL_DEMO_USERS


def authenticate(username: str, password: str) -> User:
    rec = DEMO_USERS.get(username)
    if not rec or rec["password"] != password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return User(username=username, role=rec["role"], display_name=rec["display_name"],
                permissions=rec["permissions"])


def issue_token(user: User) -> str:
    token = secrets.token_urlsafe(32)
    expires_at = (datetime.utcnow() + timedelta(hours=12)).isoformat() + "Z"
    with cursor() as c:
        c.execute(
            "INSERT INTO auth_sessions "
            "(token_hash,username,role,display_name,permissions,expires_at) "
            "VALUES (?,?,?,?,?,?)",
            (hashlib.sha256(token.encode("utf-8")).hexdigest(), user.username,
             user.role, user.display_name, json.dumps(user.permissions), expires_at),
        )
    return token


def revoke_token(token: str):
    with cursor() as c:
        c.execute(
            "DELETE FROM auth_sessions WHERE token_hash = ?",
            (hashlib.sha256(token.encode("utf-8")).hexdigest(),),
        )


def token_expiration(token: str):
    with cursor() as c:
        c.execute(
            "SELECT expires_at FROM auth_sessions WHERE token_hash = ?",
            (hashlib.sha256(token.encode("utf-8")).hexdigest(),),
        )
        row = c.fetchone()
    return row["expires_at"] if row else None


def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> User:
    if not creds or creds.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = creds.credentials
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    user = None
    expired = False
    with cursor() as c:
        c.execute(
            "SELECT username,role,display_name,permissions,expires_at "
            "FROM auth_sessions WHERE token_hash = ?",
            (token_hash,),
        )
        record = c.fetchone()
        if record:
            expires_at = datetime.fromisoformat(record["expires_at"].replace("Z", "+00:00"))
            expired = datetime.now(expires_at.tzinfo) >= expires_at
        if expired:
            c.execute("DELETE FROM auth_sessions WHERE token_hash = ?", (token_hash,))
        elif record:
            user = User(
                username=record["username"],
                role=record["role"],
                display_name=record["display_name"],
                permissions=json.loads(record["permissions"]),
            )
    if expired:
        raise HTTPException(status_code=401, detail="Token expired")
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user


def require_permission(perm: str):
    def dep(user: User = Depends(get_current_user)) -> User:
        if perm not in user.permissions:
            raise HTTPException(status_code=403, detail=f"Requires '{perm}' permission")
        return user
    return dep
