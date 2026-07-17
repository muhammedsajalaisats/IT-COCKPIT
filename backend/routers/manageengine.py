"""
routers/manageengine.py

ManageEngine ServiceDesk Plus endpoints.

Phase 4.2: get_current_user dependency wired to all protected routes.
Phase 5  : /all endpoint now returns the full documented contract shape
           (kpis, stations, categories, sla, summary) with response
           metadata (source, generated_at, from_cache, stale).
           SQL wiring is a future phase; data remains mock for now.

All SQL queries in future phases must use parameterized inputs to prevent
injection attacks. Do NOT construct SQL with request values via string
interpolation.
"""

import asyncio
import time
from datetime import datetime
from functools import wraps
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends

from auth.teams_validator import get_current_user

router = APIRouter()

IST      = ZoneInfo("Asia/Kolkata")
CACHE_TTL = 60  # seconds — ManageEngine data is shared across IT users

# ── In-memory cache (shared; ManageEngine data is org-wide for IT staff) ──────
_cache: dict[str, tuple[float, Any]] = {}


def _now_ist() -> str:
    """Return current time as ISO 8601 string in IST."""
    return datetime.now(IST).isoformat(timespec="seconds")


def _cached(key: str, ttl: int = CACHE_TTL):
    """Simple in-memory cache decorator for async functions."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            now = time.time()
            if key in _cache:
                ts, data = _cache[key]
                if now - ts < ttl:
                    return {**data, "from_cache": True}
            result = await func(*args, **kwargs)
            _cache[key] = (now, result)
            return result
        return wrapper
    return decorator


# ── Mock data (Phase 6 will replace with live parameterized SQL) ───────────────

_MOCK_KPIS = {
    "total_tickets":    1248,
    "open_tickets":     387,
    "sla_breached":     23,
    "resolved_today":   94,
    "pending_approval": 56,
    "changes_vs_yesterday": {
        "total_tickets":    {"value": 12,  "unit": "percent"},
        "open_tickets":     {"value": 8,   "unit": "count"},
        "sla_breached":     {"value": -3,  "unit": "count"},
        "resolved_today":   {"value": 18,  "unit": "percent"},
        "pending_approval": {"value": -2,  "unit": "count"},
    },
}

_MOCK_STATIONS = [
    {"code": "DEL", "open_tickets": 87, "sla_compliance_pct": 91.0},
    {"code": "TRV", "open_tickets": 64, "sla_compliance_pct": 88.0},
    {"code": "IXE", "open_tickets": 52, "sla_compliance_pct": 95.0},
    {"code": "BLR", "open_tickets": 41, "sla_compliance_pct": 97.0},
    {"code": "HYD", "open_tickets": 38, "sla_compliance_pct": 93.0},
    {"code": "IXR", "open_tickets": 29, "sla_compliance_pct": 82.0},
    {"code": "CHQ", "open_tickets": 18, "sla_compliance_pct": 100.0},
    {"code": "COK", "open_tickets": 12, "sla_compliance_pct": 100.0},
]

_MOCK_CATEGORIES = [
    {"category": "Network",  "open_tickets": 92},
    {"category": "Hardware", "open_tickets": 74},
    {"category": "Software", "open_tickets": 61},
    {"category": "Access",   "open_tickets": 55},
    {"category": "Email",    "open_tickets": 48},
    {"category": "Other",    "open_tickets": 27},
]

_MOCK_SLA = {
    "met":      312,
    "at_risk":  52,
    "breached": 23,
}

_MOCK_SUMMARY = {
    "avg_resolution_hours":     4.2,
    "first_call_resolution_pct": 68.0,
    "escalated_tickets":        31,
}


# ── Endpoints (all protected by get_current_user) ─────────────────────────────

@router.get("/kpis", summary="Get KPI summary metrics")
@_cached("me_kpis")
async def get_kpis(user: dict = Depends(get_current_user)):
    """
    Returns top-level KPI counts for the IT dashboard.

    Future SQL (parameterized):
      SELECT
        COUNT(*)                                              AS total_tickets,
        SUM(CASE WHEN status NOT IN ('Closed','Resolved') THEN 1 ELSE 0 END) AS open_tickets,
        SUM(CASE WHEN sla_violated = 1 AND status NOT IN ('Closed','Resolved') THEN 1 ELSE 0 END) AS sla_breached,
        SUM(CASE WHEN CAST(resolved_at AS DATE) = CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END) AS resolved_today
      FROM tickets
      -- KPIs are org-wide for IT ops staff (not user-scoped).
    """
    return {
        "source":       "manageengine",
        "generated_at": _now_ist(),
        "from_cache":   False,
        "stale":        False,
        "data":         _MOCK_KPIS,
    }


@router.get("/stations", summary="Get per-station ticket heatmap")
@_cached("me_stations")
async def get_stations(user: dict = Depends(get_current_user)):
    """
    Returns open ticket counts and SLA compliance per airport station.

    Future SQL (parameterized):
      SELECT station_code AS code,
             COUNT(*)     AS open_tickets,
             ROUND(100.0 * SUM(CASE WHEN sla_met = 1 THEN 1 ELSE 0 END) / COUNT(*), 1)
                          AS sla_compliance_pct
      FROM tickets
      WHERE status NOT IN ('Closed', 'Resolved')
      GROUP BY station_code
      ORDER BY open_tickets DESC
    """
    return {
        "source":       "manageengine",
        "generated_at": _now_ist(),
        "from_cache":   False,
        "stale":        False,
        "data":         _MOCK_STATIONS,
    }


@router.get("/categories", summary="Get ticket breakdown by category")
@_cached("me_categories")
async def get_categories(user: dict = Depends(get_current_user)):
    """
    Returns open ticket counts grouped by IT category.

    Future SQL (parameterized):
      SELECT category, COUNT(*) AS open_tickets
      FROM   tickets
      WHERE  status NOT IN ('Closed', 'Resolved')
      GROUP  BY category
      ORDER  BY open_tickets DESC
    """
    return {
        "source":       "manageengine",
        "generated_at": _now_ist(),
        "from_cache":   False,
        "stale":        False,
        "data":         _MOCK_CATEGORIES,
    }


@router.get("/all", summary="Get all ManageEngine data in one call")
async def get_all(user: dict = Depends(get_current_user)):
    """
    Aggregates KPIs, stations, categories, SLA summary, and metrics
    in a single response matching the documented API contract.

    Returns mock data for now; live SQL wiring is a future phase.
    """
    generated_at = _now_ist()

    return {
        "source":       "manageengine",
        "generated_at": generated_at,
        "from_cache":   False,
        "stale":        False,
        # KPI cards
        "kpis": _MOCK_KPIS,
        # Station heatmap
        "stations": _MOCK_STATIONS,
        # Category breakdown chart
        "categories": _MOCK_CATEGORIES,
        # SLA donut chart
        "sla": _MOCK_SLA,
        # Summary metrics
        "summary": _MOCK_SUMMARY,
    }
