import { useEffect, useRef } from 'react'
import {
  Chart as ChartJS,
  ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement,
  Title,
} from 'chart.js'
import { Doughnut, Bar } from 'react-chartjs-2'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title)

/* ── Mock Data ─────────────────────────────── */
const STATIONS = [
  { name: 'DEL', tickets: 87, sla: 91 },
  { name: 'BLR', tickets: 41, sla: 97 },
  { name: 'TRV', tickets: 64, sla: 88 },
  { name: 'DXN', tickets: 12, sla: 100 },
  { name: 'COK', tickets: 28, sla: 95 },
  { name: 'RPR', tickets: 15, sla: 99 },
  { name: 'IXE', tickets: 35, sla: 93 },
  { name: 'IXR', tickets: 52, sla: 82 },
  { name: 'CHQ', tickets: 18, sla: 98 },
  { name: 'HYD', tickets: 73, sla: 90 },
]

const CATEGORY_DATA = {
  labels: ['Network', 'Hardware', 'Software', 'Access', 'Email', 'Other'],
  datasets: [{
    label: 'Open Tickets',
    data: [92, 74, 61, 55, 48, 27],
    backgroundColor: [
      'rgba(13,138,138,0.8)',
      'rgba(100,255,218,0.8)',
      'rgba(255,184,48,0.8)',
      'rgba(167,139,250,0.8)',
      'rgba(255,77,109,0.8)',
      'rgba(139,162,176,0.8)',
    ],
    borderColor: 'transparent',
    borderRadius: 6,
    borderSkipped: false,
  }]
}

const SLA_DONUT_DATA = {
  labels: ['Met', 'At Risk', 'Breached'],
  datasets: [{
    data: [312, 52, 23],
    backgroundColor: ['rgba(100,255,218,0.85)', 'rgba(255,184,48,0.85)', 'rgba(255,77,109,0.85)'],
    borderColor: 'var(--card)',
    borderWidth: 3,
    hoverOffset: 8,
  }]
}

/* ── Heat color helper ──────────────────────── */
function heatColor(tickets) {
  if (tickets >= 80) return { bg: 'rgba(255,77,109,0.25)',  border: 'rgba(255,77,109,0.6)',  text: '#ff4d6d' }
  if (tickets >= 50) return { bg: 'rgba(255,184,48,0.2)',   border: 'rgba(255,184,48,0.5)',  text: '#ffb830' }
  if (tickets >= 25) return { bg: 'rgba(13,138,138,0.2)',   border: 'rgba(13,138,138,0.5)',  text: '#0fb3b3' }
  return               { bg: 'rgba(100,255,218,0.1)',  border: 'rgba(100,255,218,0.3)', text: '#64ffda' }
}

const chartOptions = (label) => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#112240',
      borderColor: '#1e3a6e',
      borderWidth: 1,
      titleColor: '#f8fafc',
      bodyColor: '#cbd5e1',
      padding: 10,
    }
  },
  scales: {
    x: {
      grid: { color: 'rgba(30,58,110,0.5)', drawBorder: false },
      ticks: { color: '#cbd5e1', font: { size: 11 } },
    },
    y: {
      grid: { color: 'rgba(30,58,110,0.5)', drawBorder: false },
      ticks: { color: '#cbd5e1', font: { size: 11 } },
    }
  }
})

const donutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '72%',
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        color: '#cbd5e1',
        padding: 16,
        font: { size: 12 },
        boxWidth: 12,
        boxHeight: 12,
        borderRadius: 4,
      }
    },
    tooltip: {
      backgroundColor: '#112240',
      borderColor: '#1e3a6e',
      borderWidth: 1,
      titleColor: '#f8fafc',
      bodyColor: '#cbd5e1',
      padding: 10,
    }
  }
}

function SkeletonBlock({ h = 200 }) {
  return <div className="skeleton" style={{ height: h, borderRadius: 12 }} />
}

export default function ManageEngine({ isLoading }) {
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
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <path d="M8 21h8M12 17v4"/>
            </svg>
          </div>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>ManageEngine</h2>
            <p style={{ fontSize: '11px', color: 'var(--text-dim)' }}>ServiceDesk Plus — Live Data</p>
          </div>
        </div>
        <span className="badge badge-teal">Mock Data</span>
      </div>

      {/* Station Heatmap */}
      <div>
        <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 12 }}>
          Station Heatmap
        </p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {STATIONS.map(s => {
            const c = heatColor(s.tickets)
            return (
              <div key={s.name} style={{
                background: c.bg, border: `1px solid ${c.border}`,
                borderRadius: 10, padding: '10px 12px',
                transition: 'transform 0.2s ease',
                cursor: 'default',
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
        {/* Bar Chart */}
        <div>
          <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 12 }}>
            By Category
          </p>
          <div style={{ height: 180 }}>
            <Bar data={CATEGORY_DATA} options={chartOptions('Tickets')} />
          </div>
        </div>

        {/* Donut Chart */}
        <div>
          <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 12 }}>
            SLA Compliance
          </p>
          <div style={{ height: 180 }}>
            <Doughnut data={SLA_DONUT_DATA} options={donutOptions} />
          </div>
        </div>
      </div>

      {/* Summary row */}
      <div style={{ display: 'flex', gap: 12 }}>
        {[
          { label: 'Avg Resolution', value: '4.2h', color: 'var(--teal-light)' },
          { label: 'First Call Res.', value: '68%', color: 'var(--accent)' },
          { label: 'Escalated', value: '31', color: 'var(--amber)' },
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
