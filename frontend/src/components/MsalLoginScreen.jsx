/**
 * src/components/MsalLoginScreen.jsx
 *
 * Full-screen sign-in page shown when:
 *   - The app is running in a plain browser (not inside Teams)
 *   - Teams SDK initialisation has failed
 *   - The user has no cached MSAL session
 *
 * The "Sign in with Microsoft" button triggers loginPopup() via the
 * msalLogin callback provided by useTeamsAuth().
 *
 * A secondary "Reset Auth State" button is provided to forcefully clear
 * corrupted MSAL browser cache state and reload the page.
 */

export default function MsalLoginScreen({ onLogin, onReset, loading, error }) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9998,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #07112b 0%, #0b1e3f 55%, #0e2347 100%)',
      padding: '24px',
      gap: '32px',
    }}>
      {/* Animated background rings */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {[280, 420, 560, 700].map((size, i) => (
          <div key={i} style={{
            position: 'absolute',
            top: '50%', left: '50%',
            width: size, height: size,
            marginTop: -size / 2, marginLeft: -size / 2,
            borderRadius: '50%',
            border: '1px solid rgba(13,138,138,0.1)',
            animation: `mls-pulse 6s ease-in-out infinite`,
            animationDelay: `${i * 1.2}s`,
          }} />
        ))}
      </div>

      {/* Logo / Brand */}
      <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <img
          src="https://www.aisats.in/images/AIR%20INDIA%20SATS%20NEW%20LOGO.png"
          alt="ME Cockpit Logo"
          className="h-16 w-auto object-contain mx-auto mb-4"
          style={{ height: '64px', width: 'auto', margin: '0 auto 16px' }}
        />
      </div>

      {/* Sign-in card */}
      <div style={{
        position: 'relative', zIndex: 1,
        background: 'rgba(17,34,64,0.85)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(30,58,110,0.7)',
        borderRadius: 20,
        padding: '40px 48px',
        maxWidth: 440,
        width: '100%',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        textAlign: 'center',
      }}>
        <h2 style={{
          fontSize: '1.2rem',
          fontWeight: 700,
          color: '#f8fafc',
          marginBottom: 8,
        }}>
          Sign in to continue
        </h2>
        <p style={{
          color: '#94a3b8',
          fontSize: '0.875rem',
          lineHeight: 1.6,
          marginBottom: 28,
        }}>
          This app is running outside Microsoft Teams.
          Sign in with your Microsoft work account to access the dashboard.
        </p>

        {/* Sign-in button */}
        <button
          id="msal-login-btn"
          onClick={onLogin}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            width: '100%',
            padding: '14px 24px',
            borderRadius: 12,
            border: '1px solid rgba(30,58,110,0.8)',
            background: loading
              ? 'rgba(13,138,138,0.2)'
              : 'linear-gradient(135deg, #0d8a8a 0%, #0b6b6b 100%)',
            color: '#f8fafc',
            fontSize: '0.9375rem',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: loading ? 'none' : '0 4px 16px rgba(13,138,138,0.35)',
          }}
          onMouseEnter={e => {
            if (!loading) {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(13,138,138,0.5)'
            }
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = loading ? 'none' : '0 4px 16px rgba(13,138,138,0.35)'
          }}
        >
          {loading ? (
            <>
              <div style={{
                width: 18, height: 18,
                borderRadius: '50%',
                border: '2px solid rgba(248,250,252,0.3)',
                borderTopColor: '#f8fafc',
                animation: 'mls-spin 0.8s linear infinite',
              }} />
              Signing in…
            </>
          ) : (
            <>
              {/* Microsoft "M" icon */}
              <svg width="18" height="18" viewBox="0 0 21 21" fill="none">
                <rect x="1"  y="1"  width="9" height="9" fill="#F25022"/>
                <rect x="11" y="1"  width="9" height="9" fill="#7FBA00"/>
                <rect x="1"  y="11" width="9" height="9" fill="#00A4EF"/>
                <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
              </svg>
              Sign in with Microsoft
            </>
          )}
        </button>

        {/* Reset Auth State button (Fallback recovery mechanism) */}
        {onReset && (
          <button
            id="msal-reset-btn"
            onClick={onReset}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              width: '100%',
              padding: '12px 24px',
              borderRadius: 12,
              border: '1px solid rgba(255, 77, 109, 0.4)',
              background: 'rgba(255, 77, 109, 0.05)',
              color: '#ff4d6d',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              marginTop: 12,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255, 77, 109, 0.15)'
              e.currentTarget.style.boxShadow = '0 0 16px rgba(255, 77, 109, 0.2)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255, 77, 109, 0.05)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            🔄 Reset Auth State
          </button>
        )}

        {/* Error message */}
        {error && (
          <div style={{
            marginTop: 16,
            padding: '10px 14px',
            borderRadius: 8,
            background: 'rgba(255,77,109,0.12)',
            border: '1px solid rgba(255,77,109,0.3)',
            color: '#ff4d6d',
            fontSize: '0.8125rem',
            textAlign: 'left',
          }}>
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* Footer note */}
      <p style={{
        position: 'relative', zIndex: 1,
        color: '#475569',
        fontSize: '0.75rem',
        textAlign: 'center',
        maxWidth: 400,
      }}>
        Your credentials are handled securely by Microsoft Entra ID.
        ME Cockpit never stores your password.
      </p>

      {/* CSS keyframes */}
      <style>{`
        @keyframes mls-pulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50%       { opacity: 0.08; transform: scale(1.04); }
        }
        @keyframes mls-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
