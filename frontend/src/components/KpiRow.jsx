import { useEffect, useRef, useState } from 'react'

/* ── Icon helpers ─────────────────────────────────────────────────────────── */
const ICONS = {
  total: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/>
      <path d="M13 5v2M13 17v2M13 11v2"/>
    </svg>
  ),
  open: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 8v4l3 3"/>
    </svg>
  ),
  breach: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  resolved: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  ),
  pending: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <polyline points="16 11 18 13 22 9"/>
    </svg>
  ),
}

/** Build KPI card config from live API data or fall back to hardcoded defaults */
function buildKpis(liveKpis) {
  const deltas = liveKpis?.changes_vs_yesterday ?? {}

  function fmtDelta(key) {
    const d = deltas[key]
    if (!d) return null
    const sign   = d.value >= 0 ? '+' : ''
    const suffix = d.unit === 'percent' ? '%' : ''
    return `${sign}${d.value}${suffix}`
  }

  return [
    {
      id: 'total', label: 'Total Tickets',
      value:   liveKpis?.total_tickets   ?? 1248,
      delta:   fmtDelta('total_tickets') ?? '+12%',
      deltaUp: (deltas.total_tickets?.value ?? 12) > 0,
      icon: ICONS.total, color: 'var(--teal)', bg: 'rgba(13,138,138,0.12)',
    },
    {
      id: 'open', label: 'Open Tickets',
      value:   liveKpis?.open_tickets   ?? 387,
      delta:   fmtDelta('open_tickets') ?? '+8',
      deltaUp: (deltas.open_tickets?.value ?? 8) > 0,
      icon: ICONS.open, color: 'var(--amber)', bg: 'var(--amber-dim)',
    },
    {
      id: 'breach', label: 'SLA Breached',
      value:   liveKpis?.sla_breached   ?? 23,
      delta:   fmtDelta('sla_breached') ?? '-3',
      deltaUp: (deltas.sla_breached?.value ?? -3) > 0,
      icon: ICONS.breach, color: 'var(--red)', bg: 'var(--red-dim)',
    },
    {
      id: 'resolved', label: 'Resolved Today',
      value:   liveKpis?.resolved_today   ?? 94,
      delta:   fmtDelta('resolved_today') ?? '+18%',
      deltaUp: (deltas.resolved_today?.value ?? 18) > 0,
      icon: ICONS.resolved, color: 'var(--accent)', bg: 'var(--accent-dim)',
    },
    {
      id: 'pending', label: 'Pending Approval',
      value:   liveKpis?.pending_approval   ?? 56,
      delta:   fmtDelta('pending_approval') ?? '-2',
      deltaUp: (deltas.pending_approval?.value ?? -2) > 0,
      icon: ICONS.pending, color: '#a78bfa', bg: 'rgba(167,139,250,0.12)',
    },
  ]
}

function useCountUp(target, duration = 1200, active = true) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!active) return
    let start = null
    const step = (ts) => {
      if (!start) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      const eased    = 1 - Math.pow(1 - progress, 3)
      setVal(Math.floor(eased * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target, duration, active])
  return val
}

function KpiCard({ kpi, index, active }) {
  const count = useCountUp(kpi.value, 1000 + index * 100, active)
  return (
    <div
      className={`card animate-fade-in-up stagger-${index + 1}`}
      style={{ flex: '1 1 180px', minWidth: 0 }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '10px',
          background: kpi.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: kpi.color,
        }}>
          {kpi.icon}
        </div>
        {kpi.delta && (
          <span className={`badge ${kpi.deltaUp ? 'badge-amber' : 'badge-green'}`}
            style={{ fontSize: '10px' }}>
            {kpi.delta} vs yesterday
          </span>
        )}
      </div>

      {/* Value */}
      <div style={{
        fontSize: '36px', fontWeight: 800, lineHeight: 1,
        color: kpi.color, fontVariantNumeric: 'tabular-nums', marginBottom: 6,
      }}>
        {count.toLocaleString()}
      </div>

      {/* Label */}
      <div style={{ fontSize: '13px', color: 'var(--text-dim)', fontWeight: 500 }}>
        {kpi.label}
      </div>

      {/* Bottom bar */}
      <div style={{ marginTop: 14, height: 3, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 99,
          background: kpi.color,
          width: `${Math.min((kpi.value / 1500) * 100, 100)}%`,
          transition: 'width 1.2s cubic-bezier(0.25,1,0.5,1)',
          boxShadow: `0 0 8px ${kpi.color}`,
        }} />
      </div>
    </div>
  )
}

function KpiSkeleton() {
  return (
    <div className="card" style={{ flex: '1 1 180px', minWidth: 0 }}>
      <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 10, marginBottom: 16 }} />
      <div className="skeleton" style={{ width: '50%', height: 36, borderRadius: 8, marginBottom: 8 }} />
      <div className="skeleton" style={{ width: '70%', height: 14, borderRadius: 6 }} />
    </div>
  )
}

/**
 * KpiRow
 * @param {boolean} isLoading - show skeleton cards while fetching
 * @param {object|null} kpis  - live data from /api/v1/manageengine/all
 */
export default function KpiRow({ isLoading, kpis = null }) {
  const cards = buildKpis(kpis)
  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {isLoading
          ? cards.map((_, i) => <KpiSkeleton key={i} />)
          : cards.map((kpi, i) => (
              <KpiCard key={kpi.id} kpi={kpi} index={i} active={!isLoading} />
            ))
        }
      </div>
    </div>
  )
}
