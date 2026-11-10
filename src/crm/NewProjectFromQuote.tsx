import { useMemo, useState } from 'react'
import { X, FileText, ArrowRight } from 'lucide-react'
import type { DashboardData, Quote } from './types'
import { crmRepository } from './repository'
import { useToast } from './Toast'

export function NewProjectFromQuote({ data, close, reload }: { data: DashboardData; close: () => void; reload: () => void }) {
  const [quoteId, setQuoteId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { notify } = useToast()
  const quotes = useMemo(() => data.quotes.filter(item => ['Rascunho', 'Publicado', 'Aceito', 'Expirado'].includes(item.status)), [data.quotes])
  const selected = quotes.find(item => item.id === quoteId)
  const linked = data.projects.find(item => item.quoteId === quoteId)
  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!quoteId) { setError('Selecione um orçamento para continuar.'); return }
    setBusy(true); setError('')
    try { await crmRepository.createProjectFromQuote(quoteId); close(); reload() } catch (cause) { const message = cause instanceof Error ? cause.message : 'Não foi possível criar o projeto.'; setError(message); notify(message, 'error') } finally { setBusy(false) }
  }
  return <div className="crm-modal-backdrop" onClick={close}><div className="crm-modal crm-project-from-quote" onClick={event => event.stopPropagation()}>
    <div className="crm-drawer-header"><div><span className="crm-eyebrow">PROJETO ÉPICO</span><h2>Novo projeto</h2></div><button className="crm-icon-button" onClick={close} aria-label="Fechar"><X size={17} /></button></div>
    <form className="crm-form" onSubmit={create}>
      <div className="crm-form-note crm-project-source-note"><FileText size={17} /><span>Escolha um orçamento. Os serviços serão convertidos automaticamente em histórias do projeto.</span></div>
      <label className="crm-field"><span>Orçamento de origem</span><select required value={quoteId} onChange={event => setQuoteId(event.target.value)}><option value="">Selecione um orçamento</option>{quotes.map(quote => <option key={quote.id} value={quote.id}>{quote.company || quote.clientName} · {quote.status} · {quote.items.length} serviço(s)</option>)}</select></label>
      {selected && <QuotePreview quote={selected} linked={linked} />}
      {error && <p className="crm-form-error" role="alert">{error}</p>}
      <div className="crm-form-actions"><button className="crm-button secondary" type="button" onClick={close}>Cancelar</button><button className="crm-button primary" type="submit" disabled={busy || !selected || Boolean(linked)}>{busy ? 'Criando projeto…' : linked ? 'Projeto já criado' : 'Criar projeto'}</button></div>
    </form>
  </div></div>
}

function QuotePreview({ quote, linked }: { quote: Quote; linked?: DashboardData['projects'][number] }) {
  return <div className="crm-project-quote-preview"><div><strong>{quote.company || quote.clientName}</strong><small>{quote.status} · validade {quote.expiresAt || 'não informada'}</small></div><span>{quote.items.reduce((sum, item) => sum + item.price * item.quantity, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>{linked && <p className="crm-form-error">Este orçamento já está vinculado ao projeto “{linked.name}”. Abra-o em Projetos para continuar.</p>}<ul>{quote.items.map(item => <li key={`${item.serviceId}-${item.name}`}><span>{item.name}</span><ArrowRight size={13} /><small>História</small></li>)}</ul></div>
}
