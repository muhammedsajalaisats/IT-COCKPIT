import { useState } from 'react'

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

export default function InboxTab({ data = [] }) {
  const [selected, setSelected] = useState(null)
  const unreadCount = data.filter(e => e.unread).length

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
          Inbox Triage
        </p>
        {unreadCount > 0 && (
          <span style={{
            background: 'var(--red)', color: 'white', borderRadius: '99px',
            fontSize: '10px', fontWeight: 700, padding: '2px 7px',
          }}>
            {unreadCount} new
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.map(email => (
          <div
            key={email.id}
            onClick={() => setSelected(selected === email.id ? null : email.id)}
            style={{
              display: 'block',
              padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
              background: email.unread ? 'rgba(13,138,138,0.08)' : 'rgba(17,34,64,0.4)',
              border: `1px solid ${email.unread ? 'rgba(13,138,138,0.25)' : 'rgba(30,58,110,0.3)'}`,
              transition: 'all 0.2s ease',
              borderLeft: email.priority === 'high' ? '3px solid var(--red)' : `3px solid transparent`,
            }}
            onMouseOver={e => e.currentTarget.style.background = 'var(--card-hover)'}
            onMouseOut={e => e.currentTarget.style.background = email.unread ? 'rgba(13,138,138,0.08)' : 'rgba(17,34,64,0.4)'}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                {email.unread && (
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--teal)', flexShrink: 0 }} />
                )}
                <span style={{
                  fontSize: '12px', fontWeight: email.unread ? 600 : 400,
                  color: email.unread ? 'var(--text)' : 'var(--text-dim)',
                  flexShrink: 0,
                }}>{email.sender_name || email.from}</span>
              </div>
              <span style={{ fontSize: '10px', color: 'var(--text-faint)', flexShrink: 0 }}>
                {formatToIST(email.received_at) || email.time}
              </span>
            </div>
            <div style={{
              fontSize: '12px', color: 'var(--text-dim)',
              marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {email.subject}
            </div>
            {(email.webLink || email.web_url) && (
              <div style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end' }}>
                <a
                  href={email.webLink || email.web_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  style={{
                    fontSize: '10px', color: 'var(--accent)', textDecoration: 'none',
                    fontWeight: 600, border: '1px solid rgba(100,255,218,0.3)',
                    padding: '2px 8px', borderRadius: 4, background: 'rgba(100,255,218,0.05)',
                    transition: 'all 0.2s',
                  }}
                  onMouseOver={e => e.currentTarget.style.background = 'rgba(100,255,218,0.15)'}
                  onMouseOut={e => e.currentTarget.style.background = 'rgba(100,255,218,0.05)'}
                >
                  View in Outlook ↗
                </a>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
