import { useState, useEffect } from 'react'
import Header from './components/Header'
import KpiRow from './components/KpiRow'
import ManageEngine from './components/ManageEngine'
import M365Widgets from './components/M365Widgets'
import ChatbotWidget from './components/ChatbotWidget'

export default function App() {
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate initial data load
    const timer = setTimeout(() => setIsLoading(false), 800)
    return () => clearTimeout(timer)
  }, [])

  const handleRefresh = () => {
    setIsLoading(true)
    setLastRefresh(new Date())
    setTimeout(() => setIsLoading(false), 800)
  }

  return (
    <div className="bg-gradient-animated min-h-screen">
      {/* Background grid pattern */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        backgroundImage: `linear-gradient(rgba(30,58,110,0.15) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(30,58,110,0.15) 1px, transparent 1px)`,
        backgroundSize: '40px 40px'
      }} />

      <div style={{ position: 'relative', zIndex: 1, padding: '0 0 32px 0' }}>
        {/* Header */}
        <Header lastRefresh={lastRefresh} onRefresh={handleRefresh} />

        <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '0 24px' }}>
          {/* KPI Row */}
          <div className="animate-fade-in-up stagger-1">
            <KpiRow isLoading={isLoading} />
          </div>

          {/* Main Dashboard Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 720px), 1fr))',
            gap: '24px',
            marginTop: '24px',
          }}>
            <div className="animate-fade-in-up stagger-3">
              <ManageEngine isLoading={isLoading} />
            </div>
            <div className="animate-fade-in-up stagger-4">
              <M365Widgets isLoading={isLoading} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Global Chatbot FAB — fixed position, persists across all views ── */}
      <ChatbotWidget />
    </div>
  )
}
