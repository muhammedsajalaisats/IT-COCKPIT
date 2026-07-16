/**
 * src/hooks/useM365.js
 *
 * Hook for fetching category-specific M365 data (mail, tasks, calendar) from the backend.
 *
 * Returns:
 *   { inboxData, calendarData, myTasksData, teamTasksData, sectionErrors, stale, generatedAt, loading, error, backendDown, refresh, patchTask }
 */

import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/apiClient'

export function useM365(token, authMode) {
  const [inboxData, setInboxData] = useState([])
  const [calendarData, setCalendarData] = useState([])
  const [myTasksData, setMyTasksData] = useState([])
  const [teamTasksData, setTeamTasksData] = useState([])
  const [sectionErrors, setSectionErrors] = useState([])
  const [stale, setStale] = useState(false)
  const [generatedAt, setGeneratedAt] = useState(null)

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

      const fetchSection = async (apiCall, setter, sectionName) => {
        try {
          const res = await apiCall(token, authMode)
          setter(res.data || [])
          return { errors: res.errors || [], stale: res.stale || false, generated_at: res.generated_at }
        } catch (err) {
          console.error(`[useM365] Error fetching ${sectionName}:`, err)
          if (sectionName === 'team_tasks' && (err.status === 403 || err.message?.includes('403') || err.message?.includes('Forbidden'))) {
            setter("Admin approval required for Team Tasks.")
            return {
              errors: [{
                section: sectionName,
                code: 'ADMIN_APPROVAL_REQUIRED',
                message: 'Admin approval required for Team Tasks.',
                retryable: false
              }],
              stale: true,
              generated_at: null
            }
          }
          if (
            err.name === 'AbortError' ||
            err.code === 'BACKEND_UNAVAILABLE' ||
            err.message?.includes('Failed to fetch') ||
            err.message?.includes('Load failed')
          ) {
            throw err
          }
          setter([])
          return {
            errors: [{
              section: sectionName,
              code: err.code || 'FETCH_ERROR',
              message: err.message || 'Failed to fetch',
              retryable: true
            }],
            stale: true,
            generated_at: null
          }
        }
      }

      const results = await Promise.all([
        fetchSection(api.getM365Messages, setInboxData, 'mail'),
        fetchSection(api.getM365Events, setCalendarData, 'calendar'),
        fetchSection(api.getM365PlannerTasks, setMyTasksData, 'my_tasks'),
        fetchSection(api.getM365TeamTasks, setTeamTasksData, 'team_tasks')
      ])

      const gatheredErrors = results.flatMap(r => r.errors)
      const gatheredStale = results.some(r => r.stale)
      const latestGeneratedAt = results.map(r => r.generated_at).filter(Boolean).sort().pop() || null

      setSectionErrors(gatheredErrors)
      setStale(gatheredStale)
      setGeneratedAt(latestGeneratedAt)
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

    const setTarget = section === 'my_tasks' ? setMyTasksData : setTeamTasksData

    // Optimistic update
    setTarget(prev => prev.map(t =>
      t.id === taskId ? { ...t, completed, percent_complete: completed ? 100 : 0 } : t
    ))

    try {
      const updated = await api.patchTask(token, taskId, completed, etag, authMode)
      // Apply the authoritative response (new ETag etc.)
      setTarget(prev => prev.map(t =>
        t.id === taskId
          ? { ...t, completed: updated.completed, percent_complete: updated.percent_complete, etag: updated.etag }
          : t
      ))
    } catch (err) {
      console.error('[useM365] patchTask failed:', err.message)
      // Roll back the optimistic update
      setTarget(prev => prev.map(t =>
        t.id === taskId ? { ...t, completed: !completed, percent_complete: completed ? 0 : 100 } : t
      ))
      // Surface a non-fatal error (409 = stale ETag — tell user to refresh)
      const userMessage = err.status === 409
        ? 'Task was updated elsewhere — please refresh to get the latest state.'
        : `Could not save task: ${err.message}`
      alert(userMessage)
    }
  }, [token, authMode])

  return {
    inboxData,
    calendarData,
    myTasksData,
    teamTasksData,
    sectionErrors,
    stale,
    generatedAt,
    loading,
    error,
    backendDown,
    refresh: fetchAll,
    patchTask
  }
}
