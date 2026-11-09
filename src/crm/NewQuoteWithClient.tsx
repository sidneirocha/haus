import { useState } from 'react'
import { X } from 'lucide-react'
import { crmRepository } from './repository'
import type { Client, DashboardData, Service } from './types'
import { useToast } from './Toast'
import { InlineServiceCreator } from './InlineServiceCreator'

export function NewQuoteWithClient({ close, reload, data }: { close: () => void; reload: () => void; data: DashboardData }) {
  const [clients, setClients] = useState(data.clients)
  const [clientId, setClientId] = useState(data.clients[0]?.id ?? '')
  const [selected, setSelected] = useState<string[]>([data.services[0]?.id ?? ''])
  const [createdServices, setCreatedServices] = useState<Service[]>([])
  const [showServiceForm, setShowServiceForm] = useState(false)
  const [showClientForm, setShowClientForm] = useState(data.clients.length === 0)
  const [clientForm, setClientForm] = useState({ name: '', company: '', email: '', phone: '', notes: '' })
  const [busy, setBusy] = useState(false)
  const [clientBusy, setClientBusy] = useState(false)
  const [error, setError] = useState('')
  const [clientError, setClientError] = useState('')
  const { notify } = useToast()
  const client = clients.find(item => item.id === clientId)
  const services = [...createdServices, ...data.services]
  const total = services.filter(item => selected.includes(item.id)).reduce((sum, item) => sum + item.price, 0)
  const saveClient = async () => {
    if (!clientForm.name.trim() || !clientForm.company.trim()) { setClientError('Informe nome e empresa para cadastrar o cliente.'); return }
    setClientBusy(true); setClientError('')
    try { const created = await crmRepository.createClient(clientForm); setClients(current => [created, ...current]); setClientId(created.id); setShowClientForm(false) }
    catch (cause) { setClientError(cause instanceof Error ? cause.message : 'Não foi possível cadastrar o cliente.'); notify('Não foi possível cadastrar o cliente.', 'error') }
    finally { setClientBusy(false) }
  }
  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!client || !selected.length) { setError('Selecione um cliente e pelo menos um serviço.'); return }
    setBusy(true); setError('')
    try { const items = services.filter(item => selected.includes(item.id)).map(item => ({ serviceId: item.id, name: item.name, quantity: 1, price: item.price, billing: item.billing })); await crmRepository.createQuote({ clientId: client.id, clientName: client.name, company: client.company, items, expiresAt: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10), notes: '', pixKey: '', paymentUrl: '' }); close(); reload() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível criar o orçamento.'); notify('Não foi possível criar o orçamento.', 'error') }
    finally { setBusy(false) }
  }
  const addCreatedService = (service: Service) => { setCreatedServices(current => [service, ...current]); setSelected(current => [...current, service.id]); setShowServiceForm(false); notify('Serviço criado e adicionado ao orçamento.') }
  return <div className="crm-modal-backdrop" onClick={close}><div className="crm-modal" onClick={event => event.stopPropagation()}><div className="crm-drawer-header"><h2>Novo orçamento</h2><button className="crm-icon-button" onClick={close} aria-label="Fechar"><X size={17} /></button></div><div className="crm-stepper"><span className="active">1 Cliente</span><span>2 Serviços</span><span>3 Publicar</span></div><form className="crm-form" onSubmit={create}><label className="crm-field"><span>Cliente</span>{clients.length ? <div className="crm-inline-field"><select required value={clientId} onChange={e => setClientId(e.target.value)}>{clients.map(item => <option key={item.id} value={item.id}>{item.company}</option>)}</select><button type="button" className="crm-button secondary" onClick={() => setShowClientForm(value => !value)}>{showClientForm ? 'Cancelar cadastro' : 'Cadastrar cliente'}</button></div> : <div className="crm-empty-inline">Nenhum cliente cadastrado. Cadastre o primeiro cliente para continuar.<button type="button" className="crm-button secondary" onClick={() => setShowClientForm(true)}>Cadastrar cliente</button></div>}</label>{showClientForm && <div className="crm-inline-form"><strong>Cadastro rápido</strong><label className="crm-field"><span>Nome</span><input value={clientForm.name} onChange={e => setClientForm({ ...clientForm, name: e.target.value })} /></label><label className="crm-field"><span>Empresa</span><input value={clientForm.company} onChange={e => setClientForm({ ...clientForm, company: e.target.value })} /></label><div className="crm-form-row"><label className="crm-field"><span>E-mail</span><input type="email" value={clientForm.email} onChange={e => setClientForm({ ...clientForm, email: e.target.value })} /></label><label className="crm-field"><span>Telefone</span><input value={clientForm.phone} onChange={e => setClientForm({ ...clientForm, phone: e.target.value })} /></label></div>{clientError && <p className="crm-form-error" role="alert">{clientError}</p>}<button type="button" className="crm-button secondary" onClick={saveClient} disabled={clientBusy}>{clientBusy ? 'Salvando…' : 'Salvar cliente'}</button></div>}<div className="crm-field"><span>Serviços do orçamento</span><div className="crm-service-picker"><button type="button" className="crm-button secondary" onClick={() => setShowServiceForm(value => !value)}>{showServiceForm ? 'Fechar criação' : 'Criar serviço direto'}</button></div>{showServiceForm && <InlineServiceCreator onCreated={addCreatedService} onCancel={() => setShowServiceForm(false)} />}<div className="crm-check-list">{services.filter(item => item.active).map(service => <label key={service.id}><input type="checkbox" checked={selected.includes(service.id)} onChange={event => setSelected(event.target.checked ? [...selected, service.id] : selected.filter(id => id !== service.id))} /><span>{service.name}</span><strong>{service.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></label>)}</div></div><div className="crm-quote-preview"><span>Total estimado</span><strong>{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong><small>O link público será gerado ao publicar.</small></div>{error && <p className="crm-form-error" role="alert">{error}</p>}<div className="crm-form-actions"><button className="crm-button secondary" type="button" onClick={close}>Cancelar</button><button className="crm-button primary" type="submit" disabled={busy || !client}>{busy ? 'Criando…' : 'Criar rascunho'}</button></div></form>{client && <p className="crm-form-note">O orçamento será criado para {client.company} e aparecerá na lista de orçamentos.</p>}</div></div>
}
