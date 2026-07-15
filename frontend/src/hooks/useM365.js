/**
 * src/hooks/useM365.js
 *
 * Hook for fetching all M365 data (mail, tasks, calendar) from the backend.
 *
 * Returns:
 *   { data, loading, error, refresh }
 *
 * - data.mail        — inbox messages
 * - data.my_tasks    — personal Planner tasks
 * - data.team_tasks  — team Planner tasks
 * - data.calendar    — upcoming calendar events
 * - data.errors      — safe per-section error objects from the backend
 * - data.stale       — true when some sections fell back to cached/empty data
 *
 * The hook also exposes patchTask() for checkbox persistence via Planner.
 */

import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/apiClient'

const EMPTY = {
  mail:       [],
  my_tasks:   [],
  team_tasks: [],
  calendar:   [],
  errors:     [],
  stale:      false,
  from_cache: false,
  generated_at: null,
}

export function useM365(token, authMode) {
  const [data,    setData   ] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error,   setError  ] = useState(null)
  const [backendDown, setBackendDown] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (!token) {
        throw new Error("No token provided for authentication")
      }
      const result = await api.getM365All(token, authMode)
      console.log('M365 API Response:', result)
      setData(result)
      setBackendDown(false)
    } catch (err) {
      console.error("[useM365] Fetch Error:", err)
      if (err.name === 'AbortError') {
        setError("The backend server took too long to respond.")
      } else {
        setError(err.message || "Failed to fetch data")
      }
      setBackendDown(
        err.code === 'BACKEND_UNAVAILABLE' ||
        err.name === 'AbortError' ||
        err.message?.includes('Failed to fetch') ||
        err.message?.includes('Load failed')
      )
    } finally {
      setLoading(false)
    }
  }, [token, authMode])

  // Fetch whenever the token is available and resolved
  useEffect(() => {
    if (token) {
      fetchAll()
    } else {
      setLoading(false)
    }
  }, [token, fetchAll])

  /**
   * Persist a task checkbox toggle via PATCH /api/v1/m365/tasks/{id}.
   * Optimistically updates local state; rolls back on error.
   */
  const patchTask = useCallback(async (taskId, completed, etag, section = 'my_tasks') => {
    if (!token) return

    // Optimistic update
    setData(prev => ({
      ...prev,
      [section]: prev[section].map(t =>
        t.id === taskId ? { ...t, completed, percent_complete: completed ? 100 : 0 } : t
      ),
    }))

    try {
      const updated = await api.patchTask(token, taskId, completed, etag, authMode)
      // Apply the authoritative response (new ETag etc.)
      setData(prev => ({
        ...prev,
        [section]: prev[section].map(t =>
          t.id === taskId
            ? { ...t, completed: updated.completed, percent_complete: updated.percent_complete, etag: updated.etag }
            : t
        ),
      }))
    } catch (err) {
      console.error('[useM365] patchTask failed:', err.message)
      // Roll back the optimistic update
      setData(prev => ({
        ...prev,
        [section]: prev[section].map(t =>
          t.id === taskId ? { ...t, completed: !completed, percent_complete: completed ? 0 : 100 } : t
        ),
      }))
      // Surface a non-fatal error (409 = stale ETag — tell user to refresh)
      const userMessage = err.status === 409
        ? 'Task was updated elsewhere — please refresh to get the latest state.'
        : `Could not save task: ${err.message}`
      alert(userMessage)
    }
  }, [token, authMode])

  return { data, loading, error, backendDown, refresh: fetchAll, patchTask }
}
