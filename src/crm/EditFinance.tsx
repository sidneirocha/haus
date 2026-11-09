import { useState } from 'react'
import { X } from 'lucide-react'
import { crmRepository } from './repository'
import type { FinancialEntry, FinancialRecurrence, FinancialStatus, FinancialType } from './types'
import { Spinner, useToast } from './Toast'
import { formatBRL, parseBRL } from './money'

export function EditFinance({ entry, close, reload }: { entry: FinancialEntry; close: () => void; reload: () => void }) {
  const [form, setForm] = useState({ date: entry.date, description: entry.description, type: entry.type, category: entry.category, amount: String(entry.amount), status: entry.status, recurrence: entry.recurrence ?? 'Nenhuma', nextDueDate: entry.nextDueDate ?? '', notes: entry.notes ?? '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { notify } = useToast()
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('')
    const amount = parseBRL(form.amount)
    if (amount <= 0) { setError('Informe um valor maior que zero.'); setBusy(false); return }
    try { await crmRepository.updateFinance(entry.id, { ...form, amount }); close(); reload() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar o lançamento.'); notify('Não foi possível atualizar o lançamento.', 'error') }
    finally { setBusy(false) }
  }
  return <div className="crm-modal-backdrop" onClick={close}><div className="crm-modal" onClick={event => event.stopPropagation()}><div className="crm-drawer-header"><h2>Editar lançamento</h2><button className="crm-icon-button" onClick={close} aria-label="Fechar"><X size={17} /></button></div><form className="crm-form" onSubmit={save}><div className="crm-form-row"><label className="crm-field"><span>Data</span><input required type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label><label className="crm-field"><span>Tipo</span><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as FinancialType })}><option>Entrada</option><option>Saída</option><option>Custo</option></select></label></div><label className="crm-field"><span>Descrição</span><input required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label><div className="crm-form-row"><label className="crm-field"><span>Categoria</span><input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} /></label><label className="crm-field"><span>Valor (BRL)</span><input required inputMode="decimal" placeholder="R$ 1.200,00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} onBlur={() => setForm(current => ({ ...current, amount: formatBRL(parseBRL(current.amount)) }))} /></label></div><div className="crm-form-row"><label className="crm-field"><span>Situação</span><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as FinancialStatus })}><option>Pendente</option><option>Pago</option><option>Recebido</option></select></label><label className="crm-field"><span>Recorrência</span><select value={form.recurrence} onChange={e => setForm({ ...form, recurrence: e.target.value as FinancialRecurrence, nextDueDate: e.target.value === 'Nenhuma' ? '' : form.nextDueDate })}><option>Nenhuma</option><option>Mensal</option><option>Trimestral</option><option>Anual</option></select></label></div>{form.recurrence !== 'Nenhuma' && <label className="crm-field"><span>Próximo vencimento</span><input required type="date" value={form.nextDueDate} onChange={e => setForm({ ...form, nextDueDate: e.target.value })} /></label>}<label className="crm-field"><span>Observações</span><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></label>{error && <p className="crm-form-error" role="alert">{error}</p>}<div className="crm-form-actions"><button className="crm-button secondary" type="button" onClick={close}>Cancelar</button><button className="crm-button primary" type="submit" disabled={busy}>{busy ? <><Spinner label="Salvando lançamento" />Salvando…</> : 'Atualizar lançamento'}</button></div></form></div></div>
}
