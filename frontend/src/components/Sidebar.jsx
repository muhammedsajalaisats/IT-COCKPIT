export default function Sidebar({ activeView, setActiveView }) {

  const handleClick = (viewName) => {
    console.log('CLICK FIRED FOR:', viewName)
    console.log('Sidebar clicked, setting view to:', viewName)
    setActiveView(viewName)
  }

  const navItem = (id, icon, label) => (
    <button
      key={id}
      id={`sidebar-${id.toLowerCase().replace(/\s+/g, '-')}`}
      onClick={() => handleClick(id)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', textAlign: 'left', padding: '10px 14px', borderRadius: 8,
        border: activeView === id ? '1px solid rgba(13,138,138,0.35)' : '1px solid transparent',
        background: activeView === id ? 'rgba(13,138,138,0.10)' : 'transparent',
        color: activeView === id ? '#64ffda' : '#94a3b8',
        fontSize: '13px', fontWeight: activeView === id ? 600 : 400,
        cursor: 'pointer', transition: 'all 0.18s ease',
      }}
      onMouseOver={e => { if (activeView !== id) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
      onMouseOut={e => { if (activeView !== id) e.currentTarget.style.background = 'transparent' }}
    >
      <span style={{ fontSize: '15px' }}>{icon}</span>
      <span>{label}</span>
    </button>
  )

  return (
    <aside style={{
      width: 220,
      background: 'rgba(11,30,63,0.96)',
      backdropFilter: 'blur(20px)',
      borderRight: '1px solid rgba(30,58,110,0.6)',
      padding: '24px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      flexShrink: 0,
      minHeight: '100vh',
      position: 'relative',
      zIndex: 100,
    }}>

      {/* Brand */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        paddingBottom: 20, marginBottom: 8,
        borderBottom: '1px solid rgba(30,58,110,0.5)',
      }}>
        <img
          src="https://www.aisats.in/images/AIR%20INDIA%20SATS%20NEW%20LOGO.png"
          alt="ME Cockpit Logo"
          className="h-10 w-auto object-contain"
          style={{ height: '32px', width: 'auto' }}
        />
      </div>

      {/* Nav items */}
      {navItem('Dashboard',   '📊', 'Dashboard')}
      {navItem('Microsoft365','☁️', 'Microsoft 365')}

    </aside>
  )
}
