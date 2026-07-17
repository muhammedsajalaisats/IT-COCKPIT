/**
 * ManageEngine.jsx
 *
 * ManageEngine ServiceDesk Plus panel.
 * Accepts live data as props from App.jsx (via useManageEngine hook).
 * Falls back to sensible defaults when data is loading or unavailable.
 */

import { useEffect, useRef } from 'react'
import {
  Chart as ChartJS,
  ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement,
  Title,
} from 'chart.js'
import { Doughnut, Bar } from 'react-chartjs-2'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title)

/* ── Heat color helper ──────────────────────── */
function heatColor(tickets) {
  if (tickets >= 80) return { bg: 'rgba(255,77,109,0.25)', border: 'rgba(255,77,109,0.6)', text: '#ff4d6d' }
  if (tickets >= 50) return { bg: 'rgba(255,184,48,0.2)', border: 'rgba(255,184,48,0.5)', text: '#ffb830' }
  if (tickets >= 25) return { bg: 'rgba(13,138,138,0.2)', border: 'rgba(13,138,138,0.5)', text: '#0fb3b3' }
  return { bg: 'rgba(100,255,218,0.1)', border: 'rgba(100,255,218,0.3)', text: '#64ffda' }
}

/* ── Chart defaults ─────────────────────────── */
const chartOptions = () => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#112240', borderColor: '#1e3a6e', borderWidth: 1,
      titleColor: '#f8fafc', bodyColor: '#cbd5e1', padding: 10,
    },
  },
  scales: {
    x: {
      grid: { color: 'rgba(30,58,110,0.5)', drawBorder: false },
      ticks: { color: '#cbd5e1', font: { size: 11 } },
    },
    y: {
      grid: { color: 'rgba(30,58,110,0.5)', drawBorder: false },
      ticks: { color: '#cbd5e1', font: { size: 11 } },
    },
  },
})

const donutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '72%',
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        color: '#cbd5e1', padding: 16, font: { size: 12 },
        boxWidth: 12, boxHeight: 12, borderRadius: 4,
      },
    },
    tooltip: {
      backgroundColor: '#112240', borderColor: '#1e3a6e', borderWidth: 1,
      titleColor: '#f8fafc', bodyColor: '#cbd5e1', padding: 10,
    },
  },
}

function SkeletonBlock({ h = 200 }) {
  return <div className="skeleton" style={{ height: h, borderRadius: 12 }} />
}

/* ── Fallback chart data (shown while real data loads) ──────────────────────── */
const FALLBACK_CATEGORY_LABELS = ['Network', 'Hardware', 'Software', 'Access', 'Email', 'Other']
const FALLBACK_SLA = { met: 312, at_risk: 52, breached: 23 }

const CHART_COLORS = [
  'rgba(13,138,138,0.8)', 'rgba(100,255,218,0.8)', 'rgba(255,184,48,0.8)',
  'rgba(167,139,250,0.8)', 'rgba(255,77,109,0.8)', 'rgba(139,162,176,0.8)',
]

/* ── Main Component ─────────────────────────── */
export default function ManageEngine({
  isLoading,
  stations = [],
  categories = [],
  sla = null,
  summary = null,
  error = null,
  stale = false,
}) {
  if (isLoading) {
    return (
      <div className="card">
        <div className="skeleton" style={{ width: 180, height: 22, borderRadius: 6, marginBottom: 20 }} />
        <SkeletonBlock h={160} />
        <div style={{ marginTop: 20 }}>
          <SkeletonBlock h={200} />
        </div>
      </div>
    )
  }

  // Build chart data from live API data (or fallback)
  const catLabels = categories.length
    ? categories.map(c => c.category)
    : FALLBACK_CATEGORY_LABELS

  const catValues = categories.length
    ? categories.map(c => c.open_tickets ?? c.count ?? 0)
    : [92, 74, 61, 55, 48, 27]

  const categoryChartData = {
    labels: catLabels,
    datasets: [{
      label: 'Open Tickets',
      data: catValues,
      backgroundColor: CHART_COLORS,
      borderColor: 'transparent',
      borderRadius: 6,
      borderSkipped: false,
    }],
  }

  const slaData = sla ?? FALLBACK_SLA
  const slaChartData = {
    labels: ['Met', 'At Risk', 'Breached'],
    datasets: [{
      data: [slaData.met, slaData.at_risk, slaData.breached],
      backgroundColor: ['rgba(100,255,218,0.85)', 'rgba(255,184,48,0.85)', 'rgba(255,77,109,0.85)'],
      borderColor: 'var(--card)',
      borderWidth: 3,
      hoverOffset: 8,
    }],
  }

  // Station list — support both 'name'/'tickets'/'sla' (old mock) and
  // 'code'/'open_tickets'/'sla_compliance_pct' (API contract)
  const stationList = stations.map(s => ({
    name: s.code ?? s.name,
    tickets: s.open_tickets ?? s.tickets ?? 0,
    sla: s.sla_compliance_pct ?? s.sla ?? 0,
  }))

  const summaryValues = summary ?? { avg_resolution_hours: '—', first_call_resolution_pct: '—', escalated_tickets: '—' }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'rgba(13,138,138,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--teal-light)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
          </div>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>ManageEngine</h2>
            <p style={{ fontSize: '11px', color: 'var(--text-dim)' }}>ServiceDesk Plus</p>
          </div>
        </div>
        <span className={`badge ${error ? 'badge-red' : stale ? 'badge-amber' : 'badge-teal'}`}>
          {error ? 'Error' : stale ? 'Stale' : 'Mock Data'}
        </span>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          background: 'rgba(255,77,109,0.08)', border: '1px solid rgba(255,77,109,0.25)',
          borderRadius: 8, padding: '10px 14px', fontSize: '12px', color: 'var(--red)',
        }}>
          Could not load ManageEngine data: {error}
        </div>
      )}

      {/* Station Heatmap */}
      <div>
        <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 12 }}>
          Station Heatmap
        </p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {(stationList.length ? stationList : [
            { name: 'DEL', tickets: 87, sla: 91 },
            { name: 'TRV', tickets: 64, sla: 88 },
            { name: 'IXE', tickets: 52, sla: 95 },
            { name: 'BLR', tickets: 41, sla: 97 },
            { name: 'HYD', tickets: 38, sla: 93 },
            { name: 'IXR', tickets: 29, sla: 82 },
            { name: 'CHQ', tickets: 18, sla: 100 },
            { name: 'COK', tickets: 12, sla: 100 },
          ]).map(s => {
            const c = heatColor(s.tickets)
            return (
              <div key={s.name} style={{
                background: c.bg, border: `1px solid ${c.border}`,
                borderRadius: 10, padding: '10px 12px',
                transition: 'transform 0.2s ease', cursor: 'default',
              }}
                onMouseOver={e => e.currentTarget.style.transform = 'scale(1.04)'}
                onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{s.name}</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: c.text, lineHeight: 1.2 }}>{s.tickets}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-faint)' }}>SLA {s.sla}%</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div>
          <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 12 }}>
            By Category
          </p>
          <div style={{ height: 180 }}>
            <Bar data={categoryChartData} options={chartOptions()} />
          </div>
        </div>
        <div>
          <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 12 }}>
            SLA Compliance
          </p>
          <div style={{ height: 180 }}>
            <Doughnut data={slaChartData} options={donutOptions} />
          </div>
        </div>
      </div>

      {/* Summary row */}
      <div style={{ display: 'flex', gap: 12 }}>
        {[
          { label: 'Avg Resolution', value: summary ? `${summaryValues.avg_resolution_hours}h` : '4.2h', color: 'var(--teal-light)' },
          { label: 'First Call Res.', value: summary ? `${summaryValues.first_call_resolution_pct}%` : '68%', color: 'var(--accent)' },
          { label: 'Escalated', value: summary ? `${summaryValues.escalated_tickets}` : '31', color: 'var(--amber)' },
        ].map(m => (
          <div key={m.label} className="card" style={{ flex: 1, padding: '12px 14px', gap: 0 }}>
            <div style={{ fontSize: '18px', fontWeight: 700, color: m.color }}>{m.value}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: 2 }}>{m.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
