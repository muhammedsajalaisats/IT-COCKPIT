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
  - The frontend sends "local_mock_token" as the Bearer value.
    Any token starting with "local_" is accepted as a recognised sentinel.

Verification criterion (Step 4.2):
  The backend can successfully intercept a token and extract the user's
  preferred_username (email).  Call GET /api/v1/me with a Bearer token to
  confirm this.
"""

import os
import time
import httpx

from jose import jwt, JWTError, ExpiredSignatureError
from fastapi import HTTPException, Request, Security, status
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

# ── Local dev sentinel token prefix ──────────────────────────────────────────
# The frontend sends "local_mock_token" in local dev mode.  Any token that
# starts with this prefix is recognised as a local dev sentinel and bypasses
# MSAL validation when APP_ENV=local.
_LOCAL_TOKEN_PREFIX = "local_"
# Legacy mock token from earlier useTeamsAuth versions — also accepted.
_LEGACY_MOCK_TOKEN  = "mock-jwt-token-for-local-dev"


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
    request: Request,
    credentials: HTTPAuthorizationCredentials = Security(bearer_scheme),
) -> dict:
    """
    FastAPI dependency — validates the incoming Bearer token.

    Token paths:
      1. APP_ENV=local + no token / "local_" prefix sentinel:
         → Return hardcoded mock user (zero network calls). Fast local testing.

      2. APP_ENV=local + X-Auth-Mode: msal-direct (real Entra ID token):
         → Decode JWT without signature verification (local trust boundary).
         → Extract real user claims (email, name, oid) from the token.
         → Use the token directly as a Graph access token (no OBO exchange).
         → This gives live M365 data in the local browser.

      3. Production (APP_ENV != local):
         → Full JWKS signature validation + OBO exchange.

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
    try:
        is_local  = os.getenv("APP_ENV", "local") == "local"
        auth_mode = request.headers.get("X-Auth-Mode", "")
        token_str = credentials.credentials if credentials else ""

        # ── Path 1: Local mock sentinel ───────────────────────────────────────
        # Quick bypass for local iteration without any browser login.
        if is_local and (
            not token_str 
            or token_str.startswith(_LOCAL_TOKEN_PREFIX) 
            or token_str in ("mock-graph-token", _LEGACY_MOCK_TOKEN)
        ):
            return {
                "email":        "it.admin@airsats.com",
                "name":         "IT Admin (Local Dev)",
                "token":        "mock-graph-token",
                "oid":          "00000000-0000-0000-0000-000000000000",
                "is_local_dev": True,
            }

        # ── Path 2: MSAL direct pass-through (local browser login) ───────────
        # If is_local is set, we assume any incoming token (that isn't a mock sentinel)
        # is already a valid Graph access token. We bypass OBO exchange entirely.
        if is_local and token_str:
            email = "local.user@airsats.com"
            name = "Local User"
            oid = "00000000-0000-0000-0000-000000000000"
            try:
                # Best-effort decode of claims without signature/expiry validation.
                # If the token is opaque to us (common for some Graph access tokens),
                # we fall back to generic claims but still use the token.
                claims = jwt.decode(
                    token_str,
                    key="",
                    options={
                        "verify_signature": False,
                        "verify_aud":       False,
                        "verify_exp":       False,
                    },
                    algorithms=["RS256"],
                )
                email = (
                    claims.get("preferred_username")
                    or claims.get("unique_name")
                    or claims.get("upn")
                    or claims.get("email")
                    or email
                )
                name = claims.get("name", email.split("@")[0] if email else name)
                oid = claims.get("oid", oid)
            except Exception as exc:
                # Log warning but do not fail; the token is passed directly to Graph.
                print(f"[useTeamsAuth Backend] Opaque/non-JWT token received. Using best-effort fallback. Error: {exc}")

            return {
                "email":        email,
                "name":         name,
                "token":        token_str,   # pass-through: already a Graph token
                "oid":          oid,
                "is_local_dev": True,
            }

        # ── Path 3: Production — full JWKS + OBO ─────────────────────────────
        if not credentials:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authorization header missing or malformed",
                headers={"WWW-Authenticate": "Bearer"},
            )

        teams_token = credentials.credentials
        claims      = await _validate_teams_token(teams_token)
        graph_token = await _obo_exchange(teams_token)

        return {
            "email":        claims.get("preferred_username") or claims.get("upn", ""),
            "name":         claims.get("name", ""),
            "token":        graph_token,
            "oid":          claims.get("oid", ""),
            "is_local_dev": False,
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {type(exc).__name__}: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )



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
