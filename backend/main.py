import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import manageengine, m365


# ── Lifespan (startup / shutdown) ───────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[IT Cockpit] API starting up...")
    yield
    print("[IT Cockpit] API shutting down...")


# ── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="IT Cockpit API",
    description="Backend API for the Air India SATS IT Cockpit Teams App",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ─────────────────────────────────────────────────────────────────────
# Teams clients and local dev are the only allowed origins.
# Tighten this to your actual Teams app domain in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",         # Vite dev server
        "http://localhost:5173",         # Vite fallback port
        "https://*.teams.microsoft.com", # Teams desktop / web client
        "https://*.teams.cloud.microsoft",
        "https://*.skype.com",           # Teams legacy
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(manageengine.router, prefix="/api/v1/manageengine", tags=["ManageEngine"])
app.include_router(m365.router,         prefix="/api/v1/m365",         tags=["Microsoft 365"])


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "service": "IT Cockpit API"}


@app.get("/", tags=["Health"])
async def root():
    return {
        "message": "IT Cockpit API is running",
        "docs": "/docs",
        "health": "/health",
    }
