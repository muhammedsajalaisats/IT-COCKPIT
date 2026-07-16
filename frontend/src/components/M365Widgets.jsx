import InboxTab from './InboxTab'

export default function M365Widgets({
  isLoading,
  inboxData     = [],
  sectionErrors = [],
  stale         = false,
  error         = null,
}) {
  if (isLoading) {
    return (
      <div className="card">
        <div className="skeleton" style={{ width: 160, height: 22, borderRadius: 6, marginBottom: 20 }} />
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="skeleton" style={{ height: 48, borderRadius: 10, marginBottom: 6 }} />
        ))}
      </div>
    )
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'rgba(100,255,218,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--accent)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
          </div>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>Microsoft 365</h2>
            <p style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Recent Mail Overview</p>
          </div>
        </div>
        <span className={`badge ${stale ? 'badge-amber' : 'badge-teal'}`}>
          {error ? 'Error' : stale ? 'Partial' : 'Live'}
        </span>
      </div>

      {/* Fatal error */}
      {error && (
        <div style={{
          background: 'rgba(255,77,109,0.08)', border: '1px solid rgba(255,77,109,0.25)',
          borderRadius: 8, padding: '10px 14px', fontSize: '12px', color: 'var(--red)',
        }}>
          Could not connect to the backend: {error}
        </div>
      )}

      {/* Main Content Area */}
      <div>
        <InboxTab data={inboxData} />
      </div>
    </div>
  )
}
