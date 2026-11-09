import type { Client, Contract, ContractModel, DashboardData, FinancialEntry, Project, Quote, Service } from './types'

export const demoClients: Client[] = [
  { id: 'cli-01', name: 'Gustavo Erbisti', company: 'M4 Logística', email: 'gustavo@exemplo.com', phone: '+55 11 99999-0000', notes: 'Contato principal do projeto institucional.', projects: 1, quotes: 1 },
  { id: 'cli-02', name: 'Mariana Costa', company: 'Centro Oeste Laticínios', email: 'mariana@centrooeste.com.br', phone: '+55 62 98888-0000', notes: 'Acompanhar oportunidade de manutenção.', projects: 2, quotes: 0 },
  { id: 'cli-03', name: 'Felipe Barros', company: 'OS Turbo', email: 'felipe@osturbo.com.br', phone: '+55 61 97777-0000', notes: 'Cliente recorrente.', projects: 1, quotes: 1 },
]

export const demoProjects: Project[] = [
  { id: 'pro-01', name: 'Website institucional', clientId: 'cli-01', clientName: 'M4 Logística', status: 'Em produção', startDate: '2026-10-20', dueDate: '2026-11-18', nextAction: 'Validar primeira versão', upsellDate: '2027-02-18', value: 8052, notes: 'Homepage, páginas institucionais e publicação.', solutions: [{ id: 'pro-01-srv-01', serviceId: 'srv-01', name: 'Website institucional', billing: 'Uma vez', value: 7500 }, { id: 'pro-01-srv-04', serviceId: 'srv-04', name: 'Hospedagem e domínio', billing: 'Anual', value: 552 }] },
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
  { id: 'fin-03', date: '2026-11-05', description: 'Assinatura de ferramentas', type: 'Custo', category: 'Software', amount: 552, status: 'Pago', recurrence: 'Mensal', nextDueDate: '2026-12-05', notes: 'Ferramentas e infraestrutura do mês.' },
  { id: 'fin-04', date: '2026-11-08', description: 'Serviço de contabilidade', type: 'Saída', category: 'Operação', amount: 450, status: 'Pendente', recurrence: 'Mensal', nextDueDate: '2026-12-08', notes: 'Despesa recorrente do contador.' },
]

const contractTemplate = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS\n\nCONTRATANTE: {{client.company}}, representada por {{client.name}}, e-mail {{client.email}}.\nCONTRATADA: Haus Art & Tech.\n\n1. OBJETO\nA CONTRATADA executará os serviços descritos no orçamento e no projeto {{project.name}}, conforme escopo aprovado pelas partes.\n\n2. INVESTIMENTO E PAGAMENTO\nO valor total contratado é de {{quote.total}}, conforme itens e condições do orçamento vinculado.\n\n3. PRAZO E ENTREGAS\nO cronograma será alinhado entre as partes e as entregas serão consideradas aprovadas após manifestação do CONTRATANTE.\n\n4. ALTERAÇÕES E CANCELAMENTO\nMudanças de escopo deverão ser registradas e poderão gerar revisão de prazo e investimento. O cancelamento observará os serviços já realizados e os valores vencidos.\n\n5. ACEITE\nO aceite eletrônico registra identidade declarada, data, hora, versão do documento e manifestação expressa do signatário.\n\n6. FORO\nFica eleito o foro da comarca da CONTRATADA, ressalvadas as regras legais aplicáveis.`

export const demoContractModels: ContractModel[] = [
  { id: 'modelo-01', name: 'Prestação de serviços digitais', description: 'Modelo base para projetos de estratégia, design, desenvolvimento e suporte.', content: contractTemplate, version: 1, active: true, createdAt: '2026-11-08', updatedAt: '2026-11-08' },
]

export const demoContracts: Contract[] = [
  { id: 'ctr-01', token: 'haus-contrato-m4-2026', clientId: 'cli-01', clientName: 'Gustavo Erbisti', company: 'M4 Logística', projectId: 'pro-01', projectName: 'Website institucional', quoteId: 'orc-01', modelId: 'modelo-01', modelName: 'Prestação de serviços digitais', title: 'Contrato — Website institucional', content: contractTemplate.replace('{{client.company}}', 'M4 Logística').replace('{{client.name}}', 'Gustavo Erbisti').replace('{{client.email}}', 'gustavo@exemplo.com').replace('{{project.name}}', 'Website institucional').replace('{{quote.total}}', 'R$ 9.300,00'), status: 'Rascunho', createdAt: '2026-11-08', updatedAt: '2026-11-08', expiresAt: '2026-12-08', events: [{ id: 'evt-01', contractId: 'ctr-01', type: 'Criado', occurredAt: '2026-11-08T10:00:00.000Z', actor: 'Haus' }] },
]

export const demoData: DashboardData = { projects: demoProjects, clients: demoClients, services: demoServices, quotes: demoQuotes, finances: demoFinances, contractModels: demoContractModels, contracts: demoContracts, aiDrafts: [] }
