import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Card, PageHeader, Btn, StatCard, Toast } from '../components/ui'
import { Wifi, WifiOff, QrCode, Settings, RefreshCw } from 'lucide-react'

export default function WhatsApp() {
  const [status, setStatus]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [setupLoading, setSetupLoading] = useState(false)
  const [toast, setToast]     = useState(null)

  const fetchStatus = async () => {
    setLoading(true)
    try {
      const data = await api.whatsappStatus()
      setStatus(data)
    } catch {
      setStatus({ connected: false, state: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStatus() }, [])

  const handleSetup = async () => {
    setSetupLoading(true)
    try {
      const data = await api.whatsappSetup()
      setToast({ message: data.message || 'Setup concluído!', type: 'success' })
      fetchStatus()
    } catch (e) {
      setToast({ message: e.message, type: 'error' })
    } finally {
      setSetupLoading(false)
    }
  }

  const connected = status?.connected
  const state     = status?.state || 'unknown'

  return (
    <div className="fade-up">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <PageHeader
        title="WhatsApp"
        subtitle="Conexão e status da instância Evolution API"
        action={
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn variant="ghost" onClick={fetchStatus} loading={loading} size="sm">
              <RefreshCw size={14} /> Atualizar
            </Btn>
            <Btn variant="secondary" onClick={handleSetup} loading={setupLoading} size="sm">
              <Settings size={14} /> Setup
            </Btn>
          </div>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard
          label="Status de Conexão"
          value={loading ? null : (connected ? 'Online' : 'Offline')}
          icon={connected ? Wifi : WifiOff}
          color={connected ? 'var(--green)' : 'var(--red)'}
          loading={loading}
        />
        <StatCard
          label="Estado"
          value={loading ? null : state}
          icon={Wifi}
          color="var(--accent)"
          loading={loading}
        />
        <StatCard
          label="Instância"
          value={loading ? null : (status?.instance || '—')}
          icon={Settings}
          color="var(--yellow)"
          loading={loading}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Status card */}
        <Card>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, marginBottom: 20 }}>
            Status da Conexão
          </div>

          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '32px 20px', gap: 16,
          }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: connected ? 'var(--green-dim)' : 'var(--red-dim)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `2px solid ${connected ? 'var(--green)' : 'var(--red)'}`,
              boxShadow: connected ? '0 0 30px var(--green-glow)' : 'none',
            }}>
              {connected
                ? <Wifi size={36} style={{ color: 'var(--green)' }} />
                : <WifiOff size={36} style={{ color: 'var(--red)' }} />
              }
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800 }}>
                {connected ? 'Conectado' : 'Desconectado'}
              </div>
              <div style={{ color: 'var(--text2)', fontSize: 13, marginTop: 4 }}>
                Estado: <strong>{state}</strong>
              </div>
            </div>
            {!connected && (
              <div style={{
                background: 'var(--red-dim)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 10, padding: '12px 16px', textAlign: 'center',
                fontSize: 13, color: 'var(--text2)',
              }}>
                Acesse o QR Code para conectar seu WhatsApp
              </div>
            )}
          </div>
        </Card>

        {/* QR Code card */}
        <Card>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, marginBottom: 20 }}>
            QR Code
          </div>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 16, padding: '20px 0',
          }}>
            <div style={{
              width: 120, height: 120, borderRadius: 16,
              background: 'var(--surface)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid var(--border2)',
            }}>
              <QrCode size={48} style={{ color: 'var(--text3)' }} />
            </div>
            <p style={{ textAlign: 'center', color: 'var(--text2)', fontSize: 13, maxWidth: 260 }}>
              O QR Code é gerado ao vivo pela Evolution API. Abra o link abaixo para escanear:
            </p>
            <a
              href="/api/v1/whatsapp/qrcode"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Btn size="md">
                <QrCode size={15} /> Abrir QR Code
              </Btn>
            </a>
            <p style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center' }}>
              WhatsApp → Dispositivos conectados → Conectar dispositivo
            </p>
          </div>
        </Card>
      </div>

      {/* Instructions */}
      <Card style={{ marginTop: 16 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, marginBottom: 16 }}>
          Como configurar
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {[
            { n: '1', title: 'Rode o Setup', desc: 'Clique em "Setup" para criar a instância e configurar o webhook automaticamente.' },
            { n: '2', title: 'Abra o QR Code', desc: 'Clique em "Abrir QR Code" e escaneie com seu WhatsApp.' },
            { n: '3', title: 'Pronto!', desc: 'O status muda para "Conectado". Você já pode enviar mensagens e campanhas.' },
          ].map(({ n, title, desc }) => (
            <div key={n} style={{
              padding: '16px', background: 'var(--surface)', borderRadius: 10,
              display: 'flex', gap: 14,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: 'var(--green-dim)', color: 'var(--green)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13,
              }}>{n}</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{title}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
