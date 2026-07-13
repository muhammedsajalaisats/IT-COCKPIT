"""
routers/m365.py

Microsoft 365 endpoints (Exchange Mail, Planner, Calendar).
Phase 4 will add real Graph API calls via the OBO flow.
Phase 5 will wire these to the frontend.
"""

import asyncio
import time
from functools import wraps
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

router = APIRouter()
bearer_scheme = HTTPBearer(auto_error=False)

# ── In-memory cache ───────────────────────────────────────────────────────────
_cache: dict[str, tuple[float, Any]] = {}
CACHE_TTL = 60


def cached(key: str, ttl: int = CACHE_TTL):
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


# ── Mock data ─────────────────────────────────────────────────────────────────
MOCK_EMAILS = [
    {"id": "1", "from": "Ops Control",   "subject": "Flight delay impacting IT at DEL T3",       "time": "09:42", "unread": True,  "priority": "high"},
    {"id": "2", "from": "Azure Monitor", "subject": "[ALERT] CPU spike on AISATS-PROD-01 > 90%", "time": "09:18", "unread": True,  "priority": "high"},
    {"id": "3", "from": "Nilesh Kumar",  "subject": "Re: VPN access for new joiners — BOM team", "time": "08:55", "unread": True,  "priority": "normal"},
    {"id": "4", "from": "ServiceDesk",   "subject": "Ticket #4821 escalated to L3",               "time": "08:30", "unread": False, "priority": "normal"},
    {"id": "5", "from": "HR Systems",    "subject": "Onboarding IT checklist — 5 new staff",      "time": "Yesterday", "unread": False, "priority": "low"},
]

MOCK_TASKS_MINE = [
    {"id": "t1", "title": "Renew SSL cert for aisats-internal.com",    "due": "Today",  "priority": "high",   "done": False},
    {"id": "t2", "title": "Review firewall rules for BOM DMZ segment",  "due": "Jul 15", "priority": "normal", "done": False},
    {"id": "t3", "title": "Update CMDB entries for new hardware batch", "due": "Jul 17", "priority": "low",    "done": True},
    {"id": "t4", "title": "DR drill — tabletop exercise prep",          "due": "Jul 20", "priority": "normal", "done": False},
]

MOCK_TASKS_TEAM = [
    {"id": "t5", "title": "Deploy Teams Rooms firmware update",     "due": "Jul 14", "priority": "high",   "done": False},
    {"id": "t6", "title": "Complete ISO 27001 gap assessment",      "due": "Jul 22", "priority": "high",   "done": False},
    {"id": "t7", "title": "Migrate legacy backup to Azure Vault",   "due": "Jul 31", "priority": "normal", "done": False},
]

MOCK_CALENDAR = [
    {"title": "Server Maintenance Window", "time": "02:00 – 04:00 AM", "day": "Tomorrow", "type": "maintenance"},
    {"title": "IT Steering Committee",      "time": "10:30 AM",         "day": "Monday",   "type": "meeting"},
    {"title": "Azure Subscription Renewal", "time": "All Day",          "day": "Jul 18",   "type": "deadline"},
]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/mail", summary="Get inbox triage emails")
@cached("m365_mail")
async def get_mail(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    """
    Phase 4+: Will use Graph API:
      GET https://graph.microsoft.com/v1.0/me/messages
        ?$select=subject,from,receivedDateTime,isRead
        &$top=20&$orderby=receivedDateTime desc
    """
    return {"source": "mock", "from_cache": False, "data": MOCK_EMAILS}


@router.get("/tasks/mine", summary="Get my Planner tasks")
@cached("m365_tasks_mine")
async def get_my_tasks(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    """
    Phase 4+: Will use Graph API:
      GET https://graph.microsoft.com/v1.0/me/planner/tasks
        ?$filter=completedDateTime eq null
    """
    return {"source": "mock", "from_cache": False, "data": MOCK_TASKS_MINE}


@router.get("/tasks/team", summary="Get team Planner tasks")
@cached("m365_tasks_team")
async def get_team_tasks(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    return {"source": "mock", "from_cache": False, "data": MOCK_TASKS_TEAM}


@router.get("/calendar", summary="Get upcoming calendar events")
@cached("m365_calendar")
async def get_calendar(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    """
    Phase 4+: Will use Graph API:
      GET https://graph.microsoft.com/v1.0/me/calendarView
        ?startDateTime=...&endDateTime=...
        &$select=subject,start,end,bodyPreview
    """
    return {"source": "mock", "from_cache": False, "data": MOCK_CALENDAR}


@router.get("/all", summary="Get all M365 data concurrently")
async def get_all(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    """
    Fetches mail, tasks, and calendar concurrently using asyncio.gather.
    Gracefully handles Graph API throttling (HTTP 429) in Phase 5.
    """
    mail, my_tasks, team_tasks, calendar = await asyncio.gather(
        get_mail(credentials),
        get_my_tasks(credentials),
        get_team_tasks(credentials),
        get_calendar(credentials),
        return_exceptions=True,
    )

    def safe(result, fallback):
        return result if not isinstance(result, Exception) else {"error": str(result), "data": fallback}

    return {
        "source": "mock",
        "mail":       safe(mail,       [])["data"],
        "my_tasks":   safe(my_tasks,   [])["data"],
        "team_tasks": safe(team_tasks, [])["data"],
        "calendar":   safe(calendar,   [])["data"],
    }
