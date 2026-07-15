/**
 * App.jsx — IT Cockpit root component.
 *
 * Wires the data-fetching hooks to the dashboard components.
 * The Refresh button triggers re-fetches from both backend APIs.
 *
 * Auth flow:
 *   1. useTeamsAuth() tries Teams SDK → success → loads dashboard.
 *   2. Teams SDK fails (plain browser) → shows MsalLoginScreen.
 *   3. User clicks "Sign in with Microsoft" → loginPopup() → real Graph token.
 *   4. Dashboard loads with live data.
 *
 * When the FastAPI backend is unreachable, the ServerConnecting overlay
 * is shown and auto-retries every 4 s until the backend comes online.
 */

import { useCallback } from 'react'
import Header from './components/Header'
import M365Widgets from './components/M365Widgets'
import ChatbotWidget from './components/ChatbotWidget'
import ServerConnecting from './components/ServerConnecting'
import MsalLoginScreen from './components/MsalLoginScreen'
import { useTeamsAuth } from './hooks/useTeamsAuth'
import { useM365 } from './hooks/useM365'

console.log("VITE_API_BASE_URL:", import.meta.env.VITE_API_BASE_URL)

export default function App() {
  // ── Auth state ────────────────────────────────────────────────────────────
  // useTeamsAuth is also called inside useM365.
  // The MSAL singleton + effect guard ensures the init runs only once;
  // subsequent calls read the cached state from React's hook ordering.
  const auth = useTeamsAuth()
  const m365 = useM365(auth.token, auth.authMode)

  const handleRefresh = useCallback(() => {
    m365.refresh()
  }, [m365])

  const isLoading = m365.loading

  const handleConnected = useCallback(() => {
    m365.refresh()
  }, [m365])

  // ── Auth loading spinner ──────────────────────────────────────────────────
  // Show a minimal spinner while MSAL / Teams SDK is initialising.
  if (auth.loading && !auth.token && !auth.needsMsalLogin) {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0b1e3f',
        flexDirection: 'column', gap: 16,
      }}>
        <div style={{
          width: 40, height: 40,
          borderRadius: '50%',
          border: '3px solid rgba(13,138,138,0.3)',
          borderTopColor: '#0d8a8a',
          animation: 'spin 0.9s linear infinite',
        }} />
        <p style={{ color: '#64ffda', fontSize: '0.875rem' }}>
          Initialising authentication…
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── MSAL login gate ───────────────────────────────────────────────────────
  // Teams SDK unavailable and no cached session → show sign-in screen.
  if (auth.needsMsalLogin) {
    return (
      <MsalLoginScreen
        onLogin={auth.msalLogin}
        onReset={auth.resetMsalState}
        loading={auth.loading}
        error={auth.error}
      />
    )
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  return (
    <div className="bg-gradient-animated min-h-screen">
      {/* Full-screen "Connecting to server…" overlay — auto-dismissed on recovery */}
      {m365.backendDown && (
        <ServerConnecting onConnected={handleConnected} />
      )}

      {/* Background grid pattern */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        backgroundImage: `linear-gradient(rgba(30,58,110,0.15) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(30,58,110,0.15) 1px, transparent 1px)`,
        backgroundSize: '40px 40px'
      }} />

      <div style={{ position: 'relative', zIndex: 1, padding: '0 0 32px 0' }}>
        <Header
          onRefresh={handleRefresh}
          isLoading={isLoading}
          lastRefreshedAt={m365.data?.generated_at ?? null}
        />

        <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '0 24px' }}>
          <div style={{ marginTop: '24px' }}>
            <div className="animate-fade-in-up stagger-3">
              <M365Widgets
                isLoading={isLoading}
                mail={m365.data?.mail ?? []}
                myTasks={m365.data?.my_tasks ?? []}
                teamTasks={m365.data?.team_tasks ?? []}
                calendar={m365.data?.calendar ?? []}
                sectionErrors={m365.data?.errors ?? []}
                stale={m365.data?.stale ?? false}
                onPatchTask={m365.patchTask}
                error={m365.error}
              />
            </div>
          </div>
        </div>
      </div>

      <ChatbotWidget />
    </div>
  )
}
