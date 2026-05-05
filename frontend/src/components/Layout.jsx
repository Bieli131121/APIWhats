import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  LayoutDashboard, Users, Megaphone, FileUp,
  MessageSquare, Wifi, Activity, LogOut, Menu, X, ChevronRight
} from 'lucide-react'

const nav = [
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/whatsapp',  icon: Wifi,            label: 'WhatsApp' },
  { to: '/contacts',  icon: Users,           label: 'Contatos' },
  { to: '/campaigns', icon: Megaphone,       label: 'Campanhas' },
  { to: '/messages',  icon: MessageSquare,   label: 'Mensagens' },
  { to: '/import',    icon: FileUp,          label: 'Importar CSV' },
  { to: '/monitor',   icon: Activity,        label: 'Monitor' },
]

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Mobile overlay */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            zIndex: 40, backdropFilter: 'blur(4px)'
          }}
        />
      )}

      {/* Sidebar */}
      <aside style={{
        width: 240, flexShrink: 0,
        background: 'var(--bg2)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, bottom: 0,
        zIndex: 50,
        transform: open ? 'translateX(0)' : undefined,
        transition: 'transform 0.25s ease',
      }}
      className="sidebar"
      >
        {/* Logo */}
        <div style={{
          padding: '20px 20px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, var(--green), var(--green2))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px var(--green-glow)',
              fontSize: 18
            }}>💬</div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, lineHeight: 1 }}>
                WA Evolution
              </div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>API Dashboard</div>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="mobile-close"
            style={{ background: 'none', color: 'var(--text2)', display: 'none' }}>
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to} to={to} end={to === '/'}
              onClick={() => setOpen(false)}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 9,
                marginBottom: 2,
                color: isActive ? 'var(--green)' : 'var(--text2)',
                background: isActive ? 'var(--green-dim)' : 'transparent',
                fontSize: 13.5, fontWeight: isActive ? 600 : 400,
                transition: 'all 0.15s',
              })}
            >
              <Icon size={16} />
              <span style={{ flex: 1 }}>{label}</span>
              {({ isActive }) => isActive && <ChevronRight size={12} />}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div style={{
          padding: '12px 10px',
          borderTop: '1px solid var(--border)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px', borderRadius: 9,
            background: 'var(--surface)',
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent), #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, flexShrink: 0,
            }}>
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.name || 'Usuário'}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>{user?.role || 'operator'}</div>
            </div>
            <button onClick={handleLogout}
              style={{ background: 'none', color: 'var(--text3)', padding: 4, borderRadius: 6, transition: 'color 0.15s' }}
              title="Sair"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, marginLeft: 240, display: 'flex', flexDirection: 'column', minWidth: 0 }} className="main-wrap">
        {/* Mobile header */}
        <header style={{
          display: 'none', alignItems: 'center', gap: 12,
          padding: '12px 16px',
          background: 'var(--bg2)',
          borderBottom: '1px solid var(--border)',
          position: 'sticky', top: 0, zIndex: 30,
        }} className="mobile-header">
          <button onClick={() => setOpen(true)}
            style={{ background: 'none', color: 'var(--text2)' }}>
            <Menu size={20} />
          </button>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>WA Evolution</span>
        </header>

        <main style={{ flex: 1, padding: '28px 32px', overflowY: 'auto' }} className="main-content">
          {children}
        </main>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .sidebar { transform: translateX(-100%); }
          .sidebar.open { transform: translateX(0); }
          .mobile-close { display: flex !important; }
          .mobile-header { display: flex !important; }
          .main-wrap { margin-left: 0 !important; }
          .main-content { padding: 20px 16px !important; }
        }
      `}</style>
    </div>
  )
}
