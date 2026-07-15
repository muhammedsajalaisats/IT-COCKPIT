"""
main.py — IT Cockpit FastAPI application entry point.

Phase 3.1: FastAPI boilerplate, CORS, base routes.
Phase 4.2: /api/v1/me endpoint — verifies Teams JWT extraction and returns
           the authenticated user's preferred_username (email).
Phase 5  : CORS tightened to explicit Vercel origin + Teams clients.
           PATCH added to allow_methods for task completion.
"""

import os
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from backend.routers import manageengine, m365
from backend.auth.teams_validator import get_current_user
from backend.database import check_db_connection

load_dotenv()

# ── CORS origins ──────────────────────────────────────────────────────────────
_FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "https://it-cockpit-frontend.vercel.app")

ALLOWED_ORIGINS: list[str] = [
    # ── Production ────────────────────────────────────────────────────────────
    # Explicit Vercel deployment URL (required — no wildcard support in
    # FastAPI's CORSMiddleware for subdomain patterns).
    "https://it-cockpit-frontend.vercel.app",
    # Also honour any override from the env var (e.g. a preview deployment URL)
    _FRONTEND_ORIGIN,
    # ── Local development ─────────────────────────────────────────────────────
    # Port 3000 is the configured Vite port (strictPort=true prevents shifting).
    # Ports 3001/3002 are included defensively for any stale dev-server instances
    # that were started before strictPort was enforced — they caused the 502 errors.
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:5173",  # Vite default port (fallback)
    # ── Microsoft Teams clients ───────────────────────────────────────────────
    # FastAPI CORSMiddleware does NOT support wildcard subdomains in allow_origins.
    # We list the known Teams origins explicitly.
    "https://teams.microsoft.com",
    "https://teams.cloud.microsoft",
    "https://local.teams.office.com",  # Teams desktop dev tools
]
# De-duplicate in case _FRONTEND_ORIGIN matches the hardcoded Vercel URL
ALLOWED_ORIGINS = list(dict.fromkeys(ALLOWED_ORIGINS))



# ── Lifespan (startup / shutdown) ────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[IT Cockpit] API starting up...")
    db_ok = await check_db_connection()
    print(f"[IT Cockpit] DB connection: {'[OK]' if db_ok else '[FAILED] check DATABASE_URL'}")
    yield
    print("[IT Cockpit] API shutting down.")


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="IT Cockpit API",
    description=(
        "Backend API for the Air India SATS IT Cockpit Teams App. "
        "Secured via Microsoft Teams SSO + On-Behalf-Of Graph API flow."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "If-Match", "X-Auth-Mode"],
    expose_headers=["ETag"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(
    manageengine.router,
    prefix="/api/v1/manageengine",
    tags=["ManageEngine"],
)
app.include_router(
    m365.router,
    prefix="/api/v1/m365",
    tags=["Microsoft 365"],
)


# ── Auth verification endpoint ────────────────────────────────────────────────
@app.get(
    "/api/v1/me",
    tags=["Authentication"],
    summary="Verify Teams token and return safe user profile",
    description=(
        "Validates the Bearer token (Teams SSO JWT) and returns the "
        "authenticated user's safe profile. The actual Graph token is "
        "**never** returned to the browser."
    ),
)
async def get_me(user: dict = Depends(get_current_user)):
    """
    Returns the currently authenticated user's profile.

    In local dev (APP_ENV=local) a mock user is returned.
    In production, the token is validated against Microsoft's JWKS and
    the OBO exchange is performed server-side.

    Response fields:
      email         — UPN / preferred_username
      name          — display name
      oid           — Azure AD Object ID
      has_graph_token — confirms the Graph token was obtained (not leaked)
    """
    return {
        "email":          user["email"],
        "name":           user["name"],
        "oid":            user.get("oid", ""),
        # Confirm the Graph token was obtained without leaking it
        "has_graph_token": bool(user.get("token")),
    }


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/api/health", tags=["Health"], summary="Health check")
async def health():
    """
    Public health endpoint. Does NOT disclose credentials, secrets,
    connection strings, or exception traces.
    """
    db_ok = await check_db_connection()
    return {
        "status":   "ok" if db_ok else "degraded",
        "service":  "IT Cockpit API",
        "database": "connected" if db_ok else "unreachable",
    }


@app.get("/", tags=["Health"])
async def root():
    return {
        "message": "IT Cockpit API is running",
        "docs":    "/docs",
        "health":  "/api/health",
        "me":      "/api/v1/me",
    }
