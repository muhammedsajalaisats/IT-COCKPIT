import { useState } from 'react'

/* ── Mock Data ─────────────────────────────── */
const MOCK_EMAILS = [
  { id: 1, from: 'Ops Control', subject: 'Flight delay impacting IT services at DEL T3', time: '9:42 AM', unread: true, priority: 'high' },
  { id: 2, from: 'Azure Monitor', subject: '[ALERT] CPU spike on AISATS-PROD-01 > 90%', time: '9:18 AM', unread: true, priority: 'high' },
  { id: 3, from: 'Nilesh Kumar', subject: 'Re: VPN access for new joiners — BOM team', time: '8:55 AM', unread: true, priority: 'normal' },
  { id: 4, from: 'ServiceDesk', subject: 'Ticket #4821 escalated to L3 — please review', time: '8:30 AM', unread: false, priority: 'normal' },
  { id: 5, from: 'HR Systems', subject: 'Onboarding IT checklist — 5 new staff joining Monday', time: 'Yesterday', unread: false, priority: 'low' },
]

const MOCK_TASKS = {
  mine: [
    { id: 1, title: 'Renew SSL cert for aisats-internal.com', due: 'Today', priority: 'high', done: false },
    { id: 2, title: 'Review firewall rules for BOM DMZ segment', due: 'Jul 15', priority: 'normal', done: false },
    { id: 3, title: 'Update CMDB entries for new hardware batch', due: 'Jul 17', priority: 'low', done: true },
    { id: 4, title: 'DR drill — tabletop exercise prep', due: 'Jul 20', priority: 'normal', done: false },
  ],
  team: [
    { id: 5, title: 'Deploy Teams Rooms firmware update', due: 'Jul 14', priority: 'high', done: false },
    { id: 6, title: 'Complete ISO 27001 gap assessment', due: 'Jul 22', priority: 'high', done: false },
    { id: 7, title: 'Migrate legacy backup to Azure Vault', due: 'Jul 31', priority: 'normal', done: false },
  ],
}

const MOCK_UPCOMING = [
  { title: 'Server Maintenance Window', time: '02:00 – 04:00 AM', day: 'Tomorrow', type: 'maintenance' },
  { title: 'IT Steering Committee', time: '10:30 AM', day: 'Monday', type: 'meeting' },
  { title: 'Azure Subscription Renewal', time: 'All Day', day: 'Jul 18', type: 'deadline' },
]

/* ── Sub-components ─────────────────────────── */
function EmailList() {
  const [selected, setSelected] = useState(null)
  const unreadCount = MOCK_EMAILS.filter(e => e.unread).length

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
        {MOCK_EMAILS.map(email => (
          <div
            key={email.id}
            onClick={() => setSelected(selected === email.id ? null : email.id)}
            style={{
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
                }}>{email.from}</span>
              </div>
              <span style={{ fontSize: '10px', color: 'var(--text-faint)', flexShrink: 0 }}>{email.time}</span>
            </div>
            <div style={{
              fontSize: '12px', color: 'var(--text-dim)',
              marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {email.subject}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TaskList({ tasks }) {
  const [items, setItems] = useState(tasks)
  const toggle = (id) => setItems(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t))

  const priorityColor = (p) => p === 'high' ? 'var(--red)' : p === 'normal' ? 'var(--amber)' : 'var(--text-faint)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map(task => (
        <div key={task.id} style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
          background: 'rgba(17,34,64,0.4)', borderRadius: 10, cursor: 'pointer',
          border: '1px solid rgba(30,58,110,0.3)',
          opacity: task.done ? 0.5 : 1, transition: 'all 0.2s ease',
        }}
          onMouseOver={e => e.currentTarget.style.background = 'var(--card-hover)'}
          onMouseOut={e => e.currentTarget.style.background = 'rgba(17,34,64,0.4)'}
          onClick={() => toggle(task.id)}
        >
          {/* Checkbox */}
          <div style={{
            width: 16, height: 16, borderRadius: 4, flexShrink: 0,
            border: `2px solid ${task.done ? 'var(--accent)' : priorityColor(task.priority)}`,
            background: task.done ? 'var(--accent)' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
          }}>
            {task.done && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--bg)" strokeWidth="3.5" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: '12px', color: 'var(--text)', textDecoration: task.done ? 'line-through' : 'none',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{task.title}</div>
          </div>
          <span style={{
            fontSize: '10px', color: task.due === 'Today' ? 'var(--red)' : 'var(--text-faint)',
            fontWeight: task.due === 'Today' ? 600 : 400, flexShrink: 0,
          }}>{task.due}</span>
        </div>
      ))}
    </div>
  )
}

function CalendarList() {
  const typeColor = (t) => t === 'maintenance' ? 'var(--amber)' : t === 'meeting' ? 'var(--teal-light)' : 'var(--red)'
  const typeIcon = (t) => {
    if (t === 'maintenance') return '🔧'
    if (t === 'meeting') return '📅'
    return '⏰'
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {MOCK_UPCOMING.map((e, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 12px', borderRadius: 10,
          background: 'rgba(17,34,64,0.4)', border: '1px solid rgba(30,58,110,0.3)',
          borderLeft: `3px solid ${typeColor(e.type)}`,
        }}>
          <span style={{ fontSize: '18px', flexShrink: 0 }}>{typeIcon(e.type)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {e.title}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: 1 }}>
              {e.day} · {e.time}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Main Component ─────────────────────────── */
const TABS = ['Inbox', 'My Tasks', 'Team Tasks', 'Calendar']

export default function M365Widgets({ isLoading }) {
  const [activeTab, setActiveTab] = useState('Inbox')

  if (isLoading) {
    return (
      <div className="card">
        <div className="skeleton" style={{ width: 160, height: 22, borderRadius: 6, marginBottom: 20 }} />
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {TABS.map((_, i) => (
            <div key={i} className="skeleton" style={{ width: 80, height: 32, borderRadius: 8 }} />
          ))}
        </div>
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
            <p style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Exchange · Planner · Calendar</p>
          </div>
        </div>
        <span className="badge badge-teal">Mock Data</span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, background: 'rgba(11,30,63,0.6)', borderRadius: 10, padding: 4 }}>
        {TABS.map(tab => (
          <button
            key={tab}
            id={`tab-${tab.toLowerCase().replace(' ', '-')}`}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1, padding: '6px 0', borderRadius: 7, border: 'none', cursor: 'pointer',
              fontSize: '12px', fontWeight: activeTab === tab ? 600 : 400,
              background: activeTab === tab ? 'var(--card)' : 'transparent',
              color: activeTab === tab ? 'var(--text)' : 'var(--text-dim)',
              transition: 'all 0.2s ease',
              boxShadow: activeTab === tab ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'Inbox'      && <EmailList />}
        {activeTab === 'My Tasks'   && <TaskList tasks={MOCK_TASKS.mine} />}
        {activeTab === 'Team Tasks' && <TaskList tasks={MOCK_TASKS.team} />}
        {activeTab === 'Calendar'   && <CalendarList />}
      </div>
    </div>
  )
}
