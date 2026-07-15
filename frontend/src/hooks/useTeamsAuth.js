/**
 * src/hooks/useTeamsAuth.js
 *
 * Unified authentication hook for IT Cockpit.
 *
 * Auth path selection:
 *   1. Teams SDK (production / inside Teams client)
 *      → calls authentication.getAuthToken() to get a Teams SSO token
 *      → backend validates via JWKS + does OBO exchange for a Graph token
 *
 *   2. MSAL browser redirect (local dev / plain browser — Teams SDK unavailable)
 *      → loginRedirect() redirects the entire tab to Microsoft for a Graph-scoped token,
 *        completely bypassing browser popup blockers.
 *      → handleRedirectPromise() captures the callback on mount.
 *      → backend receives the token with header X-Auth-Mode: msal-direct
 *      → backend decodes claims (no sig verification in local mode) + uses
 *        the token as a pass-through Graph token (no OBO needed)
 *
 * Return shape:
 *   {
 *     token          — Bearer token string (null until authenticated)
 *     user           — { email, name } (null until authenticated)
 *     loading        — true while SDK init / token acquisition is in progress
 *     error          — error message string or null
 *     needsMsalLogin — true when MSAL redirect needs to be triggered by the user
 *     msalLogin      — async function; call on button click to trigger redirect flow
 *     resetMsalState — function to clear storage and reload page if corrupted
 *     authMode       — 'teams' | 'msal-direct' | null; passed as X-Auth-Mode header
 *   }
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { PublicClientApplication } from '@azure/msal-browser'
import { msalConfig, GRAPH_SCOPES } from '../lib/msalConfig'

// ── MSAL singleton (module-level) ─────────────────────────────────────────────
// Created exactly ONCE per page load, well outside React's render lifecycle.
const _msalInstance = new PublicClientApplication(msalConfig)

// ── Idempotent initialisation promise ────────────────────────────────────────
let _msalInitPromise = null

// Helper to aggressively clear interaction status keys from storage on mount
function clearMsalInteractionKeys() {
  try {
    const clearStorage = (storage) => {
      const keysToRemove = []
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i)
        if (key) {
          const lowerKey = key.toLowerCase()
          if (
            lowerKey.includes('interaction_status') ||
            lowerKey.includes('interaction.status') ||
            lowerKey.includes('interaction_in_progress') ||
            lowerKey.includes('interaction')
          ) {
            keysToRemove.push(key)
          }
        }
      }
      keysToRemove.forEach((k) => storage.removeItem(k))
    }
    clearStorage(sessionStorage)
    clearStorage(localStorage)
    console.info('[useTeamsAuth] Cleared interaction status keys on mount.')
  } catch (e) {
    console.warn('[useTeamsAuth] Failed to clear MSAL interaction keys:', e)
  }
}

async function _runMsalInit() {
  // Check if returning from redirect by checking the hash
  const hasHash = window.location.hash && (
    window.location.hash.includes('code=') ||
    window.location.hash.includes('id_token=') ||
    window.location.hash.includes('access_token=') ||
    window.location.hash.includes('error=')
  )

  if (!hasHash) {
    // Safe to clear interaction keys to prevent stuck status if not in redirect flow
    clearMsalInteractionKeys()
  }

  if (!_msalInstance.getConfiguration) {
    await _msalInstance.initialize()
  } else {
    try {
      await _msalInstance.initialize()
    } catch (initErr) {
      if (!initErr?.message?.toLowerCase().includes('already')) throw initErr
    }
  }

  try {
    // Process redirect result if coming back from MSAL login redirect
    const redirectResult = await _msalInstance.handleRedirectPromise()
    return redirectResult
  } catch (redirectErr) {
    console.error('[useTeamsAuth] handleRedirectPromise error:', redirectErr)
    clearMsalInteractionKeys()
    throw redirectErr
  }
}

function getMsalInitPromise() {
  if (!_msalInitPromise) {
    _msalInitPromise = _runMsalInit().catch((err) => {
      _msalInitPromise = null
      throw err
    })
  }
  return _msalInitPromise
}

// ── Teams SDK "not-in-Teams" error signatures ─────────────────────────────────
const TEAMS_EXPECTED_ERRORS = [
  'no parent window found',
  'sdk initialization timed out',
  'not initialized',
  'app not initialized',
  'inteams',
]

function isExpectedTeamsError(err) {
  if (!err) return false
  const msg = (err.message || err.toString() || '').toLowerCase()
  return TEAMS_EXPECTED_ERRORS.some((sig) => msg.includes(sig))
}

// Strict-Mode / HMR guard
let _authInitStarted = false

// ─────────────────────────────────────────────────────────────────────────────
export function useTeamsAuth() {
  const [token,          setToken] = useState(null)
  const [user,           setUser] = useState(null)
  const [loading,        setLoading] = useState(true)
  const [error,          setError] = useState(null)
  const [needsMsalLogin, setNeedsMsalLogin] = useState(false)
  const [authMode,       setAuthMode] = useState(null)

  const msalRef = useRef(_msalInstance)

  useEffect(() => {
    if (_authInitStarted) return
    _authInitStarted = true

    async function init() {
      setLoading(true)
      try {
        // ────────────────────────────────────────────────────────────────────────
        // PATH 1 — Teams SDK (inside Teams frame)
        // ────────────────────────────────────────────────────────────────────────
        try {
          const { app, authentication } = await import('@microsoft/teams-js')
          await app.initialize()

          const context = await app.getContext()
          const authToken = await authentication.getAuthToken()

          setToken(authToken)
          setAuthMode('teams')
          setUser({
            email: context.user?.loginHint || context.user?.userPrincipalName || '',
            name:  context.user?.displayName || 'IT User',
          })
          return

        } catch (teamsErr) {
          if (isExpectedTeamsError(teamsErr)) {
            console.debug(
              '[useTeamsAuth] Not inside Teams — falling back to MSAL browser redirect.',
              `(suppressed: ${teamsErr?.message})`
            )
          } else {
            console.info(
              '[useTeamsAuth] Teams SDK unavailable. Switching to MSAL redirect.',
              teamsErr?.message
            )
          }
        }

        // ────────────────────────────────────────────────────────────────────────
        // PATH 2 — MSAL browser redirect (local dev / plain browser)
        // ────────────────────────────────────────────────────────────────────────
        setNeedsMsalLogin(false)

        const redirectResult = await getMsalInitPromise()
        const msal = msalRef.current

        // 1. Capture the Redirect Response
        if (redirectResult) {
          console.info('[useTeamsAuth] Redirect callback resolved successfully.', redirectResult)
          
          // 2. Set Active Account
          if (redirectResult.account) {
            msal.setActiveAccount(redirectResult.account)
          }
          
          setToken(redirectResult.accessToken)
          setAuthMode('msal-direct')
          setUser({
            email: redirectResult.account?.username || redirectResult.account?.idTokenClaims?.email || '',
            name:  redirectResult.account?.name     || redirectResult.account?.idTokenClaims?.name  || 'IT User',
          })
          return
        }

        // 3. Handle Existing Sessions on Mount
        const accounts = msal.getAllAccounts()
        if (accounts.length > 0) {
          const account = accounts[0]
          msal.setActiveAccount(account)

          try {
            console.info('[useTeamsAuth] Found cached account. Attempting acquireTokenSilent.')
            const silentPromise = msal.acquireTokenSilent({
              scopes:  GRAPH_SCOPES,
              account,
            })
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Silent token acquisition timed out')), 5000)
            )
            const silentResult = await Promise.race([silentPromise, timeoutPromise])

            setToken(silentResult.accessToken)
            setAuthMode('msal-direct')
            setUser({
              email: account.username || account.idTokenClaims?.email || '',
              name:  account.name     || account.idTokenClaims?.name  || 'IT User',
            })
            return
          } catch (silentErr) {
            console.error(
              '[useTeamsAuth] Silent token acquisition failed — prompting redirect login:',
              silentErr
            )
            setNeedsMsalLogin(true)
          }
        } else {
          // Neither redirectResult nor silent login succeeded. Show redirect button.
          setNeedsMsalLogin(true)
        }

      } catch (msalErr) {
        console.error('[useTeamsAuth] MSAL initialisation failed:', msalErr)
        setError(msalErr?.message || 'MSAL initialisation failed')
        setNeedsMsalLogin(true)
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [])

  // ────────────────────────────────────────────────────────────────────────────
  // msalLogin — Trigger loginRedirect flow to strictly avoid popup blocks
  // ────────────────────────────────────────────────────────────────────────────
  const msalLogin = useCallback(async () => {
    const msal = msalRef.current
    try {
      setLoading(true)
      setError(null)

      await getMsalInitPromise()

      // Active Account Check before Redirect
      const accounts = msal.getAllAccounts()
      if (accounts.length > 0) {
        const account = accounts[0]
        msal.setActiveAccount(account)
        try {
          console.info('[useTeamsAuth] Active account found. Attempting silent acquisition.')
          const silentPromise = msal.acquireTokenSilent({
            scopes: GRAPH_SCOPES,
            account,
          })
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Silent token acquisition timed out')), 5000)
          )
          const silentResult = await Promise.race([silentPromise, timeoutPromise])

          setToken(silentResult.accessToken)
          setAuthMode('msal-direct')
          setUser({
            email: account.username || account.idTokenClaims?.email || '',
            name:  account.name     || account.idTokenClaims?.name  || 'IT User',
          })
          setNeedsMsalLogin(false)
          return
        } catch (silentErr) {
          console.error('[useTeamsAuth] Silent acquisition failed, redirecting...', silentErr)
        }
      }

      console.info('[useTeamsAuth] Initiating MSAL loginRedirect...')
      await msal.loginRedirect({
        scopes: GRAPH_SCOPES,
        prompt: 'select_account',
      })

    } catch (err) {
      console.error('[useTeamsAuth] loginRedirect failed:', err)
      setError(err?.message || 'Redirect login failed')
    } finally {
      setLoading(false)
    }
  }, [])

  // resetMsalState — User-driven reset to resolve hard persistent browser lockups
  const resetMsalState = useCallback(() => {
    try {
      sessionStorage.clear()
      localStorage.clear()
      window.location.reload()
    } catch (e) {
      console.error('[useTeamsAuth] Failed to reset MSAL state:', e)
    }
  }, [])

  return { token, user, loading, error, needsMsalLogin, msalLogin, resetMsalState, authMode }
}
