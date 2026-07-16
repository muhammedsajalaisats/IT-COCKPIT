const formatToIST = (dateString) => {
  if (!dateString) return '';
  const timeString = !dateString.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(dateString)
    ? `${dateString}Z`
    : dateString;
  try {
    const date = new Date(timeString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short',
      hour12: true
    });
  } catch (err) {
    return dateString;
  }
};

const priorityColor = (p) =>
  p === 'high' || p === 'urgent' ? 'var(--red)'
  : p === 'normal'               ? 'var(--amber)'
  :                                'var(--text-faint)'

export default function MyTasksTab({ data = [], onToggle }) {
  if (typeof data === 'string') {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--red)', fontSize: '13px' }}>
        ⚠️ {data}
      </div>
    )
  }

  if (!data) {
    return <p style={{ color: 'var(--text-faint)', fontSize: '13px', textAlign: 'center', padding: '32px 0' }}>Loading data...</p>
  }

  if (!data.length) {
    return <p style={{ color: 'var(--text-faint)', fontSize: '13px', textAlign: 'center', padding: '32px 0' }}>No items found.</p>
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
          Personal Tasks (Planner)
        </p>
        <a
          href="https://to-do.office.com/"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: '10px', color: 'var(--accent)', textDecoration: 'none',
            fontWeight: 600, border: '1px solid rgba(100,255,218,0.3)',
            padding: '4px 10px', borderRadius: 6, background: 'rgba(100,255,218,0.05)',
            transition: 'all 0.2s',
          }}
          onMouseOver={e => e.currentTarget.style.background = 'rgba(100,255,218,0.15)'}
          onMouseOut={e => e.currentTarget.style.background = 'rgba(100,255,218,0.05)'}
        >
          View in To-Do ↗
        </a>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.map(task => (
          <div
            key={task.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
              background: 'rgba(17,34,64,0.4)', borderRadius: 10, cursor: 'pointer',
              border: '1px solid rgba(30,58,110,0.3)',
              opacity: task.completed || task.done ? 0.5 : 1, transition: 'all 0.2s ease',
            }}
            onMouseOver={e => e.currentTarget.style.background = 'var(--card-hover)'}
            onMouseOut={e => e.currentTarget.style.background = 'rgba(17,34,64,0.4)'}
            onClick={() => onToggle && onToggle(task)}
          >
            {/* Checkbox */}
            <div style={{
              width: 16, height: 16, borderRadius: 4, flexShrink: 0,
              border: `2px solid ${(task.completed || task.done) ? 'var(--accent)' : priorityColor(task.priority)}`,
              background: (task.completed || task.done) ? 'var(--accent)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
            }}>
              {(task.completed || task.done) && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--bg)" strokeWidth="3.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '12px', color: 'var(--text)',
                textDecoration: (task.completed || task.done) ? 'line-through' : 'none',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{task.title}</div>
            </div>
            <span style={{
              fontSize: '10px',
              color: (task.due_at && formatToIST(task.due_at).includes('Today')) || task.due === 'Today' ? 'var(--red)' : 'var(--text-faint)',
              fontWeight: (task.due_at && formatToIST(task.due_at).includes('Today')) || task.due === 'Today' ? 600 : 400,
              flexShrink: 0,
            }}>
              {task.due_at ? formatToIST(task.due_at) : task.due}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
