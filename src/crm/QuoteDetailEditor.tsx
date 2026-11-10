import { useEffect, useRef, useState } from 'react'
import { Bold, ChevronDown, ChevronUp, Copy, ExternalLink, Italic, Plus, Trash2, Underline, X, CopyPlus } from 'lucide-react'
import { crmRepository } from './repository'
import { InlineServiceCreator } from './InlineServiceCreator'
import { Spinner, useConfirm, useToast } from './Toast'
import type { DashboardData, Installment, InstallmentStatus, Quote, Service } from './types'

const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
const dateInputValue = (value?: string) => {
  if (!value) return ''
  const raw = String(value).trim().slice(0, 10)
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [day, month, year] = raw.split('/')
    return `${year}-${month}-${day}`
  }
  return raw
}
const date = (value?: string) => {
  const normalized = dateInputValue(value)
  if (!normalized) return '—'
  const parsed = new Date(`${normalized}T12:00:00`)
  return Number.isNaN(parsed.getTime()) ? '—' : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed).replace('.', '')
}
const path = (value: string) => `${import.meta.env.BASE_URL}${value.replace(/^\//, '')}`
const parseBRL = (value: string) => {
  const normalized = value.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  const amount = Number(normalized)
  return Number.isFinite(amount) ? amount : 0
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="crm-field"><span>{label}</span>{children}</label>
}

function Button({ children, onClick, variant = 'primary', disabled = false, type = 'button' }: { children: React.ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' | 'danger'; disabled?: boolean; type?: 'button' | 'submit' }) {
  return <button className={`crm-button ${variant}`} type={type} onClick={onClick} disabled={disabled}>{children}</button>
}

function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: string }) {
  return <span className={`crm-badge ${tone}`}>{children}</span>
}

export function QuoteDetailEditor({ quote, data, reload, onClose, onReactivate }: { quote: Quote; data: DashboardData; reload: () => void; onClose: () => void; onReactivate: () => void }) {
  const [items, setItems] = useState(quote.items ?? [])
  const [form, setForm] = useState({ expiresAt: dateInputValue(quote.expiresAt), notes: quote.notes ?? '', pixKey: quote.pixKey ?? '', paymentUrl: quote.paymentUrl ?? '' })
  const [installments, setInstallments] = useState(quote.installments ?? [])
  const [showServiceCreator, setShowServiceCreator] = useState(false)
  const [showInstallmentForm, setShowInstallmentForm] = useState(false)
  const [editingInstallment, setEditingInstallment] = useState<Installment | null>(null)
  const [installmentForm, setInstallmentForm] = useState({ dueDate: '', amount: '', paymentUrl: '', status: 'Pendente' as InstallmentStatus })
  const [busy, setBusy] = useState(false)
  const [publishBusy, setPublishBusy] = useState(false)
  const [installmentBusy, setInstallmentBusy] = useState(false)
  const { notify } = useToast()
  const confirm = useConfirm()
  const formRef = useRef(form)
  const notesRef = useRef<HTMLTextAreaElement>(null)
  const itemsRef = useRef(items)
  const savingRef = useRef(false)
  const queuedRef = useRef(false)
  const expired = quote.status === 'Expirado' || (quote.status === 'Publicado' && dateInputValue(quote.expiresAt) && new Date(`${dateInputValue(quote.expiresAt)}T23:59:59`).getTime() < Date.now())
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  useEffect(() => {
    setItems(quote.items ?? []); itemsRef.current = quote.items ?? []
    const nextForm = { expiresAt: dateInputValue(quote.expiresAt), notes: quote.notes ?? '', pixKey: quote.pixKey ?? '', paymentUrl: quote.paymentUrl ?? '' }
    setForm(nextForm); formRef.current = nextForm
    setInstallments(quote.installments ?? [])
  }, [quote.id, quote.items, quote.installments, quote.expiresAt, quote.notes, quote.pixKey, quote.paymentUrl])

  const persist = async () => {
    queuedRef.current = true
    if (savingRef.current) return
    savingRef.current = true
    setBusy(true)
    try {
      while (queuedRef.current) {
        queuedRef.current = false
        await crmRepository.updateQuote(quote.id, { clientId: quote.clientId, clientName: quote.clientName, company: quote.company, items: itemsRef.current, ...formRef.current })
      }
      reload()
      notify('Orçamento salvo automaticamente.')
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Não foi possível salvar o orçamento.', 'error')
    } finally {
      savingRef.current = false
      setBusy(false)
      if (queuedRef.current) void persist()
    }
  }

  const updateForm = (key: keyof typeof form, value: string, saveNow = false) => {
    const next = { ...formRef.current, [key]: value }
    formRef.current = next
    setForm(next)
    if (saveNow) void persist()
  }
  const formatNotes = (marker: '**' | '*' | '++' | '_') => {
    const textarea = notesRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = formRef.current.notes.slice(start, end)
    const content = selected || 'texto'
    const nextNotes = `${formRef.current.notes.slice(0, start)}${marker}${content}${marker}${formRef.current.notes.slice(end)}`
    updateForm('notes', nextNotes)
    void persist()
    requestAnimationFrame(() => {
      textarea.focus()
      const selectionStart = start + marker.length
      textarea.setSelectionRange(selectionStart, selectionStart + content.length)
    })
  }
  const saveItems = (next: Quote['items']) => { itemsRef.current = next; setItems(next); void persist() }
  const add = (serviceId: string) => {
    const service = data.services.find(item => item.id === serviceId)
    if (!service || itemsRef.current.some(item => item.serviceId === service.id)) return
    saveItems([...itemsRef.current, { serviceId: service.id, name: service.name, quantity: 1, price: service.price, billing: service.billing }])
  }
  const addCreated = (service: Service) => { add(service.id); setShowServiceCreator(false) }
  const remove = (serviceId: string) => saveItems(itemsRef.current.filter(item => item.serviceId !== serviceId))
  const moveItem = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= itemsRef.current.length) return
    const next = [...itemsRef.current]
    const [item] = next.splice(index, 1)
    next.splice(nextIndex, 0, item)
    saveItems(next)
  }

  const openInstallment = (installment?: Installment) => {
    setEditingInstallment(installment ?? null)
    setInstallmentForm(installment ? { dueDate: dateInputValue(installment.dueDate), amount: String(installment.amount).replace('.', ','), paymentUrl: installment.paymentUrl ?? '', status: installment.status } : { dueDate: '', amount: '', paymentUrl: '', status: 'Pendente' })
    setShowInstallmentForm(true)
  }
  const saveInstallment = async (event: React.FormEvent) => {
    event.preventDefault()
    const amount = parseBRL(installmentForm.amount)
    if (!installmentForm.dueDate || amount <= 0) { notify('Informe vencimento e um valor válido para a parcela.', 'error'); return }
    setInstallmentBusy(true)
    try {
      const input = { dueDate: installmentForm.dueDate, amount, paymentUrl: installmentForm.paymentUrl, status: installmentForm.status }
      const saved = editingInstallment ? await crmRepository.updateInstallment(quote.id, editingInstallment.id, input) : await crmRepository.createInstallment(quote.id, input)
      setInstallments(current => editingInstallment ? current.map(item => item.id === saved.id ? saved : item) : [...current, saved])
      setShowInstallmentForm(false)
      reload()
      notify(editingInstallment ? 'Parcela atualizada.' : 'Parcela criada.')
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Não foi possível salvar a parcela.'
      const backendHint = /ação inválida|aba ausente|parcelas/i.test(message)
        ? ' Atualize e implante a versão mais recente do Code.gs e execute setupSheets() uma vez.'
        : ''
      notify(`${message}${backendHint}`, 'error')
    } finally { setInstallmentBusy(false) }
  }
  const deleteInstallment = async (installment: Installment) => {
    if (!(await confirm({ title: 'Excluir parcela?', message: `A parcela de ${money(installment.amount)} será removida deste orçamento.`, confirmLabel: 'Excluir parcela' }))) return
    try { await crmRepository.deleteInstallment(quote.id, installment.id); setInstallments(current => current.filter(item => item.id !== installment.id)); reload(); notify('Parcela excluída.') } catch (cause) { notify(cause instanceof Error ? cause.message : 'Não foi possível excluir a parcela.', 'error') }
  }
  const payInstallment = async (installment: Installment) => {
    try { const saved = await crmRepository.markInstallmentPaid(quote.id, installment.id); setInstallments(current => current.map(item => item.id === saved.id ? saved : item)); reload(); notify('Parcela marcada como paga.') } catch (cause) { notify(cause instanceof Error ? cause.message : 'Não foi possível atualizar a parcela.', 'error') }
  }
  const publish = async () => {
    if (publishBusy) return
    setPublishBusy(true)
    try {
      const expiresAt = formRef.current.expiresAt
      const parsedExpiresAt = expiresAt ? new Date(`${expiresAt}T23:59:59`) : null
      if (!parsedExpiresAt || Number.isNaN(parsedExpiresAt.getTime()) || parsedExpiresAt.getTime() <= Date.now()) {
        throw new Error('Defina uma validade futura antes de publicar.')
      }
      const currentInput = { clientId: quote.clientId, clientName: quote.clientName, company: quote.company, items: itemsRef.current, expiresAt: formRef.current.expiresAt, notes: formRef.current.notes, pixKey: formRef.current.pixKey, paymentUrl: formRef.current.paymentUrl }
      await crmRepository.updateQuote(quote.id, currentInput)
      await crmRepository.publishQuote(quote.id, { ...quote, items, expiresAt: formRef.current.expiresAt, notes: formRef.current.notes, pixKey: formRef.current.pixKey, paymentUrl: formRef.current.paymentUrl })
      reload(); notify('Orçamento publicado.')
    } catch (cause) { notify(cause instanceof Error ? cause.message : 'Não foi possível publicar o orçamento.', 'error') }
    finally { setPublishBusy(false) }
  }
  const clone = async () => {
    try { await crmRepository.cloneQuote(quote.id); onClose(); reload(); notify('Orçamento clonado como rascunho.') } catch (cause) { notify(cause instanceof Error ? cause.message : 'Não foi possível clonar o orçamento.', 'error') }
  }
  const removeQuote = async () => {
    if (!(await confirm({ title: 'Excluir orçamento?', message: `O orçamento de ${quote.company} e suas parcelas serão removidos. Essa ação não pode ser desfeita.`, confirmLabel: 'Excluir orçamento' }))) return
    setBusy(true)
    try { await crmRepository.deleteQuote(quote.id); onClose(); reload(); notify('Orçamento excluído.') } catch (cause) { notify(cause instanceof Error ? cause.message : 'Não foi possível excluir o orçamento.', 'error') } finally { setBusy(false) }
  }

  return <div className="crm-quote-detail">
    <div className="crm-quote-highlight"><span>{quote.company}</span><strong>{money(total)}</strong><Badge tone={expired ? 'red' : quote.status === 'Aceito' ? 'green' : 'blue'}>{expired ? 'Expirado' : quote.status}</Badge></div>
    {expired && <div className="crm-quote-expired"><strong>Este orçamento expirou em {date(quote.expiresAt)}.</strong><span>Reative para gerar uma nova validade e liberar o link público novamente.</span><Button onClick={onReactivate}>Reativar orçamento</Button></div>}
    <div className="crm-detail-section"><h3>Itens do orçamento</h3><div className="crm-inline-edit"><div className="crm-service-picker"><Field label="Adicionar serviço"><select defaultValue="" onChange={event => { add(event.target.value); event.currentTarget.value = '' }}><option value="">Selecione um serviço</option>{data.services.filter(service => service.active && !items.some(item => item.serviceId === service.id)).map(service => <option key={service.id} value={service.id}>{service.name} · {money(service.price)}</option>)}</select></Field><button className="crm-button secondary" type="button" onClick={() => setShowServiceCreator(current => !current)}><Plus size={15} />{showServiceCreator ? 'Fechar criação' : 'Criar serviço'}</button></div>{showServiceCreator && <InlineServiceCreator onCreated={addCreated} onCancel={() => setShowServiceCreator(false)} />}{items.map((item, index) => <div className="crm-line-item crm-quote-item" key={item.serviceId}><span>{item.name} × {item.quantity}<small>{item.billing}</small></span><div className="crm-quote-item-actions"><strong>{money(item.price * item.quantity)}</strong><button className="crm-mini-button" type="button" disabled={index === 0} onClick={() => moveItem(index, -1)} aria-label={`Mover ${item.name} para cima`} title="Mover para cima"><ChevronUp size={13} /></button><button className="crm-mini-button" type="button" disabled={index === items.length - 1} onClick={() => moveItem(index, 1)} aria-label={`Mover ${item.name} para baixo`} title="Mover para baixo"><ChevronDown size={13} /></button><button className="crm-mini-button" type="button" onClick={() => remove(item.serviceId)}>Remover</button></div></div>)}</div></div>
    <div className="crm-detail-section"><h3>Dados públicos</h3><div className="crm-inline-edit"><Field label="Validade"><input type="date" value={form.expiresAt} onChange={event => updateForm('expiresAt', event.target.value, true)} /></Field><Field label="Chave Pix"><input value={form.pixKey} onChange={event => updateForm('pixKey', event.target.value)} onBlur={() => void persist()} /></Field><Field label="Link de pagamento"><input value={form.paymentUrl} onChange={event => updateForm('paymentUrl', event.target.value)} onBlur={() => void persist()} /></Field><Field label="Notas"><div className="crm-rich-editor"><div className="crm-rich-toolbar" role="toolbar" aria-label="Formatação das notas"><button type="button" title="Negrito" aria-label="Negrito" onClick={() => formatNotes('**')}><Bold size={14} /></button><button type="button" title="Itálico" aria-label="Itálico" onClick={() => formatNotes('*')}><Italic size={14} /></button><button type="button" title="Sublinhado" aria-label="Sublinhado" onClick={() => formatNotes('++')}><Underline size={14} /></button><span>Selecione um trecho e aplique a formatação</span></div><textarea ref={notesRef} value={form.notes} onChange={event => updateForm('notes', event.target.value)} onBlur={() => void persist()} /></div></Field><span className="crm-autosave-state">{busy ? 'Salvando…' : 'Salvamento automático'}</span></div></div>
    <div className="crm-detail-section"><div className="crm-section-heading"><h3>Parcelas</h3><Button variant="secondary" onClick={() => openInstallment()}><Plus size={14} />Adicionar parcela</Button></div>{installments.length > 0 && installments.map(item => <div className="crm-line-item crm-installment-row" key={item.id}><span><strong>{date(item.dueDate)}</strong><small>{item.status}{item.paymentUrl ? ' · link de pagamento disponível' : ''}</small></span><div><strong>{money(item.amount)}</strong>{item.status !== 'Pago' && <button className="crm-mini-button" onClick={() => void payInstallment(item)}>Pagar</button>}<button className="crm-mini-button" onClick={() => openInstallment(item)}>Editar</button><button className="crm-mini-button danger" onClick={() => void deleteInstallment(item)} aria-label="Excluir parcela"><Trash2 size={13} /></button></div></div>)}</div>
    {showInstallmentForm && <div className="crm-inline-modal" role="dialog" aria-modal="true"><form className="crm-inline-modal-card" onSubmit={saveInstallment}><div className="crm-drawer-header"><h3>{editingInstallment ? 'Editar parcela' : 'Nova parcela'}</h3><button className="crm-icon-button" type="button" onClick={() => setShowInstallmentForm(false)} aria-label="Fechar"><X size={16} /></button></div><div className="crm-form-row"><Field label="Vencimento"><input required type="date" value={installmentForm.dueDate} onChange={event => setInstallmentForm({ ...installmentForm, dueDate: event.target.value })} /></Field><Field label="Valor"><input required inputMode="decimal" placeholder="R$ 0,00" value={installmentForm.amount} onChange={event => setInstallmentForm({ ...installmentForm, amount: event.target.value })} /></Field></div><Field label="Link de pagamento"><input value={installmentForm.paymentUrl} onChange={event => setInstallmentForm({ ...installmentForm, paymentUrl: event.target.value })} /></Field><Field label="Situação"><select value={installmentForm.status} onChange={event => setInstallmentForm({ ...installmentForm, status: event.target.value as InstallmentStatus })}><option value="Pendente">Pendente</option><option value="Pago">Pago</option><option value="Atrasado">Atrasado</option></select></Field><div className="crm-form-actions"><Button variant="secondary" onClick={() => setShowInstallmentForm(false)}>Cancelar</Button><Button type="submit" disabled={installmentBusy}>{installmentBusy ? 'Salvando…' : 'Salvar parcela'}</Button></div></form></div>}
    <div className="crm-detail-actions">{quote.status === 'Rascunho' && <Button onClick={() => void publish()} disabled={publishBusy || busy}>{publishBusy ? <><Spinner label="Publicando orçamento" />Publicando…</> : 'Publicar orçamento'}</Button>}<Button variant="secondary" onClick={() => void clone()} disabled={busy || publishBusy}><CopyPlus size={14} />Clonar orçamento</Button><button className="crm-button danger" onClick={() => void removeQuote()} disabled={busy || publishBusy}><Trash2 size={14} />Excluir orçamento</button><a className="crm-public-link" href={path(`/orcamento/${quote.token}`)} target="_blank" rel="noreferrer"><ExternalLink size={15} />Abrir orçamento público</a><button className="crm-link-button" onClick={async () => { const link = `${window.location.origin}${path(`/orcamento/${quote.token}`)}`; try { await navigator.clipboard?.writeText(link); notify('Link copiado.') } catch { notify('Não foi possível copiar o link.', 'error') } }}><Copy size={14} />Copiar link</button></div>
  </div>
}
