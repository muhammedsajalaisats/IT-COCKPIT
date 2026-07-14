"""
main.py — IT Cockpit FastAPI application entry point.

Phase 3.1: FastAPI boilerplate, CORS, base routes.
Phase 4.2: /api/v1/me endpoint added — verifies Teams JWT extraction works
           and returns the authenticated user's preferred_username (email).
"""

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware

from routers import manageengine, m365
from auth.teams_validator import get_current_user
from database import check_db_connection


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
# Teams clients and local dev origins only.
# Tighten allow_origins to your exact Teams app domain in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",          # Vite dev server (alt port)
        "http://localhost:5173",          # Vite default port
        "https://*.teams.microsoft.com",  # Teams desktop / web client
        "https://*.teams.cloud.microsoft",
        "https://*.skype.com",            # Teams legacy endpoints
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
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


# ── Auth verification endpoint (Phase 4.2) ────────────────────────────────────
@app.get(
    "/api/v1/me",
    tags=["Authentication"],
    summary="Verify Teams token and return authenticated user info",
    description=(
        "**Step 4.2 Verification Endpoint.** "
        "Call this with a valid Bearer token to confirm the backend can "
        "intercept the Teams JWT and extract the user's `preferred_username` "
        "(email). In local dev (APP_ENV=local) a mock user is returned. "
        "In production, the token is validated against Microsoft's JWKS and "
        "the OBO exchange is performed."
    ),
)
async def get_me(user: dict = Depends(get_current_user)):
    """
    Returns the currently authenticated user's profile.

    Example response (local dev):
    {
        "email":        "it.admin@airsats.com",
        "name":         "IT Admin (Local Dev)",
        "oid":          "00000000-0000-0000-0000-000000000000",
        "is_local_dev": true,
        "has_graph_token": true
    }
    """
    return {
        "email":           user["email"],
        "name":            user["name"],
        "oid":             user.get("oid", ""),
        "is_local_dev":    user.get("is_local_dev", False),
        # Don't expose the actual token — just confirm it was obtained
        "has_graph_token": bool(user.get("token")),
    }


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health():
    db_ok = await check_db_connection()
    return {
        "status":  "ok",
        "service": "IT Cockpit API",
        "db":      "connected" if db_ok else "unreachable",
    }


@app.get("/", tags=["Health"])
async def root():
    return {
        "message": "IT Cockpit API is running",
        "docs":    "/docs",
        "health":  "/health",
        "me":      "/api/v1/me",
    }
