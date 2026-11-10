import { useMemo, useState } from 'react'
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, LoaderCircle, MessageSquare, Plus, RefreshCw } from 'lucide-react'
import { crmRepository } from './repository'
import type { DashboardData, Project, Sprint, Story, WorkStatus } from './types'

const statuses: WorkStatus[] = ['Backlog', 'Em andamento', 'Em revisão', 'Concluído', 'Bloqueado']
const sprintStatuses: Sprint['status'][] = ['Planejada', 'Ativa', 'Concluída']
const iso = (date: Date) => date.toISOString().slice(0, 10)
const addDays = (value: string, days: number) => { const raw = String(value || '').trim(); const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T12:00:00`) : new Date(raw); if (Number.isNaN(date.getTime())) return ''; date.setDate(date.getDate() + days); return iso(date) }
const humanDate = (value?: string) => {
  const raw = String(value || '').trim()
  if (!raw) return '—'
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T12:00:00`) : new Date(raw)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(date).replace('.', '')
}

type Props = { project: Project; data: DashboardData; close: () => void; reload: () => void }

export function ProjectWorkspace({ project, data, close, reload }: Props) {
  const [tab, setTab] = useState<'Resumo' | 'Sprints' | 'Backlog' | 'Cronograma' | 'Atividades'>('Resumo')
  const [busy, setBusy] = useState(false)
  const [creatingSprint, setCreatingSprint] = useState(false)
  const [sprintError, setSprintError] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [activity, setActivity] = useState('')
  const [sprintForm, setSprintForm] = useState({ name: '', goal: '', startDate: iso(new Date()), durationDays: 15 })
  const stories = useMemo(() => (data.stories ?? []).filter(item => item.projectId === project.id).sort((a, b) => a.position - b.position), [data.stories, project.id])
  const sprints = useMemo(() => (data.sprints ?? []).filter(item => item.projectId === project.id), [data.sprints, project.id])
  const activities = (data.activities ?? []).filter(item => item.entityId === project.id || (item.entityType === 'story' && stories.some(story => story.id === item.entityId)))
  const totals = statuses.map(status => ({ status, count: stories.filter(story => story.status === status).length })).filter(item => item.count > 0)

  const updateStory = async (story: Story, values: Partial<Story>) => {
    setBusy(true)
    try { await crmRepository.updateStory(story.id, { projectId: story.projectId, sprintId: values.sprintId ?? story.sprintId, quoteItemId: story.quoteItemId, serviceId: story.serviceId, title: story.title, description: story.description, status: values.status ?? story.status, priority: story.priority, assignee: story.assignee, startDate: story.startDate, dueDate: story.dueDate, position: story.position }); await reload() } finally { setBusy(false) }
  }
  const createSprint = async () => {
    const name = sprintForm.name.trim() || `Sprint ${sprints.length + 1}`
    setCreatingSprint(true)
    setSprintError('')
    try {
      await crmRepository.createSprint({ projectId: project.id, name, goal: sprintForm.goal, startDate: sprintForm.startDate, endDate: addDays(sprintForm.startDate, Math.max(1, sprintForm.durationDays) - 1), status: sprints.length ? 'Planejada' : 'Ativa', durationDays: Math.max(1, sprintForm.durationDays) })
      setSprintForm({ name: '', goal: '', startDate: sprintForm.startDate, durationDays: 15 })
      await reload()
      setTab('Sprints')
    } catch (cause) {
      setSprintError(cause instanceof Error ? cause.message : 'Não foi possível criar a sprint.')
    } finally {
      setCreatingSprint(false)
    }
  }
  const addActivity = async () => {
    if (!activity.trim()) return
    setBusy(true)
    try { await crmRepository.createActivity({ entityType: 'project', entityId: project.id, type: 'comment', message: activity.trim() }); setActivity(''); await reload() } finally { setBusy(false) }
  }
  const createFirstSprint = async () => {
    setCreatingSprint(true)
    setSprintError('')
    try {
      const startDate = project.startDate || iso(new Date())
      await crmRepository.createSprint({ projectId: project.id, name: 'Sprint 1', goal: 'Iniciar as histórias do projeto.', startDate, endDate: addDays(startDate, 14), status: 'Ativa', durationDays: 15 })
      await reload()
      setTab('Sprints')
    } catch (cause) {
      setSprintError(cause instanceof Error ? cause.message : 'Não foi possível criar a sprint.')
    } finally {
      setCreatingSprint(false)
    }
  }
  const renderStory = (story: Story) => {
    const storyActivities = activities.filter(item => item.entityId === story.id)
    return <article className={`crm-workspace-story ${expanded === story.id ? 'is-open' : ''}`} key={story.id}>
      <button className="crm-workspace-story-main" onClick={() => setExpanded(expanded === story.id ? null : story.id)}><span><strong>{story.title}</strong><small>{story.description || 'Sem descrição'}</small></span><select value={story.status} onClick={event => event.stopPropagation()} onChange={event => void updateStory(story, { status: event.target.value as WorkStatus })}>{statuses.map(status => <option key={status}>{status}</option>)}</select></button>
      {expanded === story.id && <div className="crm-workspace-story-details"><label>Sprint<select value={story.sprintId || ''} onChange={event => void updateStory(story, { sprintId: event.target.value || undefined })}><option value="">Backlog</option>{sprints.map(sprint => <option key={sprint.id} value={sprint.id}>{sprint.name}</option>)}</select></label>{storyActivities.map(item => <p className="crm-workspace-activity" key={item.id}><MessageSquare size={13} />{item.message}</p>)}</div>}
    </article>
  }
  return <div className="crm-project-workspace">
    <header className="crm-workspace-header"><button className="crm-button secondary" onClick={close}><ArrowLeft size={16} /> Projetos</button><div><small>ÉPICO · {project.epicKey || project.id}</small><h1>{project.name}</h1><p>{project.clientName} · origem: orçamento {project.quoteToken || 'interno'}</p></div><div className="crm-workspace-header-actions"><select value={project.status} onChange={event => void crmRepository.updateProjectStatus(project.id, event.target.value).then(reload)}><option>Briefing</option><option>Em produção</option><option>Em revisão</option><option>Concluído</option><option>Arquivo</option></select><button className="crm-button secondary" onClick={reload}><RefreshCw size={15} /></button></div></header>
    <nav className="crm-workspace-tabs">{(['Resumo', 'Sprints', 'Backlog', 'Cronograma', 'Atividades'] as const).map(item => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item}</button>)}</nav>
    <main className="crm-workspace-body">
      {tab === 'Resumo' && <><section className="crm-workspace-hero"><div><span className="crm-eyebrow">Controle ágil</span><h2>{stories.length} histórias no épico</h2><p>Organize a execução do orçamento em sprints e acompanhe as próximas ações.</p></div><div className="crm-workspace-progress"><strong>{stories.length ? Math.round(stories.filter(item => item.status === 'Concluído').length / stories.length * 100) : 0}%</strong><small>concluído</small></div></section><div className="crm-workspace-stats">{totals.map(item => <div key={item.status}><strong>{item.count}</strong><span>{item.status}</span></div>)}<div><strong>{sprints.length}</strong><span>sprints</span></div></div><section className="crm-workspace-panel"><div className="crm-panel-heading"><div><h3>Próximas histórias</h3><p>Ações derivadas do orçamento.</p></div><button className="crm-button secondary" onClick={() => setTab('Backlog')}>Ver backlog</button></div>{stories.slice(0, 4).map(renderStory)}</section></>}
      {tab === 'Sprints' && <><section className="crm-workspace-panel"><div className="crm-panel-heading"><div><h2>Sprints</h2><p>Planeje ciclos curtos com duração padrão de 15 dias.</p></div><button className="crm-button primary" onClick={() => { setSprintError(''); setSprintForm({ name: '', goal: '', startDate: iso(new Date()), durationDays: 15 }) }} disabled={creatingSprint}><Plus size={15} /> Nova sprint</button></div>{creatingSprint && <div className="crm-sprint-loading" role="status"><LoaderCircle className="crm-spin" size={16} /><span>Criando sprint e atualizando o projeto…</span></div>}{sprintError && <div className="crm-inline-error" role="alert">{sprintError}</div>}{sprints.length ? <div className="crm-sprint-grid">{sprints.map(sprint => <article className="crm-sprint-card" key={sprint.id}><div className="crm-sprint-card-top"><span><Clock3 size={15} />{sprint.name}</span><select value={sprint.status} onChange={event => void crmRepository.updateSprint(sprint.id, { ...sprint, status: event.target.value as Sprint['status'] }).then(reload)}>{sprintStatuses.map(status => <option key={status}>{status}</option>)}</select></div><strong>{humanDate(sprint.startDate)} — {humanDate(sprint.endDate)}</strong><p>{sprint.goal || 'Sem objetivo definido.'}</p><small>{stories.filter(story => story.sprintId === sprint.id).length} histórias · {sprint.durationDays} dias</small></article>)}</div> : <div className="crm-empty"><CalendarDays size={22} /><strong>Nenhuma sprint criada</strong><span>Comece com um ciclo de 15 dias.</span><button className="crm-button primary" onClick={() => void createFirstSprint()} disabled={creatingSprint}>{creatingSprint ? <><LoaderCircle className="crm-spin" size={15} /> Criando sprint…</> : 'Criar sprint de 15 dias'}</button></div>}</section><section className="crm-workspace-panel crm-sprint-form"><h3>Nova sprint</h3><div className="crm-form-grid"><input placeholder="Nome da sprint" value={sprintForm.name} onChange={event => setSprintForm({ ...sprintForm, name: event.target.value })} disabled={creatingSprint} /><input placeholder="Objetivo" value={sprintForm.goal} onChange={event => setSprintForm({ ...sprintForm, goal: event.target.value })} disabled={creatingSprint} /><label>Início<input type="date" value={sprintForm.startDate} onChange={event => setSprintForm({ ...sprintForm, startDate: event.target.value })} disabled={creatingSprint} /></label><label>Duração em dias<input type="number" min="1" value={sprintForm.durationDays} onChange={event => setSprintForm({ ...sprintForm, durationDays: Number(event.target.value) })} disabled={creatingSprint} /></label></div><button className="crm-button primary" disabled={creatingSprint} onClick={() => void createSprint()}>{creatingSprint ? <><LoaderCircle className="crm-spin" size={15} /> Criando sprint…</> : 'Salvar sprint'}</button></section></>}
      {tab === 'Backlog' && <section className="crm-workspace-panel"><div className="crm-panel-heading"><div><h2>Backlog</h2><p>As histórias entram aqui antes de serem atribuídas a um ciclo.</p></div><span className="crm-count">{stories.filter(item => !item.sprintId).length} sem sprint</span></div>{stories.filter(item => !item.sprintId).length ? stories.filter(item => !item.sprintId).map(renderStory) : <div className="crm-empty"><CheckCircle2 size={22} /><strong>Backlog limpo</strong><span>Todas as histórias estão associadas a uma sprint.</span></div>}</section>}
      {tab === 'Cronograma' && <section className="crm-workspace-panel"><div className="crm-panel-heading"><div><h2>Cronograma</h2><p>Visão rápida dos ciclos e da execução.</p></div></div><div className="crm-timeline">{sprints.map(sprint => <div key={sprint.id}><span>{humanDate(sprint.startDate)}</span><div><strong>{sprint.name}</strong><small>{sprint.goal || 'Sem objetivo definido.'}</small></div><b>{humanDate(sprint.endDate)}</b></div>)}</div></section>}
      {tab === 'Atividades' && <section className="crm-workspace-panel"><div className="crm-panel-heading"><div><h2>Atividades</h2><p>Registre decisões, comentários e links do projeto.</p></div></div><textarea className="crm-workspace-activity-input" value={activity} onChange={event => setActivity(event.target.value)} placeholder="Adicionar comentário ou link..." /><button className="crm-button primary" disabled={busy || !activity.trim()} onClick={() => void addActivity()}>Registrar atividade</button><div className="crm-activity-feed">{activities.filter(item => item.entityType === 'project').map(item => <div key={item.id}><small>{item.author} · {new Date(item.createdAt).toLocaleString('pt-BR')}</small><span>{item.message}</span></div>)}</div></section>}
    </main>
  </div>
}
