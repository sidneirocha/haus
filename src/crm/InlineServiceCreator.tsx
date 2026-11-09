import { useState } from 'react'
import { crmRepository } from './repository'
import { SERVICE_CATEGORIES, type Service } from './types'
import { formatBRL, parseBRL } from './money'
import { useToast } from './Toast'

export function InlineServiceCreator({ onCreated, onCancel }: { onCreated: (service: Service) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ name: '', description: '', category: 'Web', price: '', billing: 'Uma vez' as Service['billing'] })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { notify } = useToast()

  const save = async () => {
    const price = parseBRL(form.price)
    if (!form.name.trim() || price <= 0) { setError('Informe nome e um preço maior que zero.'); return }
    setBusy(true); setError('')
    try {
      const service = await crmRepository.createService({ ...form, name: form.name.trim(), price, active: true })
      notify('Serviço criado e pronto para adicionar.')
      onCreated(service)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível criar o serviço.'); notify('Não foi possível criar o serviço.', 'error') }
    finally { setBusy(false) }
  }

  return <div className="crm-inline-form" onClick={event => event.stopPropagation()}>
    <strong>Novo serviço rápido</strong>
    <div className="crm-form-row">
      <label className="crm-field"><span>Nome</span><input autoFocus value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label>
      <label className="crm-field"><span>Categoria</span><select value={form.category} onChange={event => setForm({ ...form, category: event.target.value })}>{SERVICE_CATEGORIES.map(item => <option key={item}>{item}</option>)}</select></label>
    </div>
    <label className="crm-field"><span>Preço padrão (BRL)</span><input inputMode="decimal" placeholder="R$ 1.200,00" value={form.price} onChange={event => setForm({ ...form, price: event.target.value })} onBlur={() => setForm(current => ({ ...current, price: formatBRL(parseBRL(current.price)) }))} /></label>
    {error && <p className="crm-form-error" role="alert">{error}</p>}
    <div className="crm-form-actions"><button className="crm-button secondary" type="button" onClick={onCancel}>Cancelar</button><button className="crm-button primary" type="button" onClick={() => void save()} disabled={busy}>{busy ? 'Criando…' : 'Criar e adicionar'}</button></div>
  </div>
}
