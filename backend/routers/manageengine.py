"""
routers/manageengine.py

ManageEngine ServiceDesk Plus endpoints.
Currently returns mock data; Phase 5 will replace with live SQL queries.

All SQL queries use parameterized inputs to prevent injection attacks.
"""

import asyncio
import time
from functools import wraps
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from database import get_db

router = APIRouter()

# ── In-memory cache (Phase 5 will extend this) ────────────────────────────────
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
    "total_tickets": 1248,
    "open_tickets": 387,
    "sla_breached": 23,
    "resolved_today": 94,
    "pending_approval": 56,
    "avg_resolution_hours": 4.2,
    "first_call_resolution_pct": 68,
    "escalated": 31,
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


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/kpis", summary="Get KPI summary metrics")
@cached("me_kpis")
async def get_kpis():
    """
    Returns top-level KPI counts.
    Phase 5: Replace mock with parameterized SQL query like:
      SELECT COUNT(*) FROM tickets WHERE status != 'CLOSED'
    """
    return {"source": "mock", "data": MOCK_KPIS}


@router.get("/stations", summary="Get per-station ticket heatmap")
@cached("me_stations")
async def get_stations():
    """
    Returns ticket counts by airport station.
    Phase 5 SQL example:
      SELECT station_code, COUNT(*) as tickets,
             AVG(CASE WHEN sla_met=1 THEN 100.0 ELSE 0 END) as sla_pct
      FROM tickets
      WHERE status != 'CLOSED'
      GROUP BY station_code
    """
    return {"source": "mock", "data": MOCK_STATIONS}


@router.get("/categories", summary="Get ticket breakdown by category")
@cached("me_categories")
async def get_categories():
    """
    Returns open ticket counts grouped by category.
    Phase 5 SQL example:
      SELECT category, COUNT(*) as count
      FROM tickets
      WHERE status = 'OPEN'
      GROUP BY category
      ORDER BY count DESC
    """
    return {"source": "mock", "data": MOCK_CATEGORIES}


@router.get("/all", summary="Get all ManageEngine data in one call")
async def get_all():
    """
    Aggregates all ManageEngine data in a single API call.
    Uses asyncio.gather for concurrent fetching (Phase 5 will hit real DB).
    """
    kpis, stations, categories = await asyncio.gather(
        get_kpis(),
        get_stations(),
        get_categories(),
    )
    return {
        "source": "mock",
        "kpis": kpis["data"],
        "stations": stations["data"],
        "categories": categories["data"],
    }
