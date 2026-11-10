import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server'

type Env = {
  ASSETS: Fetcher
  WEBAUTHN_KV?: KVNamespace
  CRM_ENDPOINT?: string
  ADMIN_EMAIL?: string
  ADMIN_KEY?: string
  RP_ID?: string
  ORIGIN?: string
}

type StoredCredential = {
  id: string
  publicKey: string
  counter: number
  transports?: string[]
  email: string
}

type ChallengeRecord = {
  challenge: string
  email: string
  sessionToken?: string
  createdAt: number
}

const CHALLENGE_TTL = 300

const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Não foi possível concluir a autenticação.'

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach(byte => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBytes(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4)
  const binary = atob(padded)
  return Uint8Array.from(binary, character => character.charCodeAt(0))
}

function json(data: unknown, status = 200, request?: Request, env?: Env) {
  const origin = request?.headers.get('Origin')
  const allowedOrigin = env?.ORIGIN || 'https://haus.art.br'
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  if (origin && origin === allowedOrigin) {
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Access-Control-Allow-Credentials', 'true')
    headers.set('Vary', 'Origin')
  }
  return new Response(JSON.stringify(data), { status, headers })
}

function requireConfig(env: Env) {
  if (!env.WEBAUTHN_KV) throw new Error('WEBAUTHN_KV não está configurado no Worker.')
  if (!env.RP_ID || !env.ORIGIN) throw new Error('RP_ID e ORIGIN não estão configurados no Worker.')
  return { kv: env.WEBAUTHN_KV, rpID: env.RP_ID, origin: env.ORIGIN }
}

async function readBody(request: Request) {
  try { return await request.json() as Record<string, unknown> } catch { throw new Error('Corpo da requisição inválido.') }
}

async function crmRequest(env: Env, action: string, payload: Record<string, unknown>) {
  if (!env.CRM_ENDPOINT) throw new Error('CRM_ENDPOINT não está configurado no Worker.')
  const url = new URL(env.CRM_ENDPOINT)
  url.searchParams.set('action', action)
  url.searchParams.set('payload', JSON.stringify({ action, ...payload }))
  const response = await fetch(url)
  const body = await response.json() as { ok?: boolean; data?: Record<string, unknown>; error?: string }
  if (!response.ok || !body.ok || !body.data) throw new Error(body.error || 'Não foi possível validar a sessão do CRM.')
  return body.data
}

async function getCredentialIds(kv: KVNamespace, email: string) {
  return await kv.get<string[]>(`user:${email}`, 'json') || []
}

async function getCredentials(kv: KVNamespace, email: string) {
  const ids = await getCredentialIds(kv, email)
  const credentials = await Promise.all(ids.map(id => kv.get<StoredCredential>(`credential:${id}`, 'json')))
  return credentials.filter((credential): credential is StoredCredential => Boolean(credential))
}

async function saveCredential(kv: KVNamespace, credential: StoredCredential) {
  const ids = await getCredentialIds(kv, credential.email)
  const nextIds = ids.includes(credential.id) ? ids : [...ids, credential.id]
  await Promise.all([
    kv.put(`credential:${credential.id}`, JSON.stringify(credential)),
    kv.put(`user:${credential.email}`, JSON.stringify(nextIds)),
  ])
}

async function createChallenge(kv: KVNamespace, record: ChallengeRecord) {
  const key = `challenge:${record.challenge}`
  await kv.put(key, JSON.stringify(record), { expirationTtl: CHALLENGE_TTL })
  return key
}

async function consumeChallenge(kv: KVNamespace, challenge: string, type: 'register' | 'login') {
  const key = `challenge:${challenge}`
  const record = await kv.get<ChallengeRecord>(key, 'json')
  await kv.delete(key)
  if (!record || Date.now() - record.createdAt > CHALLENGE_TTL * 1000) throw new Error('Desafio expirado. Tente novamente.')
  if ((type === 'register') !== Boolean(record.sessionToken)) throw new Error('Desafio inválido.')
  return record
}

async function registerOptions(request: Request, env: Env) {
  const config = requireConfig(env)
  const body = await readBody(request)
  const sessionToken = String(body.sessionToken || '')
  if (!sessionToken) throw new Error('Sessão do CRM obrigatória.')
  const session = await crmRequest(env, 'auth.session', { sessionToken })
  const email = String(session.email || '').toLowerCase()
  const credentials = await getCredentials(config.kv, email)
  const userID = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email)))
  const options = await generateRegistrationOptions({
    rpName: 'Haus CRM',
    rpID: config.rpID,
    userName: email,
    userID,
    excludeCredentials: credentials.map(credential => ({ id: credential.id, transports: credential.transports as AuthenticatorTransport[] | undefined })),
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
  })
  await createChallenge(config.kv, { challenge: options.challenge, email, sessionToken, createdAt: Date.now() })
  return json({ ok: true, data: options }, 200, request, env)
}

async function registerVerify(request: Request, env: Env) {
  const config = requireConfig(env)
  const body = await readBody(request)
  const response = body.response
  if (!response || typeof response !== 'object') throw new Error('Resposta WebAuthn ausente.')
  const sessionToken = String(body.sessionToken || '')
  const session = await crmRequest(env, 'auth.session', { sessionToken })
  let challengeRecord: ChallengeRecord | null = null
  const verification = await verifyRegistrationResponse({
    response: response as Parameters<typeof verifyRegistrationResponse>[0]['response'],
    expectedChallenge: async challenge => {
      challengeRecord = await config.kv.get<ChallengeRecord>(`challenge:${challenge}`, 'json')
      return Boolean(challengeRecord && challengeRecord.sessionToken === sessionToken)
    },
    expectedOrigin: config.origin,
    expectedRPID: config.rpID,
    requireUserVerification: true,
  })
  if (!verification.verified || !verification.registrationInfo) throw new Error('Não foi possível validar a passkey.')
  if (!challengeRecord) throw new Error('Desafio de registro inválido.')
  await config.kv.delete(`challenge:${challengeRecord.challenge}`)
  const credential = verification.registrationInfo.credential
  await saveCredential(config.kv, {
    id: credential.id,
    publicKey: bytesToBase64Url(credential.publicKey),
    counter: credential.counter,
    transports: credential.transports,
    email: String(session.email || '').toLowerCase(),
  })
  return json({ ok: true, data: { registered: true } }, 200, request, env)
}

async function loginOptions(request: Request, env: Env) {
  const config = requireConfig(env)
  const body = await readBody(request)
  const email = String(body.email || '').trim().toLowerCase()
  if (!email) throw new Error('Informe o e-mail administrativo para usar a biometria.')
  const credentials = await getCredentials(config.kv, email)
  if (!credentials.length) throw new Error('Nenhuma passkey cadastrada para este e-mail.')
  const options = await generateAuthenticationOptions({
    rpID: config.rpID,
    allowCredentials: credentials.map(credential => ({ id: credential.id, transports: credential.transports as AuthenticatorTransport[] | undefined })),
    userVerification: 'required',
  })
  await createChallenge(config.kv, { challenge: options.challenge, email, createdAt: Date.now() })
  return json({ ok: true, data: options }, 200, request, env)
}

async function loginVerify(request: Request, env: Env) {
  const config = requireConfig(env)
  const body = await readBody(request)
  const response = body.response
  if (!response || typeof response !== 'object') throw new Error('Resposta WebAuthn ausente.')
  const credentialId = String((response as { id?: string }).id || '')
  const allCredentials = await getCredentials(config.kv, String(body.email || '').trim().toLowerCase())
  const stored = allCredentials.find(credential => credential.id === credentialId)
  if (!stored) throw new Error('Passkey não encontrada.')
  const challenge = String(body.challenge || '')
  const record = await consumeChallenge(config.kv, challenge, 'login')
  const verification = await verifyAuthenticationResponse({
    response: response as Parameters<typeof verifyAuthenticationResponse>[0]['response'],
    expectedChallenge: record.challenge,
    expectedOrigin: config.origin,
    expectedRPID: config.rpID,
    credential: {
      id: stored.id,
      publicKey: base64UrlToBytes(stored.publicKey),
      counter: stored.counter,
      transports: stored.transports as AuthenticatorTransport[] | undefined,
    },
    requireUserVerification: true,
  })
  if (!verification.verified) throw new Error('Biometria não validada.')
  const updated = { ...stored, counter: verification.authenticationInfo.newCounter }
  await config.kv.put(`credential:${stored.id}`, JSON.stringify(updated))
  const session = await crmRequest(env, 'auth.login', { email: record.email, adminKey: env.ADMIN_KEY || '' })
  return json({ ok: true, data: session }, 200, request, env)
}

async function handleApi(request: Request, env: Env) {
  const path = new URL(request.url).pathname
  if (request.method === 'OPTIONS') {
    const response = new Response(null, { status: 204 })
    const origin = request.headers.get('Origin')
    if (origin === env.ORIGIN) {
      response.headers.set('Access-Control-Allow-Origin', origin)
      response.headers.set('Access-Control-Allow-Credentials', 'true')
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Haus-Session')
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    }
    return response
  }
  if (request.method === 'GET' && path === '/api/webauthn/health') return json({ ok: true, data: { service: 'haus-webauthn' } }, 200, request, env)
  if (request.method !== 'POST') return json({ ok: false, error: 'Método não permitido.' }, 405, request, env)
  if (path === '/api/webauthn/register/options') return registerOptions(request, env)
  if (path === '/api/webauthn/register/verify') return registerVerify(request, env)
  if (path === '/api/webauthn/login/options') return loginOptions(request, env)
  if (path === '/api/webauthn/login/verify') return loginVerify(request, env)
  return json({ ok: false, error: 'Rota não encontrada.' }, 404, request, env)
}

export default {
  async fetch(request: Request, env: Env) {
    if (new URL(request.url).pathname.startsWith('/api/webauthn/')) {
      try { return await handleApi(request, env) } catch (error) { return json({ ok: false, error: errorMessage(error) }, 400, request, env) }
    }
    return env.ASSETS.fetch(request)
  },
}
