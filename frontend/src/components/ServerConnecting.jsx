/**
 * src/components/ServerConnecting.jsx
 *
 * Full-screen overlay shown when the FastAPI backend is unreachable.
 * Polls the /health endpoint every 4 seconds and automatically removes
 * itself once the backend comes back online — no manual refresh needed.
 *
 * Triggered when any data hook receives error.code === 'BACKEND_UNAVAILABLE'.
 */

import { useEffect, useRef, useState } from 'react'

const RETRY_INTERVAL_MS = 4000
const rawBase = import.meta.env.VITE_API_BASE_URL || ''
const HEALTH_URL = rawBase.replace(/\/$/, '') + '/api/health'

export default function ServerConnecting({ onConnected }) {
  const [countdown,    setCountdown   ] = useState(RETRY_INTERVAL_MS / 1000)
  const [attempt,      setAttempt     ] = useState(1)
  const [pingStatus,   setPingStatus  ] = useState('waiting') // 'waiting' | 'checking' | 'failed'
  const [loadingMessage, setLoadingMessage] = useState('Connecting to ME Cockpit...')
  const intervalRef = useRef(null)

  useEffect(() => {
    const t1 = setTimeout(() => {
      setLoadingMessage('Waking up the backend server...')
    }, 5000)

    const t2 = setTimeout(() => {
      setLoadingMessage('Server cold start in progress. This may take up to a minute on the free tier...')
    }, 15000)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  useEffect(() => {
    let tick = RETRY_INTERVAL_MS / 1000

    // Countdown timer — updates every second
    const countdownId = setInterval(() => {
      tick -= 1
      setCountdown(tick)
      if (tick <= 0) tick = RETRY_INTERVAL_MS / 1000
    }, 1000)

    // Health-check poller — fires every RETRY_INTERVAL_MS
    const pollId = setInterval(async () => {
      setPingStatus('checking')
      try {
        const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(2500) })
        if (res.ok) {
          clearInterval(pollId)
          clearInterval(countdownId)
          onConnected()          // lift state — App hides this overlay
          return
        }
      } catch {
        /* still unreachable */
      }
      setPingStatus('failed')
      setAttempt(prev => prev + 1)
      setCountdown(RETRY_INTERVAL_MS / 1000)
      tick = RETRY_INTERVAL_MS / 1000
    }, RETRY_INTERVAL_MS)

    intervalRef.current = { pollId, countdownId }

    return () => {
      clearInterval(pollId)
      clearInterval(countdownId)
    }
  }, [onConnected])

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #07112b 0%, #0b1e3f 60%, #0e2347 100%)',
      gap: '24px',
      padding: '24px',
    }}>
      {/* Brand logo */}
      <img
        src="https://www.aisats.in/images/AIR%20INDIA%20SATS%20NEW%20LOGO.png"
        alt="Air India SATS Logo"
        style={{
          height: '42px',
          objectFit: 'contain',
          marginBottom: '8px',
          filter: 'drop-shadow(0 0 12px rgba(13,138,138,0.2))',
        }}
      />

      {/* Animated radar ring */}
      <div style={{ position: 'relative', width: 96, height: 96 }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: '2px solid rgba(13,138,138,0.25)',
          animation: 'sc-ping 2s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute',
          inset: 8,
          borderRadius: '50%',
          border: '2px solid rgba(13,138,138,0.4)',
          animation: 'sc-ping 2s ease-in-out infinite 0.4s',
        }} />
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: '3px solid transparent',
          borderTopColor: '#0d8a8a',
          animation: 'sc-spin 1s linear infinite',
        }} />
        {/* Server icon */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
        }}>
          🖥️
        </div>
      </div>

      {/* Status text */}
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <h2 style={{
          fontSize: '1.25rem',
          fontWeight: 700,
          color: '#f8fafc',
          marginBottom: 12,
          letterSpacing: '-0.01em',
          lineHeight: 1.4,
          padding: '0 16px',
        }}>
          {loadingMessage}
        </h2>
        <p style={{
          color: '#94a3b8',
          fontSize: '0.9rem',
          lineHeight: 1.6,
          marginBottom: 16,
        }}>
          The FastAPI backend is initializing.
          {pingStatus === 'checking'
            ? ' Checking health status…'
            : ` Retry #${attempt} in ${countdown}s.`
          }
        </p>

        {/* Command hint */}
        <div style={{
          background: 'rgba(13,138,138,0.08)',
          border: '1px solid rgba(13,138,138,0.3)',
          borderRadius: 10,
          padding: '12px 16px',
          textAlign: 'left',
          marginBottom: 16,
        }}>
          <p style={{ color: '#64ffda', fontSize: '0.78rem', marginBottom: 6, fontWeight: 600 }}>
            ⚡ Start both servers in one command:
          </p>
          <code style={{
            display: 'block',
            color: '#e2e8f0',
            fontSize: '0.82rem',
            fontFamily: "'Fira Code', 'Cascadia Code', 'Courier New', monospace",
            letterSpacing: '0.02em',
          }}>
            npm run dev:all
          </code>
        </div>

        {/* Progress dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#0d8a8a',
              animation: `sc-bounce 1.2s ease-in-out infinite`,
              animationDelay: `${i * 0.2}s`,
            }} />
          ))}
        </div>
      </div>

      {/* CSS keyframes injected inline */}
      <style>{`
        @keyframes sc-ping {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50%       { transform: scale(1.18); opacity: 0.2; }
        }
        @keyframes sc-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes sc-bounce {
          0%, 80%, 100% { transform: translateY(0);    opacity: 0.4; }
          40%            { transform: translateY(-8px); opacity: 1;   }
        }
      `}</style>
    </div>
  )
}
