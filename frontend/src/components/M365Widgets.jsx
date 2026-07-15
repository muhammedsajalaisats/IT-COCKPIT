/**
 * M365Widgets.jsx
 *
 * Microsoft 365 panel — Inbox, My Tasks, Team Tasks, Calendar.
 *
 * Accepts live data as props from App.jsx (via useM365 hook).
 * Falls back to an empty-state message when data is unavailable.
 * Task checkboxes call onPatchTask() to persist state via Planner.
 */

import { useState } from 'react'

/* ── Helpers ────────────────────────────────────────────────────────────────── */

/** Format an ISO 8601 date string into a human-readable label */
function fmtDate(isoString) {
  if (!isoString) return ''
  const d    = new Date(isoString)
  const now  = new Date()
  const todayStr    = now.toDateString()
  const tomorrowStr = new Date(now.getTime() + 86_400_000).toDateString()
  if (d.toDateString() === todayStr)    return 'Today'
  if (d.toDateString() === tomorrowStr) return 'Tomorrow'
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
}

/** Format received_at / start_at for display */
function fmtTime(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

const priorityColor = (p) =>
  p === 'high' || p === 'urgent' ? 'var(--red)'
  : p === 'normal'               ? 'var(--amber)'
  :                                'var(--text-faint)'

/* ── Email list ─────────────────────────────────────────────────────────────── */
function EmailList({ emails }) {
  const [selected, setSelected] = useState(null)
  const unreadCount = emails.filter(e => e.unread).length

  if (!emails.length) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-faint)', fontSize: '13px' }}>
        No messages to show
      </div>
    )
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
        {emails.map(email => (
          <a
            key={email.id}
            href={email.web_url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => { if (!email.web_url) { e.preventDefault(); setSelected(selected === email.id ? null : email.id) } }}
            style={{
              display: 'block',
              padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
              background: email.unread ? 'rgba(13,138,138,0.08)' : 'rgba(17,34,64,0.4)',
              border: `1px solid ${email.unread ? 'rgba(13,138,138,0.25)' : 'rgba(30,58,110,0.3)'}`,
              transition: 'all 0.2s ease',
              borderLeft: email.priority === 'high' ? '3px solid var(--red)' : `3px solid transparent`,
              textDecoration: 'none',
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
                {fmtTime(email.received_at) || email.time}
              </span>
            </div>
            <div style={{
              fontSize: '12px', color: 'var(--text-dim)',
              marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {email.subject}
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}

/* ── Task list ──────────────────────────────────────────────────────────────── */
function TaskList({ tasks, onToggle }) {
  if (!tasks.length) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-faint)', fontSize: '13px' }}>
        No tasks to show
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {tasks.map(task => (
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
            color: (task.due_at && fmtDate(task.due_at) === 'Today') || task.due === 'Today' ? 'var(--red)' : 'var(--text-faint)',
            fontWeight: (task.due_at && fmtDate(task.due_at) === 'Today') || task.due === 'Today' ? 600 : 400,
            flexShrink: 0,
          }}>
            {task.due_at ? fmtDate(task.due_at) : task.due}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ── Calendar list ──────────────────────────────────────────────────────────── */
function CalendarList({ events }) {
  const typeColor = (t) => t === 'maintenance' ? 'var(--amber)' : t === 'meeting' ? 'var(--teal-light)' : 'var(--red)'
  const typeIcon  = (t) => t === 'maintenance' ? '🔧' : t === 'meeting' ? '📅' : '⏰'

  if (!events.length) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-faint)', fontSize: '13px' }}>
        No upcoming events
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {events.map((ev, i) => (
        <a
          key={ev.id || i}
          href={ev.web_url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 12px', borderRadius: 10,
            background: 'rgba(17,34,64,0.4)', border: '1px solid rgba(30,58,110,0.3)',
            borderLeft: `3px solid ${typeColor(ev.type)}`,
            textDecoration: 'none',
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
              {ev.start_at ? `${fmtDate(ev.start_at)} · ${fmtTime(ev.start_at)}` : `${ev.day} · ${ev.time}`}
            </div>
          </div>
        </a>
      ))}
    </div>
  )
}

/* ── Section error banner ───────────────────────────────────────────────────── */
function SectionErrorBanner({ errors }) {
  if (!errors?.length) return null
  return (
    <div style={{
      background: 'rgba(255,184,48,0.08)', border: '1px solid rgba(255,184,48,0.25)',
      borderRadius: 8, padding: '8px 12px', marginBottom: 8,
    }}>
      {errors.map((e, i) => (
        <div key={i} style={{ fontSize: '11px', color: 'var(--amber)' }}>
          ⚠ {e.section}: {e.message} {e.retryable ? '(will retry)' : ''}
        </div>
      ))}
    </div>
  )
}

/* ── Main Component ─────────────────────────────────────────────────────────── */
const TABS = ['Inbox', 'My Tasks', 'Team Tasks', 'Calendar']

export default function M365Widgets({
  isLoading,
  mail       = [],
  myTasks    = [],
  teamTasks  = [],
  calendar   = [],
  sectionErrors = [],
  stale      = false,
  error      = null,
  onPatchTask,
}) {
  const [activeTab, setActiveTab] = useState('Inbox')

  const handleTaskToggle = (task, section) => {
    if (!onPatchTask) return
    onPatchTask(task.id, !(task.completed ?? task.done), task.etag ?? '', section)
  }

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
        <SectionErrorBanner errors={sectionErrors.filter(e =>
          (activeTab === 'Inbox'      && e.section === 'mail')      ||
          (activeTab === 'My Tasks'   && e.section === 'my_tasks')  ||
          (activeTab === 'Team Tasks' && e.section === 'team_tasks') ||
          (activeTab === 'Calendar'   && e.section === 'calendar')
        )} />

        {activeTab === 'Inbox'      && <EmailList emails={mail} />}
        {activeTab === 'My Tasks'   && (
          <TaskList
            tasks={myTasks}
            onToggle={t => handleTaskToggle(t, 'my_tasks')}
          />
        )}
        {activeTab === 'Team Tasks' && (
          <TaskList
            tasks={teamTasks}
            onToggle={t => handleTaskToggle(t, 'team_tasks')}
          />
        )}
        {activeTab === 'Calendar'   && <CalendarList events={calendar} />}
      </div>
    </div>
  )
}
