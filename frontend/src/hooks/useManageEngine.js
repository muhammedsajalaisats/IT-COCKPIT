/**
 * src/hooks/useManageEngine.js
 *
 * Hook for fetching ManageEngine data from the backend.
 *
 * Returns:
 *   { data, loading, error, backendDown, refresh }
 *
 * - data.kpis       — KPI card values + deltas
 * - data.stations   — per-airport heatmap rows
 * - data.categories — category breakdown chart data
 * - data.sla        — SLA donut chart values
 * - data.summary    — avg resolution, FCR%, escalated
 * - backendDown     — true when the backend returned BACKEND_UNAVAILABLE (503)
 */

import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/apiClient'

const EMPTY = {
  kpis:       null,
  stations:   [],
  categories: [],
  sla:        null,
  summary:    null,
  from_cache: false,
  stale:      false,
  generated_at: null,
}

export function useManageEngine(token, authMode) {
  const [data,        setData      ] = useState(EMPTY)
  const [loading,     setLoading   ] = useState(true)
  const [error,       setError     ] = useState(null)
  const [backendDown, setBackendDown] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (!token) {
        throw new Error("No token provided for authentication")
      }
      const result = await api.getManageEngineAll(token, authMode)
      console.log('ManageEngine API Response:', result)
      setData(result)
      setBackendDown(false)
    } catch (err) {
      console.error("[useManageEngine] Fetch Error:", err)
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

  return { data, loading, error, backendDown, refresh: fetchAll }
}
