import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Btn, Input } from '../components/ui'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.email, form.password)
      navigate('/')
    } catch (err) {
      setError(err.message || 'Credenciais inválidas')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)',
      backgroundImage: `radial-gradient(ellipse 80% 60% at 50% -10%, rgba(37,211,102,0.08) 0%, transparent 70%)`,
      padding: 16,
    }}>
      <div className="fade-up" style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, var(--green), var(--green2))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', fontSize: 26,
            boxShadow: '0 0 40px var(--green-glow)',
          }}>💬</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800 }}>WA Evolution API</h1>
          <p style={{ color: 'var(--text2)', marginTop: 6, fontSize: 14 }}>Acesse o painel de controle</p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 18, padding: 32,
          boxShadow: '0 8px 48px rgba(0,0,0,0.5)',
        }}>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <Input
              label="Email"
              type="email"
              placeholder="admin@example.com"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              required
            />
            <Input
              label="Senha"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              required
            />
            {error && (
              <div style={{
                background: 'var(--red-dim)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 8, padding: '10px 14px',
                color: 'var(--red)', fontSize: 13,
              }}>
                {error}
              </div>
            )}
            <Btn type="submit" loading={loading} size="lg" style={{ width: '100%', justifyContent: 'center' }}>
              Entrar
            </Btn>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, color: 'var(--text3)', fontSize: 12 }}>
          WhatsApp Evolution API v2.0
        </p>
      </div>
    </div>
  )
}
