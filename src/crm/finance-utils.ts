import type { FinancialEntry, FinancialRecurrence } from './types'

const monthValue = (value: string) => {
  const [year, month] = value.slice(0, 7).split('-').map(Number)
  return year * 12 + month - 1
}

const recurrenceStep: Record<FinancialRecurrence, number> = {
  Nenhuma: 0,
  Mensal: 1,
  Trimestral: 3,
  Anual: 12,
}

const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate()

export function shiftMonth(value: string, amount: number) {
  const [year, month] = value.split('-').map(Number)
  const next = new Date(year, month - 1 + amount, 1)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
}

export function monthsBetween(start: string, end: string) {
  if (!start || !end) return []
  const first = start <= end ? start : end
  const last = start <= end ? end : start
  const months: string[] = []
  for (let month = first; month <= last; month = shiftMonth(month, 1)) months.push(month)
  return months
}

function occurrenceDate(entry: FinancialEntry, targetMonth: string) {
  const recurrence = entry.recurrence ?? 'Nenhuma'
  const step = recurrenceStep[recurrence]
  if (!step) return null
  const anchor = entry.nextDueDate || entry.date
  if (entry.recurrenceEndDate && targetMonth > entry.recurrenceEndDate.slice(0, 7)) return null
  const difference = monthValue(targetMonth) - monthValue(anchor)
  if (difference < 0 || difference % step !== 0) return null
  const [year, month] = targetMonth.split('-').map(Number)
  const day = Math.min(Number(anchor.slice(8, 10)) || 1, daysInMonth(year, month))
  return `${targetMonth}-${String(day).padStart(2, '0')}`
}

function occurrenceStatus(entry: FinancialEntry, occurrenceDate: string) {
  return entry.recurrenceStatuses?.[occurrenceDate] ?? 'Pendente'
}

export function recurrenceCutoffBefore(entry: FinancialEntry, targetMonth: string) {
  const steps: Record<FinancialRecurrence, number> = { Nenhuma: 0, Mensal: 1, Trimestral: 3, Anual: 12 }
  const step = steps[entry.recurrence ?? 'Nenhuma']
  if (!step) return ''
  return `${shiftMonth(targetMonth, -step)}-01`
}

export function financeEntriesForMonth(entries: FinancialEntry[], targetMonth: string) {
  const result = entries.filter(entry => entry.date.startsWith(targetMonth)).map(entry => ({ ...entry, projected: false }))
  entries.forEach(entry => {
    const date = occurrenceDate(entry, targetMonth)
    if (!date || entry.date.startsWith(targetMonth)) return
    result.push({
      ...entry,
      id: `${entry.id}::${targetMonth}`,
      date,
      projected: true,
      sourceId: entry.id,
      status: occurrenceStatus(entry, date),
      notes: `${entry.notes ? `${entry.notes} ` : ''}Projeção de recorrência.`,
    })
  })
  return result.sort((a, b) => b.date.localeCompare(a.date))
}

export type ProjectedFinancialEntry = FinancialEntry & { projected?: boolean }

export function financeEntriesThroughMonth(entries: FinancialEntry[], targetMonth: string) {
  if (!targetMonth) return []
  const months: string[] = []
  const first = entries.reduce<string | null>((oldest, entry) => !oldest || entry.date < oldest ? entry.date.slice(0, 7) : oldest, null)
  if (!first) return []
  for (let month = first; month <= targetMonth; month = shiftMonth(month, 1)) months.push(month)
  return months.flatMap(month => financeEntriesForMonth(entries, month))
}

export function financeEntriesForPeriod(entries: FinancialEntry[], start: string, end: string) {
  return monthsBetween(start, end).flatMap(month => financeEntriesForMonth(entries, month))
}
