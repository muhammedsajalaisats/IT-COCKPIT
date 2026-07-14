"""
routers/manageengine.py

ManageEngine ServiceDesk Plus endpoints.

Phase 4.2: get_current_user dependency wired to KPI/station/category routes.
            ManageEngine data is not user-scoped (shared IT ops data), so we
            apply auth to ensure only authenticated users can access it.
Phase 5   : Replace mock data with live parameterized SQL queries via
            SQLAlchemy asyncio.

All SQL queries use parameterized inputs to prevent injection attacks.
"""

import asyncio
import time
from functools import wraps
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from database import get_db
from auth.teams_validator import get_current_user

router = APIRouter()

# ── In-memory cache (1-minute TTL) ───────────────────────────────────────────
_cache: dict[str, tuple[float, Any]] = {}
CACHE_TTL = 60  # seconds


def cached(key: str, ttl: int = CACHE_TTL):
    """Simple in-memory cache decorator for async functions."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            now = time.time()
            if key in _cache:
                ts, data = _cache[key]
                if now - ts < ttl:
                    return data
            result = await func(*args, **kwargs)
            _cache[key] = (now, result)
            return result
        return wrapper
    return decorator


# ── Mock data (replaced by SQL in Phase 5) ────────────────────────────────────
MOCK_KPIS = {
    "total_tickets":            1248,
    "open_tickets":             387,
    "sla_breached":             23,
    "resolved_today":           94,
    "pending_approval":         56,
    "avg_resolution_hours":     4.2,
    "first_call_resolution_pct": 68,
    "escalated":                31,
}

MOCK_STATIONS = [
    {"name": "DEL T3", "tickets": 87, "sla_pct": 91},
    {"name": "BOM",    "tickets": 64, "sla_pct": 88},
    {"name": "MAA",    "tickets": 52, "sla_pct": 95},
    {"name": "BLR",    "tickets": 41, "sla_pct": 97},
    {"name": "HYD",    "tickets": 38, "sla_pct": 93},
    {"name": "CCU",    "tickets": 29, "sla_pct": 82},
    {"name": "GOI",    "tickets": 18, "sla_pct": 100},
    {"name": "AMD",    "tickets": 15, "sla_pct": 99},
    {"name": "COK",    "tickets": 12, "sla_pct": 100},
]

MOCK_CATEGORIES = [
    {"category": "Network",  "count": 92},
    {"category": "Hardware", "count": 74},
    {"category": "Software", "count": 61},
    {"category": "Access",   "count": 55},
    {"category": "Email",    "count": 48},
    {"category": "Other",    "count": 27},
]


# ── Endpoints (protected by get_current_user) ─────────────────────────────────

@router.get("/kpis", summary="Get KPI summary metrics")
@cached("me_kpis")
async def get_kpis(user: dict = Depends(get_current_user)):
    """
    Returns top-level KPI counts for the IT dashboard.

    Phase 5 SQL (parameterized):
      SELECT
        COUNT(*)                                              AS total_tickets,
        SUM(CASE WHEN status != 'CLOSED' THEN 1 ELSE 0 END)  AS open_tickets,
        SUM(CASE WHEN sla_violated = 1 THEN 1 ELSE 0 END)    AS sla_breached,
        SUM(CASE WHEN DATE(resolved_at) = CURDATE() THEN 1 ELSE 0 END)
                                                              AS resolved_today
      FROM tickets
      -- No user-filter: KPIs are org-wide for IT ops staff.
    """
    return {"source": "mock", "data": MOCK_KPIS}


@router.get("/stations", summary="Get per-station ticket heatmap")
@cached("me_stations")
async def get_stations(user: dict = Depends(get_current_user)):
    """
    Returns ticket counts and SLA compliance per airport station.

    Phase 5 SQL (parameterized):
      SELECT station_code AS name,
             COUNT(*)     AS tickets,
             ROUND(100.0 * SUM(CASE WHEN sla_met = 1 THEN 1 ELSE 0 END)
                   / COUNT(*), 1) AS sla_pct
      FROM tickets
      WHERE status != 'CLOSED'
      GROUP BY station_code
      ORDER BY tickets DESC
    """
    return {"source": "mock", "data": MOCK_STATIONS}


@router.get("/categories", summary="Get ticket breakdown by category")
@cached("me_categories")
async def get_categories(user: dict = Depends(get_current_user)):
    """
    Returns open ticket counts grouped by IT category.

    Phase 5 SQL (parameterized):
      SELECT category, COUNT(*) AS count
      FROM   tickets
      WHERE  status = 'OPEN'
      GROUP  BY category
      ORDER  BY count DESC
    """
    return {"source": "mock", "data": MOCK_CATEGORIES}


@router.get("/all", summary="Get all ManageEngine data in one call")
async def get_all(user: dict = Depends(get_current_user)):
    """
    Aggregates KPIs, stations, and categories in a single call.
    Uses asyncio.gather for concurrent sub-queries (Phase 5: live DB).
    """
    kpis, stations, categories = await asyncio.gather(
        get_kpis(user),
        get_stations(user),
        get_categories(user),
    )
    return {
        "source":     "mock",
        "kpis":       kpis["data"],
        "stations":   stations["data"],
        "categories": categories["data"],
    }
