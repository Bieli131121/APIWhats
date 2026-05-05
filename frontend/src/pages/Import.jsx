import { useState } from 'react'
import { api } from '../lib/api'
import { Card, PageHeader, Btn, Input, Textarea, Toast } from '../components/ui'
import { Upload, Download, CheckCircle } from 'lucide-react'

export default function Import() {
  const [form, setForm] = useState({ campaign_name: '', csv_content: '', message_template: '' })
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState(null)
  const [toast, setToast]     = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setResult(null)
    try {
      const data = await api.importCSV(form)
      setResult(data)
      setToast({ message: `${data.total_imported} mensagens agendadas!`, type: 'success' })
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    } finally { setLoading(false) }
  }

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setForm(p => ({ ...p, csv_content: ev.target.result }))
    reader.readAsText(file)
  }

  return (
    <div className="fade-up">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <PageHeader
        title="Importar CSV"
        subtitle="Importe uma lista de contatos e dispare mensagens em massa"
        action={
          <a href="/api/v1/import/template" download>
            <Btn variant="ghost" size="sm">
              <Download size={14} /> CSV Modelo
            </Btn>
          </a>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Form */}
        <Card>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, marginBottom: 20 }}>
            Configuração
          </div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Input
              label="Nome da campanha *"
              placeholder="Promoção Julho 2025"
              value={form.campaign_name}
              onChange={e => setForm(p => ({ ...p, campaign_name: e.target.value }))}
              required
            />

            <Textarea
              label="Template da mensagem"
              placeholder="Olá {{name}}! Temos uma oferta especial para você sobre {{produto}}."
              value={form.message_template}
              onChange={e => setForm(p => ({ ...p, message_template: e.target.value }))}
              style={{ minHeight: 80 }}
            />
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: -10 }}>
              Use <code style={{ background: 'var(--surface)', padding: '1px 5px', borderRadius: 4 }}>{'{{coluna}}'}</code> para inserir valores do CSV.
            </div>

            {/* Upload */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Upload CSV</label>
              <label style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '24px', border: '2px dashed var(--border2)', borderRadius: 10,
                cursor: 'pointer', gap: 8, transition: 'border-color 0.2s',
                ':hover': { borderColor: 'var(--green)' }
              }}>
                <Upload size={24} style={{ color: 'var(--text3)' }} />
                <span style={{ fontSize: 13, color: 'var(--text2)' }}>Clique para selecionar o arquivo CSV</span>
                <input type="file" accept=".csv" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>
            </div>

            <Textarea
              label="Ou cole o conteúdo CSV diretamente"
              placeholder={`phone,name,produto\n+5547999990001,João,Plano Pro\n+5511988880002,Maria,Plano Basic`}
              value={form.csv_content}
              onChange={e => setForm(p => ({ ...p, csv_content: e.target.value }))}
              style={{ minHeight: 120, fontFamily: 'monospace', fontSize: 12 }}
            />

            <Btn type="submit" loading={loading} size="lg" style={{ justifyContent: 'center' }}>
              <Upload size={16} /> Importar e Disparar
            </Btn>
          </form>
        </Card>

        {/* Guide + Result */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Result */}
          {result && (
            <Card style={{ border: '1px solid rgba(37,211,102,0.3)' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
                <CheckCircle size={20} style={{ color: 'var(--green)' }} />
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>
                  Importação concluída!
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Importados', value: result.total_imported, color: 'var(--green)' },
                  { label: 'Pulados', value: result.skipped, color: 'var(--yellow)' },
                  { label: 'ID Campanha', value: result.campaign_id?.slice(0, 8) + '...', color: 'var(--accent)' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{
                    background: 'var(--surface)', borderRadius: 9, padding: '12px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color }}>{value}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>
              {result.errors?.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 12, color: 'var(--yellow)', fontWeight: 600, marginBottom: 6 }}>
                    Erros ({result.errors.length}):
                  </div>
                  {result.errors.map((e, i) => (
                    <div key={i} style={{ fontSize: 11, color: 'var(--red)', marginBottom: 2 }}>
                      Linha {e.linha}: {e.phone} — {e.erro}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* Guide */}
          <Card>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, marginBottom: 16 }}>
              Formato do CSV
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ background: 'var(--surface)', borderRadius: 9, padding: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, fontWeight: 600 }}>OBRIGATÓRIO</div>
                <code style={{ fontSize: 12, color: 'var(--green)' }}>phone</code>
                <span style={{ fontSize: 12, color: 'var(--text2)', marginLeft: 8 }}>— telefone com DDI (+55...)</span>
              </div>
              <div style={{ background: 'var(--surface)', borderRadius: 9, padding: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, fontWeight: 600 }}>OPCIONAIS</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.8 }}>
                  <code style={{ color: 'var(--accent)' }}>name</code>, <code style={{ color: 'var(--accent)' }}>text</code> (mensagem direta),
                  ou qualquer coluna usada no template como <code style={{ color: 'var(--accent)' }}>{'{{coluna}}'}</code>
                </div>
              </div>
              <div style={{ background: 'var(--surface)', borderRadius: 9, padding: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, fontWeight: 600 }}>EXEMPLO</div>
                <pre style={{ fontSize: 11, color: 'var(--text2)', overflowX: 'auto', margin: 0 }}>
{`phone,name,produto
+5547999990001,João,Plano Pro
+5511988880002,Maria,Plano Basic`}
                </pre>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
