# IT Cockpit — Backend API Requirements

**Frontend:** https://it-cockpit-frontend.vercel.app/  
**Prepared:** 14 July 2026  
**Audience:** Backend/API engineer

## 1. Current status

The deployed React frontend is a UI prototype. It currently reads hard-coded mock data from:

- `frontend/src/components/KpiRow.jsx`
- `frontend/src/components/ManageEngine.jsx`
- `frontend/src/components/M365Widgets.jsx`

The deployed JavaScript bundle also contains the mock labels and contains no `/api/...` requests. The Refresh button only waits 800 ms and redisplays the same mock data. Task completion is only changed in React state and is not persisted.

A FastAPI skeleton already exists under `backend/`. Its routes, Teams token validation, OBO flow, SQL connection, and mock responses are useful starting points, but live ManageEngine SQL and Microsoft Graph calls still need to be implemented.

## 2. APIs the frontend needs

For the first production release, the frontend only needs these calls:

| Priority | Method | Route | Purpose |
|---|---|---|---|
| P0 | `GET` | `/api/v1/me` | Validate the Teams token and return the current user's safe profile |
| P0 | `GET` | `/api/v1/manageengine/all` | Load KPIs, station heatmap, category chart, SLA chart, and summary metrics in one request |
| P0 | `GET` | `/api/v1/m365/all` | Load inbox, personal Planner tasks, team Planner tasks, and calendar concurrently |
| P0* | `PATCH` | `/api/v1/m365/tasks/{task_id}` | Persist the task checkbox state. Required if the checkbox remains interactive |
| Ops | `GET` | `/health` | Deployment/database health check; no user data |

`GET /api/v1/manageengine/all` and `GET /api/v1/m365/all` should be the normal dashboard calls. The existing smaller endpoints can remain for debugging or partial refreshes:

- `GET /api/v1/manageengine/kpis`
- `GET /api/v1/manageengine/stations`
- `GET /api/v1/manageengine/categories`
- `GET /api/v1/m365/mail`
- `GET /api/v1/m365/tasks/mine`
- `GET /api/v1/m365/tasks/team`
- `GET /api/v1/m365/calendar`

The chatbot is an embedded Copilot Studio iframe and does **not** need a new IT Cockpit backend endpoint.

## 3. Common request rules

### Base URL

The frontend will use an environment variable such as:

```env
VITE_API_BASE_URL=https://<backend-host>
```

Do not hard-code `localhost:8000` in production.

### Authentication

Every `/api/v1/...` route must require the Microsoft Teams SSO token:

```http
Authorization: Bearer <teams-sso-jwt>
Accept: application/json
```

The backend must:

1. Validate signature, expiry, tenant/issuer, and audience.
2. Exchange the Teams token for a Microsoft Graph token using the OBO flow.
3. Make Graph calls server-side.
4. Never return the Teams token, client secret, or Graph access token to the browser.

The existing `backend/auth/teams_validator.py` already scaffolds this flow. `APP_ENV=local` may bypass authentication only for local development; production must never run in local mode.

### Common response metadata

Data endpoints should include freshness information so the UI can show real refresh state:

```json
{
  "source": "manageengine",
  "generated_at": "2026-07-14T10:30:00+05:30",
  "from_cache": false,
  "stale": false
}
```

- Use ISO 8601 timestamps.
- Dashboard/business-day calculations use `Asia/Kolkata` unless the business confirms another timezone.
- `from_cache` means a valid cached response was used.
- `stale` means fallback data was returned because the live source failed.

## 4. Endpoint contracts

### 4.1 `GET /api/v1/me`

Returns only safe user information.

#### `200 OK`

```json
{
  "email": "it.admin@airsats.com",
  "name": "IT Admin",
  "oid": "00000000-0000-0000-0000-000000000000",
  "has_graph_token": true
}
```

Do not return the actual Graph token.

---

### 4.2 `GET /api/v1/manageengine/all`

Loads every ManageEngine section shown by the dashboard.

#### `200 OK`

```json
{
  "source": "manageengine",
  "generated_at": "2026-07-14T10:30:00+05:30",
  "from_cache": false,
  "stale": false,
  "kpis": {
    "total_tickets": 1248,
    "open_tickets": 387,
    "sla_breached": 23,
    "resolved_today": 94,
    "pending_approval": 56,
    "changes_vs_yesterday": {
      "total_tickets": { "value": 12, "unit": "percent" },
      "open_tickets": { "value": 8, "unit": "count" },
      "sla_breached": { "value": -3, "unit": "count" },
      "resolved_today": { "value": 18, "unit": "percent" },
      "pending_approval": { "value": -2, "unit": "count" }
    }
  },
  "stations": [
    { "code": "DEL", "open_tickets": 87, "sla_compliance_pct": 91.0 },
    { "code": "BLR", "open_tickets": 41, "sla_compliance_pct": 97.0 }
  ],
  "categories": [
    { "category": "Network", "open_tickets": 92 },
    { "category": "Hardware", "open_tickets": 74 }
  ],
  "sla": {
    "met": 312,
    "at_risk": 52,
    "breached": 23
  },
  "summary": {
    "avg_resolution_hours": 4.2,
    "first_call_resolution_pct": 68.0,
    "escalated_tickets": 31
  }
}
```

#### Required business definitions

The backend should keep these definitions consistent across the cards and charts:

- `open_tickets`: tickets not in a configured terminal status such as `Closed` or `Resolved`.
- `resolved_today`: tickets resolved from 00:00:00 through 23:59:59 in `Asia/Kolkata`.
- `pending_approval`: tickets whose current workflow status is awaiting approval.
- `sla_breached`: unresolved tickets whose SLA deadline has passed or which are marked as violated.
- `at_risk`: unresolved tickets within the agreed warning window before the SLA deadline.
- `first_call_resolution_pct`: resolved on first contact / all resolved tickets in the reporting period × 100.
- `avg_resolution_hours`: average resolution duration for resolved tickets in the reporting period.
- `changes_vs_yesterday`: signed current value minus yesterday's comparable value. Percent changes must handle a zero yesterday value without division errors; return `null` when a percentage is not meaningful.

The exact ManageEngine table/column names are environment-specific. Use parameterized SQL only. Do not construct SQL with request values through string interpolation.

---

### 4.3 `GET /api/v1/m365/all`

Loads the four Microsoft 365 tabs. The backend should call Graph concurrently and should return successful sections even if one Graph call fails.

#### `200 OK`

```json
{
  "source": "microsoft_graph",
  "generated_at": "2026-07-14T10:30:00+05:30",
  "from_cache": false,
  "stale": false,
  "user": "it.admin@airsats.com",
  "mail": [
    {
      "id": "AAMk...",
      "sender_name": "Ops Control",
      "sender_email": "ops.control@airsats.com",
      "subject": "Flight delay impacting IT services at DEL T3",
      "received_at": "2026-07-14T09:42:00+05:30",
      "unread": true,
      "priority": "high",
      "web_url": "https://outlook.office.com/..."
    }
  ],
  "my_tasks": [
    {
      "id": "planner-task-id",
      "title": "Renew SSL certificate",
      "due_at": "2026-07-14T17:00:00+05:30",
      "priority": "high",
      "completed": false,
      "percent_complete": 0,
      "etag": "W/\"planner-etag\"",
      "web_url": null
    }
  ],
  "team_tasks": [
    {
      "id": "planner-team-task-id",
      "title": "Deploy Teams Rooms firmware update",
      "due_at": "2026-07-15T17:00:00+05:30",
      "priority": "normal",
      "completed": false,
      "percent_complete": 0,
      "etag": "W/\"planner-etag\"",
      "web_url": null
    }
  ],
  "calendar": [
    {
      "id": "event-id",
      "title": "Server Maintenance Window",
      "start_at": "2026-07-15T02:00:00+05:30",
      "end_at": "2026-07-15T04:00:00+05:30",
      "is_all_day": false,
      "type": "maintenance",
      "location": "Online",
      "web_url": "https://outlook.office.com/calendar/..."
    }
  ],
  "errors": []
}
```

If one section fails, return the remaining data and describe the failed section without leaking Graph response bodies or tokens:

```json
{
  "errors": [
    {
      "section": "calendar",
      "code": "GRAPH_TEMPORARILY_UNAVAILABLE",
      "message": "Calendar data is temporarily unavailable",
      "retryable": true
    }
  ]
}
```

#### Graph mapping

| UI section | Microsoft Graph call | Minimum useful fields |
|---|---|---|
| Inbox | `GET /me/messages` | `id`, `sender`, `subject`, `receivedDateTime`, `isRead`, `importance`, `webLink` |
| My Tasks | `GET /me/planner/tasks` | `id`, `title`, `dueDateTime`, `percentComplete`, `priority`, `@odata.etag` |
| Team Tasks | `GET /planner/plans/{configured-plan-id}/tasks` | Same task fields; plan ID must be server configuration, not an unrestricted client value |
| Calendar | `GET /me/calendarView?startDateTime=...&endDateTime=...` | `id`, `subject`, `start`, `end`, `isAllDay`, `location`, `webLink` |

Suggested limits for the current layout are 5 inbox items, 10 personal tasks, 10 team tasks, and 5 upcoming events. Sort mail newest first, tasks by due date, and calendar by start time. The frontend should format ISO dates into labels such as `Today`, `Tomorrow`, or `Jul 15`; the API should not return locale-specific display strings.

`type` for calendar entries is a UI grouping and is not a standard Graph field. Use a documented mapping, for example categories or subject keywords, and fall back to `meeting`.

---

### 4.4 `PATCH /api/v1/m365/tasks/{task_id}`

Persists task completion when a user clicks a checkbox.

#### Request

```json
{
  "completed": true,
  "etag": "W/\"planner-etag\""
}
```

#### `200 OK`

```json
{
  "id": "planner-task-id",
  "completed": true,
  "percent_complete": 100,
  "etag": "W/\"new-planner-etag\"",
  "updated_at": "2026-07-14T10:31:12+05:30"
}
```

The backend maps `completed=true` to Planner `percentComplete=100` and `false` to `0`. Microsoft Planner updates require the last known ETag in `If-Match`; the backend should handle this server-side. Return `409 Conflict` if the task changed and cannot be safely retried.

The backend must confirm that the signed-in user is allowed to update the task. A caller must not be able to update an arbitrary task merely by guessing its ID.

---

### 4.5 `GET /health`

This endpoint may be public but must not disclose credentials, connection strings, internal hostnames, or exception traces.

```json
{
  "status": "ok",
  "service": "IT Cockpit API",
  "database": "connected"
}
```

Return a non-2xx status when a required dependency makes the service unusable. If the API itself is healthy but an optional upstream is degraded, use a clear `degraded` state.

## 5. Standard errors

Use this shape for non-2xx responses:

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication is required",
    "retryable": false,
    "request_id": "f23d8a5e-..."
  }
}
```

Expected status codes:

| Status | Meaning |
|---|---|
| `400` | Invalid input |
| `401` | Missing, expired, invalid token, or OBO/consent required |
| `403` | Authenticated but not allowed |
| `404` | Requested task/resource does not exist |
| `409` | Planner task version conflict |
| `429` | Rate limited and no cached fallback is available |
| `500` | Unexpected backend failure |
| `502` | ManageEngine/Graph returned an unusable response |
| `503` | Required dependency unavailable |

Logs should include `request_id`, route, duration, upstream status, and user `oid` or a safe hash. Do not log bearer tokens, secrets, raw email bodies, or connection strings.

## 6. Cache and resilience requirements

- Cache ManageEngine dashboard data for about 60 seconds. This data is shared across authorized IT users.
- Cache Microsoft 365 data **per user** using `oid` plus the section name. Never use a global key such as only `m365_mail` or `m365_tasks_mine`.
- The current in-memory M365 cache is global and must be fixed before production because it can return one user's mail/tasks to another user.
- Use a shared cache such as Redis if the backend runs multiple workers/instances. In-memory cache is not consistent across processes.
- For Microsoft Graph `429`, respect `Retry-After`; do not retry immediately. If safe cached data exists, return it with `stale: true`.
- Apply timeouts to SQL and Graph calls. Partial M365 failure must not blank the ManageEngine widget, and vice versa.
- The frontend Refresh button should trigger new requests, but normal server-side TTL/rate-limit protections should still apply.

## 7. Production configuration checklist

The backend needs these environment-specific values:

```env
APP_ENV=production
AZURE_TENANT_ID=...
AZURE_CLIENT_ID=...
AZURE_CLIENT_SECRET=...
DATABASE_URL=mssql+aioodbc://...
TEAM_PLANNER_PLAN_ID=...
FRONTEND_ORIGIN=https://it-cockpit-frontend.vercel.app
```

Required deployment changes:

- Add the exact Vercel origin `https://it-cockpit-frontend.vercel.app` to CORS.
- Do not rely on strings such as `https://*.teams.microsoft.com` as wildcard origins; use an origin regex or explicit allowed origins supported by the framework.
- Allow `PATCH` as well as `GET` and `OPTIONS` if task completion is enabled.
- Keep credentials and DB access server-side.
- Restrict the API to the intended Entra tenant and authorized IT users/groups.
- Configure the Teams app manifest and Entra app Application ID URI for the deployed frontend/backend domains.
- Grant/admin-consent only the Graph delegated permissions actually required: `User.Read`, mail read access, calendar read access, `Tasks.Read`, and `Tasks.ReadWrite` if task completion is enabled.

## 8. Business decisions to confirm

These points cannot be determined from the UI alone. The backend engineer and product owner should confirm them before final SQL/Graph mapping:

1. Which ManageEngine statuses count as open, resolved, closed, pending approval, and escalated?
2. Is `Total Tickets` all-time, current month, or another reporting window?
3. Does `SLA Breached` mean all historical breaches or only unresolved breached tickets? This document assumes unresolved.
4. What warning window defines `At Risk`?
5. Which database table/columns hold station, category, SLA, first-call resolution, approvals, and escalation data?
6. Which airport station codes should be included and how should aliases such as `DEL T3` be normalized?
7. Which Microsoft Planner plan is the source for Team Tasks?
8. Should users only view team tasks, or may they also complete them?
9. How should Graph/Planner priority values map to `high`, `normal`, and `low`?
10. Should the standalone Vercel website be supported outside Microsoft Teams? The current auth hook expects Teams in production, so standalone sign-in would require a separate MSAL flow.

## 9. Definition of done

Backend work is ready for frontend integration when:

- All P0 endpoints return the documented JSON shapes using live data.
- Mock responses cannot be enabled in production.
- Teams JWT validation and Graph OBO work for a real tenant user.
- ManageEngine values reconcile with agreed SQL reports.
- M365 caching is isolated per user.
- Graph `429`, upstream timeouts, expired tokens, and partial failures are handled without leaking sensitive details.
- The Vercel origin passes CORS preflight, including `PATCH` if used.
- Swagger/OpenAPI documents all routes and response models.
- Automated tests cover authentication, response schemas, authorization, per-user cache separation, and task-update conflicts.

## 10. Official implementation references

- Teams tab SSO: https://learn.microsoft.com/en-us/microsoftteams/platform/tabs/how-to/authentication/tab-sso-overview
- Teams SSO with Microsoft Graph/OBO: https://learn.microsoft.com/en-us/microsoftteams/platform/tabs/how-to/authentication/tab-sso-graph-api
- List mailbox messages: https://learn.microsoft.com/en-us/graph/api/user-list-messages?view=graph-rest-1.0
- List a user's Planner tasks: https://learn.microsoft.com/en-us/graph/api/planneruser-list-tasks?view=graph-rest-1.0
- Planner overview and plan tasks: https://learn.microsoft.com/en-us/graph/planner-concept-overview
- Update a Planner task: https://learn.microsoft.com/en-us/graph/api/plannertask-update?view=graph-rest-1.0
- List a user's calendar view: https://learn.microsoft.com/en-us/graph/api/user-list-calendarview?view=graph-rest-1.0
- Microsoft Graph throttling: https://learn.microsoft.com/en-us/graph/throttling
