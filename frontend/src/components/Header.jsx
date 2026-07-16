/**
 * Header.jsx
 *
 * Sticky top bar. Shows live clock, refresh state, and triggers data refetch.
 * lastRefreshedAt is the ISO timestamp from the API response (generated_at).
 */

import { useState, useEffect } from 'react'

export default function Header({ onRefresh, isLoading = false, lastRefreshedAt = null, account = null, logout = null }) {
  const [time, setTime] = useState(new Date())
  const [isProfileOpen, setIsProfileOpen] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const fmt = (d) => d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const fmtDate = (d) => d.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  // Show how long ago the data was generated (from the API timestamp)
  let sinceText = 'Never'
  if (lastRefreshedAt) {
    const last = new Date(lastRefreshedAt)
    const secs = Math.max(0, Math.floor((time - last) / 1000))
    sinceText = secs < 60 ? `${secs}s ago` : `${Math.floor(secs / 60)}m ago`
  }

  return (
    <header style={{
      background: 'rgba(11,30,63,0.85)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--border)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      padding: '0 24px',
    }}>
      <div style={{
        maxWidth: '1600px',
        margin: '0 auto',
        height: '68px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
      }}>
        {/* Left: Completely empty spacer */}
        <div style={{ minWidth: 0 }} />

        {/* Center: Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="pulse-dot" style={{ background: isLoading ? 'var(--amber)' : undefined }} />
          <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
            {isLoading ? 'Loading…' : 'Live'}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-faint)' }}>·</span>
          <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
            {isLoading ? 'Fetching data' : `Refreshed ${sinceText}`}
          </span>
        </div>

        {/* Right: Time + Refresh + Avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
              {fmt(time)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
              {fmtDate(time)}
            </div>
          </div>

          <button
            id="btn-refresh"
            onClick={onRefresh}
            disabled={isLoading}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: isLoading ? 'rgba(100,255,218,0.05)' : 'var(--accent-dim)',
              border: '1px solid rgba(100,255,218,0.3)',
              color: isLoading ? 'var(--text-faint)' : 'var(--accent)',
              borderRadius: '8px', padding: '7px 14px', cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '13px', fontWeight: 500, transition: 'all 0.2s ease',
            }}
            onMouseOver={e => { if (!isLoading) e.currentTarget.style.background = 'rgba(100,255,218,0.2)' }}
            onMouseOut={e => { if (!isLoading) e.currentTarget.style.background = 'var(--accent-dim)' }}
          >
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
              style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }}
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            {isLoading ? 'Loading…' : 'Refresh'}
          </button>

          {/* Avatar and Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              id="header-profile-avatar"
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              type="button"
              style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, var(--teal) 0%, #0b5a8a 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '13px', fontWeight: 700, color: 'white',
                border: '2px solid var(--border)', cursor: 'pointer',
                outline: 'none', position: 'relative', zIndex: 110,
              }}
            >
              {account?.name ? account.name.charAt(0).toUpperCase() : 'IT'}
            </button>

            {isProfileOpen && (
              <div
                id="header-profile-dropdown"
                style={{
                  position: 'absolute',
                  top: '46px',
                  right: 0,
                  width: '240px',
                  background: 'rgba(11,30,63,0.98)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '16px',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  zIndex: 200,
                  textAlign: 'left',
                }}
              >
                {/* User Info */}
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {account?.name || 'ME Cockpit User'}
                  </p>
                  <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '2px 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {account?.username || 'user@airsats.com'}
                  </p>
                </div>

                {/* Sign Out Button */}
                {logout && (
                  <button
                    id="btn-sign-out"
                    onClick={() => {
                      setIsProfileOpen(false)
                      logout()
                    }}
                    type="button"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'rgba(255, 77, 109, 0.1)',
                      border: '1px solid rgba(255, 77, 109, 0.3)',
                      color: 'var(--red)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      textAlign: 'center',
                    }}
                    onMouseOver={e => {
                      e.currentTarget.style.background = 'rgba(255, 77, 109, 0.2)'
                    }}
                    onMouseOut={e => {
                      e.currentTarget.style.background = 'rgba(255, 77, 109, 0.1)'
                    }}
                  >
                    Sign Out
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
