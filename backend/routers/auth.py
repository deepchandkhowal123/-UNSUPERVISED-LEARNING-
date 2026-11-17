"""Authentication endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Request
from ..models import LoginRequest, Token
from ..auth import authenticate, issue_token, revoke_token, get_current_user, token_expiration, DEMO_USERS, User
from ..audit import log

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/accounts")
def demo_accounts():
    """List demo accounts for one-click login (dev convenience)."""
    return [{"username": u, "role": d["role"], "display_name": d["display_name"]}
            for u, d in DEMO_USERS.items()]


@router.post("/login", response_model=Token)
def login(body: LoginRequest):
    user = authenticate(body.username, body.password)
    token = issue_token(user)
    return Token(access_token=token, user=user)


def _bearer_token(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return ""


@router.post("/logout")
def logout(request: Request, user: User = Depends(get_current_user)):
    """Revoke the current bearer token server-side and audit the logout."""
    token = _bearer_token(request)
    if token:
        revoke_token(token)
    log(user, "auth.logout", user.username)
    return {"ok": True}


@router.get("/me")
def me(request: Request, user: User = Depends(get_current_user)):
    """Return the current user plus token expiry (ISO string)."""
    token = _bearer_token(request)
    return {
        "username": user.username,
        "role": user.role,
        "display_name": user.display_name,
        "permissions": user.permissions,
        "expires_at": token_expiration(token) if token else None,
    }
