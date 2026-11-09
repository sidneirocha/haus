import { useState } from 'react'
import { X } from 'lucide-react'
import { crmRepository } from './repository'
import { SERVICE_CATEGORIES } from './types'
import type { Service } from './types'
import { Spinner, useConfirm, useToast } from './Toast'
import { formatBRL, parseBRL } from './money'

export function EditService({ service, close, reload }: { service: Service; close: () => void; reload: () => void }) {
  const [form, setForm] = useState({ name: service.name, description: service.description, category: service.category, price: formatBRL(service.price), billing: service.billing, active: service.active })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { notify } = useToast()
  const confirm = useConfirm()
  const remove = async () => {
    if (!(await confirm({ title: 'Excluir serviço?', message: `O serviço “${service.name}” será removido da biblioteca. Essa ação não pode ser desfeita.`, confirmLabel: 'Excluir serviço' }))) return
    setBusy(true); setError('')
    try { await crmRepository.deleteService(service.id); close(); reload() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível excluir o serviço.'); notify('Não foi possível excluir o serviço.', 'error') }
    finally { setBusy(false) }
  }
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('')
    const price = parseBRL(form.price)
    if (price <= 0) { setBusy(false); setError('Informe um preço maior que zero.'); return }
    try { await crmRepository.updateService(service.id, { ...form, price }); close(); reload(); notify('Serviço atualizado.') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar o serviço.'); notify('Não foi possível atualizar o serviço.', 'error') }
    finally { setBusy(false) }
  }
  return <div className="crm-modal-backdrop" onClick={close}><div className="crm-modal" onClick={event => event.stopPropagation()}><div className="crm-drawer-header"><h2>Editar serviço</h2><button className="crm-icon-button" onClick={close} aria-label="Fechar"><X size={17} /></button></div><form className="crm-form" onSubmit={save}><label className="crm-field"><span>Nome</span><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label><label className="crm-field"><span>Descrição</span><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label><div className="crm-form-row"><label className="crm-field"><span>Categoria</span><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{!SERVICE_CATEGORIES.includes(form.category as typeof SERVICE_CATEGORIES[number]) && <option>{form.category}</option>}{SERVICE_CATEGORIES.map(item => <option key={item}>{item}</option>)}</select></label><label className="crm-field"><span>Preço padrão (BRL)</span><input inputMode="decimal" placeholder="R$ 1.200,00" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} onBlur={() => setForm(current => ({ ...current, price: formatBRL(parseBRL(current.price)) }))} /></label></div><label className="crm-field"><span>Cobrança</span><select value={form.billing} onChange={e => setForm({ ...form, billing: e.target.value as Service['billing'] })}><option>Uma vez</option><option>Mensal</option><option>Anual</option></select></label><label className="crm-checkbox"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> Serviço ativo</label>{error && <p className="crm-form-error" role="alert">{error}</p>}<div className="crm-form-actions"><button className="crm-button danger" type="button" onClick={remove} disabled={busy}>Excluir</button><span className="crm-form-actions-spacer" /><button className="crm-button secondary" type="button" onClick={close}>Cancelar</button><button className="crm-button primary" type="submit" disabled={busy}>{busy ? <><Spinner label="Salvando serviço" />Salvando…</> : 'Atualizar serviço'}</button></div></form></div></div>
}
