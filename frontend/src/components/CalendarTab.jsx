const formatToIST = (graphDate) => {
  if (!graphDate) return "No time provided";
  
  let dateTimeStr = "";
  let timeZone = "UTC";
  
  if (typeof graphDate === 'object') {
    if (!graphDate.dateTime) return "No time provided";
    dateTimeStr = graphDate.dateTime;
    timeZone = graphDate.timeZone || "UTC";
  } else {
    dateTimeStr = graphDate;
  }
  
  // Append 'Z' to force UTC parsing if timeZone explicitly says UTC and it doesn't end with Z
  const timeString = timeZone === 'UTC' && !dateTimeStr.endsWith('Z')
    ? `${dateTimeStr}Z`
    : dateTimeStr;
    
  try {
    const date = new Date(timeString);
    if (isNaN(date.getTime())) return dateTimeStr;
    return date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short',
      hour12: true
    });
  } catch (err) {
    return dateTimeStr;
  }
};

const typeColor = (t) => t === 'maintenance' ? 'var(--amber)' : t === 'meeting' ? 'var(--teal-light)' : 'var(--red)'
const typeIcon  = (t) => t === 'maintenance' ? '🔧' : t === 'meeting' ? '📅' : '⏰'

export default function CalendarTab({ data = [] }) {
  if (!data) {
    return <p style={{ color: 'var(--text-faint)', fontSize: '13px', textAlign: 'center', padding: '32px 0' }}>Loading data...</p>
  }

  if (!data.length) {
    return <p style={{ color: 'var(--text-faint)', fontSize: '13px', textAlign: 'center', padding: '32px 0' }}>No items found.</p>
  }

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
          Upcoming Calendar & Meetings
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.map((ev, i) => (
          <div
            key={ev.id || i}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', borderRadius: 10,
              background: 'rgba(17,34,64,0.4)', border: '1px solid rgba(30,58,110,0.3)',
              borderLeft: `3px solid ${typeColor(ev.type)}`,
              transition: 'background 0.2s',
            }}
            onMouseOver={e => e.currentTarget.style.background = 'var(--card-hover)'}
            onMouseOut={e => e.currentTarget.style.background = 'rgba(17,34,64,0.4)'}
          >
            <span style={{ fontSize: '18px', flexShrink: 0 }}>{typeIcon(ev.type)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {ev.title || ev.subject}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: 1 }}>
                {ev.start ? (
                  `Start: ${formatToIST(ev.start)}`
                ) : ev.start_at ? (
                  `Start: ${formatToIST(ev.start_at)}`
                ) : `${ev.day} · ${ev.time}`}
                {ev.end && ` · End: ${formatToIST(ev.end)}`}
                {(!ev.end && ev.end_at) && ` · End: ${formatToIST(ev.end_at)}`}
              </div>
              {ev.location && (
                <div style={{ fontSize: '10px', color: 'var(--text-faint)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                  📍 {ev.location}
                </div>
              )}
            </div>
            {(ev.webLink || ev.web_url) && (
              <a
                href={ev.webLink || ev.web_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: '10px', color: 'var(--accent)', textDecoration: 'none',
                  fontWeight: 600, border: '1px solid rgba(100,255,218,0.3)',
                  padding: '4px 10px', borderRadius: 6, background: 'rgba(100,255,218,0.05)',
                  transition: 'all 0.2s',
                  flexShrink: 0,
                }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(100,255,218,0.15)'}
                onMouseOut={e => e.currentTarget.style.background = 'rgba(100,255,218,0.05)'}
              >
                View Event ↗
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
