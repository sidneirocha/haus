import { parseBRL } from './money'
import type { Service } from './types'

export type ServiceImport = Omit<Service, 'id'>

const normalize = (value: string) => value
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[ _-]+/g, '')

const aliases: Record<string, keyof ServiceImport> = {
  nome: 'name', name: 'name',
  descricao: 'description', description: 'description',
  categoria: 'category', category: 'category',
  preco: 'price', price: 'price', valor: 'price',
  cobranca: 'billing', billing: 'billing', recorrencia: 'billing',
  ativo: 'active', active: 'active',
}

function parseRows(text: string, delimiter: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index += 1 }
      else quoted = !quoted
    } else if (char === delimiter && !quoted) {
      row.push(cell); cell = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1
      row.push(cell); cell = ''
      if (row.some(value => value.trim())) rows.push(row)
      row = []
    } else cell += char
  }
  row.push(cell)
  if (row.some(value => value.trim())) rows.push(row)
  return rows
}

const parseActive = (value: string) => !value.trim() || !['nao', 'não', 'false', '0', 'inativo'].includes(value.trim().toLowerCase())

export function parseServicesCsv(text: string): { services: ServiceImport[]; errors: string[] } {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  const delimiter = (firstLine.match(/;/g) ?? []).length >= (firstLine.match(/,/g) ?? []).length ? ';' : ','
  const rows = parseRows(text.replace(/^\uFEFF/, ''), delimiter)
  if (!rows.length) return { services: [], errors: ['O arquivo está vazio.'] }
  const headers = rows[0].map(normalize)
  const mapped = headers.map(header => aliases[header])
  const required = ['name', 'category', 'price'] as const
  const missing = required.filter(field => !mapped.includes(field))
  if (missing.length) return { services: [], errors: [`Cabeçalho obrigatório ausente: ${missing.join(', ')}.`] }

  const services: ServiceImport[] = []
  const errors: string[] = []
  rows.slice(1).forEach((values, index) => {
    const line = index + 2
    const get = (field: keyof ServiceImport) => {
      const position = mapped.indexOf(field)
      return position >= 0 ? (values[position] ?? '').trim() : ''
    }
    const name = get('name')
    const category = get('category')
    const price = parseBRL(get('price'))
    const billing = get('billing') || 'Uma vez'
    if (!name || !category || price <= 0) {
      errors.push(`Linha ${line}: nome, categoria e preço maior que zero são obrigatórios.`)
      return
    }
    if (!['Uma vez', 'Mensal', 'Anual'].includes(billing)) {
      errors.push(`Linha ${line}: cobrança deve ser Uma vez, Mensal ou Anual.`)
      return
    }
    services.push({ name, description: get('description'), category, price, billing: billing as Service['billing'], active: parseActive(get('active')) })
  })
  return { services, errors }
}

export function servicesCsvTemplate() {
  return 'nome;categoria;descricao;preco;cobranca;ativo\n'
}
