export type ProjectStatus = 'Briefing' | 'Em produção' | 'Em revisão' | 'Concluído'
export type QuoteStatus = 'Rascunho' | 'Publicado' | 'Aceito' | 'Recusado'
export type InstallmentStatus = 'Pendente' | 'Pago' | 'Atrasado'
export type FinancialType = 'Entrada' | 'Saída' | 'Custo'
export type FinancialStatus = 'Pago' | 'Recebido' | 'Pendente'

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

export type QuoteItem = { serviceId: string; name: string; quantity: number; price: number; billing: Service['billing'] }
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
  signedName?: string
  signedAt?: string
}

export type FinancialEntry = {
  id: string
  date: string
  description: string
  type: FinancialType
  category: string
  amount: number
  status: FinancialStatus
  clientId?: string
  clientName?: string
  projectId?: string
  projectName?: string
  notes?: string
}

export type DashboardData = {
  projects: Project[]
  clients: Client[]
  services: Service[]
  quotes: Quote[]
  finances: FinancialEntry[]
}
