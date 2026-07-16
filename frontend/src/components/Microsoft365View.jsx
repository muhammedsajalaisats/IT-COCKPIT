import { useState } from 'react'
import InboxTab from './InboxTab'
import MyTasksTab from './MyTasksTab'
import TeamsTasksTab from './TeamsTasksTab'
import CalendarTab from './CalendarTab'

const TABS = [
  { id: 'Inbox',      label: 'Inbox',      icon: '📧' },
  { id: 'My Tasks',   label: 'My Tasks',   icon: '✅' },
  { id: 'Team Tasks', label: 'Team Tasks', icon: '👥' },
  { id: 'Calendar',   label: 'Calendar',   icon: '📅' },
]

export default function Microsoft365View({
  isLoading,
  inboxData     = [],
  myTasksData   = [],
  teamTasksData = [],
  calendarData  = [],
  sectionErrors = [],
  stale         = false,
  error         = null,
  onPatchTask,
}) {
  const [activeTab, setActiveTab] = useState('Inbox')

  const handleTabClick = (tabId) => {
    console.log('M365 tab clicked:', tabId)
    setActiveTab(tabId)
  }

  if (isLoading) {
    return (
      <div className="card">
        <div className="skeleton" style={{ width: 200, height: 22, borderRadius: 6, marginBottom: 20 }} />
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {TABS.map(t => (
            <div key={t.id} className="skeleton" style={{ width: 90, height: 34, borderRadius: 8 }} />
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

      {/* ── Page Header ── */}
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
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>Microsoft 365</h2>
            <p style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Mail · Tasks · Calendar</p>
          </div>
        </div>
        <span className={`badge ${error ? 'badge-red' : stale ? 'badge-amber' : 'badge-teal'}`}>
          {error ? 'Error' : stale ? 'Partial' : 'Live'}
        </span>
      </div>

      {/* ── Fatal Error ── */}
      {error && (
        <div style={{
          background: 'rgba(255,77,109,0.08)', border: '1px solid rgba(255,77,109,0.25)',
          borderRadius: 8, padding: '10px 14px', fontSize: '12px', color: 'var(--red)',
        }}>
          Could not connect to backend: {error}
        </div>
      )}

      {/* ── Contextual Tab Bar ── */}
      <div style={{
        display: 'flex', gap: 6,
        borderBottom: '1px solid rgba(30,58,110,0.4)',
        paddingBottom: 12,
        position: 'relative',
        zIndex: 10,
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            id={`m365-tab-${tab.id.toLowerCase().replace(' ', '-')}`}
            type="button"
            onClick={() => {
              console.log('Tab clicked:', tab.id)
              handleTabClick(tab.id)
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 8,
              border: activeTab === tab.id
                ? '1px solid rgba(13,138,138,0.4)'
                : '1px solid transparent',
              background: activeTab === tab.id
                ? 'rgba(13,138,138,0.12)'
                : 'transparent',
              color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-dim)',
              fontSize: '12px', fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: 'pointer', transition: 'all 0.18s ease',
              whiteSpace: 'nowrap',
              position: 'relative',
              zIndex: 10,
            }}
            onMouseOver={e => {
              if (activeTab !== tab.id) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
            }}
            onMouseOut={e => {
              if (activeTab !== tab.id) e.currentTarget.style.background = 'transparent'
            }}
          >
            <span style={{ fontSize: '13px' }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div>
        {activeTab === 'Inbox'      && <InboxTab data={inboxData} />}
        {activeTab === 'My Tasks'   && (
          <MyTasksTab
            data={myTasksData}
            onToggle={t => onPatchTask && onPatchTask(t.id, !(t.completed ?? t.done), t.etag ?? '', 'my_tasks')}
          />
        )}
        {activeTab === 'Team Tasks' && (
          <TeamsTasksTab
            data={teamTasksData}
            onToggle={t => onPatchTask && onPatchTask(t.id, !(t.completed ?? t.done), t.etag ?? '', 'team_tasks')}
          />
        )}
        {activeTab === 'Calendar'   && <CalendarTab data={calendarData} />}
      </div>
    </div>
  )
}
