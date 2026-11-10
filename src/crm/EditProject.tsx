import { useRef, useState } from 'react'
import { X } from 'lucide-react'
import { crmRepository } from './repository'
import type { Client, Project, ProjectStatus, Service } from './types'
import { Spinner, useConfirm, useToast } from './Toast'
import { formatBRL } from './money'
import { toInputDate } from './date-utils'

type EditProjectProps = {
  project: Project
  clients: Client[]
  services?: Service[]
  stages?: string[]
  close: () => void
  reload: () => void
  drawer?: boolean
}

type ProjectForm = {
  name: string
  clientId: string
  status: ProjectStatus
  startDate: string
  dueDate: string
  nextAction: string
  upsellDate: string
  value: string
  notes: string
}

export function EditProject({ project, clients, services = [], stages = ['Briefing', 'Em produção', 'Em revisão', 'Concluído'], close, reload, drawer = false }: EditProjectProps) {
  const availableServices = services.length ? services : (project.solutions ?? []).map(solution => ({ id: solution.serviceId || solution.id, name: solution.name, description: '', category: 'Projeto', price: solution.value, billing: solution.billing, active: true }))
  const initialValue = project.solutions?.length ? project.solutions.reduce((sum, solution) => sum + solution.value, 0) : project.value
  const [form, setForm] = useState<ProjectForm>({ name: project.name, clientId: project.clientId, status: project.status, startDate: toInputDate(project.startDate), dueDate: toInputDate(project.dueDate), nextAction: project.nextAction, upsellDate: toInputDate(project.upsellDate), value: String(initialValue), notes: project.notes })
  const [selected, setSelected] = useState<string[]>(project.solutions?.map(solution => solution.serviceId || solution.id) ?? [])
  const [selectionChanged, setSelectionChanged] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const savingRef = useRef(false)
  const pendingSaveRef = useRef<{ form: ProjectForm; selected: string[] } | null>(null)
  const { notify } = useToast()
  const confirm = useConfirm()
  const serviceTotal = availableServices.filter(service => selected.includes(service.id)).reduce((sum, service) => sum + service.price, 0)
  const calculatedValue = selectionChanged || project.solutions?.length ? serviceTotal : Number(form.value)

  const flushSave = async () => {
    if (savingRef.current) return
    savingRef.current = true
    setBusy(true)
    setError('')
    try {
      while (pendingSaveRef.current) {
        const pending = pendingSaveRef.current
        pendingSaveRef.current = null
        const solutions = availableServices.filter(service => pending.selected.includes(service.id)).map(service => ({ id: `${project.id}-${service.id}`, serviceId: service.id, name: service.name, billing: service.billing, value: service.price }))
        await crmRepository.updateProject(project.id, { ...pending.form, value: pending.selected.length ? solutions.reduce((sum, solution) => sum + solution.value, 0) : Number(pending.form.value), solutions })
        reload()
        notify('Alteração salva automaticamente.')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a alteração.')
      notify('Não foi possível salvar a alteração.', 'error')
    } finally {
      savingRef.current = false
      setBusy(false)
      if (pendingSaveRef.current) void flushSave()
    }
  }

  const saveDraft = (nextForm = form, nextSelected = selected) => {
    pendingSaveRef.current = { form: nextForm, selected: nextSelected }
    void flushSave()
  }

  const updateField = <K extends keyof ProjectForm>(field: K, value: ProjectForm[K], saveImmediately = false) => {
    const nextForm = { ...form, [field]: value }
    setForm(nextForm)
    if (saveImmediately) saveDraft(nextForm)
  }

  const setSolutionSelection = (next: string[]) => {
    const nextValue = availableServices.filter(service => next.includes(service.id)).reduce((sum, service) => sum + service.price, 0)
    const nextForm = { ...form, value: String(nextValue) }
    setSelectionChanged(true); setSelected(next); setForm(nextForm); void saveDraft(nextForm, next)
  }

  const remove = async () => {
    if (!(await confirm({ title: 'Excluir projeto?', message: `O projeto “${project.name}” será removido do CRM. Essa ação não pode ser desfeita.`, confirmLabel: 'Excluir projeto' }))) return
    setBusy(true); setError('')
    try { await crmRepository.deleteProject(project.id); close(); reload(); notify('Projeto excluído.') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível excluir o projeto.'); notify('Não foi possível excluir o projeto.', 'error') }
    finally { setBusy(false) }
  }

  const content = <>
    <div className="crm-drawer-header"><div><p className="crm-overline">Haus / CRM</p><h2>Detalhes do projeto</h2><span className="crm-autosave-state">{busy ? <><Spinner label="Salvando alteração" /> Salvando…</> : 'Salvamento automático'}</span></div><button className="crm-icon-button" onClick={close} aria-label="Fechar" title="Fechar"><X size={17} /></button></div>
    <form className="crm-form" onSubmit={event => event.preventDefault()}>
      <label className="crm-field"><span>Nome do projeto</span><input required value={form.name} onChange={e => updateField('name', e.target.value)} onBlur={() => saveDraft()} /></label>
      <label className="crm-field"><span>Cliente</span><select value={form.clientId} onChange={e => updateField('clientId', e.target.value, true)}>{clients.map(client => <option key={client.id} value={client.id}>{client.company}</option>)}</select></label>
      <div className="crm-form-row"><label className="crm-field"><span>Etapa</span><select value={form.status} onChange={e => updateField('status', e.target.value as ProjectStatus, true)}>{stages.map(stage => <option key={stage}>{stage}</option>)}</select></label><label className="crm-field"><span>Valor calculado</span><input type="text" value={formatBRL(calculatedValue)} readOnly aria-describedby="project-value-help" title="Soma das soluções selecionadas" /><small id="project-value-help" className="crm-form-note">Calculado pelas soluções.</small></label></div>
      <div className="crm-form-row"><label className="crm-field"><span>Início</span><input required type="date" value={form.startDate} onChange={e => updateField('startDate', e.target.value, true)} /></label><label className="crm-field"><span>Vencimento</span><input required type="date" value={form.dueDate} onChange={e => updateField('dueDate', e.target.value, true)} /></label></div>
      <div className="crm-form-row"><label className="crm-field"><span>Próxima ação</span><input value={form.nextAction} onChange={e => updateField('nextAction', e.target.value)} onBlur={() => saveDraft()} /></label><label className="crm-field"><span>Upsell</span><input type="date" value={form.upsellDate} onChange={e => updateField('upsellDate', e.target.value, true)} /></label></div>
      <div className="crm-field crm-project-solutions"><span>Soluções deste projeto</span><div className="crm-check-list">{availableServices.filter(service => service.active).map(service => <label key={service.id} title={`Adicionar ${service.name} por ${service.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}><input type="checkbox" checked={selected.includes(service.id)} onChange={event => setSolutionSelection(event.target.checked ? [...selected, service.id] : selected.filter(id => id !== service.id))} /><span>{service.name}<small>{service.billing}</small></span><strong>{service.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></label>)}</div></div>
      <label className="crm-field"><span>Notas</span><textarea value={form.notes} onChange={e => updateField('notes', e.target.value)} onBlur={() => saveDraft()} /></label>
      {error && <p className="crm-form-error" role="alert">{error}</p>}
      <div className="crm-form-actions"><button className="crm-button danger" type="button" onClick={remove} disabled={busy}>Excluir</button><span className="crm-form-actions-spacer" /><button className="crm-button secondary" type="button" onClick={close}>Fechar</button></div>
    </form>
  </>
  return drawer ? <div className="crm-drawer-backdrop" onClick={close}><aside className="crm-drawer crm-project-edit-drawer" onClick={event => event.stopPropagation()}>{content}</aside></div> : <div className="crm-modal-backdrop" onClick={close}><div className="crm-modal" onClick={event => event.stopPropagation()}>{content}</div></div>
}
