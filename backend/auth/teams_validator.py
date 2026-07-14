"""
auth/teams_validator.py

Phase 4.2 — Teams JWT Validator & Microsoft Graph OBO Flow.

Production flow:
  1. The Teams client sends a Teams SSO token in the Authorization header.
  2. validate_teams_token() fetches Microsoft's JWKS and verifies the JWT
     signature, audience, issuer, and expiry.
  3. _obo_exchange() uses the validated Teams token to call the Microsoft
     identity platform token endpoint and obtain a Graph API access token
     (On-Behalf-Of / RFC 7523 grant).
  4. The Graph token is returned to the calling route as part of the user dict.
     Routes can then call Microsoft Graph on behalf of the authenticated user.

Local dev mode:
  - APP_ENV=local → entire validation is bypassed; a mock user dict is returned
    so developers can work without a real Azure AD App Registration.

Verification criterion (Step 4.2):
  The backend can successfully intercept a token and extract the user's
  preferred_username (email).  Call GET /api/v1/me with a Bearer token to
  confirm this.
"""

import os
import time
import httpx

from jose import jwt, JWTError, ExpiredSignatureError
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv

load_dotenv()

# ── Config ────────────────────────────────────────────────────────────────────
TENANT_ID     = os.getenv("AZURE_TENANT_ID", "")
CLIENT_ID     = os.getenv("AZURE_CLIENT_ID", "")
CLIENT_SECRET = os.getenv("AZURE_CLIENT_SECRET", "")
IS_LOCAL      = os.getenv("APP_ENV", "local") == "local"

# Microsoft identity platform JWKS endpoint (tenant-specific).
# Falls back to common if no tenant is configured (useful for multi-tenant).
_JWKS_URL = (
    f"https://login.microsoftonline.com/{TENANT_ID}/discovery/v2.0/keys"
    if TENANT_ID
    else "https://login.microsoftonline.com/common/discovery/v2.0/keys"
)

_VALID_ISSUERS = [
    f"https://login.microsoftonline.com/{TENANT_ID}/v2.0",
    f"https://sts.windows.net/{TENANT_ID}/",
]

# ── JWKS in-memory cache (avoids fetching on every request) ──────────────────
_jwks_cache: dict = {}
_jwks_fetched_at: float = 0.0
_JWKS_TTL: int = 3600  # refresh every hour


async def _get_jwks() -> dict:
    """Return cached JWKS, refreshing if stale."""
    global _jwks_cache, _jwks_fetched_at
    if time.time() - _jwks_fetched_at > _JWKS_TTL:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(_JWKS_URL)
            resp.raise_for_status()
            _jwks_cache = resp.json()
            _jwks_fetched_at = time.time()
    return _jwks_cache


# ── Bearer scheme ─────────────────────────────────────────────────────────────
bearer_scheme = HTTPBearer(auto_error=False)


# ── Public dependency ─────────────────────────────────────────────────────────

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(bearer_scheme),
) -> dict:
    """
    FastAPI dependency — validates the incoming Bearer token.

    Returns:
        {
            "email":        str,   # preferred_username / UPN
            "name":         str,   # display name
            "token":        str,   # Graph access token (or mock in local dev)
            "oid":          str,   # Azure AD Object ID
            "is_local_dev": bool,  # True only in local mode
        }

    Raises:
        HTTP 401 — missing, expired, or invalid token
        HTTP 403 — token audience / issuer mismatch
    """
    # ── Local dev passthrough ─────────────────────────────────────────────────
    if IS_LOCAL:
        return {
            "email":        "it.admin@airsats.com",
            "name":         "IT Admin (Local Dev)",
            "token":        "mock-graph-token",
            "oid":          "00000000-0000-0000-0000-000000000000",
            "is_local_dev": True,
        }

    # ── Production: require token ─────────────────────────────────────────────
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing or malformed",
            headers={"WWW-Authenticate": "Bearer"},
        )

    teams_token = credentials.credentials
    claims = await _validate_teams_token(teams_token)
    graph_token = await _obo_exchange(teams_token)

    return {
        "email":        claims.get("preferred_username") or claims.get("upn", ""),
        "name":         claims.get("name", ""),
        "token":        graph_token,
        "oid":          claims.get("oid", ""),
        "is_local_dev": False,
    }


# ── Internal helpers ──────────────────────────────────────────────────────────

async def _validate_teams_token(teams_token: str) -> dict:
    """
    Validate the Teams SSO JWT:
      - Signature verified against Microsoft's JWKS
      - Audience must be our CLIENT_ID (api://<client-id>)
      - Issuer must match our tenant
      - Expiry checked automatically by python-jose

    Returns the decoded JWT claims dict.
    """
    if not CLIENT_ID:
        # No Azure config — decode without verification (not for production!)
        try:
            return jwt.decode(
                teams_token,
                key="",
                options={"verify_signature": False, "verify_aud": False},
            )
        except JWTError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Token decode failed (no Azure config): {exc}",
            )

    try:
        jwks = await _get_jwks()
        # python-jose accepts the full JWKS dict; it picks the matching key
        # via the 'kid' header in the token.
        claims = jwt.decode(
            teams_token,
            key=jwks,
            algorithms=["RS256"],
            audience=f"api://{CLIENT_ID}",
            options={"verify_exp": True},
        )
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Teams token has expired. Please re-authenticate.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Teams token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Issuer validation
    issuer = claims.get("iss", "")
    if _VALID_ISSUERS and not any(issuer.startswith(v) for v in _VALID_ISSUERS):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Token issuer '{issuer}' is not trusted.",
        )

    return claims


async def _obo_exchange(teams_token: str) -> str:
    """
    Exchange a validated Teams SSO token for a Microsoft Graph access token
    using the OAuth 2.0 On-Behalf-Of grant (RFC 7523).

    Scopes requested:
      - Mail.Read        — inbox triage widget
      - Tasks.ReadWrite  — Planner tasks widget
      - Calendars.Read   — calendar events widget
      - User.Read        — basic profile

    Returns the Graph access_token string.
    Raises HTTP 401 if the exchange fails (e.g. consent not granted).
    """
    if not all([TENANT_ID, CLIENT_ID, CLIENT_SECRET]):
        # Missing Azure config — caller should be in local dev mode.
        # This branch should not be reached in production.
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Azure AD config incomplete. Set AZURE_TENANT_ID, "
                   "AZURE_CLIENT_ID, and AZURE_CLIENT_SECRET in .env",
        )

    token_url = (
        f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token"
    )
    payload = {
        "grant_type":          "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "client_id":           CLIENT_ID,
        "client_secret":       CLIENT_SECRET,
        "assertion":           teams_token,
        "scope": (
            "https://graph.microsoft.com/Mail.Read "
            "https://graph.microsoft.com/Tasks.ReadWrite "
            "https://graph.microsoft.com/Calendars.Read "
            "https://graph.microsoft.com/User.Read"
        ),
        "requested_token_use": "on_behalf_of",
    }

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(token_url, data=payload)

    if resp.status_code == 200:
        return resp.json()["access_token"]

    err = resp.json()
    error_code = err.get("error", "unknown")
    error_desc = err.get("error_description", resp.text)

    # Differentiate consent-required errors from other failures
    if error_code in ("invalid_grant", "interaction_required"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=(
                "Graph consent required. Admin must grant API permissions "
                f"for this application: {error_desc}"
            ),
        )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=f"OBO token exchange failed [{error_code}]: {error_desc}",
    )
