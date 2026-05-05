import { useEffect, useState, useRef } from 'react'
import { api } from '../lib/api'
import { Card, PageHeader, Btn, StatusBadge, Spinner, Empty, StatCard } from '../components/ui'
import { RefreshCw, Activity, Clock, CheckCircle, XCircle, Zap } from 'lucide-react'

export default function Monitor() {
  const [queue, setQueue]   = useState(null)
  const [logs, setLogs]     = useState([])
  const [status, setStatus] = useState('')
  const [loading, setLoading]  = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const intervalRef = useRef(null)

  const fetch = async () => {
    try {
      const [q, l] = await Promise.all([
        api.monitorQueue(),
        api.monitorLogs({ status: status || undefined, limit: 50 }),
      ])
      setQueue(q)
      setLogs(l?.messages || [])
    } catch { }
    setLoading(false)
  }

  useEffect(() => { fetch() }, [status])

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetch, 5000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [autoRefresh, status])

  const mq = queue?.message_queue || {}
  const sq = queue?.scheduler_queue || {}

  return (
    <div className="fade-up">
      <PageHeader
        title="Monitor"
        subtitle="Filas, logs e performance em tempo real"
        action={
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => setAutoRefresh(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 16px', borderRadius: 9, fontSize: 13,
                border: '1px solid',
                borderColor: autoRefresh ? 'var(--green)' : 'var(--border2)',
                background: autoRefresh ? 'var(--green-dim)' : 'transparent',
                color: autoRefresh ? 'var(--green)' : 'var(--text2)',
                cursor: 'pointer', fontWeight: 600,
              }}
            >
              <Zap size={14} />
              {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh'}
            </button>
            <Btn variant="secondary" size="sm" onClick={fetch}>
              <RefreshCw size={13} /> Atualizar
            </Btn>
          </div>
        }
      />

      {/* Queue stats */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 10 }}>
          Fila de Campanhas (Template)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Aguardando', value: mq.waiting, icon: Clock, color: 'var(--yellow)' },
            { label: 'Ativo', value: mq.active, icon: Activity, color: 'var(--accent)' },
            { label: 'Concluído', value: mq.completed, icon: CheckCircle, color: 'var(--green)' },
            { label: 'Falhou', value: mq.failed, icon: XCircle, color: 'var(--red)' },
            { label: 'Atrasado', value: mq.delayed, icon: Clock, color: 'var(--yellow)' },
          ].map(({ label, value, icon, color }) => (
            <StatCard key={label} label={label} value={loading ? null : value ?? 0} icon={icon} color={color} loading={loading} />
          ))}
        </div>

        <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 10 }}>
          Fila Scheduler (Agendado)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Aguardando', value: sq.waiting, icon: Clock, color: 'var(--yellow)' },
            { label: 'Ativo', value: sq.active, icon: Activity, color: 'var(--accent)' },
            { label: 'Concluído', value: sq.completed, icon: CheckCircle, color: 'var(--green)' },
            { label: 'Falhou', value: sq.failed, icon: XCircle, color: 'var(--red)' },
            { label: 'Intervalo', value: sq.interval_minutes ? `${sq.interval_minutes}m` : '—', icon: Clock, color: 'var(--text2)' },
          ].map(({ label, value, icon, color }) => (
            <StatCard key={label} label={label} value={loading ? null : value ?? 0} icon={icon} color={color} loading={loading} />
          ))}
        </div>
      </div>

      {/* Logs */}
      <Card style={{ padding: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          flexWrap: 'wrap', gap: 10,
        }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>Log de Mensagens</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['', 'sent', 'delivered', 'read', 'failed', 'queued', 'pending'].map(s => (
              <button key={s} onClick={() => setStatus(s)}
                style={{
                  padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                  border: '1px solid',
                  borderColor: status === s ? 'var(--green)' : 'var(--border)',
                  background: status === s ? 'var(--green-dim)' : 'transparent',
                  color: status === s ? 'var(--green)' : 'var(--text3)',
                  cursor: 'pointer',
                }}
              >
                {s || 'Todos'}
              </button>
            ))}
          </div>
        </div>

        {loading ? <Spinner /> : logs.length === 0 ? (
          <Empty icon="📋" text="Nenhum log encontrado" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Telefone</th>
                  <th>Contato</th>
                  <th>Campanha</th>
                  <th>Status</th>
                  <th>Meta ID</th>
                  <th>Enviado</th>
                  <th>Entregue</th>
                  <th>Lido</th>
                  <th>Erro</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(m => (
                  <tr key={m.id}>
                    <td>{m.phone_to || '—'}</td>
                    <td>{m.contact_name || <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                    <td>{m.campaign_name || <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                    <td><StatusBadge status={m.status} /></td>
                    <td style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text3)' }}>
                      {m.meta_message_id ? m.meta_message_id.slice(0, 12) + '…' : '—'}
                    </td>
                    <td>{m.sent_at ? new Date(m.sent_at).toLocaleTimeString('pt-BR') : '—'}</td>
                    <td>{m.delivered_at ? new Date(m.delivered_at).toLocaleTimeString('pt-BR') : '—'}</td>
                    <td>{m.read_at ? new Date(m.read_at).toLocaleTimeString('pt-BR') : '—'}</td>
                    <td style={{ fontSize: 11, color: 'var(--red)', maxWidth: 160 }}>
                      {m.error_message
                        ? <span title={m.error_message}>{m.error_message.slice(0, 30)}{m.error_message.length > 30 ? '…' : ''}</span>
                        : '—'
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {autoRefresh && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--green-dim)', border: '1px solid var(--green)',
          borderRadius: 999, padding: '6px 18px',
          fontSize: 12, color: 'var(--green)', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Zap size={12} /> Atualizando a cada 5s
        </div>
      )}
    </div>
  )
}
