"""
database.py — Async SQLAlchemy engine with enterprise-grade connection pooling.

Supports MS SQL Server (primary for ManageEngine ServiceDesk Plus).
Set DATABASE_URL in your .env file, e.g.:
  DATABASE_URL=mssql+aioodbc://user:pass@server/SDPDB?driver=ODBC+Driver+17+for+SQL+Server

For local development without a DB, set:
  DATABASE_URL=sqlite+aiosqlite:///./test.db
"""

import os
from typing import AsyncGenerator

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    # Default to SQLite for local dev when no .env is present
    "sqlite+aiosqlite:///./itcockpit_dev.db",
)

IS_SQLITE = DATABASE_URL.startswith("sqlite")

# ── Engine ────────────────────────────────────────────────────────────────────
engine = create_async_engine(
    DATABASE_URL,
    # Connection pool settings (ignored by SQLite but active for SQL Server)
    pool_size=10,
    max_overflow=20,
    pool_timeout=30,
    pool_recycle=1800,          # Recycle connections every 30 min
    pool_pre_ping=True,         # Verify connection health before use
    echo=False,                 # Set True to log all SQL (dev only)
    # MS SQL Server specific kwargs (ignored for SQLite)
    **({} if IS_SQLITE else {
        "connect_args": {"timeout": 10},
    }),
)

# ── Session factory ───────────────────────────────────────────────────────────
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


# ── Base model ────────────────────────────────────────────────────────────────
class Base(DeclarativeBase):
    pass


# ── Dependency (FastAPI) ──────────────────────────────────────────────────────
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield a database session; close it when the request finishes."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


# ── Health check helper ───────────────────────────────────────────────────────
async def check_db_connection() -> bool:
    """Returns True if the database is reachable."""
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        return True
    except Exception as e:
        print(f"[DB] Connection check failed: {e}")
        return False
