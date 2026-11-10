export type ProjectStatus = string
export type QuoteStatus = 'Rascunho' | 'Publicado' | 'Aceito' | 'Recusado' | 'Expirado'
export type InstallmentStatus = 'Pendente' | 'Pago' | 'Atrasado'
export type FinancialType = 'Entrada' | 'Saída' | 'Custo'
export type FinancialStatus = 'Pago' | 'Recebido' | 'Pendente'
export type FinancialRecurrence = 'Nenhuma' | 'Mensal' | 'Trimestral' | 'Anual'
export type ContractStatus = 'Rascunho' | 'Enviado' | 'Visualizado' | 'Assinado' | 'Expirado' | 'Cancelado'
export const SERVICE_CATEGORIES = ['Web', 'Produto', 'Suporte', 'Infra', 'Estratégia', 'Branding'] as const

export type ProjectSolution = {
  id: string
  serviceId?: string
  name: string
  billing: 'Uma vez' | 'Mensal' | 'Anual'
  value: number
}

export type Client = {
  id: string
  name: string
  company: string
  email: string
  phone: string
  notes: string
  projects: number
  quotes: number
}

export type Project = {
  id: string
  name: string
  clientId: string
  clientName: string
  status: ProjectStatus
  startDate: string
  dueDate: string
  nextAction: string
  upsellDate: string
  value: number
  notes: string
  solutions?: ProjectSolution[]
  quoteId?: string
  quoteToken?: string
  sourceStatus?: QuoteStatus
  epicKey?: string
}

export type WorkStatus = 'Backlog' | 'Em andamento' | 'Em revisão' | 'Concluído' | 'Bloqueado'

export type Story = {
  id: string
  projectId: string
  quoteItemId?: string
  serviceId?: string
  title: string
  description: string
  status: WorkStatus
  priority: string
  assignee: string
  startDate: string
  dueDate: string
  position: number
  createdAt: string
  updatedAt: string
}

export type Subtask = {
  id: string
  storyId: string
  title: string
  description: string
  status: WorkStatus
  priority: string
  assignee: string
  startDate: string
  dueDate: string
  position: number
  createdAt: string
  updatedAt: string
}

export type Activity = {
  id: string
  entityType: 'project' | 'story' | 'subtask'
  entityId: string
  type: 'comment' | 'link' | 'status' | 'system'
  message: string
  url?: string
  author: string
  createdAt: string
  updatedAt?: string
}

export type Service = {
  id: string
  name: string
  description: string
  category: string
  price: number
  billing: 'Uma vez' | 'Mensal' | 'Anual'
  active: boolean
}

export type QuoteItem = { serviceId: string; name: string; description?: string; quantity: number; price: number; billing: Service['billing'] }
export type Installment = { id: string; dueDate: string; amount: number; paymentUrl: string; status: InstallmentStatus; paidAt?: string }

export type Quote = {
  id: string
  token: string
  clientId: string
  clientName: string
  company: string
  status: QuoteStatus
  createdAt: string
  expiresAt: string
  items: QuoteItem[]
  notes: string
  pixKey: string
  paymentUrl: string
  installments: Installment[]
  projectId?: string
  signedName?: string
  signedAt?: string
}

export type ContractModel = {
  id: string
  name: string
  description: string
  content: string
  version: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export type ContractEvent = {
  id: string
  contractId: string
  type: 'Criado' | 'Atualizado' | 'Publicado' | 'Visualizado' | 'Assinado' | 'Cancelado'
  occurredAt: string
  actor: string
  metadata?: string
}

export type Contract = {
  id: string
  token: string
  clientId: string
  clientName: string
  company: string
  projectId?: string
  projectName?: string
  quoteId?: string
  modelId: string
  modelName: string
  title: string
  content: string
  status: ContractStatus
  createdAt: string
  updatedAt: string
  expiresAt: string
  signedName?: string
  signedEmail?: string
  signerDocument?: string
  signerIp?: string
  signedAt?: string
  clientEmail?: string
  clientPhone?: string
  signatureHash?: string
  events: ContractEvent[]
}

export type AiDraft = {
  id: string
  briefing: string
  clientId?: string
  clientName?: string
  status: 'Rascunho' | 'Aprovado' | 'Descartado'
  result: { items: QuoteItem[]; notes: string; paymentTerms: string; alerts: string[] }
  model?: string
  createdAt: string
  updatedAt: string
}

export type FinancialEntry = {
  id: string
  date: string
  description: string
  type: FinancialType
  category: string
  amount: number
  status: FinancialStatus
  recurrence?: FinancialRecurrence
  nextDueDate?: string
  clientId?: string
  clientName?: string
  projectId?: string
  projectName?: string
  notes?: string
  projected?: boolean
  sourceId?: string
  recurrenceEndDate?: string
  recurrenceStatuses?: Record<string, FinancialStatus>
}

export type DashboardData = {
  projects: Project[]
  clients: Client[]
  services: Service[]
  quotes: Quote[]
  finances: FinancialEntry[]
  contractModels: ContractModel[]
  contracts: Contract[]
  aiDrafts: AiDraft[]
  stories?: Story[]
  subtasks?: Subtask[]
  activities?: Activity[]
}
