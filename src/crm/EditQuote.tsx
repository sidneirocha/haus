import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { crmRepository } from './repository'
import { InlineServiceCreator } from './InlineServiceCreator'
import type { DashboardData, Quote, QuoteItem, Service } from './types'
import { Spinner, useConfirm, useToast } from './Toast'

export function EditQuote({ quote, data, close, reload }: { quote: Quote; data: DashboardData; close: () => void; reload: () => void }) {
  const [clientId, setClientId] = useState(quote.clientId)
  const [selected, setSelected] = useState<string[]>(quote.items.map(item => item.serviceId))
  const [createdServices, setCreatedServices] = useState<Service[]>([])
  const [serviceToAdd, setServiceToAdd] = useState('')
  const [showServiceCreator, setShowServiceCreator] = useState(false)
  const [expiresAt, setExpiresAt] = useState(quote.expiresAt)
  const [notes, setNotes] = useState(quote.notes)
  const [pixKey, setPixKey] = useState(quote.pixKey)
  const [paymentUrl, setPaymentUrl] = useState(quote.paymentUrl)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { notify } = useToast()
  const confirm = useConfirm()
  const client = data.clients.find(item => item.id === clientId)
  const allServices = [...createdServices, ...data.services.filter(item => !createdServices.some(created => created.id === item.id))]
  const available = allServices.filter(item => item.active && !selected.includes(item.id))
  const addService = () => { if (serviceToAdd) { setSelected(current => [...current, serviceToAdd]); setServiceToAdd(''); notify('Serviço adicionado ao orçamento.') } }
  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!client || !selected.length) { setError('Selecione um cliente e pelo menos um serviço.'); return }
    setBusy(true); setError('')
    try { const items: QuoteItem[] = allServices.filter(item => selected.includes(item.id)).map(item => ({ serviceId: item.id, name: item.name, quantity: 1, price: item.price, billing: item.billing })); await crmRepository.updateQuote(quote.id, { clientId, clientName: client.name, company: client.company, items, expiresAt, notes, pixKey, paymentUrl }); close(); reload(); notify('Orçamento atualizado.') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar o orçamento.'); notify('Não foi possível atualizar o orçamento.', 'error') }
    finally { setBusy(false) }
  }
  const remove = async () => {
    if (!(await confirm({ title: 'Excluir orçamento?', message: `O orçamento de “${quote.company}” será removido. Essa ação não pode ser desfeita.`, confirmLabel: 'Excluir orçamento' }))) return
    setBusy(true); setError('')
    try { await crmRepository.deleteQuote(quote.id); close(); reload() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível excluir o orçamento.'); notify('Não foi possível excluir o orçamento.', 'error') }
    finally { setBusy(false) }
  }
  const createdService = (service: Service) => { setCreatedServices(current => [service, ...current]); setShowServiceCreator(false); setSelected(current => [...current, service.id]); notify('Serviço criado e adicionado ao orçamento.'); void reload() }
  return <div className="crm-modal-backdrop" onClick={close}><div className="crm-modal" onClick={event => event.stopPropagation()}><div className="crm-drawer-header"><h2>Editar orçamento</h2><button className="crm-icon-button" onClick={close} aria-label="Fechar"><X size={17} /></button></div><form className="crm-form" onSubmit={save}><label className="crm-field"><span>Cliente</span><select value={clientId} onChange={e => setClientId(e.target.value)}>{data.clients.map(item => <option key={item.id} value={item.id}>{item.company}</option>)}</select></label><div className="crm-field"><span>Serviços do orçamento</span><div className="crm-service-picker"><select value={serviceToAdd} onChange={e => setServiceToAdd(e.target.value)}><option value="">Selecione um serviço</option>{available.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}</select><button className="crm-button secondary" type="button" onClick={addService} disabled={!serviceToAdd}><Plus size={15} />Adicionar serviço</button><button className="crm-button ghost" type="button" onClick={() => setShowServiceCreator(current => !current)}>{showServiceCreator ? 'Fechar criação' : 'Criar serviço'}</button></div>{showServiceCreator && <InlineServiceCreator onCreated={createdService} onCancel={() => setShowServiceCreator(false)} />}<div className="crm-selected-services">{selected.map(id => { const service = allServices.find(item => item.id === id); if (!service) return null; return <div key={id}><span>{service.name}<small>{service.billing}</small></span><strong>{service.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong><button type="button" className="crm-icon-button" onClick={() => { setSelected(current => current.filter(item => item !== id)); notify('Serviço removido do orçamento.') }} aria-label={`Remover ${service.name}`}><X size={13} /></button></div> })}</div></div><label className="crm-field"><span>Expira em</span><input required type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} /></label><label className="crm-field"><span>Chave Pix</span><input value={pixKey} onChange={e => setPixKey(e.target.value)} /></label><label className="crm-field"><span>Link de pagamento</span><input value={paymentUrl} onChange={e => setPaymentUrl(e.target.value)} /></label><label className="crm-field"><span>Notas</span><textarea value={notes} onChange={e => setNotes(e.target.value)} /></label>{error && <p className="crm-form-error" role="alert">{error}</p>}<div className="crm-form-actions"><button className="crm-button danger" type="button" onClick={remove} disabled={busy}>Excluir</button><span className="crm-form-actions-spacer" /><button className="crm-button secondary" type="button" onClick={close}>Cancelar</button><button className="crm-button primary" type="submit" disabled={busy}>{busy ? <><Spinner label="Salvando orçamento" />Salvando…</> : 'Atualizar orçamento'}</button></div></form></div></div>
}
