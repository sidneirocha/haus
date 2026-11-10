import type { ContractModel } from './types'

export type ContractModelImport = Omit<ContractModel, 'id' | 'version' | 'createdAt' | 'updatedAt'>
const tags = ['{{client.company}}', '{{client.name}}', '{{client.email}}', '{{project.name}}', '{{quote.total}}']
const normalize = (value: string) => value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[ _-]+/g, '')
const aliases: Record<string, string> = { nome: 'name', name: 'name', descricao: 'description', description: 'description', conteudo: 'content', content: 'content', ativo: 'active', active: 'active' }

function rows(text: string, delimiter: string) {
  const result: string[][] = []; let current: string[] = []; let cell = ''; let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (char === '"') { if (quoted && text[index + 1] === '"') { cell += '"'; index += 1 } else quoted = !quoted }
    else if (char === delimiter && !quoted) { current.push(cell); cell = '' }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && text[index + 1] === '\n') index += 1; current.push(cell); cell = ''; if (current.some(value => value.trim())) result.push(current); current = [] }
    else cell += char
  }
  current.push(cell); if (current.some(value => value.trim())) result.push(current)
  return result
}

const activeValue = (value: string) => !['nao', 'não', 'false', '0', 'inativo'].includes(value.trim().toLowerCase())

export function parseContractModelsCsv(text: string): { models: ContractModelImport[]; errors: string[] } {
  const clean = text.replace(/^\uFEFF/, ''); const firstLine = clean.split(/\r?\n/, 1)[0] ?? ''
  const delimiter = (firstLine.match(/;/g) ?? []).length >= (firstLine.match(/,/g) ?? []).length ? ';' : ','
  const data = rows(clean, delimiter)
  if (!data.length) return { models: [], errors: ['O arquivo está vazio.'] }
  const headers = data[0].map(normalize).map(header => aliases[header] ?? header)
  const missing = ['name', 'description', 'content'].filter(field => !headers.includes(field))
  if (missing.length) return { models: [], errors: [`Cabeçalho obrigatório ausente: ${missing.join(', ')}.`] }
  const models: ContractModelImport[] = []; const errors: string[] = []
  data.slice(1).forEach((values, index) => {
    const line = index + 2; const get = (field: string) => { const position = headers.indexOf(field); return position >= 0 ? (values[position] ?? '').trim() : '' }
    const name = get('name'); const description = get('description'); const content = get('content')
    if (!name || !description || !content) { errors.push(`Linha ${line}: nome, descrição e conteúdo são obrigatórios.`); return }
    const unknown = Array.from(content.matchAll(/\{\{[^}]+\}\}/g)).map(match => match[0]).filter(tag => !tags.includes(tag))
    if (unknown.length) { errors.push(`Linha ${line}: tags não reconhecidas: ${unknown.join(', ')}.`); return }
    models.push({ name, description, content, active: activeValue(get('active')) })
  })
  return { models, errors }
}

export const contractModelTags = tags
export const contractModelsCsvTemplate = () => 'nome;descricao;conteudo;ativo\n'
