import { demoData } from './demo-data'
import type { Client, DashboardData, FinancialEntry, Project, Quote, Service } from './types'

const endpoint = import.meta.env.VITE_CRM_ENDPOINT as string | undefined

export const isCrmDemo = !endpoint

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const demoState = clone(demoData)

async function request<T>(action: string, options: RequestInit = {}): Promise<T> {
  if (!endpoint) throw new Error('Modo demonstração ativo')
  const url = new URL(endpoint)
  url.searchParams.set('action', action)
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) } })
  const body = await response.json() as { ok: boolean; data: T; error?: string }
  if (!response.ok || !body.ok) throw new Error(body.error || 'Não foi possível concluir a operação.')
  return body.data
}

export const crmRepository = {
  async getDashboard(): Promise<DashboardData> {
    if (!endpoint) return clone(demoState)
    const response = await request<DashboardData>('dashboard')
    return { ...response, finances: response.finances ?? [] }
  },
  async createClient(input: Omit<Client, 'id' | 'projects' | 'quotes'>) {
    if (!endpoint) { const client = { ...input, id: `cli-${Date.now()}`, projects: 0, quotes: 0 }; demoState.clients.unshift(client); return client }
    return request<Client>('client.create', { method: 'POST', body: JSON.stringify({ action: 'client.create', ...input }) })
  },
  async createProject(input: Omit<Project, 'id' | 'clientName'>) {
    const client = demoState.clients.find(item => item.id === input.clientId)
    if (!endpoint) { const project = { ...input, id: `pro-${Date.now()}`, clientName: client?.company ?? 'Cliente' }; demoState.projects.unshift(project); return project }
    return request<Project>('project.create', { method: 'POST', body: JSON.stringify({ action: 'project.create', ...input }) })
  },
  async createService(input: Omit<Service, 'id'>) {
    if (!endpoint) { const service = { ...input, id: `srv-${Date.now()}` }; demoState.services.unshift(service); return service }
    return request<Service>('service.create', { method: 'POST', body: JSON.stringify({ action: 'service.create', ...input }) })
  },
  async createFinance(input: Omit<FinancialEntry, 'id'>) {
    if (!endpoint) { const entry = { ...input, id: `fin-${Date.now()}` }; demoState.finances.unshift(entry); return entry }
    return request<FinancialEntry>('finance.create', { method: 'POST', body: JSON.stringify({ action: 'finance.create', ...input }) })
  },
  async settleFinance(id: string) {
    if (!endpoint) { const entry = demoState.finances.find(item => item.id === id); if (!entry) throw new Error('Lançamento não encontrado.'); entry.status = entry.type === 'Entrada' ? 'Recebido' : 'Pago'; return entry }
    return request<FinancialEntry>('finance.settle', { method: 'POST', body: JSON.stringify({ action: 'finance.settle', id }) })
  },
  async acceptQuote(token: string, signedName: string) {
    if (!endpoint) { const quote = demoState.quotes.find(item => item.token === token); if (!quote) throw new Error('Orçamento não encontrado.'); quote.status = 'Aceito'; quote.signedName = signedName; quote.signedAt = new Date().toISOString(); return quote }
    return request<Quote>('quote.accept', { method: 'POST', body: JSON.stringify({ action: 'quote.accept', token, signedName }) })
  },
  async markInstallmentPaid(quoteId: string, installmentId: string) {
    if (!endpoint) { const quote = demoState.quotes.find(item => item.id === quoteId); const installment = quote?.installments.find(item => item.id === installmentId); if (!installment) throw new Error('Parcela não encontrada.'); installment.status = 'Pago'; installment.paidAt = new Date().toISOString(); return installment }
    return request('installment.pay', { method: 'POST', body: JSON.stringify({ action: 'installment.pay', quoteId, installmentId }) })
  },
}
