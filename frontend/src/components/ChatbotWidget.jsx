import { useState, useEffect } from 'react'

/* ─────────────────────────────────────────────────────────────────────────────
   ChatbotWidget.jsx
   Floating Action Button that expands into a full Copilot Studio chat window.
   Uses the existing CSS design-token variables (--teal, --card, --border …).
───────────────────────────────────────────────────────────────────────────── */

// ── Copilot Studio iframe URL ─────────────────────────────────────────────────
const COPILOT_SRC =
  'https://copilotstudio.microsoft.com/environments/Default-34465b8c-2359-4706-8187-a581c53d6bf2/bots/cre53_TechnologySupport/canvas?__version__=2&enableFileAttachment=true'

// ── Copilot-style "AI rings" SVG icon ────────────────────────────────────────
function CopilotIcon({ size = 28, color = 'white' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
    >
      {/* Outer ring */}
      <circle cx="14" cy="14" r="12" stroke={color} strokeWidth="1.6" strokeDasharray="4 2.5" strokeLinecap="round" opacity="0.5" />
      {/* Middle ring */}
      <circle cx="14" cy="14" r="8" stroke={color} strokeWidth="1.8" strokeDasharray="6 3" strokeLinecap="round" opacity="0.75" />
      {/* Core glow */}
      <circle cx="14" cy="14" r="4" fill={color} opacity="0.9" />
      {/* Sparkle top-right */}
      <line x1="21" y1="7" x2="22.5" y2="5.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
      <line x1="22" y1="6" x2="22" y2="4" stroke={color} strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
      <line x1="23" y1="7" x2="25" y2="7" stroke={color} strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
    </svg>
  )
}

// ── CloseIcon ─────────────────────────────────────────────────────────────────
function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

// ── Main widget ───────────────────────────────────────────────────────────────
export default function ChatbotWidget() {
  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(false)  // controls CSS animation
  const [iframeLoaded, setIframeLoaded] = useState(false)

  // Animate panel in/out
  useEffect(() => {
    if (open) {
      // Small delay so the DOM mounts before the transition class is applied
      const t = setTimeout(() => setVisible(true), 10)
      return () => clearTimeout(t)
    } else {
      setVisible(false)
    }
  }, [open])

  const handleOpen = () => { setOpen(true); setIframeLoaded(false) }
  const handleClose = () => setOpen(false)

  return (
    <>
      {/* ── Floating chat window ──────────────────────────────────────────── */}
      {open && (
        <div
          role="dialog"
          aria-label="AI Assistant chat"
          aria-modal="true"
          style={{
            position: 'fixed',
            bottom: '96px',
            right: '24px',
            width: '380px',
            height: '600px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: '20px',
            overflow: 'hidden',
            border: '1px solid var(--border)',
            background: 'var(--card)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.55), 0 0 0 1px rgba(13,138,138,0.2)',
            /* Slide-up + fade animation */
            transform: visible ? 'translateY(0)   scale(1)' : 'translateY(20px) scale(0.97)',
            opacity: visible ? 1 : 0,
            transition: 'transform 0.28s cubic-bezier(0.34,1.2,0.64,1), opacity 0.22s ease',
          }}
        >
          {/* ── Header ──────────────────────────────────────────────────── */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            background: 'linear-gradient(135deg, #0b2a4a 0%, #0d3b5e 100%)',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}>
            {/* Left: icon + title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: '10px',
                background: 'linear-gradient(135deg, var(--teal) 0%, #0a6b8a 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 12px rgba(13,138,138,0.5)',
                flexShrink: 0,
              }}>
                <CopilotIcon size={20} color="white" />
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
                  AI Assistant
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: 'var(--accent)',
                    display: 'inline-block',
                    boxShadow: '0 0 6px rgba(100,255,218,0.8)',
                  }} />
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                    Copilot Studio · Online
                  </span>
                </div>
              </div>
            </div>

            {/* Right: action buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {/* Minimize / close */}
              <button
                id="chatbot-close-btn"
                onClick={handleClose}
                title="Close chat"
                style={{
                  width: 30, height: 30, borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.06)',
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
                onMouseOver={e => {
                  e.currentTarget.style.background = 'rgba(255,77,109,0.2)'
                  e.currentTarget.style.color = 'var(--red)'
                  e.currentTarget.style.borderColor = 'rgba(255,77,109,0.4)'
                }}
                onMouseOut={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                  e.currentTarget.style.color = 'var(--text-dim)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                }}
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          {/* ── iFrame body ─────────────────────────────────────────────── */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            overflow: 'hidden',
            background: '#0c1e3a',
          }}>
            {/* Loading skeleton shown while iframe bootstraps */}
            {!iframeLoaded && (
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
                background: '#0c1e3a',
                zIndex: 2,
              }}>
                {/* Animated copilot rings loader */}
                <div style={{ position: 'relative', width: 60, height: 60 }}>
                  <div style={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    border: '2px solid var(--teal)', opacity: 0.6,
                    animation: 'chatbot-spin 1.8s linear infinite',
                    borderTopColor: 'transparent',
                  }} />
                  <div style={{
                    position: 'absolute', inset: 8, borderRadius: '50%',
                    border: '2px solid var(--accent)', opacity: 0.5,
                    animation: 'chatbot-spin 1.2s linear infinite reverse',
                    borderRightColor: 'transparent',
                  }} />
                  <div style={{
                    position: 'absolute', inset: 18, borderRadius: '50%',
                    background: 'var(--teal)', opacity: 0.9,
                  }} />
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
                  Loading AI Assistant...
                </div>
              </div>
            )}

            <iframe
              id="copilot-chat-iframe"
              src={COPILOT_SRC}
              title="AI Assistant — Copilot Studio"
              frameBorder="0"
              allow="microphone; camera"
              onLoad={() => setIframeLoaded(true)}
              style={{
                width: '100%',
                height: '100%',
                flex: 1,
                border: 'none',
                display: 'block',
                /* Keep in DOM so the session isn't lost on re-open */
                opacity: iframeLoaded ? 1 : 0,
                transition: 'opacity 0.3s ease',
              }}
            />
          </div>
        </div>
      )}

      {/* ── FAB button ───────────────────────────────────────────────────── */}
      <button
        id="chatbot-fab-btn"
        onClick={open ? handleClose : handleOpen}
        title={open ? 'Close AI Assistant' : 'Open AI Assistant'}
        aria-label={open ? 'Close AI Assistant' : 'Open AI Assistant'}
        aria-expanded={open}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          border: '2px solid rgba(13,138,138,0.5)',
          cursor: 'pointer',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          /* Gradient matching the brand */
          background: open
            ? 'linear-gradient(135deg, #0b2a4a 0%, #0d3b5e 100%)'
            : 'linear-gradient(135deg, var(--teal) 0%, #0a6b8a 60%, #0b2a4a 100%)',
          boxShadow: open
            ? '0 4px 20px rgba(0,0,0,0.4)'
            : '0 6px 28px rgba(13,138,138,0.55), 0 2px 8px rgba(0,0,0,0.4)',
          transition: 'all 0.25s cubic-bezier(0.34,1.2,0.64,1)',
          /* Subtle breathing glow when closed */
          animation: open ? 'none' : 'fab-breathe 3s ease-in-out infinite',
        }}
        onMouseOver={e => {
          if (!open) {
            e.currentTarget.style.transform = 'scale(1.1) translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 10px 36px rgba(13,138,138,0.7), 0 4px 12px rgba(0,0,0,0.4)'
          }
        }}
        onMouseOut={e => {
          e.currentTarget.style.transform = 'scale(1) translateY(0)'
          e.currentTarget.style.boxShadow = open
            ? '0 4px 20px rgba(0,0,0,0.4)'
            : '0 6px 28px rgba(13,138,138,0.55), 0 2px 8px rgba(0,0,0,0.4)'
        }}
      >
        {/* Animated icon: rotates between AI icon and X */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: open ? 'rotate(180deg) scale(0.85)' : 'rotate(0deg) scale(1)',
          transition: 'transform 0.3s cubic-bezier(0.34,1.2,0.64,1)',
        }}>
          {open
            ? <CloseIcon />
            : <CopilotIcon size={28} color="white" />
          }
        </div>

        {/* Notification badge / unread dot (always shown when closed) */}
        {!open && (
          <span style={{
            position: 'absolute',
            top: 3, right: 3,
            width: 12, height: 12,
            borderRadius: '50%',
            background: 'var(--accent)',
            border: '2px solid var(--bg)',
            boxShadow: '0 0 8px rgba(100,255,218,0.8)',
            animation: 'fab-ping 2.5s ease-out infinite',
          }} />
        )}
      </button>
    </>
  )
}
