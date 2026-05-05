import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Card, PageHeader, Btn, Input, Textarea, Modal, Toast, Empty, Spinner, StatusBadge, StatCard } from '../components/ui'
import { Plus, Play, Pause, BarChart2, ChevronRight } from 'lucide-react'

export default function Campaigns() {
  const [campaigns, setCampaigns]   = useState([])
  const [templates, setTemplates]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [modal, setModal]           = useState(false)  // 'create' | 'stats' | false
  const [selected, setSelected]     = useState(null)
  const [stats, setStats]           = useState(null)
  const [toast, setToast]           = useState(null)
  const [saving, setSaving]         = useState(false)
  const [launching, setLaunching]   = useState(null)
  const [form, setForm]             = useState({ name: '', description: '', template_id: '' })

  const fetch = async () => {
    setLoading(true)
    try {
      const [c, t] = await Promise.all([
        api.listCampaigns(),
        api.listTemplates({ status: 'APPROVED' }),
      ])
      setCampaigns(c.campaigns || [])
      setTemplates(t.templates || [])
    } catch { }
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.createCampaign(form)
      setToast({ message: 'Campanha criada!', type: 'success' })
      setModal(false)
      fetch()
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    } finally { setSaving(false) }
  }

  const handleLaunch = async (id) => {
    if (!confirm('Confirma o disparo desta campanha?')) return
    setLaunching(id)
    try {
      const data = await api.launchCampaign(id)
      setToast({ message: `${data.messages_queued} mensagens enfileiradas!`, type: 'success' })
      fetch()
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    } finally { setLaunching(null) }
  }

  const handlePause = async (id) => {
    try {
      await api.pauseCampaign(id)
      setToast({ message: 'Campanha pausada', type: 'success' })
      fetch()
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    }
  }

  const handleStats = async (campaign) => {
    setSelected(campaign)
    setModal('stats')
    try {
      const data = await api.getCampaignStats(campaign.id)
      setStats(data)
    } catch { setStats(null) }
  }

  const running   = campaigns.filter(c => c.status === 'running').length
  const completed = campaigns.filter(c => c.status === 'completed').length
  const draft     = campaigns.filter(c => c.status === 'draft').length

  return (
    <div className="fade-up">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <PageHeader
        title="Campanhas"
        subtitle="Gerencie e dispare suas campanhas"
        action={<Btn onClick={() => setModal('create')}><Plus size={15} /> Nova Campanha</Btn>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard label="Em andamento" value={running}   color="var(--green)"  />
        <StatCard label="Concluídas"   value={completed} color="var(--accent)" />
        <StatCard label="Rascunhos"    value={draft}     color="var(--yellow)" />
        <StatCard label="Total"        value={campaigns.length} color="var(--text2)" />
      </div>

      <Card style={{ padding: 0 }}>
        {loading ? <Spinner /> : campaigns.length === 0 ? (
          <Empty icon="📢" text="Nenhuma campanha" sub="Crie sua primeira campanha clicando em + Nova Campanha" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Template</th>
                  <th>Status</th>
                  <th>Contatos</th>
                  <th>Enviados</th>
                  <th>Falharam</th>
                  <th>Criado em</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map(c => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.template_name || '—'}</td>
                    <td><StatusBadge status={c.status} /></td>
                    <td>{c.total_contacts || 0}</td>
                    <td style={{ color: 'var(--green)' }}>{c.sent_count || 0}</td>
                    <td style={{ color: c.failed_count > 0 ? 'var(--red)' : 'var(--text3)' }}>{c.failed_count || 0}</td>
                    <td>{new Date(c.created_at).toLocaleDateString('pt-BR')}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {['draft', 'paused'].includes(c.status) && (
                          <Btn size="sm" onClick={() => handleLaunch(c.id)} loading={launching === c.id}>
                            <Play size={11} /> Disparar
                          </Btn>
                        )}
                        {c.status === 'running' && (
                          <Btn size="sm" variant="secondary" onClick={() => handlePause(c.id)}>
                            <Pause size={11} /> Pausar
                          </Btn>
                        )}
                        <Btn size="sm" variant="ghost" onClick={() => handleStats(c)}>
                          <BarChart2 size={11} />
                        </Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal criar */}
      <Modal open={modal === 'create'} onClose={() => setModal(false)} title="Nova Campanha">
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Nome da campanha *" placeholder="Promoção Junho 2025"
            value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
          <Textarea label="Descrição" placeholder="Descrição opcional..."
            value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', letterSpacing: '0.3px' }}>Template *</label>
            <select
              required
              value={form.template_id}
              onChange={e => setForm(p => ({ ...p, template_id: e.target.value }))}
              style={{
                background: 'var(--surface)', border: '1px solid var(--border2)',
                borderRadius: 9, padding: '9px 13px', color: 'var(--text)', fontSize: 13.5,
              }}
            >
              <option value="">Selecione um template aprovado</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {templates.length === 0 && (
              <span style={{ fontSize: 11, color: 'var(--yellow)' }}>
                ⚠️ Nenhum template aprovado. Crie e aprove um template primeiro.
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <Btn variant="ghost" onClick={() => setModal(false)}>Cancelar</Btn>
            <Btn type="submit" loading={saving}>Criar Campanha</Btn>
          </div>
        </form>
      </Modal>

      {/* Modal stats */}
      <Modal open={modal === 'stats'} onClose={() => { setModal(false); setStats(null) }}
        title={`Estatísticas — ${selected?.name}`} width={520}>
        {!stats ? <Spinner /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {[
                { label: 'Total', value: stats.campaign?.total_contacts || 0, color: 'var(--text2)' },
                { label: 'Enviados', value: stats.campaign?.sent_count || 0, color: 'var(--green)' },
                { label: 'Entregues', value: stats.campaign?.delivered_count || 0, color: 'var(--accent)' },
                { label: 'Lidos', value: stats.campaign?.read_count || 0, color: 'var(--green)' },
                { label: 'Falharam', value: stats.campaign?.failed_count || 0, color: 'var(--red)' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{
                  background: 'var(--surface)', borderRadius: 10, padding: '12px 14px', textAlign: 'center'
                }}>
                  <div style={{ fontSize: 22, fontFamily: 'var(--font-display)', fontWeight: 800, color }}>{value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                Por Status
              </div>
              {stats.breakdown?.map(b => (
                <div key={b.status} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '8px 12px', background: 'var(--surface)', borderRadius: 8, marginBottom: 6,
                }}>
                  <StatusBadge status={b.status} />
                  <strong style={{ color: 'var(--text)' }}>{b.count}</strong>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
