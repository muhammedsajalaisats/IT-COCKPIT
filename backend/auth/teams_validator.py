"""
auth/teams_validator.py

Teams JWT validator and MSAL OBO (On-Behalf-Of) flow.
Phase 4 implementation — currently a passthrough for local dev.

In production:
  1. The Teams client sends a Teams SSO token in the Authorization header.
  2. This middleware validates the JWT signature against Microsoft's JWKS.
  3. It then exchanges the Teams token for a Graph API token via the OBO flow.
  4. The Graph token is used to call Microsoft Graph on behalf of the user.
"""

import os
import httpx
from jose import jwt, JWTError
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv

load_dotenv()

TENANT_ID    = os.getenv("AZURE_TENANT_ID", "")
CLIENT_ID    = os.getenv("AZURE_CLIENT_ID", "")
CLIENT_SECRET = os.getenv("AZURE_CLIENT_SECRET", "")
IS_LOCAL     = os.getenv("APP_ENV", "local") == "local"

bearer_scheme = HTTPBearer(auto_error=False)

GRAPH_SCOPE = "https://graph.microsoft.com/.default"


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(bearer_scheme)
) -> dict:
    """
    FastAPI dependency — validates the incoming token and returns user info.

    In local dev mode: accepts any token, returns a mock user.
    In production: validates Teams JWT and performs OBO exchange.
    """
    if IS_LOCAL:
        # ── Local dev passthrough ────────────────────────────────────────────
        return {
            "email": "it.admin@airsats.com",
            "name": "IT Admin (Local Dev)",
            "token": "mock-graph-token",
        }

    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing",
        )

    teams_token = credentials.credentials

    try:
        # ── Step 1: Decode Teams JWT (validation) ────────────────────────────
        # In production, fetch the JWKS from Microsoft and verify signature.
        # For now, we decode without verification to extract claims.
        # TODO Phase 4: Add full JWKS-based signature verification.
        claims = jwt.decode(
            teams_token,
            key="",
            options={"verify_signature": False, "verify_aud": False},
        )
        user_email = claims.get("preferred_username") or claims.get("upn", "")
        user_name  = claims.get("name", user_email)

    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Teams token: {e}",
        )

    # ── Step 2: OBO Flow — exchange Teams token for Graph token ──────────────
    graph_token = await _obo_exchange(teams_token)

    return {
        "email": user_email,
        "name": user_name,
        "token": graph_token,
    }


async def _obo_exchange(teams_token: str) -> str:
    """
    Exchange a Teams SSO token for a Microsoft Graph access token
    using the OAuth 2.0 On-Behalf-Of flow.
    """
    token_url = f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token"
    payload = {
        "grant_type":            "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "client_id":             CLIENT_ID,
        "client_secret":         CLIENT_SECRET,
        "assertion":             teams_token,
        "scope":                 "https://graph.microsoft.com/Mail.Read "
                                 "https://graph.microsoft.com/Tasks.Read "
                                 "https://graph.microsoft.com/Calendars.Read",
        "requested_token_use":   "on_behalf_of",
    }

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(token_url, data=payload)

    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"OBO exchange failed: {resp.text}",
        )

    return resp.json().get("access_token", "")
