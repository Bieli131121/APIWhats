import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { StatCard, Card, PageHeader, StatusBadge, Spinner } from '../components/ui'
import { Users, Megaphone, MessageSquare, Activity, CheckCircle, XCircle, Clock } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export default function Dashboard() {
  const [queue, setQueue] = useState(null)
  const [logs, setLogs]   = useState([])
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.monitorQueue().catch(() => null),
      api.monitorLogs({ limit: 8 }).catch(() => ({ messages: [] })),
      api.health().catch(() => null),
    ]).then(([q, l, h]) => {
      setQueue(q)
      setLogs(l?.messages || [])
      setHealth(h)
      setLoading(false)
    })
  }, [])

  const mq = queue?.message_queue || {}
  const sq = queue?.scheduler_queue || {}

  const chartData = [
    { name: 'Aguardando', value: (mq.waiting || 0) + (sq.waiting || 0), color: '#f59e0b' },
    { name: 'Ativo',      value: (mq.active  || 0) + (sq.active  || 0), color: '#3b82f6' },
    { name: 'Concluído',  value: (mq.completed || 0) + (sq.completed || 0), color: '#25d366' },
    { name: 'Falhou',     value: (mq.failed  || 0) + (sq.failed  || 0), color: '#ef4444' },
  ]

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 14px', fontSize: 12 }}>
        <strong style={{ color: payload[0].payload.color }}>{payload[0].name}</strong>: {payload[0].value}
      </div>
    )
  }

  return (
    <div className="fade-up">
      <PageHeader
        title="Dashboard"
        subtitle={`Sistema ${health?.status === 'healthy' ? '✅ saudável' : health?.status === 'degraded' ? '⚠️ degradado' : '⏳ verificando...'}`}
      />

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard label="Fila — Aguardando" value={loading ? null : (mq.waiting || 0) + (sq.waiting || 0)}
          icon={Clock} color="var(--yellow)" loading={loading} />
        <StatCard label="Fila — Ativo"      value={loading ? null : (mq.active  || 0) + (sq.active  || 0)}
          icon={Activity} color="var(--accent)" loading={loading} />
        <StatCard label="Enviados (total)"  value={loading ? null : (mq.completed || 0) + (sq.completed || 0)}
          icon={CheckCircle} color="var(--green)" loading={loading} />
        <StatCard label="Falharam"          value={loading ? null : (mq.failed  || 0) + (sq.failed  || 0)}
          icon={XCircle} color="var(--red)" loading={loading} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* Chart */}
        <Card>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 20, fontSize: 15 }}>Status das Filas</div>
          {loading ? <Spinner /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} barCategoryGap="30%">
                <XAxis dataKey="name" tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Services health */}
        <Card>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 20, fontSize: 15 }}>Serviços</div>
          {loading ? <Spinner /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { name: 'API', ok: true },
                { name: 'Banco de Dados', ok: health?.services?.database === 'ok' },
                { name: 'Redis / Filas', ok: health?.services?.redis === 'ok' },
              ].map(({ name, ok }) => (
                <div key={name} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', background: 'var(--surface)', borderRadius: 10,
                }}>
                  <span style={{ fontSize: 13.5, fontWeight: 500 }}>{name}</span>
                  <span className={`badge ${ok ? 'badge-green' : 'badge-red'}`}>
                    {ok ? '● Online' : '● Offline'}
                  </span>
                </div>
              ))}
              <div style={{
                padding: '12px 16px', background: 'var(--surface)', borderRadius: 10,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 13, color: 'var(--text3)' }}>Scheduler — intervalo</span>
                <span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>
                  {sq.interval_minutes || '—'} min
                </span>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Recent messages */}
      <Card>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 18, fontSize: 15 }}>
          Mensagens Recentes
        </div>
        {loading ? <Spinner /> : logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text3)', fontSize: 13 }}>
            Nenhuma mensagem ainda
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Telefone</th>
                  <th>Campanha</th>
                  <th>Status</th>
                  <th>Enviado em</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(m => (
                  <tr key={m.id}>
                    <td>{m.phone_to || '—'}</td>
                    <td>{m.campaign_name || <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                    <td><StatusBadge status={m.status} /></td>
                    <td>{m.sent_at ? new Date(m.sent_at).toLocaleString('pt-BR') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
