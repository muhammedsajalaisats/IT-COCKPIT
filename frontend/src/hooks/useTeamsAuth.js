import { useState, useEffect } from 'react'

const IS_LOCAL = import.meta.env.VITE_ENV === 'local' || import.meta.env.DEV

/**
 * useTeamsAuth
 * Returns { token, user, loading, error }
 *
 * In local/dev mode: returns a mock JWT so you can develop without Teams.
 * In production (inside Teams): calls the Teams JS SDK to get a real token.
 */
export function useTeamsAuth() {
  const [token, setToken] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function init() {
      try {
        if (IS_LOCAL) {
          // ── Local dev mock ──────────────────────────
          // Replace with your own email for testing
          await new Promise(r => setTimeout(r, 300))
          setToken('mock-jwt-token-for-local-dev')
          setUser({ email: 'it.admin@airsats.com', name: 'IT Admin (Local)' })
        } else {
          // ── Production: Teams SDK ───────────────────
          const { app, authentication } = await import('@microsoft/teams-js')
          await app.initialize()
          const context = await app.getContext()
          const authToken = await authentication.getAuthToken()
          setToken(authToken)
          setUser({
            email: context.user?.loginHint || context.user?.userPrincipalName,
            name: context.user?.displayName || 'IT User',
          })
        }
      } catch (err) {
        console.error('[useTeamsAuth] Error:', err)
        setError(err.message || 'Authentication failed')
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [])

  return { token, user, loading, error }
}
