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

import { useCallback, useState } from 'react'
import Header from './components/Header'
import KpiRow from './components/KpiRow'
import ManageEngine from './components/ManageEngine'
import M365Widgets from './components/M365Widgets'
import ChatbotWidget from './components/ChatbotWidget'
import ServerConnecting from './components/ServerConnecting'
import MsalLoginScreen from './components/MsalLoginScreen'
import Sidebar from './components/Sidebar'
import Microsoft365View from './components/Microsoft365View'
import { useTeamsAuth } from './hooks/useTeamsAuth'
import { useManageEngine } from './hooks/useManageEngine'
import { useM365 } from './hooks/useM365'

console.log("VITE_API_BASE_URL:", import.meta.env.VITE_API_BASE_URL)

export default function App() {
  // ── Auth state ────────────────────────────────────────────────────────────
  // useTeamsAuth is also called inside useManageEngine / useM365.
  // The MSAL singleton + effect guard ensures the init runs only once;
  // subsequent calls read the cached state from React's hook ordering.
  const auth = useTeamsAuth()
  const me = useManageEngine(auth.token, auth.authMode)
  const m365 = useM365(auth.token, auth.authMode)
  const [activeView, setActiveView] = useState('Dashboard')

  const handleRefresh = useCallback(() => {
    me.refresh()
    m365.refresh()
  }, [me, m365])

  const isLoading = me.loading || m365.loading

  const handleConnected = useCallback(() => {
    me.refresh()
    m365.refresh()
  }, [me, m365])

  // ── Auth loading spinner ──────────────────────────────────────────────────
  // Show a minimal spinner while MSAL / Teams SDK is initialising, or interaction is in progress.
  if (
    (auth.loading && !auth.token && !auth.needsMsalLogin) ||
    (auth.inProgress && auth.inProgress !== auth.InteractionStatus.None)
  ) {
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
          {auth.inProgress === auth.InteractionStatus.HandleRedirect
            ? 'Completing authentication login redirect…'
            : auth.inProgress === auth.InteractionStatus.Logout
              ? 'Signing out of Microsoft account…'
              : 'Initialising authentication…'}
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── MSAL login gate ───────────────────────────────────────────────────────
  // Teams SDK unavailable and no active authenticated session → show sign-in screen.
  if (!auth.isAuthenticated && auth.needsMsalLogin) {
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
    <div className="bg-gradient-animated min-h-screen" style={{ display: 'flex' }}>
      {/* Sidebar Navigation */}
      <Sidebar activeView={activeView} setActiveView={setActiveView} />

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Full-screen "Connecting to server…" overlay — auto-dismissed on recovery */}
        {(me.backendDown || m365.backendDown) && (
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
            lastRefreshedAt={me.data?.generated_at ?? m365.data?.generated_at ?? null}
            account={auth.account}
            logout={auth.logout}
          />

          <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '0 24px' }}>
            <div className="animate-fade-in-up stagger-1">
              <KpiRow
                isLoading={me.loading}
                kpis={me.data?.kpis ?? null}
              />
            </div>

            <div className="main-content-area" style={{ marginTop: '24px' }}>
              {activeView === 'Dashboard' && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 720px), 1fr))',
                  gap: '24px',
                }}>
                  <div className="animate-fade-in-up stagger-3">
                    <ManageEngine
                      isLoading={me.loading}
                      stations={me.data?.stations ?? []}
                      categories={me.data?.categories ?? []}
                      sla={me.data?.sla ?? null}
                      summary={me.data?.summary ?? null}
                      error={me.error}
                      stale={me.data?.stale ?? false}
                    />
                  </div>
                  <div className="animate-fade-in-up stagger-4">
                    <M365Widgets
                      isLoading={m365.loading}
                      inboxData={m365.inboxData}
                      sectionErrors={m365.sectionErrors}
                      stale={m365.stale}
                      error={m365.error}
                    />
                  </div>
                </div>
              )}
              {activeView === 'Microsoft365' && (
                <Microsoft365View
                  isLoading={m365.loading}
                  inboxData={m365.inboxData}
                  myTasksData={m365.myTasksData}
                  teamTasksData={m365.teamTasksData}
                  calendarData={m365.calendarData}
                  sectionErrors={m365.sectionErrors}
                  stale={m365.stale}
                  error={m365.error}
                  onPatchTask={m365.patchTask}
                />
              )}
            </div>
          </div>
        </div>

        <ChatbotWidget />
      </div>
    </div>
  )
}
