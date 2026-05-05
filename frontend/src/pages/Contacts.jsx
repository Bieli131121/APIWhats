import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Card, PageHeader, Btn, Input, Modal, Toast, Empty, Spinner, StatusBadge } from '../components/ui'
import { Plus, Search, UserX } from 'lucide-react'

export default function Contacts() {
  const [contacts, setContacts] = useState([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [optedFilter, setOptedFilter] = useState('')
  const [page, setPage]         = useState(1)
  const [modal, setModal]       = useState(false)
  const [toast, setToast]       = useState(null)
  const [form, setForm]         = useState({
    phone: '', name: '', email: '',
    opted_in: 'true', opted_in_source: '', opted_in_confirmation: '',
  })
  const [saving, setSaving]     = useState(false)

  const fetch = async () => {
    setLoading(true)
    try {
      const data = await api.listContacts({ page, limit: 20, search: search || undefined, opted_in: optedFilter || undefined })
      setContacts(data.contacts || [])
      setTotal(data.total || 0)
    } catch { setContacts([]) }
    setLoading(false)
  }

  useEffect(() => { fetch() }, [page, optedFilter])

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(1)
    fetch()
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.createContact(form)
      setToast({ message: 'Contato criado com sucesso!', type: 'success' })
      setModal(false)
      fetch()
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    } finally { setSaving(false) }
  }

  const handleOptOut = async (phone) => {
    if (!confirm(`Fazer opt-out de ${phone}?`)) return
    try {
      await api.optOut(phone)
      setToast({ message: 'Opt-out realizado!', type: 'success' })
      fetch()
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    }
  }

  const totalPages = Math.ceil(total / 20)

  return (
    <div className="fade-up">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <PageHeader
        title="Contatos"
        subtitle={`${total} contatos cadastrados`}
        action={<Btn onClick={() => setModal(true)}><Plus size={15} /> Novo Contato</Btn>}
      />

      {/* Filters */}
      <Card style={{ marginBottom: 16, padding: '14px 18px' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <Input
              placeholder="Buscar por nome ou telefone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ margin: 0 }}
            />
          </div>
          <select
            value={optedFilter}
            onChange={e => { setOptedFilter(e.target.value); setPage(1) }}
            style={{
              background: 'var(--surface)', border: '1px solid var(--border2)',
              borderRadius: 9, padding: '9px 13px', color: 'var(--text)', fontSize: 13.5,
            }}
          >
            <option value="">Todos</option>
            <option value="true">Com opt-in</option>
            <option value="false">Sem opt-in</option>
          </select>
          <Btn type="submit" variant="secondary" size="md">
            <Search size={14} /> Buscar
          </Btn>
        </form>
      </Card>

      {/* Table */}
      <Card style={{ padding: 0 }}>
        {loading ? <Spinner /> : contacts.length === 0 ? (
          <Empty icon="👥" text="Nenhum contato encontrado" sub="Crie seu primeiro contato clicando em + Novo Contato" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Telefone</th>
                  <th>Nome</th>
                  <th>Tags</th>
                  <th>Opt-in</th>
                  <th>Opt-out</th>
                  <th>Cadastrado em</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {contacts.map(c => (
                  <tr key={c.id}>
                    <td>{c.phone}</td>
                    <td>{c.name || '—'}</td>
                    <td>
                      {c.tags?.length ? c.tags.map(t => (
                        <span key={t} className="badge badge-blue" style={{ marginRight: 4 }}>{t}</span>
                      )) : <span style={{ color: 'var(--text3)' }}>—</span>}
                    </td>
                    <td><StatusBadge status={c.opted_in ? 'sent' : 'failed'} /></td>
                    <td>
                      {c.opted_out
                        ? <span className="badge badge-red">Opt-out</span>
                        : <span style={{ color: 'var(--text3)' }}>—</span>
                      }
                    </td>
                    <td>{new Date(c.created_at).toLocaleDateString('pt-BR')}</td>
                    <td>
                      {!c.opted_out && (
                        <button
                          onClick={() => handleOptOut(c.phone)}
                          style={{ background: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 4 }}
                          title="Opt-out"
                        >
                          <UserX size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 20px', borderTop: '1px solid var(--border)',
          }}>
            <span style={{ fontSize: 13, color: 'var(--text3)' }}>
              Página {page} de {totalPages}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="ghost" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Btn>
              <Btn variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Próxima</Btn>
            </div>
          </div>
        )}
      </Card>

      {/* Modal criar contato */}
      <Modal open={modal} onClose={() => setModal(false)} title="Novo Contato">
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Telefone *" placeholder="+5547999990000" value={form.phone}
            onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} required />
          <Input label="Nome" placeholder="João Silva" value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          <Input label="Email" type="email" placeholder="joao@email.com" value={form.email}
            onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
          <Input label="Origem do consentimento *" placeholder="website_form" value={form.opted_in_source}
            onChange={e => setForm(p => ({ ...p, opted_in_source: e.target.value }))} required />
          <Input label="Texto exibido ao usuário *"
            placeholder="Concordo em receber mensagens via WhatsApp."
            value={form.opted_in_confirmation}
            onChange={e => setForm(p => ({ ...p, opted_in_confirmation: e.target.value }))} required />
          <div style={{
            background: 'var(--green-dim)', border: '1px solid rgba(37,211,102,0.2)',
            borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--text2)',
          }}>
            ✅ Ao cadastrar, o opt-in será registrado com IP, user agent e confirmação para conformidade LGPD.
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <Btn variant="ghost" onClick={() => setModal(false)}>Cancelar</Btn>
            <Btn type="submit" loading={saving}>Cadastrar</Btn>
          </div>
        </form>
      </Modal>
    </div>
  )
}
