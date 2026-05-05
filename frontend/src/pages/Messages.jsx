import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Card, PageHeader, Btn, Input, Textarea, Modal, Toast, Empty, Spinner, StatusBadge } from '../components/ui'
import { Send, Plus } from 'lucide-react'

export default function Messages() {
  const [messages, setMessages] = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [toast, setToast]       = useState(null)
  const [saving, setSaving]     = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [form, setForm] = useState({ phone: '', text: '', delay_minutes: 0 })

  const fetch = async () => {
    setLoading(true)
    try {
      const data = await api.listMessages({ status: statusFilter || undefined, limit: 50 })
      setMessages(data.messages || [])
    } catch { setMessages([]) }
    setLoading(false)
  }

  useEffect(() => { fetch() }, [statusFilter])

  const handleSend = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.scheduleMessage(form)
      setToast({ message: 'Mensagem agendada com sucesso!', type: 'success' })
      setModal(false)
      setForm({ phone: '', text: '', delay_minutes: 0 })
      fetch()
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    } finally { setSaving(false) }
  }

  return (
    <div className="fade-up">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <PageHeader
        title="Mensagens"
        subtitle="Envie mensagens avulsas ou agende para depois"
        action={<Btn onClick={() => setModal(true)}><Plus size={15} /> Nova Mensagem</Btn>}
      />

      {/* Filter */}
      <Card style={{ marginBottom: 16, padding: '14px 18px' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: 'var(--text3)' }}>Filtrar por status:</span>
          {['', 'pending', 'sending', 'sent', 'failed', 'cancelled'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              style={{
                padding: '5px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                border: '1px solid',
                borderColor: statusFilter === s ? 'var(--green)' : 'var(--border2)',
                background: statusFilter === s ? 'var(--green-dim)' : 'transparent',
                color: statusFilter === s ? 'var(--green)' : 'var(--text2)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {s || 'Todos'}
            </button>
          ))}
        </div>
      </Card>

      <Card style={{ padding: 0 }}>
        {loading ? <Spinner /> : messages.length === 0 ? (
          <Empty icon="💬" text="Nenhuma mensagem" sub="Clique em + Nova Mensagem para enviar" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Telefone</th>
                  <th>Mensagem</th>
                  <th>Status</th>
                  <th>Agendado para</th>
                  <th>Enviado em</th>
                </tr>
              </thead>
              <tbody>
                {messages.map(m => (
                  <tr key={m.id}>
                    <td>{m.phone}</td>
                    <td style={{ maxWidth: 300 }}>
                      <span style={{
                        display: 'block', whiteSpace: 'nowrap',
                        overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {m.text}
                      </span>
                    </td>
                    <td><StatusBadge status={m.status} /></td>
                    <td>{m.scheduled_for ? new Date(m.scheduled_for).toLocaleString('pt-BR') : '—'}</td>
                    <td>{m.sent_at ? new Date(m.sent_at).toLocaleString('pt-BR') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title="Nova Mensagem">
        <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input
            label="Telefone *"
            placeholder="+5547999990000"
            value={form.phone}
            onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
            required
          />
          <Textarea
            label="Mensagem *"
            placeholder="Digite a mensagem aqui..."
            value={form.text}
            onChange={e => setForm(p => ({ ...p, text: e.target.value }))}
            required
          />
          <Input
            label="Atraso (minutos)"
            type="number"
            min="0"
            value={form.delay_minutes}
            onChange={e => setForm(p => ({ ...p, delay_minutes: parseInt(e.target.value) || 0 }))}
          />
          <div style={{
            background: 'var(--surface)', borderRadius: 9, padding: '10px 14px',
            fontSize: 12, color: 'var(--text3)',
          }}>
            💡 Defina atraso = 0 para envio imediato. O envio respeita o horário configurado (8h–20h).
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => setModal(false)}>Cancelar</Btn>
            <Btn type="submit" loading={saving}>
              <Send size={14} /> Enviar
            </Btn>
          </div>
        </form>
      </Modal>
    </div>
  )
}
