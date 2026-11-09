export type CrmSession = {
  token: string
  email: string
  expiresAt: string
}

const SESSION_KEY = 'haus-crm-session'
const endpoint = import.meta.env.VITE_CRM_ENDPOINT as string | undefined

const emitAuthChange = () => window.dispatchEvent(new Event('haus-crm-auth'))

export function getCrmSession(): CrmSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as CrmSession
    if (!session.token || !session.email || !session.expiresAt || new Date(session.expiresAt).getTime() <= Date.now()) {
      clearCrmSession()
      return null
    }
    return session
  } catch {
    clearCrmSession()
    return null
  }
}

export function getCrmSessionToken() {
  return getCrmSession()?.token ?? ''
}

export function clearCrmSession() {
  sessionStorage.removeItem(SESSION_KEY)
  emitAuthChange()
}

export function subscribeCrmAuth(listener: () => void) {
  window.addEventListener('haus-crm-auth', listener)
  return () => window.removeEventListener('haus-crm-auth', listener)
}

export async function loginCrm(email: string, adminKey: string) {
  if (!endpoint) throw new Error('VITE_CRM_ENDPOINT não está configurado. Conecte o Apps Script para entrar no CRM.')
  const url = new URL(endpoint)
  url.searchParams.set('action', 'auth.login')
  // Apps Script Web Apps redirect POST requests to a googleusercontent URL.
  // A GET keeps the browser request readable and avoids the redirect CORS failure.
  url.searchParams.set('payload', JSON.stringify({ action: 'auth.login', email: email.trim(), adminKey }))
  const response = await fetch(url)
  const body = await response.json() as { ok: boolean; data?: CrmSession; error?: string }
  if (!response.ok || !body.ok || !body.data) throw new Error(body.error || 'Não foi possível entrar no CRM.')
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(body.data))
  emitAuthChange()
  return body.data
}

export const isCrmEndpointConfigured = Boolean(endpoint)
