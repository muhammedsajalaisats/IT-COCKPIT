import { useState, useEffect } from 'react'

export default function Header({ lastRefresh, onRefresh }) {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const fmt = (d) => d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const fmtDate = (d) => d.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const sinceRefresh = Math.floor((time - lastRefresh) / 1000)
  const sinceText = sinceRefresh < 60
    ? `${sinceRefresh}s ago`
    : `${Math.floor(sinceRefresh / 60)}m ago`

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
        {/* Left: Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
          {/* Logo mark */}
          <div style={{
            width: 38, height: 38, borderRadius: '10px', flexShrink: 0,
            background: 'linear-gradient(135deg, var(--teal) 0%, var(--accent) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px rgba(13,138,138,0.5)',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
              <path d="M7 8h3M7 11h3M14 8h3M14 11h3" />
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>
              ME Cockpit
            </h1>
            <p style={{ fontSize: '11px', color: 'var(--text-dim)', letterSpacing: '0.3px' }}>
              Air India SATS
            </p>
          </div>
        </div>

        {/* Center: Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="pulse-dot" />
          <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Live</span>
          <span style={{ fontSize: '12px', color: 'var(--text-faint)' }}>·</span>
          <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Refreshed {sinceText}</span>
        </div>

        {/* Right: Time + Refresh */}
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
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'var(--accent-dim)', border: '1px solid rgba(100,255,218,0.3)',
              color: 'var(--accent)', borderRadius: '8px',
              padding: '7px 14px', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
              transition: 'all 0.2s ease',
            }}
            onMouseOver={e => e.currentTarget.style.background = 'rgba(100,255,218,0.2)'}
            onMouseOut={e => e.currentTarget.style.background = 'var(--accent-dim)'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            Refresh
          </button>

          {/* Avatar */}
          <div style={{
            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, var(--teal) 0%, #0b5a8a 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '13px', fontWeight: 700, color: 'white',
            border: '2px solid var(--border)', cursor: 'pointer',
          }}>
            IT
          </div>
        </div>
      </div>
    </header>
  )
}
