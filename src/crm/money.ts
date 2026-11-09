export const formatBRL = (value: number) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
}).format(Number.isFinite(value) ? value : 0)

export const parseBRL = (value: string | number) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const raw = value.trim().replace(/R\$\s?/gi, '')
  if (!raw) return 0
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}
