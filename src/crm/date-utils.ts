export function toInputDate(value?: string | Date | null) {
  if (!value) return ''
  const raw = String(value).trim()
  if (!raw) return ''
  const brazilian = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (brazilian) return `${brazilian[3]}-${brazilian[2]}-${brazilian[1]}`
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return ''
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
}
