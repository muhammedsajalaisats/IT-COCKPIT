/**
 * src/lib/apiClient.js
 *
 * Centralised API helper for IT Cockpit.
 *
 * - Attaches the Bearer token to every request automatically.
 * - Routes all /api calls through the Vite dev-proxy (localhost:8000)
 *   so there are no CORS issues during local development.
 * - Throws structured errors that match the backend error contract.
 */

const rawBase = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
const API_BASE = rawBase.replace(/\/$/, '')

/**
 * Core fetch wrapper.
 * @param {string}  path      - e.g. "/api/v1/m365/all"
 * @param {string}  token     - Bearer token from useTeamsAuth
 * @param {object}  options   - fetch() options override
 * @param {string}  [authMode] - 'teams' | 'msal-direct'; forwarded as X-Auth-Mode header
 */
export async function apiFetch(path, token, options = {}, authMode = null) {
  const url = `${API_BASE}${path}`
  console.log("Fetching from:", url)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Accept':        'application/json',
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
        // Tell the backend how to process this token:
        //   'teams'       → validate via JWKS + OBO exchange (production)
        //   'msal-direct' → token is already a Graph token; use as pass-through
        ...(authMode ? { 'X-Auth-Mode': authMode } : {}),
        ...(options.headers ?? {}),
      },
    })

    if (!response.ok) {
      let errorBody
      try { errorBody = await response.json() } catch { errorBody = null }
      const message =
        errorBody?.error?.message ??
        errorBody?.detail ??
        `HTTP ${response.status}`
      const err = new Error(message)
      err.status = response.status
      err.code   = errorBody?.error?.code ?? 'API_ERROR'
      err.retryable = errorBody?.error?.retryable ?? false
      throw err
    }

    return response.json()
  } catch (err) {
    if (err.name === 'AbortError') {
      const timeoutErr = new Error("The backend server took too long to respond.")
      timeoutErr.name = 'AbortError'
      throw timeoutErr
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}

// ── Convenience methods ───────────────────────────────────────────────────────

export const api = {
  /** GET /api/v1/me */
  getMe: (token, authMode) =>
    apiFetch('/api/v1/me', token, {}, authMode),

  /** GET /api/v1/m365/all */
  getM365All: (token, authMode) =>
    apiFetch('/api/v1/m365/all', token, {}, authMode),

  /** GET /api/v1/m365/me/messages */
  getM365Messages: (token, authMode) =>
    apiFetch('/api/v1/m365/me/messages', token, {}, authMode),

  /** GET /api/v1/m365/me/events */
  getM365Events: (token, authMode) =>
    apiFetch('/api/v1/m365/me/events', token, {}, authMode),

  /** GET /api/v1/m365/me/planner/tasks */
  getM365PlannerTasks: (token, authMode) =>
    apiFetch('/api/v1/m365/me/planner/tasks', token, {}, authMode),

  /** GET /api/v1/m365/tasks/team */
  getM365TeamTasks: (token, authMode) =>
    apiFetch('/api/v1/m365/tasks/team', token, {}, authMode),

  /** GET /api/v1/manageengine/all */
  getManageEngineAll: (token, authMode) =>
    apiFetch('/api/v1/manageengine/all', token, {}, authMode),

  /** PATCH /api/v1/m365/tasks/{taskId} */
  patchTask: (token, taskId, completed, etag, authMode) =>
    apiFetch(`/api/v1/m365/tasks/${encodeURIComponent(taskId)}`, token, {
      method:  'PATCH',
      headers: { 'If-Match': etag },
      body:    JSON.stringify({ completed, etag }),
    }, authMode),
}
