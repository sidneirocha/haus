import { useState } from 'react'
import { X } from 'lucide-react'
import { crmRepository } from './repository'
import type { Client, ProjectStatus, Service } from './types'
import { useToast } from './Toast'
import { formatBRL } from './money'

type ClientForm = { name: string; company: string; email: string; phone: string; notes: string }
const emptyClient: ClientForm = { name: '', company: '', email: '', phone: '', notes: '' }

export function NewProjectWithSolutions({ clients: initialClients, services, stages = ['Briefing', 'Em produção', 'Em revisão', 'Concluído'], close, reload }: { clients: Client[]; services: Service[]; stages?: string[]; close: () => void; reload: () => void }) {
  const [clients, setClients] = useState(initialClients)
  const [form, setForm] = useState({ name: '', clientId: initialClients[0]?.id ?? '', status: 'Briefing' as ProjectStatus, startDate: new Date().toISOString().slice(0, 10), dueDate: '', nextAction: '', upsellDate: '', value: '0', notes: '' })
  const [clientForm, setClientForm] = useState<ClientForm>(emptyClient)
  const [selected, setSelected] = useState<string[]>([])
  const [showClientForm, setShowClientForm] = useState(initialClients.length === 0)
  const [busy, setBusy] = useState(false)
  const [clientBusy, setClientBusy] = useState(false)
  const [error, setError] = useState('')
  const [clientError, setClientError] = useState('')
  const { notify } = useToast()
  const serviceTotal = services.filter(service => selected.includes(service.id)).reduce((sum, service) => sum + service.price, 0)
  const client = clients.find(item => item.id === form.clientId)

  const setSolutionSelection = (next: string[]) => {
    setSelected(next)
    setForm(current => ({ ...current, value: String(services.filter(service => next.includes(service.id)).reduce((sum, service) => sum + service.price, 0)) }))
  }

  const saveClient = async () => {
    if (!clientForm.name.trim() || !clientForm.company.trim()) {
      setClientError('Informe nome e empresa para cadastrar o cliente.')
      return
    }
    setClientBusy(true)
    setClientError('')
    try {
      const created = await crmRepository.createClient(clientForm)
      setClients(current => [created, ...current])
      setForm(current => ({ ...current, clientId: created.id }))
      setClientForm(emptyClient)
      setShowClientForm(false)
    } catch (cause) {
      setClientError(cause instanceof Error ? cause.message : 'Não foi possível cadastrar o cliente.')
      notify('Não foi possível cadastrar o cliente.', 'error')
    } finally {
      setClientBusy(false)
    }
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.clientId) {
      setError('Cadastre ou selecione um cliente para continuar.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const solutions = services.filter(service => selected.includes(service.id)).map(service => ({ id: `solution-${Date.now()}-${service.id}`, serviceId: service.id, name: service.name, billing: service.billing, value: service.price }))
      await crmRepository.createProject({ ...form, value: serviceTotal, solutions })
      close()
      reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o projeto.')
      notify('Não foi possível salvar o projeto.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return <div className="crm-modal-backdrop" onClick={close}>
    <div className="crm-modal" onClick={event => event.stopPropagation()}>
      <div className="crm-drawer-header"><h2>Novo projeto</h2><button className="crm-icon-button" onClick={close} aria-label="Fechar" title="Fechar"><X size={17} /></button></div>
      <form className="crm-form" onSubmit={save}>
        <label className="crm-field"><span>Nome do projeto</span><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
        <label className="crm-field">
          <span>Cliente</span>
          {clients.length ? <div className="crm-inline-field"><select required value={form.clientId} onChange={e => setForm({ ...form, clientId: e.target.value })}>{clients.map(item => <option key={item.id} value={item.id}>{item.company}</option>)}</select><button type="button" className="crm-button secondary" onClick={() => setShowClientForm(value => !value)}>{showClientForm ? 'Cancelar cadastro' : 'Cadastrar cliente'}</button></div> : <div className="crm-empty-inline">Nenhum cliente cadastrado. Cadastre o primeiro para continuar.<button type="button" className="crm-button secondary" onClick={() => setShowClientForm(true)}>Cadastrar cliente</button></div>}
        </label>
        {showClientForm && <div className="crm-inline-form"><strong>Cadastro rápido do cliente</strong><label className="crm-field"><span>Nome</span><input required value={clientForm.name} onChange={e => setClientForm({ ...clientForm, name: e.target.value })} /></label><label className="crm-field"><span>Empresa</span><input required value={clientForm.company} onChange={e => setClientForm({ ...clientForm, company: e.target.value })} /></label><div className="crm-form-row"><label className="crm-field"><span>E-mail</span><input type="email" value={clientForm.email} onChange={e => setClientForm({ ...clientForm, email: e.target.value })} /></label><label className="crm-field"><span>Telefone</span><input value={clientForm.phone} onChange={e => setClientForm({ ...clientForm, phone: e.target.value })} /></label></div>{clientError && <p className="crm-form-error" role="alert">{clientError}</p>}<button type="button" className="crm-button secondary" onClick={saveClient} disabled={clientBusy}>{clientBusy ? 'Salvando…' : 'Salvar cliente'}</button></div>}
        <div className="crm-form-row"><label className="crm-field"><span>Etapa</span><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as ProjectStatus })}>{stages.map(stage => <option key={stage}>{stage}</option>)}</select></label><label className="crm-field"><span>Valor calculado</span><input type="text" value={formatBRL(serviceTotal)} readOnly aria-describedby="new-project-value-help" title="Soma das soluções selecionadas" /><small id="new-project-value-help" className="crm-form-note">Selecione as soluções para atualizar o total.</small></label></div>
        <div className="crm-form-row"><label className="crm-field"><span>Início</span><input required type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></label><label className="crm-field"><span>Vencimento</span><input required type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} /></label></div>
        <label className="crm-field"><span>Próxima ação</span><input value={form.nextAction} onChange={e => setForm({ ...form, nextAction: e.target.value })} /></label>
        <div className="crm-field crm-project-solutions"><span>Soluções deste projeto</span><div className="crm-check-list">{services.filter(service => service.active).map(service => <label key={service.id} title={`Adicionar ${service.name} por ${service.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}><input type="checkbox" checked={selected.includes(service.id)} onChange={event => setSolutionSelection(event.target.checked ? [...selected, service.id] : selected.filter(id => id !== service.id))} /><span>{service.name}<small>{service.billing}</small></span><strong>{service.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></label>)}</div><small className="crm-form-note">Um projeto pode reunir várias soluções, como site, hospedagem e domínio.</small></div>
        <label className="crm-field"><span>Notas</span><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></label>
        {error && <p className="crm-form-error" role="alert">{error}</p>}
        <div className="crm-form-actions"><button className="crm-button secondary" type="button" onClick={close}>Cancelar</button><button className="crm-button primary" type="submit" disabled={busy || !client}>{busy ? 'Salvando…' : 'Salvar projeto'}</button></div>
      </form>
    </div>
  </div>
}
