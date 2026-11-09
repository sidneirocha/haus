import { demoData } from './demo-data'
import type { AiDraft, Client, Contract, ContractModel, DashboardData, FinancialEntry, Project, Quote, Service } from './types'
import { announce } from './Toast'
import { clearCrmSession, getCrmSessionToken } from './auth'

const endpoint = import.meta.env.VITE_CRM_ENDPOINT as string | undefined
const DEMO_STORAGE_KEY = 'haus-crm-demo-state'

export const isCrmDemo = !endpoint

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const loadDemoState = (): DashboardData => {
  try {
    const stored = localStorage.getItem(DEMO_STORAGE_KEY)
    return stored ? JSON.parse(stored) as DashboardData : clone(demoData)
  } catch { return clone(demoData) }
}
const demoState = loadDemoState()
const persistDemoState = () => { try { localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(demoState)) } catch { /* storage may be unavailable */ } }
const syncDemoState = () => { if (!endpoint) Object.assign(demoState, loadDemoState()) }

async function request<T>(action: string, options: RequestInit = {}): Promise<T> {
  if (!endpoint) throw new Error('Modo demonstração ativo')
  const url = new URL(endpoint)
  url.searchParams.set('action', action)
  const token = getCrmSessionToken()
  const payload = typeof options.body === 'string' ? JSON.parse(options.body) as Record<string, unknown> : { action }
  if (token) {
    payload.sessionToken = token
    url.searchParams.set('session', token)
  }
  url.searchParams.set('payload', JSON.stringify(payload))
  const response = await fetch(url)
  const result = await response.json() as { ok: boolean; data: T; error?: string }
  if (!response.ok || !result.ok) {
    if (result.error === 'Não autorizado.') clearCrmSession()
    throw new Error(result.error || 'Não foi possível concluir a operação.')
  }
  return result.data
}

async function publicRequest<T>(action: string, params: Record<string, string> = {}): Promise<T> {
  if (!endpoint) throw new Error('Modo demonstração ativo')
  const url = new URL(endpoint)
  url.searchParams.set('action', action)
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))
  const response = await fetch(url)
  const body = await response.json() as { ok: boolean; data: T; error?: string }
  if (!response.ok || !body.ok) throw new Error(body.error || 'Não foi possível carregar o contrato.')
  return body.data
}

export const crmRepository = {
  async getDashboard(): Promise<DashboardData> {
    if (!endpoint) { syncDemoState(); return clone(demoState) }
    const response = await request<DashboardData>('dashboard')
    return {
      ...response,
      finances: response.finances ?? [],
      contractModels: response.contractModels ?? [],
      contracts: response.contracts ?? [],
      aiDrafts: response.aiDrafts ?? [],
    }
  },
  async createClient(input: Omit<Client, 'id' | 'projects' | 'quotes'>) {
    if (!endpoint) { const client = { ...input, id: `cli-${Date.now()}`, projects: 0, quotes: 0 }; demoState.clients.unshift(client); persistDemoState(); announce('Cliente criado.'); return client }
    return request<Client>('client.create', { method: 'POST', body: JSON.stringify({ action: 'client.create', ...input }) }).then(result => { announce('Cliente criado.'); return result })
  },
  async updateClient(id: string, input: Omit<Client, 'id' | 'projects' | 'quotes'>) {
    if (!endpoint) { const client = demoState.clients.find(item => item.id === id); if (!client) throw new Error('Cliente não encontrado.'); Object.assign(client, input); persistDemoState(); return client }
    return request<Client>('client.update', { method: 'POST', body: JSON.stringify({ action: 'client.update', id, ...input }) })
  },
  async deleteClient(id: string) {
    if (!endpoint) {
      if (demoState.projects.some(item => item.clientId === id) || demoState.quotes.some(item => item.clientId === id)) throw new Error('Este cliente possui projetos ou orçamentos vinculados.')
      const index = demoState.clients.findIndex(item => item.id === id)
      if (index < 0) throw new Error('Cliente não encontrado.')
      demoState.clients.splice(index, 1)
      persistDemoState()
      announce('Cliente excluído.')
      return { id }
    }
    return request<{ id: string }>('client.delete', { method: 'POST', body: JSON.stringify({ action: 'client.delete', id }) }).then(result => { announce('Cliente excluído.'); return result })
  },
  async createProject(input: Omit<Project, 'id' | 'clientName'>) {
    const client = demoState.clients.find(item => item.id === input.clientId)
    if (!endpoint) { const project = { ...input, id: `pro-${Date.now()}`, clientName: client?.company ?? 'Cliente' }; demoState.projects.unshift(project); persistDemoState(); announce('Projeto criado.'); return project }
    return request<Project>('project.create', { method: 'POST', body: JSON.stringify({ action: 'project.create', ...input, solutions: JSON.stringify(input.solutions ?? []) }) }).then(result => { announce('Projeto criado.'); return result })
  },
  async updateProjectStatus(id: string, status: Project['status']) {
    if (!endpoint) { const project = demoState.projects.find(item => item.id === id); if (!project) throw new Error('Projeto não encontrado.'); project.status = status; persistDemoState(); return project }
    return request<Project>('project.status', { method: 'POST', body: JSON.stringify({ action: 'project.status', id, status }) })
  },
  async updateProject(id: string, input: Omit<Project, 'id' | 'clientName'>) {
    const client = demoState.clients.find(item => item.id === input.clientId)
    if (!endpoint) { const project = demoState.projects.find(item => item.id === id); if (!project) throw new Error('Projeto não encontrado.'); Object.assign(project, input, { clientName: client?.company ?? project.clientName }); persistDemoState(); return project }
    return request<Project>('project.update', { method: 'POST', body: JSON.stringify({ action: 'project.update', id, ...input, solutions: JSON.stringify(input.solutions ?? []) }) })
  },
  async deleteProject(id: string) {
    if (!endpoint) {
      const index = demoState.projects.findIndex(item => item.id === id)
      if (index < 0) throw new Error('Projeto não encontrado.')
      demoState.projects.splice(index, 1)
      persistDemoState()
      announce('Projeto excluído.')
      return { id }
    }
    return request<{ id: string }>('project.delete', { method: 'POST', body: JSON.stringify({ action: 'project.delete', id }) }).then(result => { announce('Projeto excluído.'); return result })
  },
  async createService(input: Omit<Service, 'id'>) {
    if (!endpoint) { const service = { ...input, id: `srv-${Date.now()}` }; demoState.services.unshift(service); persistDemoState(); announce('Serviço criado.'); return service }
    return request<Service>('service.create', { method: 'POST', body: JSON.stringify({ action: 'service.create', ...input }) }).then(result => { announce('Serviço criado.'); return result })
  },
  async updateService(id: string, input: Omit<Service, 'id'>) {
    if (!endpoint) { const service = demoState.services.find(item => item.id === id); if (!service) throw new Error('Serviço não encontrado.'); Object.assign(service, input); persistDemoState(); return service }
    return request<Service>('service.update', { method: 'POST', body: JSON.stringify({ action: 'service.update', id, ...input }) })
  },
  async deleteService(id: string) {
    if (!endpoint) {
      if (demoState.projects.some(project => project.solutions?.some(solution => (solution.serviceId || solution.id) === id)) || demoState.quotes.some(quote => quote.items.some(item => item.serviceId === id))) throw new Error('Este serviço está vinculado a um projeto ou orçamento. Desative-o em vez de excluí-lo.')
      const index = demoState.services.findIndex(item => item.id === id)
      if (index < 0) throw new Error('Serviço não encontrado.')
      demoState.services.splice(index, 1)
      persistDemoState()
      announce('Serviço excluído.')
      return { id }
    }
    return request<{ id: string }>('service.delete', { method: 'POST', body: JSON.stringify({ action: 'service.delete', id }) }).then(result => { announce('Serviço excluído.'); return result })
  },
  async createQuote(input: { clientId: string; clientName: string; company: string; items: Quote['items']; expiresAt: string; notes: string; pixKey: string; paymentUrl: string }) {
    if (!endpoint) { const quote: Quote = { ...input, id: `orc-${Date.now()}`, token: `haus-demo-${Date.now()}`, status: 'Rascunho', createdAt: new Date().toISOString().slice(0, 10), installments: [] }; demoState.quotes.unshift(quote); persistDemoState(); announce('Orçamento criado.'); return quote }
    return request<Quote>('quote.create', { method: 'POST', body: JSON.stringify({ action: 'quote.create', ...input }) }).then(result => { announce('Orçamento criado.'); return result })
  },
  async updateQuote(id: string, input: { clientId: string; clientName: string; company: string; items: Quote['items']; expiresAt: string; notes: string; pixKey: string; paymentUrl: string }) {
    if (!endpoint) { const quote = demoState.quotes.find(item => item.id === id); if (!quote) throw new Error('Orçamento não encontrado.'); Object.assign(quote, input); persistDemoState(); return quote }
    return request<Quote>('quote.update', { method: 'POST', body: JSON.stringify({ action: 'quote.update', id, ...input }) })
  },
  async publishQuote(id: string) {
    if (!endpoint) {
      const quote = demoState.quotes.find(item => item.id === id)
      if (!quote) throw new Error('Orçamento não encontrado.')
      if (!quote.expiresAt || new Date(`${quote.expiresAt}T12:00:00`).getTime() <= new Date().setHours(0, 0, 0, 0)) throw new Error('Defina uma validade futura antes de publicar.')
      quote.status = 'Publicado'
      persistDemoState()
      announce('Orçamento publicado.')
      return quote
    }
    return request<Quote>('quote.publish', { method: 'POST', body: JSON.stringify({ action: 'quote.publish', id }) }).then(result => { announce('Orçamento publicado.'); return result })
  },
  async reactivateQuote(id: string, expiresAt: string) {
    if (!expiresAt) throw new Error('Informe uma nova data de validade.')
    if (new Date(`${expiresAt}T12:00:00`).getTime() <= new Date().setHours(0, 0, 0, 0)) throw new Error('A nova validade precisa ser futura.')
    if (!endpoint) {
      const quote = demoState.quotes.find(item => item.id === id)
      if (!quote) throw new Error('Orçamento não encontrado.')
      quote.status = 'Publicado'
      quote.expiresAt = expiresAt
      persistDemoState()
      announce('Orçamento reativado.')
      return quote
    }
    return request<Quote>('quote.reactivate', { method: 'POST', body: JSON.stringify({ action: 'quote.reactivate', id, expiresAt }) }).then(result => { announce('Orçamento reativado.'); return result })
  },
  async deleteQuote(id: string) {
    if (!endpoint) {
      const index = demoState.quotes.findIndex(item => item.id === id)
      if (index < 0) throw new Error('Orçamento não encontrado.')
      demoState.quotes.splice(index, 1)
      announce('Orçamento excluído.')
      return { id }
    }
    return request<{ id: string }>('quote.delete', { method: 'POST', body: JSON.stringify({ action: 'quote.delete', id }) }).then(result => { announce('Orçamento excluído.'); return result })
  },
  async createFinance(input: Omit<FinancialEntry, 'id'>) {
    if (!endpoint) { const entry = { ...input, id: `fin-${Date.now()}` }; demoState.finances.unshift(entry); persistDemoState(); announce('Lançamento financeiro criado.'); return entry }
    return request<FinancialEntry>('finance.create', { method: 'POST', body: JSON.stringify({ action: 'finance.create', ...input }) }).then(result => { announce('Lançamento financeiro criado.'); return result })
  },
  async updateFinance(id: string, input: Omit<FinancialEntry, 'id'>) {
    if (!endpoint) { const entry = demoState.finances.find(item => item.id === id); if (!entry) throw new Error('Lançamento não encontrado.'); Object.assign(entry, input); persistDemoState(); announce('Lançamento atualizado.'); return entry }
    return request<FinancialEntry>('finance.update', { method: 'POST', body: JSON.stringify({ action: 'finance.update', id, ...input }) }).then(result => { announce('Lançamento atualizado.'); return result })
  },
  async settleFinance(id: string) {
    if (!endpoint) { const entry = demoState.finances.find(item => item.id === id); if (!entry) throw new Error('Lançamento não encontrado.'); entry.status = entry.type === 'Entrada' ? 'Recebido' : 'Pago'; persistDemoState(); announce('Lançamento atualizado.'); return entry }
    return request<FinancialEntry>('finance.settle', { method: 'POST', body: JSON.stringify({ action: 'finance.settle', id }) }).then(result => { announce('Lançamento atualizado.'); return result })
  },
  async deleteFinance(id: string) {
    if (!endpoint) {
      const index = demoState.finances.findIndex(item => item.id === id)
      if (index < 0) throw new Error('Lançamento não encontrado.')
      demoState.finances.splice(index, 1)
      persistDemoState()
      announce('Lançamento excluído.')
      return { id }
    }
    return request<{ id: string }>('finance.delete', { method: 'POST', body: JSON.stringify({ action: 'finance.delete', id }) }).then(result => { announce('Lançamento excluído.'); return result })
  },
  async acceptQuote(token: string, signedName: string) {
    if (!endpoint) { const quote = demoState.quotes.find(item => item.token === token); if (!quote) throw new Error('Orçamento não encontrado.'); quote.status = 'Aceito'; quote.signedName = signedName; quote.signedAt = new Date().toISOString(); persistDemoState(); announce('Orçamento aceito.'); return quote }
    return request<Quote>('quote.accept', { method: 'POST', body: JSON.stringify({ action: 'quote.accept', token, signedName }) }).then(result => { announce('Orçamento aceito.'); return result })
  },
  async markInstallmentPaid(quoteId: string, installmentId: string) {
    if (!endpoint) { const quote = demoState.quotes.find(item => item.id === quoteId); const installment = quote?.installments.find(item => item.id === installmentId); if (!installment) throw new Error('Parcela não encontrada.'); installment.status = 'Pago'; installment.paidAt = new Date().toISOString(); persistDemoState(); announce('Parcela marcada como paga.'); return installment }
    return request('installment.pay', { method: 'POST', body: JSON.stringify({ action: 'installment.pay', quoteId, installmentId }) }).then(result => { announce('Parcela marcada como paga.'); return result })
  },
  async createContractModel(input: Omit<ContractModel, 'id' | 'version' | 'createdAt' | 'updatedAt'>) {
    if (!endpoint) { const stamp = new Date().toISOString(); const model: ContractModel = { ...input, id: `modelo-${Date.now()}`, version: 1, createdAt: stamp, updatedAt: stamp }; demoState.contractModels.unshift(model); persistDemoState(); announce('Modelo de contrato criado.'); return model }
    return request<ContractModel>('contract-model.create', { method: 'POST', body: JSON.stringify({ action: 'contract-model.create', ...input }) }).then(result => { announce('Modelo de contrato criado.'); return result })
  },
  async updateContractModel(id: string, input: Omit<ContractModel, 'id' | 'version' | 'createdAt' | 'updatedAt'>) {
    if (!endpoint) { const model = demoState.contractModels.find(item => item.id === id); if (!model) throw new Error('Modelo de contrato não encontrado.'); Object.assign(model, input, { version: model.version + 1, updatedAt: new Date().toISOString() }); persistDemoState(); announce('Modelo de contrato atualizado.'); return model }
    return request<ContractModel>('contract-model.update', { method: 'POST', body: JSON.stringify({ action: 'contract-model.update', id, ...input }) }).then(result => { announce('Modelo de contrato atualizado.'); return result })
  },
  async deleteContractModel(id: string) {
    if (!endpoint) { if (demoState.contracts.some(item => item.modelId === id)) throw new Error('Este modelo está vinculado a um contrato.'); const index = demoState.contractModels.findIndex(item => item.id === id); if (index < 0) throw new Error('Modelo de contrato não encontrado.'); demoState.contractModels.splice(index, 1); persistDemoState(); announce('Modelo de contrato excluído.'); return { id } }
    return request<{ id: string }>('contract-model.delete', { method: 'POST', body: JSON.stringify({ action: 'contract-model.delete', id }) }).then(result => { announce('Modelo de contrato excluído.'); return result })
  },
  async createContract(input: Omit<Contract, 'id' | 'token' | 'createdAt' | 'updatedAt' | 'events' | 'status'>) {
    if (!input.clientId || !input.modelId || !input.title || !input.content || !input.expiresAt) throw new Error('Cliente, modelo, título, conteúdo e validade são obrigatórios.')
    if (!endpoint) { const stamp = new Date().toISOString(); const contract: Contract = { ...input, id: `ctr-${Date.now()}`, token: `haus-contrato-${Date.now()}`, status: 'Rascunho', createdAt: stamp, updatedAt: stamp, events: [{ id: `evt-${Date.now()}`, contractId: `ctr-${Date.now()}`, type: 'Criado', occurredAt: stamp, actor: 'Haus' }] }; contract.events[0].contractId = contract.id; demoState.contracts.unshift(contract); persistDemoState(); announce('Contrato criado.'); return contract }
    return request<Contract>('contract.create', { method: 'POST', body: JSON.stringify({ action: 'contract.create', ...input }) }).then(result => { announce('Contrato criado.'); return result })
  },
  async updateContract(id: string, input: Pick<Contract, 'clientId' | 'clientName' | 'company' | 'projectId' | 'projectName' | 'quoteId' | 'modelId' | 'modelName' | 'title' | 'content' | 'expiresAt'>) {
    if (!input.clientId || !input.modelId || !input.title.trim() || !input.content.trim() || !input.expiresAt) throw new Error('Cliente, modelo, título, conteúdo e validade são obrigatórios.')
    if (!endpoint) {
      const contract = demoState.contracts.find(item => item.id === id)
      if (!contract) throw new Error('Contrato não encontrado.')
      if (contract.status === 'Assinado') throw new Error('Contratos assinados não podem ser editados.')
      Object.assign(contract, input, { updatedAt: new Date().toISOString() })
      contract.events.unshift({ id: `evt-${Date.now()}`, contractId: id, type: 'Atualizado', occurredAt: contract.updatedAt, actor: 'Haus' })
      persistDemoState()
      announce('Contrato atualizado.')
      return contract
    }
    return request<Contract>('contract.update', { method: 'POST', body: JSON.stringify({ action: 'contract.update', id, ...input }) }).then(result => { announce('Contrato atualizado.'); return result })
  },
  async cancelContract(id: string) {
    if (!endpoint) {
      const contract = demoState.contracts.find(item => item.id === id)
      if (!contract) throw new Error('Contrato não encontrado.')
      if (contract.status === 'Assinado') throw new Error('Contratos assinados não podem ser cancelados.')
      contract.status = 'Cancelado'
      contract.updatedAt = new Date().toISOString()
      contract.events.unshift({ id: `evt-${Date.now()}`, contractId: id, type: 'Cancelado', occurredAt: contract.updatedAt, actor: 'Haus' })
      persistDemoState()
      announce('Contrato cancelado.')
      return contract
    }
    return request<Contract>('contract.cancel', { method: 'POST', body: JSON.stringify({ action: 'contract.cancel', id }) }).then(result => { announce('Contrato cancelado.'); return result })
  },
  async deleteContract(id: string) {
    if (!endpoint) {
      const index = demoState.contracts.findIndex(item => item.id === id)
      const contract = demoState.contracts[index]
      if (!contract) throw new Error('Contrato não encontrado.')
      if (!['Rascunho', 'Cancelado'].includes(contract.status)) throw new Error('Somente rascunhos ou contratos cancelados podem ser excluídos.')
      demoState.contracts.splice(index, 1)
      persistDemoState()
      announce('Contrato excluído.')
      return { id }
    }
    return request<{ id: string }>('contract.delete', { method: 'POST', body: JSON.stringify({ action: 'contract.delete', id }) }).then(result => { announce('Contrato excluído.'); return result })
  },
  async publishContract(id: string) {
    if (!endpoint) { const contract = demoState.contracts.find(item => item.id === id); if (!contract) throw new Error('Contrato não encontrado.'); if (contract.status === 'Assinado') throw new Error('Um contrato assinado não pode ser republicado.'); contract.status = 'Enviado'; contract.updatedAt = new Date().toISOString(); contract.events.unshift({ id: `evt-${Date.now()}`, contractId: id, type: 'Publicado', occurredAt: contract.updatedAt, actor: 'Haus' }); persistDemoState(); announce('Contrato publicado.'); return contract }
    return request<Contract>('contract.publish', { method: 'POST', body: JSON.stringify({ action: 'contract.publish', id }) }).then(result => { announce('Contrato publicado.'); return result })
  },
  async getPublicContract(token: string) {
    if (!endpoint) {
      syncDemoState()
      const contract = demoState.contracts.find(item => item.token === token)
      if (!contract || !['Enviado', 'Visualizado', 'Assinado'].includes(contract.status)) throw new Error('Contrato não encontrado ou ainda não publicado.')
      return clone(contract)
    }
    return publicRequest<Contract>('contract', { id: token })
  },
  async markContractViewed(token: string) {
    if (!endpoint) { syncDemoState(); const contract = demoState.contracts.find(item => item.token === token); if (!contract || contract.status === 'Assinado') return contract; if (contract.status === 'Enviado') { contract.status = 'Visualizado'; contract.events.unshift({ id: `evt-${Date.now()}`, contractId: contract.id, type: 'Visualizado', occurredAt: new Date().toISOString(), actor: 'Cliente' }); persistDemoState() } return contract }
    return request<Contract>('contract.view', { method: 'POST', body: JSON.stringify({ action: 'contract.view', token }) })
  },
  async signContract(token: string, input: { signedName: string; signedEmail: string; signerDocument: string; consent: boolean }) {
    if (!input.consent || input.signedName.trim().length < 3 || !input.signedEmail.includes('@') || input.signerDocument.replace(/\D/g, '').length < 11) throw new Error('Informe nome completo, e-mail, CPF/CNPJ e aceite os termos.')
    if (!endpoint) { syncDemoState(); const contract = demoState.contracts.find(item => item.token === token); if (!contract) throw new Error('Contrato não encontrado.'); if (!['Enviado', 'Visualizado'].includes(contract.status)) throw new Error('Este contrato não está disponível para assinatura.'); contract.status = 'Assinado'; contract.signedName = input.signedName.trim(); contract.signedEmail = input.signedEmail.trim(); contract.signerDocument = input.signerDocument.trim(); contract.signedAt = new Date().toISOString(); contract.updatedAt = contract.signedAt; contract.events.unshift({ id: `evt-${Date.now()}`, contractId: contract.id, type: 'Assinado', occurredAt: contract.signedAt, actor: input.signedName, metadata: `Consentimento: ${input.consent}` }); persistDemoState(); announce('Contrato assinado.'); return contract }
    return request<Contract>('contract.sign', { method: 'POST', body: JSON.stringify({ action: 'contract.sign', token, ...input }) }).then(result => { announce('Contrato assinado.'); return result })
  },
  async createAiDraft(input: { briefing: string; clientId?: string }) {
    if (!input.briefing.trim()) throw new Error('Descreva o briefing para gerar um rascunho.')
    const client = demoState.clients.find(item => item.id === input.clientId)
    if (!endpoint) { const selected = demoState.services.filter(item => item.active).slice(0, 2); const stamp = new Date().toISOString(); const draft: AiDraft = { id: `ai-${Date.now()}`, briefing: input.briefing.trim(), clientId: client?.id, clientName: client?.company, status: 'Rascunho', result: { items: selected.map(item => ({ serviceId: item.id, name: item.name, quantity: 1, price: item.price, billing: item.billing })), notes: 'Rascunho gerado localmente. Revise escopo, prazo e valores antes de publicar.', paymentTerms: 'Definir condições de pagamento após revisão humana.', alerts: ['Revisão humana obrigatória antes do envio.'] }, model: 'local-ready', createdAt: stamp, updatedAt: stamp }; demoState.aiDrafts.unshift(draft); announce('Rascunho de orçamento preparado.'); return draft }
    return request<AiDraft>('ai.draftQuote', { method: 'POST', body: JSON.stringify({ action: 'ai.draftQuote', ...input }) }).then(result => { announce('Rascunho de orçamento preparado.'); return result })
  },
}
