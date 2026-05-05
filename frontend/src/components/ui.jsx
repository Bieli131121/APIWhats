import { Loader2 } from 'lucide-react'

export function Card({ children, style = {}, className = '' }) {
  return (
    <div className={className} style={{
      background: 'var(--bg2)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: 24,
      ...style
    }}>
      {children}
    </div>
  )
}

export function StatCard({ label, value, sub, icon: Icon, color = 'var(--green)', loading }) {
  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
          {label}
        </div>
        {Icon && (
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: `${color}18`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color,
          }}>
            <Icon size={16} />
          </div>
        )}
      </div>
      {loading ? (
        <div className="skeleton" style={{ height: 32, width: '60%' }} />
      ) : (
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>
          {value ?? '—'}
        </div>
      )}
      {sub && <div style={{ fontSize: 12, color: 'var(--text3)' }}>{sub}</div>}
    </Card>
  )
}

export function Btn({ children, onClick, variant = 'primary', size = 'md', loading, disabled, style = {}, type = 'button' }) {
  const sizes = { sm: { padding: '6px 14px', fontSize: 12 }, md: { padding: '9px 20px', fontSize: 13.5 }, lg: { padding: '12px 28px', fontSize: 15 } }
  const variants = {
    primary: { background: 'var(--green)', color: '#000', fontWeight: 700 },
    secondary: { background: 'var(--surface2)', color: 'var(--text)', fontWeight: 500 },
    danger: { background: 'var(--red)', color: '#fff', fontWeight: 600 },
    ghost: { background: 'transparent', color: 'var(--text2)', border: '1px solid var(--border2)', fontWeight: 500 },
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={loading || disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        borderRadius: 9, cursor: (loading || disabled) ? 'not-allowed' : 'pointer',
        opacity: (loading || disabled) ? 0.6 : 1,
        transition: 'all 0.15s', border: 'none',
        ...sizes[size], ...variants[variant], ...style
      }}
    >
      {loading && <Loader2 size={14} className="spin" />}
      {children}
    </button>
  )
}

export function Input({ label, error, style = {}, ...props }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', letterSpacing: '0.3px' }}>{label}</label>}
      <input
        {...props}
        style={{
          background: 'var(--surface)',
          border: `1px solid ${error ? 'var(--red)' : 'var(--border2)'}`,
          borderRadius: 9,
          padding: '9px 13px',
          color: 'var(--text)',
          fontSize: 13.5,
          transition: 'border-color 0.15s',
          width: '100%',
          ...style
        }}
      />
      {error && <span style={{ fontSize: 11, color: 'var(--red)' }}>{error}</span>}
    </div>
  )
}

export function Textarea({ label, error, style = {}, ...props }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', letterSpacing: '0.3px' }}>{label}</label>}
      <textarea
        {...props}
        style={{
          background: 'var(--surface)',
          border: `1px solid ${error ? 'var(--red)' : 'var(--border2)'}`,
          borderRadius: 9,
          padding: '9px 13px',
          color: 'var(--text)',
          fontSize: 13.5,
          resize: 'vertical',
          minHeight: 90,
          width: '100%',
          ...style
        }}
      />
      {error && <span style={{ fontSize: 11, color: 'var(--red)' }}>{error}</span>}
    </div>
  )
}

export function Select({ label, error, children, style = {}, ...props }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', letterSpacing: '0.3px' }}>{label}</label>}
      <select
        {...props}
        style={{
          background: 'var(--surface)',
          border: `1px solid ${error ? 'var(--red)' : 'var(--border2)'}`,
          borderRadius: 9,
          padding: '9px 13px',
          color: 'var(--text)',
          fontSize: 13.5,
          width: '100%',
          ...style
        }}
      >
        {children}
      </select>
      {error && <span style={{ fontSize: 11, color: 'var(--red)' }}>{error}</span>}
    </div>
  )
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{title}</h1>
        {subtitle && <p style={{ color: 'var(--text2)', fontSize: 13.5, marginTop: 6 }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function Modal({ open, onClose, title, children, width = 480 }) {
  if (!open) return null
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: 16, backdropFilter: 'blur(4px)',
    }}>
      <div onClick={e => e.stopPropagation()} className="fade-up" style={{
        background: 'var(--bg2)', border: '1px solid var(--border2)',
        borderRadius: 'var(--radius-lg)', padding: 28, width: '100%', maxWidth: width,
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {title && (
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginBottom: 20 }}>{title}</div>
        )}
        {children}
      </div>
    </div>
  )
}

export function Toast({ message, type = 'success', onClose }) {
  if (!message) return null
  const colors = { success: 'var(--green)', error: 'var(--red)', info: 'var(--accent)' }
  return (
    <div className="fade-up" style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 200,
      background: 'var(--surface2)', border: `1px solid ${colors[type]}40`,
      borderLeft: `3px solid ${colors[type]}`,
      borderRadius: 10, padding: '12px 18px',
      display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: 'var(--shadow-lg)', maxWidth: 360,
    }}>
      <span style={{ color: colors[type], fontSize: 16 }}>
        {type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}
      </span>
      <span style={{ fontSize: 13.5, flex: 1 }}>{message}</span>
      <button onClick={onClose} style={{ background: 'none', color: 'var(--text3)', fontSize: 16, lineHeight: 1 }}>×</button>
    </div>
  )
}

export function Empty({ icon, text, sub }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text3)' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{icon || '📭'}</div>
      <div style={{ fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>{text || 'Nenhum registro'}</div>
      {sub && <div style={{ fontSize: 13 }}>{sub}</div>}
    </div>
  )
}

export function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 60 }}>
      <Loader2 size={28} className="spin" style={{ color: 'var(--green)' }} />
    </div>
  )
}

export function StatusBadge({ status }) {
  const map = {
    sent: ['badge-green', 'Enviado'],
    delivered: ['badge-blue', 'Entregue'],
    read: ['badge-green', 'Lido'],
    failed: ['badge-red', 'Falhou'],
    queued: ['badge-gray', 'Fila'],
    pending: ['badge-yellow', 'Pendente'],
    running: ['badge-green', 'Rodando'],
    paused: ['badge-yellow', 'Pausado'],
    draft: ['badge-gray', 'Rascunho'],
    cancelled: ['badge-red', 'Cancelado'],
    completed: ['badge-blue', 'Concluído'],
    sending: ['badge-yellow', 'Enviando'],
    skipped: ['badge-gray', 'Ignorado'],
    APPROVED: ['badge-green', 'Aprovado'],
    PENDING: ['badge-yellow', 'Pendente'],
    REJECTED: ['badge-red', 'Rejeitado'],
    open: ['badge-green', 'Conectado'],
    close: ['badge-red', 'Desconectado'],
    connecting: ['badge-yellow', 'Conectando'],
  }
  const [cls, label] = map[status] || ['badge-gray', status || '—']
  return <span className={`badge ${cls}`}>{label}</span>
}
