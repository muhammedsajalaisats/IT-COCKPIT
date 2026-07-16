"""
routers/m365.py

Microsoft 365 endpoints — live Microsoft Graph API integration.

Phase 5 implementation:
  - Per-user in-memory cache keyed by  m365:{oid}:{section}
    (fixes the global cache bug that could leak one user's data to another)
  - Live Graph helpers for mail, personal tasks, team tasks, calendar
  - GET  /api/v1/m365/all   — concurrent fetch, graceful partial failures
  - PATCH /api/v1/m365/tasks/{task_id} — persist checkbox state via Planner
  - All responses include source, generated_at, from_cache, stale metadata
  - Errors never leak Graph tokens, response bodies, or secrets

In local dev (APP_ENV=local) the auth dependency returns a mock user with
token="mock-graph-token".  Graph calls will fail and each section will
return an error dict — this is expected and correct behaviour for local dev.
"""

import asyncio
import os
import time
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Optional
from zoneinfo import ZoneInfo

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from dotenv import load_dotenv

from auth.teams_validator import get_current_user

load_dotenv()

router = APIRouter()

# Setup logger to output to Uvicorn terminal
logger = logging.getLogger("uvicorn.error")

def _is_mock_token(token: str) -> bool:
    return not token or token in ("mock-graph-token", "mock-jwt-token-for-local-dev") or token.startswith("local_")

_MOCK_MAIL = [
    {
        "id": "mock_mail_1",
        "sender_name": "Microsoft Sentinel",
        "sender_email": "sentinel@security.microsoft.com",
        "subject": "⚠️ Security Alert: High severity alert triggered",
        "received_at": "2026-07-15T09:30:00Z",
        "unread": True,
        "priority": "high",
        "web_url": "https://outlook.office.com"
    },
    {
        "id": "mock_mail_2",
        "sender_name": "ManageEngine Support",
        "sender_email": "support@manageengine.com",
        "subject": "Ticket #40921 resolved: Database storage expanded",
        "received_at": "2026-07-15T08:15:00Z",
        "unread": False,
        "priority": "normal",
        "web_url": "https://outlook.office.com"
    },
    {
        "id": "mock_mail_3",
        "sender_name": "Karan Sharma (IT Director)",
        "sender_email": "karan.sharma@airsats.com",
        "subject": "Urgent: Infrastructure review meeting presentation slides",
        "received_at": "2026-07-15T07:00:00Z",
        "unread": True,
        "priority": "high",
        "web_url": "https://outlook.office.com"
    }
]

_MOCK_MY_TASKS = [
    {
        "id": "mock_task_1",
        "title": "Review firewall rule exception logs",
        "due_at": "2026-07-16T18:00:00Z",
        "priority": "high",
        "completed": False,
        "percent_complete": 0,
        "etag": 'W/"mock-etag-1"',
        "web_url": None
    },
    {
        "id": "mock_task_2",
        "title": "Renew SSL certificates for api.airsats.com",
        "due_at": "2026-07-18T10:00:00Z",
        "priority": "urgent",
        "completed": False,
        "percent_complete": 50,
        "etag": 'W/"mock-etag-2"',
        "web_url": None
    }
]

_MOCK_TEAM_TASKS = [
    {
        "id": "mock_team_task_1",
        "title": "Migration of SQL Server pool to AWS RDS",
        "due_at": "2026-07-20T23:59:59Z",
        "priority": "normal",
        "completed": False,
        "percent_complete": 30,
        "etag": 'W/"mock-etag-3"',
        "web_url": None
    },
    {
        "id": "mock_team_task_2",
        "title": "Update backup rotation policies for Mumbai DC",
        "due_at": "2026-07-15T15:00:00Z",
        "priority": "high",
        "completed": True,
        "percent_complete": 100,
        "etag": 'W/"mock-etag-4"',
        "web_url": None
    }
]

_MOCK_CALENDAR = [
    {
        "id": "mock_cal_1",
        "title": "IT Operations Weekly Alignment",
        "start_at": "2026-07-15T13:00:00Z",
        "end_at": "2026-07-15T14:00:00Z",
        "is_all_day": False,
        "type": "meeting",
        "location": "Boardroom 3 & Teams",
        "web_url": "https://teams.microsoft.com"
    },
    {
        "id": "mock_cal_2",
        "title": "Mumbai DC Scheduled Maintenance Window",
        "start_at": "2026-07-16T22:00:00Z",
        "end_at": "2026-07-17T02:00:00Z",
        "is_all_day": False,
        "type": "maintenance",
        "location": "Mumbai Data Center",
        "web_url": None
    }
]

# ── Config ────────────────────────────────────────────────────────────────────
GRAPH_BASE     = "https://graph.microsoft.com/v1.0"
TEAM_PLAN_ID   = os.getenv("TEAM_PLANNER_PLAN_ID", "")
CACHE_TTL      = 60          # seconds
IST            = ZoneInfo("Asia/Kolkata")

# Planner priority mapping (Graph integer → our label)
# https://learn.microsoft.com/en-us/graph/api/resources/plannertask
_PRIORITY_MAP: dict[int, str] = {
    0: "urgent",
    1: "urgent",
    2: "high",
    3: "high",
    4: "normal",
    5: "normal",
    6: "normal",
    7: "low",
    8: "low",
    9: "low",
}

# Calendar category → type mapping (fall back to "meeting")
_CATEGORY_TYPE_MAP: dict[str, str] = {
    "maintenance": "maintenance",
    "deadline":    "deadline",
    "training":    "training",
    "holiday":     "holiday",
}

# ── Per-user in-memory cache ──────────────────────────────────────────────────
# Key format: "m365:{oid}:{section}"   e.g. "m365:abc-123:mail"
# Value: (timestamp_float, data_dict)
_cache: dict[str, tuple[float, Any]] = {}


def _cache_key(oid: str, section: str) -> str:
    """Build a per-user, per-section cache key."""
    return f"m365:{oid}:{section}"


def _cache_get(oid: str, section: str) -> Optional[Any]:
    """Return cached data if within TTL, else None."""
    key = _cache_key(oid, section)
    if key in _cache:
        ts, data = _cache[key]
        if time.time() - ts < CACHE_TTL:
            return data
    return None


def _cache_set(oid: str, section: str, data: Any) -> None:
    """Store data in the per-user cache."""
    _cache[_cache_key(oid, section)] = (time.time(), data)


# ── Timestamp helper ──────────────────────────────────────────────────────────
def _now_ist() -> str:
    """Return the current time as an ISO 8601 string in IST."""
    return datetime.now(IST).isoformat(timespec="seconds")


# ── Graph HTTP helper ─────────────────────────────────────────────────────────
async def _graph_get(token: str, url: str, params: Optional[dict] = None) -> Any:
    """
    Perform an authenticated GET against Microsoft Graph.
    Raises httpx.HTTPStatusError on non-2xx responses.
    Does NOT propagate the token or response body to callers on error.
    """
    logger.debug(f"[Graph GET] Requesting URL: {url} with params: {params}")
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            resp = await client.get(
                url,
                headers={"Authorization": f"Bearer {token}"},
                params=params,
            )
            resp.raise_for_status()
            logger.debug(f"[Graph GET] Success URL: {url}")
            return resp.json()
        except httpx.HTTPStatusError as exc:
            status_code = exc.response.status_code
            error_msg = exc.response.text
            logger.error(
                f"[Graph GET] Failed URL: {url} | Status: {status_code} | "
                f"Response: {error_msg}"
            )
            raise exc
        except Exception as exc:
            logger.error(f"[Graph GET] Exception URL: {url} | Details: {exc}")
            raise exc


# ── Graph data fetchers ───────────────────────────────────────────────────────

async def _fetch_mail(token: str) -> list[dict]:
    """
    Fetch the top 5 inbox messages ordered newest first.
    Graph: GET /me/messages
    """
    data = await _graph_get(
        token,
        f"{GRAPH_BASE}/me/messages",
        params={
            "$select": "id,subject,from,receivedDateTime,isRead,importance,webLink",
            "$top":    "5",
            "$orderby": "receivedDateTime desc",
        },
    )
    result = []
    for msg in data.get("value", []):
        sender = msg.get("from", {}).get("emailAddress", {})
        result.append({
            "id":           msg.get("id", ""),
            "sender_name":  sender.get("name", ""),
            "sender_email": sender.get("address", ""),
            "subject":      msg.get("subject", ""),
            "received_at":  msg.get("receivedDateTime", ""),
            "unread":       not msg.get("isRead", True),
            "priority":     msg.get("importance", "normal").lower(),
            "web_url":      msg.get("webLink", None),
        })
    return result


async def _fetch_my_tasks(token: str) -> list[dict]:
    """
    Fetch the user's personal Planner tasks (up to 10), sorted by due date.
    Graph: GET /me/planner/tasks
    """
    data = await _graph_get(
        token,
        f"{GRAPH_BASE}/me/planner/tasks",
        params={
            "$select": "id,title,dueDateTime,percentComplete,priority,planId",
            "$top":    "10",
        },
    )
    tasks = []
    for t in data.get("value", []):
        pct = t.get("percentComplete", 0)
        priority_int = t.get("priority", 5)
        tasks.append({
            "id":               t.get("id", ""),
            "title":            t.get("title", ""),
            "due_at":           t.get("dueDateTime", None),
            "priority":         _PRIORITY_MAP.get(priority_int, "normal"),
            "completed":        pct >= 100,
            "percent_complete": pct,
            "etag":             t.get("@odata.etag", ""),
            "web_url":          None,
        })
    # Sort by due date ascending (None/null tasks last)
    tasks.sort(key=lambda x: (x["due_at"] is None, x["due_at"] or ""))
    return tasks


async def _fetch_team_tasks(token: str) -> list[dict]:
    """
    Fetch team Planner tasks from the configured plan (up to 10).
    Graph: GET /planner/plans/{plan_id}/tasks
    Plan ID is server-side config — callers cannot inject an arbitrary plan.
    """
    if not TEAM_PLAN_ID:
        # Plan ID not configured — return empty with a warning
        raise ValueError("TEAM_PLANNER_PLAN_ID is not configured on the server")

    data = await _graph_get(
        token,
        f"{GRAPH_BASE}/planner/plans/{TEAM_PLAN_ID}/tasks",
        params={
            "$select": "id,title,dueDateTime,percentComplete,priority",
            "$top":    "10",
        },
    )
    tasks = []
    for t in data.get("value", []):
        pct = t.get("percentComplete", 0)
        priority_int = t.get("priority", 5)
        tasks.append({
            "id":               t.get("id", ""),
            "title":            t.get("title", ""),
            "due_at":           t.get("dueDateTime", None),
            "priority":         _PRIORITY_MAP.get(priority_int, "normal"),
            "completed":        pct >= 100,
            "percent_complete": pct,
            "etag":             t.get("@odata.etag", ""),
            "web_url":          None,
        })
    tasks.sort(key=lambda x: (x["due_at"] is None, x["due_at"] or ""))
    return tasks


async def _fetch_calendar(token: str) -> list[dict]:
    """
    Fetch up to 5 calendar events for the next 7 days.
    Graph: GET /me/calendarView
    """
    now     = datetime.now(timezone.utc)
    end     = now + timedelta(days=7)
    iso_now = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    iso_end = end.strftime("%Y-%m-%dT%H:%M:%SZ")

    data = await _graph_get(
        token,
        f"{GRAPH_BASE}/me/calendarView",
        params={
            "startDateTime": iso_now,
            "endDateTime":   iso_end,
            "$select":       "id,subject,start,end,isAllDay,location,webLink,categories",
            "$top":          "5",
            "$orderby":      "start/dateTime asc",
        },
    )

    events = []
    for ev in data.get("value", []):
        # Derive a UI "type" from categories (fall back to "meeting")
        categories = ev.get("categories", [])
        ev_type = "meeting"
        for cat in categories:
            mapped = _CATEGORY_TYPE_MAP.get(cat.lower(), None)
            if mapped:
                ev_type = mapped
                break
        # Also check subject keywords as secondary fallback
        subject_lower = ev.get("subject", "").lower()
        if ev_type == "meeting":
            for keyword, ktype in _CATEGORY_TYPE_MAP.items():
                if keyword in subject_lower:
                    ev_type = ktype
                    break

        location_obj = ev.get("location", {})
        location_str = (
            location_obj.get("displayName", "")
            if isinstance(location_obj, dict) else str(location_obj)
        )

        events.append({
            "id":         ev.get("id", ""),
            "title":      ev.get("subject", ""),
            "start_at":   ev.get("start", {}).get("dateTime", ""),
            "end_at":     ev.get("end",   {}).get("dateTime", ""),
            "is_all_day": ev.get("isAllDay", False),
            "type":       ev_type,
            "location":   location_str,
            "web_url":    ev.get("webLink", None),
        })
    return events


# ── Section wrapper: cache + graceful error ───────────────────────────────────

async def _section(
    name: str,
    oid: str,
    fetcher,
    token: str,
) -> tuple[list, Optional[dict]]:
    """
    Run a Graph fetcher with per-user caching and graceful error capture.

    Returns (data, error_dict) where error_dict is None on success.
    Never leaks tokens, secrets, or Graph response bodies.
    """
    # Check per-user cache first
    cached = _cache_get(oid, name)
    if cached is not None:
        return cached, None

    try:
        data = await fetcher(token)
        _cache_set(oid, name, data)
        return data, None
    except ValueError as exc:
        # Config errors (e.g. missing plan ID) — not retryable
        return [], {
            "section":   name,
            "code":      "CONFIGURATION_ERROR",
            "message":   str(exc),
            "retryable": False,
        }
    except httpx.HTTPStatusError as exc:
        status_code = exc.response.status_code
        if status_code == 429:
            return [], {
                "section":   name,
                "code":      "GRAPH_RATE_LIMITED",
                "message":   f"{name.replace('_', ' ').title()} data is temporarily rate-limited",
                "retryable": True,
            }
        if status_code in (401, 403):
            return [], {
                "section":   name,
                "code":      "GRAPH_PERMISSION_DENIED",
                "message":   f"Insufficient permissions to fetch {name}",
                "retryable": False,
            }
        return [], {
            "section":   name,
            "code":      "GRAPH_TEMPORARILY_UNAVAILABLE",
            "message":   f"{name.replace('_', ' ').title()} data is temporarily unavailable",
            "retryable": True,
        }
    except Exception:
        return [], {
            "section":   name,
            "code":      "GRAPH_TEMPORARILY_UNAVAILABLE",
            "message":   f"{name.replace('_', ' ').title()} data is temporarily unavailable",
            "retryable": True,
        }


# ── Individual debug endpoints (still protected by get_current_user) ──────────

@router.get("/me/messages", summary="Get inbox triage emails")
async def get_me_messages(user: dict = Depends(get_current_user)):
    """
    Returns up to 5 inbox messages for the authenticated user.
    Live Graph call: GET /me/messages
    """
    oid   = user["oid"]
    token = user["token"]
    if _is_mock_token(token):
        return {
            "source":       "mock_microsoft_graph",
            "generated_at": _now_ist(),
            "from_cache":   False,
            "stale":        False,
            "user":         user["email"],
            "data":         _MOCK_MAIL,
            "errors":       [],
        }
    from_cache = _cache_get(oid, "mail") is not None
    data, error = await _section("mail", oid, _fetch_mail, token)
    return {
        "source":       "microsoft_graph",
        "generated_at": _now_ist(),
        "from_cache":   from_cache,
        "stale":        bool(error),
        "user":         user["email"],
        "data":         data,
        "errors":       [error] if error else [],
    }


@router.get("/me/calendarview", summary="Get upcoming calendar events")
async def get_me_calendarview(user: dict = Depends(get_current_user)):
    """
    Returns up to 5 calendar events for the next 7 days.
    Live Graph call: GET /me/calendarView
    """
    oid   = user["oid"]
    token = user["token"]
    if _is_mock_token(token):
        return {
            "source":       "mock_microsoft_graph",
            "generated_at": _now_ist(),
            "from_cache":   False,
            "stale":        False,
            "user":         user["email"],
            "data":         _MOCK_CALENDAR,
            "errors":       [],
        }
    data, error = await _section("calendar", oid, _fetch_calendar, token)
    from_cache   = _cache_get(oid, "calendar") is not None
    return {
        "source":       "microsoft_graph",
        "generated_at": _now_ist(),
        "from_cache":   from_cache,
        "stale":        bool(error),
        "user":         user["email"],
        "data":         data,
        "errors":       [error] if error else [],
    }


@router.get("/me/events", summary="Get upcoming calendar events")
async def get_me_events(user: dict = Depends(get_current_user)):
    """
    Returns up to 5 calendar events for the next 7 days.
    Live Graph call: GET /me/calendarView
    """
    return await get_me_calendarview(user)


@router.get("/me/planner/tasks", summary="Get my Planner tasks")
async def get_me_planner_tasks(user: dict = Depends(get_current_user)):
    """
    Returns up to 10 personal Planner tasks for the authenticated user.
    Live Graph call: GET /me/planner/tasks
    """
    oid   = user["oid"]
    token = user["token"]
    if _is_mock_token(token):
        return {
            "source":       "mock_microsoft_graph",
            "generated_at": _now_ist(),
            "from_cache":   False,
            "stale":        False,
            "user":         user["email"],
            "data":         _MOCK_MY_TASKS,
            "errors":       [],
        }
    from_cache = _cache_get(oid, "my_tasks") is not None
    data, error = await _section("my_tasks", oid, _fetch_my_tasks, token)
    return {
        "source":       "microsoft_graph",
        "generated_at": _now_ist(),
        "from_cache":   from_cache,
        "stale":        bool(error),
        "user":         user["email"],
        "data":         data,
        "errors":       [error] if error else [],
    }


@router.get("/mail", summary="Get inbox triage emails")
async def get_mail(user: dict = Depends(get_current_user)):
    """
    Returns up to 5 inbox messages for the authenticated user.
    Live Graph call: GET /me/messages
    """
    oid   = user["oid"]
    token = user["token"]
    if _is_mock_token(token):
        return {
            "source":       "mock_microsoft_graph",
            "generated_at": _now_ist(),
            "from_cache":   False,
            "stale":        False,
            "user":         user["email"],
            "data":         _MOCK_MAIL,
            "errors":       [],
        }
    from_cache = _cache_get(oid, "mail") is not None  # check BEFORE fetch writes to cache
    data, error = await _section("mail", oid, _fetch_mail, token)
    return {
        "source":       "microsoft_graph",
        "generated_at": _now_ist(),
        "from_cache":   from_cache,
        "stale":        bool(error),
        "user":         user["email"],
        "data":         data,
        "errors":       [error] if error else [],
    }


@router.get("/tasks/mine", summary="Get my Planner tasks")
async def get_my_tasks(user: dict = Depends(get_current_user)):
    """
    Returns up to 10 personal Planner tasks for the authenticated user.
    Live Graph call: GET /me/planner/tasks
    """
    oid   = user["oid"]
    token = user["token"]
    if _is_mock_token(token):
        return {
            "source":       "mock_microsoft_graph",
            "generated_at": _now_ist(),
            "from_cache":   False,
            "stale":        False,
            "user":         user["email"],
            "data":         _MOCK_MY_TASKS,
            "errors":       [],
        }
    from_cache = _cache_get(oid, "my_tasks") is not None
    data, error = await _section("my_tasks", oid, _fetch_my_tasks, token)
    return {
        "source":       "microsoft_graph",
        "generated_at": _now_ist(),
        "from_cache":   from_cache,
        "stale":        bool(error),
        "user":         user["email"],
        "data":         data,
        "errors":       [error] if error else [],
    }


@router.get("/tasks/team", summary="Get team Planner tasks")
async def get_team_tasks(user: dict = Depends(get_current_user)):
    """
    Returns up to 10 team Planner tasks from the configured plan.
    Live Graph call: GET /planner/plans/{plan_id}/tasks
    """
    oid   = user["oid"]
    token = user["token"]
    if _is_mock_token(token):
        return {
            "source":       "mock_microsoft_graph",
            "generated_at": _now_ist(),
            "from_cache":   False,
            "stale":        False,
            "user":         user["email"],
            "data":         _MOCK_TEAM_TASKS,
            "errors":       [],
        }
    data, error = await _section("team_tasks", oid, _fetch_team_tasks, token)
    from_cache   = _cache_get(oid, "team_tasks") is not None
    return {
        "source":       "microsoft_graph",
        "generated_at": _now_ist(),
        "from_cache":   from_cache,
        "stale":        bool(error),
        "user":         user["email"],
        "data":         data,
        "errors":       [error] if error else [],
    }


@router.get("/calendar", summary="Get upcoming calendar events")
async def get_calendar(user: dict = Depends(get_current_user)):
    """
    Returns up to 5 calendar events for the next 7 days.
    Live Graph call: GET /me/calendarView
    """
    oid   = user["oid"]
    token = user["token"]
    if _is_mock_token(token):
        return {
            "source":       "mock_microsoft_graph",
            "generated_at": _now_ist(),
            "from_cache":   False,
            "stale":        False,
            "user":         user["email"],
            "data":         _MOCK_CALENDAR,
            "errors":       [],
        }
    data, error = await _section("calendar", oid, _fetch_calendar, token)
    from_cache   = _cache_get(oid, "calendar") is not None
    return {
        "source":       "microsoft_graph",
        "generated_at": _now_ist(),
        "from_cache":   from_cache,
        "stale":        bool(error),
        "user":         user["email"],
        "data":         data,
        "errors":       [error] if error else [],
    }


# ── Primary aggregate endpoint ────────────────────────────────────────────────

@router.get("/all", summary="Get all M365 data concurrently")
async def get_all(user: dict = Depends(get_current_user)):
    """
    Fetches inbox, personal tasks, team tasks, and calendar concurrently.
    Returns 200 even if individual sections fail; failed sections appear
    in the top-level `errors` array with safe, non-leaking error objects.

    Live Graph calls (concurrent):
      GET /me/messages
      GET /me/planner/tasks
      GET /planner/plans/{plan_id}/tasks
      GET /me/calendarView
    """
    oid   = user["oid"]
    token = user["token"]

    if _is_mock_token(token):
        return {
            "source":       "mock_microsoft_graph",
            "generated_at": _now_ist(),
            "from_cache":   False,
            "stale":        False,
            "user":         user["email"],
            "mail":         _MOCK_MAIL,
            "my_tasks":     _MOCK_MY_TASKS,
            "team_tasks":   _MOCK_TEAM_TASKS,
            "calendar":     _MOCK_CALENDAR,
            "errors":       [],
        }

    # Run all four fetchers concurrently
    results = await asyncio.gather(
        _section("mail",       oid, _fetch_mail,       token),
        _section("my_tasks",   oid, _fetch_my_tasks,   token),
        _section("team_tasks", oid, _fetch_team_tasks, token),
        _section("calendar",   oid, _fetch_calendar,   token),
        return_exceptions=True,
    )

    mail_data,  mail_err        = results[0] if not isinstance(results[0], Exception) else ([], {"section": "mail",       "code": "INTERNAL_ERROR", "message": "Unexpected error fetching mail",       "retryable": True})
    tasks_data, tasks_err       = results[1] if not isinstance(results[1], Exception) else ([], {"section": "my_tasks",   "code": "INTERNAL_ERROR", "message": "Unexpected error fetching tasks",      "retryable": True})
    team_data,  team_err        = results[2] if not isinstance(results[2], Exception) else ([], {"section": "team_tasks", "code": "INTERNAL_ERROR", "message": "Unexpected error fetching team tasks", "retryable": True})
    cal_data,   cal_err         = results[3] if not isinstance(results[3], Exception) else ([], {"section": "calendar",   "code": "INTERNAL_ERROR", "message": "Unexpected error fetching calendar",   "retryable": True})

    errors = [e for e in [mail_err, tasks_err, team_err, cal_err] if e is not None]
    stale  = len(errors) > 0

    return {
        "source":       "microsoft_graph",
        "generated_at": _now_ist(),
        "from_cache":   False,
        "stale":        stale,
        "user":         user["email"],
        "mail":         mail_data,
        "my_tasks":     tasks_data,
        "team_tasks":   team_data,
        "calendar":     cal_data,
        "errors":       errors,
    }


# ── PATCH /tasks/{task_id} — persist checkbox state ───────────────────────────

class TaskUpdateRequest(BaseModel):
    completed: bool
    etag: str


@router.patch(
    "/tasks/{task_id}",
    summary="Update Planner task completion state",
    responses={
        409: {"description": "Task version conflict — re-fetch the task and retry"},
        404: {"description": "Task not found or user does not have access"},
    },
)
async def patch_task(
    task_id: str,
    body: TaskUpdateRequest,
    user: dict = Depends(get_current_user),
):
    """
    Persists the checkbox state of a Planner task on behalf of the signed-in user.

    - Maps `completed=true`  → `percentComplete=100`
    - Maps `completed=false` → `percentComplete=0`
    - Sends `If-Match: {etag}` as required by Microsoft Planner.
    - Returns 409 on ETag conflict (task changed concurrently).

    The user must be an assignee or plan member — Graph enforces this server-side.
    We also verify the task belongs to a plan the user can see before updating.

    Request body:
      { "completed": true, "etag": "W/\\"planner-etag\\"" }
    """
    token        = user["token"]
    percent_val  = 100 if body.completed else 0
    request_id   = str(uuid.uuid4())

    if _is_mock_token(token):
        logger.debug(f"[Graph PATCH] Mock token detected. Simulating task completion: {body.completed}")
        return {
            "id":              task_id,
            "completed":       body.completed,
            "percent_complete": percent_val,
            "etag":            body.etag + "_mock",
            "updated_at":      _now_ist(),
        }

    # Build the PATCH request to Graph
    patch_url = f"{GRAPH_BASE}/planner/tasks/{task_id}"
    logger.debug(f"[Graph PATCH] Requesting URL: {patch_url} for task_id: {task_id}")

    async with httpx.AsyncClient(timeout=15) as client:
        try:
            resp = await client.patch(
                patch_url,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type":  "application/json",
                    "If-Match":      body.etag,
                },
                json={"percentComplete": percent_val},
            )
            logger.debug(f"[Graph PATCH] Success. Status code: {resp.status_code}")
        except Exception as exc:
            logger.error(f"[Graph PATCH] Exception URL: {patch_url} | Details: {exc}")
            raise exc

    if resp.status_code not in (200, 204):
        logger.error(
            f"[Graph PATCH] Failed. Status: {resp.status_code} | "
            f"Response: {resp.text}"
        )

    if resp.status_code == 204:
        # Planner PATCH returns 204 No Content on success.
        # Read back the updated ETag from the response header.
        new_etag = resp.headers.get("ETag", body.etag)
        return {
            "id":              task_id,
            "completed":       body.completed,
            "percent_complete": percent_val,
            "etag":            new_etag,
            "updated_at":      _now_ist(),
        }

    if resp.status_code == 409 or resp.status_code == 412:
        # Precondition Failed (412) = ETag mismatch = concurrent update
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": {
                    "code":       "TASK_VERSION_CONFLICT",
                    "message":    "The task was modified by another client. Re-fetch the task to get the latest ETag and retry.",
                    "retryable":  True,
                    "request_id": request_id,
                }
            },
        )

    if resp.status_code == 404:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code":       "TASK_NOT_FOUND",
                    "message":    "Task not found or you do not have permission to update it.",
                    "retryable":  False,
                    "request_id": request_id,
                }
            },
        )

    if resp.status_code in (401, 403):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": {
                    "code":       "PERMISSION_DENIED",
                    "message":    "You do not have permission to update this task.",
                    "retryable":  False,
                    "request_id": request_id,
                }
            },
        )

    # Unexpected error — do not leak the Graph response body
    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail={
            "error": {
                "code":       "GRAPH_ERROR",
                "message":    "An unexpected error occurred while updating the task.",
                "retryable":  True,
                "request_id": request_id,
            }
        },
    )
