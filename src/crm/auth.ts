export type CrmSession = {
  token: string
  email: string
  expiresAt: string
}

const SESSION_KEY = 'haus-crm-session'
const endpoint = ((import.meta.env.VITE_CRM_ENDPOINT as string | undefined) || 'https://script.google.com/macros/s/AKfycbwhBycqlcQUB6SOYGVy2tPDJFk0-aT5vc--8YiFznpZslbpz_zrtgFBsumt7KnzPVhi/exec')
const webauthnEndpoint = ((import.meta.env.VITE_WEBAUTHN_ENDPOINT as string | undefined) || 'https://haus-webauthn.sidneisrbarros.workers.dev').replace(/\/$/, '')

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

const base64UrlToBuffer = (value: string) => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64 + '='.repeat((4 - base64.length % 4) % 4))
  return Uint8Array.from(binary, character => character.charCodeAt(0)).buffer
}

const bufferToBase64Url = (value: ArrayBuffer | ArrayBufferView) => {
  const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  let binary = ''
  bytes.forEach(byte => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const serializeCredential = (credential: PublicKeyCredential) => {
  const response = credential.response as AuthenticatorAssertionResponse | AuthenticatorAttestationResponse
  const result: Record<string, unknown> = {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
    },
  }
  if ('authenticatorData' in response) {
    result.response = {
      ...result.response as Record<string, unknown>,
      authenticatorData: bufferToBase64Url(response.authenticatorData),
      signature: bufferToBase64Url(response.signature),
      userHandle: response.userHandle ? bufferToBase64Url(response.userHandle) : null,
    }
  } else {
    result.response = {
      ...result.response as Record<string, unknown>,
      attestationObject: bufferToBase64Url(response.attestationObject),
      transports: response.getTransports?.() || [],
    }
  }
  return result
}

const postWebAuthn = async (path: string, payload: Record<string, unknown>) => {
  const response = await fetch(`${webauthnEndpoint}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = await response.json() as { ok: boolean; data?: Record<string, unknown>; error?: string }
  if (!response.ok || !body.ok || !body.data) throw new Error(body.error || 'Não foi possível concluir a autenticação por biometria.')
  return body.data
}

export const isWebAuthnAvailable = () => Boolean(window.PublicKeyCredential && navigator.credentials)

export async function loginCrmWithPasskey(email = '') {
  if (!isWebAuthnAvailable()) throw new Error('Este navegador não oferece autenticação por biometria.')
  const options = await postWebAuthn('/api/webauthn/login/options', { email: email.trim() })
  const publicKey: PublicKeyCredentialRequestOptions = {
    ...(options as unknown as PublicKeyCredentialRequestOptions),
    challenge: base64UrlToBuffer(String(options.challenge)),
    allowCredentials: Array.isArray(options.allowCredentials)
      ? options.allowCredentials.map(item => ({ ...item as PublicKeyCredentialDescriptor, id: base64UrlToBuffer(String((item as { id: string }).id)) }))
      : undefined,
  }
  const credential = await navigator.credentials.get({ publicKey }) as PublicKeyCredential | null
  if (!credential) throw new Error('A autenticação foi cancelada.')
  const body = await postWebAuthn('/api/webauthn/login/verify', {
    ...(email.trim() ? { email: email.trim() } : {}),
    challenge: options.challenge,
    response: serializeCredential(credential),
  })
  const session = body as unknown as CrmSession
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  emitAuthChange()
  return session
}

export async function registerCrmPasskey() {
  const session = getCrmSession()
  if (!session) throw new Error('Entre no CRM antes de cadastrar uma passkey.')
  const options = await postWebAuthn('/api/webauthn/register/options', { sessionToken: session.token })
  const publicKey = {
    ...(options as unknown as PublicKeyCredentialCreationOptions),
    challenge: base64UrlToBuffer(String(options.challenge)),
    user: {
      ...(options.user as PublicKeyCredentialUserEntity),
      id: base64UrlToBuffer(String((options.user as { id: string }).id)),
    },
    excludeCredentials: Array.isArray(options.excludeCredentials)
      ? options.excludeCredentials.map(item => ({ ...item as PublicKeyCredentialDescriptor, id: base64UrlToBuffer(String((item as { id: string }).id)) }))
      : undefined,
  }
  const credential = await navigator.credentials.create({ publicKey }) as PublicKeyCredential | null
  if (!credential) throw new Error('O cadastro da passkey foi cancelado.')
  await postWebAuthn('/api/webauthn/register/verify', { sessionToken: session.token, response: serializeCredential(credential) })
}

export const isCrmEndpointConfigured = Boolean(endpoint)
