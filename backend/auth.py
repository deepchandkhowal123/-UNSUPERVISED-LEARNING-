"""Simple token-based auth (no external JWT lib needed)."""
import secrets
import threading
from datetime import datetime, timedelta
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from .models import User, now

bearer = HTTPBearer(auto_error=False)

# Predefined demo accounts (password == username for easy demo login).
DEMO_USERS = {
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

_lock = threading.Lock()
TOKENS = {}  # token -> {user: User, expires: datetime}


def authenticate(username: str, password: str) -> User:
    rec = DEMO_USERS.get(username)
    if not rec or rec["password"] != password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return User(username=username, role=rec["role"], display_name=rec["display_name"],
                permissions=rec["permissions"])


def issue_token(user: User) -> str:
    token = secrets.token_urlsafe(32)
    with _lock:
        TOKENS[token] = {"user": user, "expires": datetime.utcnow() + timedelta(hours=12)}
    return token


def revoke_token(token: str):
    with _lock:
        TOKENS.pop(token, None)


def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> User:
    if not creds or creds.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = creds.credentials
    with _lock:
        rec = TOKENS.get(token)
        if not rec:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        if datetime.utcnow() > rec["expires"]:
            TOKENS.pop(token, None)
            raise HTTPException(status_code=401, detail="Token expired")
        return rec["user"]


def require_permission(perm: str):
    def dep(user: User = Depends(get_current_user)) -> User:
        if perm not in user.permissions:
            raise HTTPException(status_code=403, detail=f"Requires '{perm}' permission")
        return user
    return dep
