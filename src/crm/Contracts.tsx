import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, Download, ExternalLink, FileSignature, History, PenLine, Plus, Printer, Send, ShieldCheck, Sparkles, Trash2, X } from 'lucide-react'
import { crmRepository } from './repository'
import type { Client, Contract, ContractModel, DashboardData, Project, Quote } from './types'
import { Spinner, useConfirm, useToast } from './Toast'

const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
const date = (value?: string) => {
  if (!value) return '—'
  const raw = String(value).trim()
  const brazilian = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  const normalized = brazilian ? `${brazilian[3]}-${brazilian[2]}-${brazilian[1]}` : raw.slice(0, 10)
  const parsed = new Date(`${normalized}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed).replace('.', '')
}
const appPath = (value: string) => `${import.meta.env.BASE_URL}${value.replace(/^\//, '')}`
const totalQuote = (quote: Quote) => quote.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
const statusTone = (status: Contract['status']) => status === 'Assinado' ? 'green' : status === 'Enviado' || status === 'Visualizado' ? 'blue' : status === 'Cancelado' || status === 'Expirado' ? 'red' : 'neutral'
const renderTemplate = (template: string, client?: Client, project?: Project, quote?: Quote) => template.replace(/\{\{client\.company\}\}/g, client?.company ?? '').replace(/\{\{client\.name\}\}/g, client?.name ?? '').replace(/\{\{client\.email\}\}/g, client?.email ?? '').replace(/\{\{project\.name\}\}/g, project?.name ?? 'projeto contratado').replace(/\{\{quote\.total\}\}/g, quote ? money(totalQuote(quote)) : 'a definir')

function Badge({ children, tone }: { children: React.ReactNode; tone: string }) { return <span className={`crm-badge ${tone}`}>{children}</span> }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="crm-field"><span>{label}</span>{children}</label> }
function Modal({ title, children, onClose, className = '' }: { title: string; children: React.ReactNode; onClose: () => void; className?: string }) { return <div className="crm-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><div className={`crm-modal ${className}`} onMouseDown={event => event.stopPropagation()}><div className="crm-drawer-header"><h2>{title}</h2><button className="crm-icon-button" onClick={onClose} aria-label="Fechar"><X size={17} /></button></div>{children}</div></div> }

export function Contracts({ data, reload, search, onSearch }: { data: DashboardData; reload: () => void; search: string; onSearch: (value: string) => void }) {
  const [tab, setTab] = useState<'contratos' | 'modelos'>('contratos')
  const [selected, setSelected] = useState<Contract | null>(null)
  const [editingContract, setEditingContract] = useState<Contract | null>(null)
  const [editingModel, setEditingModel] = useState<ContractModel | null | undefined>(undefined)
  const [newContract, setNewContract] = useState(false)
  const [newAiDraft, setNewAiDraft] = useState(false)
  const term = search.toLowerCase()
  const contracts = data.contracts.filter(item => `${item.title} ${item.company} ${item.status} ${item.projectName ?? ''}`.toLowerCase().includes(term))
  const models = data.contractModels.filter(item => `${item.name} ${item.description}`.toLowerCase().includes(term))
  const { notify } = useToast()
  const copy = async (contract: Contract) => { const link = `${window.location.origin}${appPath(`/contrato/${contract.token}`)}`; await navigator.clipboard?.writeText(link); notify('Link do contrato copiado.') }
  return <>
    <header className="crm-topbar"><div><p className="crm-overline">Haus / CRM</p><h1>Contratos</h1></div><div className="crm-top-actions"><div className="crm-command"><span aria-hidden="true">⌕</span><input value={search} onChange={event => onSearch(event.target.value)} placeholder="Buscar contratos" aria-label="Buscar contratos" /></div><button className="crm-button secondary" onClick={() => setNewAiDraft(true)}><Sparkles size={15} />Preparar com IA</button><button className="crm-button primary" onClick={() => setNewContract(true)}><Plus size={16} />Novo contrato</button></div></header>
    <div className="crm-content crm-contracts-page">
      <div className="crm-contract-intro"><div><p className="crm-overline">Documentos e aceite eletrônico</p><span>Modelos versionados, contratos vinculados e trilha de eventos.</span></div><div className="crm-contract-trust"><ShieldCheck size={16} /> Validação básica antes do envio</div></div>
      <div className="crm-tabs crm-contract-tabs"><button className={tab === 'contratos' ? 'active' : ''} onClick={() => setTab('contratos')}>Contratos <small>{data.contracts.length}</small></button><button className={tab === 'modelos' ? 'active' : ''} onClick={() => setTab('modelos')}>Modelos <small>{data.contractModels.length}</small></button></div>
      {tab === 'contratos' ? <div className="crm-contract-list">{contracts.map(contract => <article key={contract.id} className="crm-card crm-contract-card crm-clickable" onClick={() => setSelected(contract)}><div className="crm-contract-card-top"><div><span className="crm-contract-icon"><FileSignature size={17} /></span><div><strong>{contract.title}</strong><small>{contract.company} · {contract.projectName ?? 'Sem projeto'}</small></div></div><Badge tone={statusTone(contract.status)}>{contract.status}</Badge></div><div className="crm-contract-card-meta"><span>Modelo {contract.modelName}</span><span>Expira em {date(contract.expiresAt)}</span><span>{contract.events.length} eventos</span></div><div className="crm-contract-card-actions"><button className="crm-link-button" onClick={event => { event.stopPropagation(); void copy(contract) }}><Copy size={14} />Copiar link</button>{contract.status === 'Rascunho' && <span className="crm-contract-hint">Pronto para revisão</span>}</div></article>)}{!contracts.length && <div className="crm-card"><div className="crm-empty"><FileSignature size={20} /><strong>Nenhum contrato encontrado</strong><p>Crie um contrato a partir de um modelo e vincule-o a um cliente.</p></div></div>}</div> : <div className="crm-contract-model-grid">{models.map(model => <article key={model.id} className="crm-card crm-contract-model-card crm-clickable" onClick={() => setEditingModel(model)}><div className="crm-contract-model-top"><Badge tone="green">v{model.version}</Badge><button className="crm-icon-button" onClick={event => { event.stopPropagation(); setEditingModel(model) }} aria-label={`Editar ${model.name}`}><PenLine size={15} /></button></div><h2>{model.name}</h2><p>{model.description}</p><small>{model.active ? 'Ativo para novos contratos' : 'Arquivado'}</small></article>)}<button className="crm-card crm-contract-new-model" onClick={() => setEditingModel(null)}><Plus size={18} /><strong>Novo modelo</strong><span>Crie uma base reutilizável</span></button></div>}
    </div>
    {selected && <ContractDrawer contract={data.contracts.find(item => item.id === selected.id) ?? selected} close={() => setSelected(null)} reload={reload} onCopy={copy} onEdit={contract => { setSelected(null); setEditingContract(contract) }} />}
    {newContract && <NewContract data={data} close={() => setNewContract(false)} reload={reload} />}
    {editingContract && <ContractEditor contract={data.contracts.find(item => item.id === editingContract.id) ?? editingContract} data={data} close={() => setEditingContract(null)} reload={reload} />}
    {editingModel !== undefined && <ModelEditor model={editingModel} close={() => setEditingModel(undefined)} reload={reload} />}
    {newAiDraft && <AiDraftModal data={data} close={() => setNewAiDraft(false)} reload={reload} />}
  </>
}

function NewContract({ data, close, reload }: { data: DashboardData; close: () => void; reload: () => void }) {
  const defaultModel = data.contractModels.find(item => item.active) ?? data.contractModels[0]
  const [form, setForm] = useState({ clientId: data.clients[0]?.id ?? '', projectId: data.projects[0]?.id ?? '', quoteId: data.quotes[0]?.id ?? '', modelId: defaultModel?.id ?? '', title: 'Contrato de prestação de serviços', expiresAt: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10), content: defaultModel?.content ?? '' })
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const { notify } = useToast()
  const client = data.clients.find(item => item.id === form.clientId); const project = data.projects.find(item => item.id === form.projectId); const quote = data.quotes.find(item => item.id === form.quoteId); const model = data.contractModels.find(item => item.id === form.modelId)
  const updateModel = (id: string) => { const next = data.contractModels.find(item => item.id === id); setForm(current => ({ ...current, modelId: id, content: next?.content ?? '' })) }
  const save = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); setError(''); try { await crmRepository.createContract({ ...form, clientName: client?.name ?? '', company: client?.company ?? '', projectName: project?.name, modelName: model?.name ?? '', content: renderTemplate(form.content, client, project, quote) }); close(); reload(); notify('Contrato criado como rascunho.') } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível criar o contrato.') } finally { setBusy(false) } }
  return <Modal title="Novo contrato" onClose={close}><form className="crm-form" onSubmit={save}><div className="crm-contract-validation"><ShieldCheck size={16} /><span>Antes de publicar, confirme partes, escopo, valores, prazo, cancelamento e foro.</span></div><div className="crm-form-row"><Field label="Cliente"><select required value={form.clientId} onChange={event => setForm({ ...form, clientId: event.target.value })}>{data.clients.map(item => <option key={item.id} value={item.id}>{item.company}</option>)}</select></Field><Field label="Projeto"><select value={form.projectId} onChange={event => setForm({ ...form, projectId: event.target.value })}><option value="">Sem projeto</option>{data.projects.filter(item => !form.clientId || item.clientId === form.clientId).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field></div><Field label="Orçamento vinculado"><select value={form.quoteId} onChange={event => setForm({ ...form, quoteId: event.target.value })}><option value="">Sem orçamento</option>{data.quotes.filter(item => !form.clientId || item.clientId === form.clientId).map(item => <option key={item.id} value={item.id}>{item.company} · {money(totalQuote(item))}</option>)}</select></Field><Field label="Modelo"><select required value={form.modelId} onChange={event => updateModel(event.target.value)}>{data.contractModels.filter(item => item.active).map(item => <option key={item.id} value={item.id}>{item.name} · v{item.version}</option>)}</select></Field><Field label="Título"><input required value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} /></Field><Field label="Validade do link"><input required type="date" value={form.expiresAt} onChange={event => setForm({ ...form, expiresAt: event.target.value })} /></Field><Field label="Conteúdo do contrato"><textarea required className="crm-contract-editor" value={form.content} onChange={event => setForm({ ...form, content: event.target.value })} /></Field>{error && <p className="crm-form-error">{error}</p>}<div className="crm-form-actions"><button className="crm-button secondary" type="button" onClick={close}>Cancelar</button><button className="crm-button primary" type="submit" disabled={busy}>{busy ? <><Spinner />Salvando…</> : 'Salvar rascunho'}</button></div></form></Modal>
}

function ContractEditor({ contract, data, close, reload }: { contract: Contract; data: DashboardData; close: () => void; reload: () => void }) {
  const [form, setForm] = useState({ clientId: contract.clientId, projectId: contract.projectId ?? '', quoteId: contract.quoteId ?? '', modelId: contract.modelId, title: contract.title, expiresAt: contract.expiresAt, content: contract.content })
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const { notify } = useToast()
  const client = data.clients.find(item => item.id === form.clientId); const project = data.projects.find(item => item.id === form.projectId); const quote = data.quotes.find(item => item.id === form.quoteId); const model = data.contractModels.find(item => item.id === form.modelId)
  const updateModel = (id: string) => { const next = data.contractModels.find(item => item.id === id); setForm(current => ({ ...current, modelId: id, content: next?.content ?? current.content })) }
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('')
    try {
      await crmRepository.updateContract(contract.id, { ...form, clientName: client?.name ?? '', company: client?.company ?? '', projectName: project?.name, modelName: model?.name ?? '', content: renderTemplate(form.content, client, project, quote) })
      close(); reload(); notify('Contrato atualizado.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar o contrato.'); notify('Não foi possível atualizar o contrato.', 'error') } finally { setBusy(false) }
  }
  return <Modal title="Editar contrato" onClose={close}><form className="crm-form" onSubmit={save}><div className="crm-contract-validation"><ShieldCheck size={16} /><span>Contratos assinados são imutáveis. Esta edição será registrada na trilha de eventos.</span></div><div className="crm-form-row"><Field label="Cliente"><select required value={form.clientId} onChange={event => setForm({ ...form, clientId: event.target.value })}>{data.clients.map(item => <option key={item.id} value={item.id}>{item.company}</option>)}</select></Field><Field label="Projeto"><select value={form.projectId} onChange={event => setForm({ ...form, projectId: event.target.value })}><option value="">Sem projeto</option>{data.projects.filter(item => !form.clientId || item.clientId === form.clientId).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field></div><Field label="Orçamento vinculado"><select value={form.quoteId} onChange={event => setForm({ ...form, quoteId: event.target.value })}><option value="">Sem orçamento</option>{data.quotes.filter(item => !form.clientId || item.clientId === form.clientId).map(item => <option key={item.id} value={item.id}>{item.company} · {money(totalQuote(item))}</option>)}</select></Field><Field label="Modelo"><select required value={form.modelId} onChange={event => updateModel(event.target.value)}>{data.contractModels.map(item => <option key={item.id} value={item.id}>{item.name} · v{item.version}</option>)}</select></Field><Field label="Título"><input required value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} /></Field><Field label="Validade do link"><input required type="date" value={form.expiresAt} onChange={event => setForm({ ...form, expiresAt: event.target.value })} /></Field><Field label="Conteúdo do contrato"><textarea required className="crm-contract-editor" value={form.content} onChange={event => setForm({ ...form, content: event.target.value })} /></Field>{error && <p className="crm-form-error" role="alert">{error}</p>}<div className="crm-form-actions"><button className="crm-button secondary" type="button" onClick={close}>Cancelar</button><button className="crm-button primary" type="submit" disabled={busy}>{busy ? <><Spinner />Salvando…</> : 'Salvar alterações'}</button></div></form></Modal>
}

function ModelEditor({ model, close, reload }: { model: ContractModel | null | undefined; close: () => void; reload: () => void }) {
  const [form, setForm] = useState({ name: model?.name ?? '', description: model?.description ?? '', content: model?.content ?? '', active: model?.active ?? true }); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const confirm = useConfirm(); const { notify } = useToast()
  const save = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); setError(''); try { if (model) await crmRepository.updateContractModel(model.id, form); else await crmRepository.createContractModel(form); close(); reload() } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o modelo.') } finally { setBusy(false) } }
  const remove = async () => { if (!model || !(await confirm({ title: 'Excluir modelo?', message: 'Modelos vinculados a contratos não podem ser removidos.', confirmLabel: 'Excluir modelo' }))) return; setBusy(true); try { await crmRepository.deleteContractModel(model.id); close(); reload() } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível excluir o modelo.') } finally { setBusy(false) } }
  return <Modal title={model ? 'Editar modelo' : 'Novo modelo'} onClose={close}><form className="crm-form" onSubmit={save}><Field label="Nome"><input required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></Field><Field label="Descrição"><input required value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></Field><Field label="Conteúdo base"><textarea required className="crm-contract-editor" value={form.content} onChange={event => setForm({ ...form, content: event.target.value })} /><small className="crm-form-note">Variáveis: {'{{client.company}}'}, {'{{client.name}}'}, {'{{client.email}}'}, {'{{project.name}}'}, {'{{quote.total}}'}.</small></Field><label className="crm-checkbox"><input type="checkbox" checked={form.active} onChange={event => setForm({ ...form, active: event.target.checked })} />Disponível para novos contratos</label>{error && <p className="crm-form-error">{error}</p>}<div className="crm-form-actions">{model && <button className="crm-button danger" type="button" onClick={remove} disabled={busy}><Trash2 size={14} />Excluir</button>}<span className="crm-form-actions-spacer" /><button className="crm-button secondary" type="button" onClick={close}>Cancelar</button><button className="crm-button primary" type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar modelo'}</button></div></form></Modal>
}

function ContractDrawer({ contract, close, reload, onCopy, onEdit }: { contract: Contract; close: () => void; reload: () => void; onCopy: (contract: Contract) => void; onEdit: (contract: Contract) => void }) {
  const [busy, setBusy] = useState(false); const { notify } = useToast(); const confirm = useConfirm(); const link = `${window.location.origin}${appPath(`/contrato/${contract.token}`)}`
  const canEdit = !['Assinado', 'Cancelado'].includes(contract.status)
  const canDelete = contract.status === 'Rascunho' || contract.status === 'Cancelado'
  const publish = async () => { setBusy(true); try { await crmRepository.publishContract(contract.id); reload(); notify('Contrato publicado.'); } catch (cause) { notify(cause instanceof Error ? cause.message : 'Não foi possível publicar.', 'error') } finally { setBusy(false) } }
  const cancel = async () => { if (!(await confirm({ title: 'Cancelar contrato?', message: `O contrato “${contract.title}” ficará indisponível para assinatura, mas sua trilha será preservada.`, confirmLabel: 'Cancelar contrato' }))) return; setBusy(true); try { await crmRepository.cancelContract(contract.id); close(); reload(); notify('Contrato cancelado.') } catch (cause) { notify(cause instanceof Error ? cause.message : 'Não foi possível cancelar.', 'error') } finally { setBusy(false) } }
  const remove = async () => { if (!(await confirm({ title: 'Excluir contrato?', message: 'Somente rascunhos ou contratos cancelados podem ser excluídos. Essa ação não pode ser desfeita.', confirmLabel: 'Excluir contrato' }))) return; setBusy(true); try { await crmRepository.deleteContract(contract.id); close(); reload(); notify('Contrato excluído.') } catch (cause) { notify(cause instanceof Error ? cause.message : 'Não foi possível excluir.', 'error') } finally { setBusy(false) } }
  return <div className="crm-drawer-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close() }}><aside className="crm-drawer crm-contract-drawer" onMouseDown={event => event.stopPropagation()}><div className="crm-drawer-header"><div><p className="crm-overline">Haus / Contrato</p><h2>{contract.title}</h2></div><button className="crm-icon-button" onClick={close} aria-label="Fechar"><X size={17} /></button></div><div className="crm-contract-drawer-head"><div className="crm-contract-icon"><FileSignature size={18} /></div><div><strong>{contract.company}</strong><small>{contract.clientName} · {contract.modelName} v{contract.modelId ? '1' : ''}</small></div><Badge tone={statusTone(contract.status)}>{contract.status}</Badge></div><div className="crm-contract-drawer-actions">{contract.status === 'Rascunho' && <button className="crm-button primary" onClick={publish} disabled={busy}>{busy ? <Spinner /> : <Send size={14} />}Publicar link</button>}{['Enviado', 'Visualizado', 'Assinado'].includes(contract.status) && <><button className="crm-button secondary" onClick={() => onCopy(contract)}><Copy size={14} />Copiar link</button><a className="crm-button secondary" href={link} target="_blank" rel="noreferrer"><ExternalLink size={14} />Abrir público</a></>}{canEdit && <button className="crm-button secondary" onClick={() => onEdit(contract)} disabled={busy}><PenLine size={14} />Editar</button>}{canEdit && contract.status !== 'Cancelado' && <button className="crm-button danger" onClick={() => void cancel} disabled={busy}>Cancelar</button>}{canDelete && <button className="crm-button danger" onClick={() => void remove} disabled={busy}><Trash2 size={14} />Excluir</button>}</div><div className="crm-contract-meta-grid"><div><span>Validade</span><strong>{date(contract.expiresAt)}</strong></div><div><span>Projeto</span><strong>{contract.projectName ?? 'Sem vínculo'}</strong></div></div><section className="crm-contract-content-preview"><h3>Conteúdo e versão</h3><pre>{contract.content}</pre></section><section className="crm-contract-events"><h3><History size={15} />Trilha de eventos</h3>{contract.events.map(event => <div key={event.id}><span>{event.type}</span><small>{event.actor} · {new Date(event.occurredAt).toLocaleString('pt-BR')}</small></div>)}</section><p className="crm-legal-note"><ShieldCheck size={15} /> O aceite eletrônico registra identidade declarada, consentimento, data/hora e versão. Para exigências específicas, valide o modelo com assessoria jurídica.</p></aside></div>
}

function AiDraftModal({ data, close, reload }: { data: DashboardData; close: () => void; reload: () => void }) { const [briefing, setBriefing] = useState(''); const [clientId, setClientId] = useState(data.clients[0]?.id ?? ''); const [draft, setDraft] = useState<Awaited<ReturnType<typeof crmRepository.createAiDraft>> | null>(null); const [busy, setBusy] = useState(false); const { notify } = useToast(); const generate = async () => { setBusy(true); try { setDraft(await crmRepository.createAiDraft({ briefing, clientId })); reload() } catch (cause) { notify(cause instanceof Error ? cause.message : 'Não foi possível gerar o rascunho.', 'error') } finally { setBusy(false) } }; return <Modal title="Preparar orçamento com IA" onClose={close}><div className="crm-ai-panel"><div className="crm-contract-validation"><Sparkles size={16} /><span>A IA ficará preparada para receber um provedor seguro. O resultado sempre passa por revisão humana.</span></div><Field label="Cliente"><select value={clientId} onChange={event => setClientId(event.target.value)}>{data.clients.map(item => <option key={item.id} value={item.id}>{item.company}</option>)}</select></Field><Field label="Briefing"><textarea required rows={6} value={briefing} onChange={event => setBriefing(event.target.value)} placeholder="Ex.: site institucional com homepage, páginas de serviço e publicação em 30 dias." /></Field><button className="crm-button primary" onClick={generate} disabled={busy || !briefing.trim()}>{busy ? <><Spinner />Preparando…</> : <><Sparkles size={15} />Gerar rascunho</>}</button>{draft && <div className="crm-ai-result"><strong>Rascunho salvo para revisão</strong>{draft.result.items.map(item => <div key={item.serviceId}><span>{item.name}</span><strong>{money(item.price)}</strong></div>)}<p>{draft.result.notes}</p><small>{draft.result.alerts.join(' ')}</small></div>}</div></Modal> }

function ContractDocument({ content }: { content: string }) {
  return <div className="crm-contract-document">{content.split(/\r?\n/).map((line, index) => {
    const value = line.trim()
    if (!value) return <div className="crm-contract-document-break" key={`break-${index}`} aria-hidden="true" />
    const section = value.match(/^(\d+\.\s+)(.+)$/)
    if (section) return <h2 className="crm-contract-document-heading" key={index}><span>{section[1]}</span>{section[2]}</h2>
    const party = value.match(/^(CONTRATANTE|CONTRATADA):\s*(.*)$/)
    if (party) return <p className="crm-contract-document-party" key={index}><strong>{party[1]}:</strong> {party[2]}</p>
    if (value === 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS') return <p className="crm-contract-document-kicker" key={index}>{value}</p>
    return <p key={index}>{value}</p>
  })}</div>
}

function downloadContractCopy(contract: Contract) {
  const signature = contract.signedAt ? `\n\nACEITE ELETRÔNICO\nNome: ${contract.signedName ?? '—'}\nE-mail: ${contract.signedEmail ?? '—'}\nDocumento: ${contract.signerDocument ?? '—'}\nData: ${new Date(contract.signedAt).toLocaleString('pt-BR')}` : ''
  const content = `${contract.title}\n${contract.company} · válido até ${date(contract.expiresAt)}\n\n${contract.content}${signature}\n`
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const href = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = `${contract.title.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'contrato'}-copia.txt`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(href)
}

export function PublicContract({ token }: { token: string }) {
  const [contract, setContract] = useState<Contract | null>(null)
  const [done, setDone] = useState(false)
  const [form, setForm] = useState({ signedName: '', signedEmail: '', signerDocument: '', consent: false })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    crmRepository.getPublicContract(token).then(item => {
      setContract(item)
      void crmRepository.markContractViewed(token)
    }).catch(() => setContract(null))
  }, [token])

  if (!contract) return <div className="crm-public-page"><div className="crm-public-card"><strong>Contrato não encontrado</strong><p>Confira se o link está correto ou solicite um novo envio.</p></div></div>

  const signed = done || contract.status === 'Assinado'
  const sign = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const updated = await crmRepository.signContract(token, form)
      setContract(updated)
      setDone(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível assinar o contrato.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="crm-public-page"><div className="crm-public-shell crm-public-contract">
    <div className="crm-public-header"><img className="crm-public-header-logo" src={appPath('/brand/logo-dark.svg')} alt="Haus" /><p className="crm-overline">Contrato de prestação de serviços</p><h1>{contract.title}</h1><p>{contract.company} · válido até {date(contract.expiresAt)}</p></div>
    <div className="crm-public-body">
      <div className="crm-public-section crm-contract-public-copy"><ContractDocument content={contract.content} /><div className="crm-public-document-actions"><button className="crm-button secondary" type="button" onClick={() => downloadContractCopy(contract)}><Download size={15} />Baixar cópia</button><button className="crm-button secondary" type="button" onClick={() => window.print()}><Printer size={15} />Imprimir / salvar PDF</button></div></div>
      {signed ? <div className="crm-success crm-sign-success"><Check size={20} /><strong>Contrato assinado</strong><span>O aceite foi registrado com data, hora, identidade declarada e versão do documento.</span><button className="crm-button primary" type="button" onClick={() => downloadContractCopy(contract)}><Download size={15} />Baixar cópia assinada</button></div> : <form className="crm-public-section crm-sign" onSubmit={sign}>
        <div className="crm-sign-heading"><span className="crm-sign-icon"><PenLine size={17} /></span><div><h2>Assinar contrato</h2><p>Leia o documento e confirme seus dados para registrar o aceite eletrônico.</p></div></div>
        <div className="crm-sign-fields"><label className="crm-sign-field"><span>Nome completo</span><input required minLength={3} autoComplete="name" placeholder="Ex.: Gustavo Erbisti" value={form.signedName} onChange={event => setForm({ ...form, signedName: event.target.value })} /></label><label className="crm-sign-field"><span>E-mail</span><input required type="email" autoComplete="email" placeholder="voce@empresa.com" value={form.signedEmail} onChange={event => setForm({ ...form, signedEmail: event.target.value })} /></label><label className="crm-sign-field crm-sign-field-full"><span>CPF ou CNPJ</span><input required autoComplete="off" placeholder="Somente para identificação" value={form.signerDocument} onChange={event => setForm({ ...form, signerDocument: event.target.value })} /></label></div>
        <label className="crm-sign-consent"><input type="checkbox" checked={form.consent} onChange={event => setForm({ ...form, consent: event.target.checked })} /><span className="crm-sign-checkmark"><Check size={14} /></span><span>Declaro que li e aceito este contrato.</span></label>
        {error && <p className="crm-form-error" role="alert">{error}</p>}<button className="crm-button primary crm-sign-submit" type="submit" disabled={busy}>{busy ? <><Spinner />Registrando…</> : <><PenLine size={15} />Assinar contrato</>}</button>
      </form>}
      <p className="crm-legal-note">Este fluxo registra aceite eletrônico para o MVP. Para validade específica, reconhecimento de firma ou certificado ICP-Brasil, solicite orientação jurídica.</p>
    </div><footer><span>haus.art.br</span><a href={appPath('/')}>Conheça a Haus <ExternalLink size={14} /></a></footer>
  </div></div>
}
