import type { Client, DashboardData, FinancialEntry, Project, Quote, Service } from './types'

export const demoClients: Client[] = [
  { id: 'cli-01', name: 'Gustavo Erbisti', company: 'M4 Logística', email: 'gustavo@exemplo.com', phone: '+55 11 99999-0000', notes: 'Contato principal do projeto institucional.', projects: 1, quotes: 1 },
  { id: 'cli-02', name: 'Mariana Costa', company: 'Centro Oeste Laticínios', email: 'mariana@centrooeste.com.br', phone: '+55 62 98888-0000', notes: 'Acompanhar oportunidade de manutenção.', projects: 2, quotes: 0 },
  { id: 'cli-03', name: 'Felipe Barros', company: 'OS Turbo', email: 'felipe@osturbo.com.br', phone: '+55 61 97777-0000', notes: 'Cliente recorrente.', projects: 1, quotes: 1 },
]

export const demoProjects: Project[] = [
  { id: 'pro-01', name: 'Website institucional', clientId: 'cli-01', clientName: 'M4 Logística', status: 'Em produção', startDate: '2026-10-20', dueDate: '2026-11-18', nextAction: 'Validar primeira versão', upsellDate: '2027-02-18', value: 7500, notes: 'Homepage, páginas institucionais e publicação.' },
  { id: 'pro-02', name: 'Sistema de gestão', clientId: 'cli-03', clientName: 'OS Turbo', status: 'Em revisão', startDate: '2026-10-03', dueDate: '2026-11-12', nextAction: 'Consolidar feedback', upsellDate: '2027-01-12', value: 3190, notes: 'Ajustes finais no painel.' },
  { id: 'pro-03', name: 'Identidade visual', clientId: 'cli-02', clientName: 'Centro Oeste Laticínios', status: 'Concluído', startDate: '2026-08-01', dueDate: '2026-09-20', nextAction: 'Oportunidade de manutenção', upsellDate: '2026-12-20', value: 4500, notes: 'Manual e aplicações principais entregues.' },
]

export const demoServices: Service[] = [
  { id: 'srv-01', name: 'Website institucional', description: 'Estratégia, design e desenvolvimento de site.', category: 'Web', price: 7500, billing: 'Uma vez', active: true },
  { id: 'srv-02', name: 'SaaS / sistema web', description: 'Interface e desenvolvimento de produto digital.', category: 'Produto', price: 12000, billing: 'Uma vez', active: true },
  { id: 'srv-03', name: 'Suporte e evolução', description: 'Pacote recorrente para melhorias e acompanhamento.', category: 'Suporte', price: 600, billing: 'Mensal', active: true },
  { id: 'srv-04', name: 'Hospedagem e domínio', description: 'Configuração e manutenção da infraestrutura.', category: 'Infra', price: 552, billing: 'Anual', active: true },
]

export const demoQuotes: Quote[] = [
  { id: 'orc-01', token: 'haus-demo-2026', clientId: 'cli-01', clientName: 'Gustavo Erbisti', company: 'M4 Logística', status: 'Publicado', createdAt: '2026-11-04', expiresAt: '2026-12-04', items: [{ serviceId: 'srv-01', name: 'Website institucional', quantity: 1, price: 7500, billing: 'Uma vez' }, { serviceId: 'srv-03', name: 'Suporte e evolução', quantity: 3, price: 600, billing: 'Mensal' }], notes: 'Prazo estimado: 30 dias úteis após aprovação.', pixKey: 'contato@haus.art.br', paymentUrl: '', installments: [{ id: 'par-01', dueDate: '2026-11-15', amount: 3750, paymentUrl: '', status: 'Pendente' }, { id: 'par-02', dueDate: '2026-12-15', amount: 3750, paymentUrl: '', status: 'Pendente' }] },
]

export const demoFinances: FinancialEntry[] = [
  { id: 'fin-01', date: '2026-11-04', description: 'Sinal — Website institucional', type: 'Entrada', category: 'Projetos', amount: 3750, status: 'Recebido', clientId: 'cli-01', clientName: 'M4 Logística', projectName: 'Website institucional' },
  { id: 'fin-02', date: '2026-11-15', description: 'Parcela 2 — Website institucional', type: 'Entrada', category: 'Projetos', amount: 3750, status: 'Pendente', clientId: 'cli-01', clientName: 'M4 Logística', projectName: 'Website institucional' },
  { id: 'fin-03', date: '2026-11-05', description: 'Assinatura de ferramentas', type: 'Custo', category: 'Software', amount: 552, status: 'Pago', notes: 'Ferramentas e infraestrutura do mês.' },
  { id: 'fin-04', date: '2026-11-08', description: 'Serviço de contabilidade', type: 'Saída', category: 'Operação', amount: 450, status: 'Pendente' },
]

export const demoData: DashboardData = { projects: demoProjects, clients: demoClients, services: demoServices, quotes: demoQuotes, finances: demoFinances }
