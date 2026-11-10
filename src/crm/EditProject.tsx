import { useRef, useState } from 'react'
import { X, MessageSquare, Plus } from 'lucide-react'
import { crmRepository } from './repository'
import type { Activity, Client, DashboardData, Project, ProjectStatus, Service, Story, Subtask, WorkStatus } from './types'
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
  data?: DashboardData
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

export function EditProject({ project, clients, services = [], stages = ['Briefing', 'Em produção', 'Em revisão', 'Concluído'], close, reload, drawer = false, data }: EditProjectProps) {
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
      {data && <ProjectWorkflow project={project} data={data} reload={reload} />}
      {error && <p className="crm-form-error" role="alert">{error}</p>}
      <div className="crm-form-actions"><button className="crm-button danger" type="button" onClick={remove} disabled={busy}>Excluir</button><span className="crm-form-actions-spacer" /><button className="crm-button secondary" type="button" onClick={close}>Fechar</button></div>
    </form>
  </>
  return drawer ? <div className="crm-drawer-backdrop" onClick={close}><aside className="crm-drawer crm-project-edit-drawer" onClick={event => event.stopPropagation()}>{content}</aside></div> : <div className="crm-modal-backdrop" onClick={close}><div className="crm-modal" onClick={event => event.stopPropagation()}>{content}</div></div>
}

function ProjectWorkflow({ project, data, reload }: { project: Project; data: DashboardData; reload: () => void }) {
  const [storyTitle, setStoryTitle] = useState('')
  const [activity, setActivity] = useState('')
  const [subtask, setSubtask] = useState('')
  const [selectedStory, setSelectedStory] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { notify } = useToast()
  const stories = (data.stories ?? []).filter(item => item.projectId === project.id).sort((a, b) => a.position - b.position)
  const subtasks = (data.subtasks ?? [])
  const activities = (data.activities ?? []).filter(item => (item.entityType === 'project' && item.entityId === project.id) || (item.entityType === 'story' && stories.some(story => story.id === item.entityId)))
  const saveStory = async (story: Story, status: WorkStatus) => { await crmRepository.updateStory(story.id, { ...story, status }); reload() }
  const createStory = async () => { if (!storyTitle.trim()) return; setBusy(true); try { await crmRepository.createStory({ projectId: project.id, title: storyTitle.trim(), description: '', status: 'Backlog', priority: 'P3 - Normal', assignee: '', startDate: project.startDate, dueDate: project.dueDate, position: stories.length }); setStoryTitle(''); reload() } catch (cause) { notify(cause instanceof Error ? cause.message : 'Não foi possível criar a história.', 'error') } finally { setBusy(false) } }
  const createSubtask = async () => { if (!selectedStory || !subtask.trim()) return; setBusy(true); try { await crmRepository.createSubtask({ storyId: selectedStory, title: subtask.trim(), description: '', status: 'Backlog', priority: 'P3 - Normal', assignee: '', startDate: '', dueDate: '', position: subtasks.filter(item => item.storyId === selectedStory).length }); setSubtask(''); reload() } catch (cause) { notify(cause instanceof Error ? cause.message : 'Não foi possível criar a subtarefa.', 'error') } finally { setBusy(false) } }
  const createActivity = async () => { if (!activity.trim()) return; setBusy(true); try { await crmRepository.createActivity({ entityType: selectedStory ? 'story' : 'project', entityId: selectedStory ?? project.id, type: 'comment', message: activity.trim() }); setActivity(''); reload() } catch (cause) { notify(cause instanceof Error ? cause.message : 'Não foi possível registrar a atividade.', 'error') } finally { setBusy(false) } }
  return <section className="crm-workflow-section"><div className="crm-card-heading"><div><p className="crm-overline">{project.epicKey || 'ÉPICO'}</p><h3>Histórias e atividades</h3></div><span className="crm-count">{stories.filter(item => item.status === 'Concluído').length}/{stories.length}</span></div>
    <div className="crm-story-list">{stories.map(story => <article key={story.id} className={`crm-story-card ${selectedStory === story.id ? 'active' : ''}`}><div className="crm-story-main" onClick={() => setSelectedStory(selectedStory === story.id ? null : story.id)}><div><strong>{story.title}</strong><small>{story.description || 'Sem descrição'}</small></div><select value={story.status} onClick={event => event.stopPropagation()} onChange={event => void saveStory(story, event.target.value as WorkStatus)}>{['Backlog', 'Em andamento', 'Em revisão', 'Concluído', 'Bloqueado'].map(status => <option key={status}>{status}</option>)}</select></div>{selectedStory === story.id && <div className="crm-story-details"><div className="crm-subtask-list">{subtasks.filter(item => item.storyId === story.id).map(item => <label key={item.id}><input type="checkbox" checked={item.status === 'Concluído'} onChange={() => void crmRepository.updateSubtask(item.id, { ...item, status: item.status === 'Concluído' ? 'Backlog' : 'Concluído' }).then(reload)} /><span>{item.title}</span></label>)}</div><div className="crm-inline-field"><input placeholder="Adicionar subtarefa" value={subtask} onChange={event => setSubtask(event.target.value)} /><button className="crm-button secondary" type="button" onClick={() => void createSubtask()} disabled={busy}><Plus size={14} />Adicionar</button></div></div>}</article>)}</div>
    <div className="crm-inline-field"><input placeholder="Adicionar história ao épico" value={storyTitle} onChange={event => setStoryTitle(event.target.value)} /><button className="crm-button secondary" type="button" onClick={() => void createStory()} disabled={busy}><Plus size={14} />História</button></div>
    <div className="crm-activity-box"><div className="crm-activity-label"><MessageSquare size={15} /> Atividade {selectedStory ? 'da história selecionada' : 'do projeto'}</div><textarea placeholder="Registre atividades, comentários ou links…" value={activity} onChange={event => setActivity(event.target.value)} /><button className="crm-button secondary" type="button" onClick={() => void createActivity()} disabled={busy || !activity.trim()}>Registrar atividade</button></div>
    {!!activities.length && <div className="crm-activity-feed">{activities.slice(-5).reverse().map((item: Activity) => <div key={item.id}><small>{item.author} · {new Date(item.createdAt).toLocaleString('pt-BR')}</small><span>{item.message}</span></div>)}</div>}
  </section>
}
