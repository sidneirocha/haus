import { useEffect, useState } from 'react'
import type { ReactNode, FormEvent } from 'react'
import { ArrowLeft, Eye, EyeOff, LockKeyhole, LogIn } from 'lucide-react'
import { clearCrmSession, getCrmSession, isCrmEndpointConfigured, loginCrm, subscribeCrmAuth } from './auth'
import './crm.css'

const path = (value: string) => `${import.meta.env.BASE_URL}${value.replace(/^\//, '')}`

export function CrmLogin() {
  const [email, setEmail] = useState('')
  const [adminKey, setAdminKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    setError('')
    setBusy(true)
    try {
      await loginCrm(email, adminKey)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível entrar no CRM.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="crm-auth-page">
    <div className="crm-auth-grid" />
    <section className="crm-auth-shell" aria-labelledby="crm-login-title">
      <div className="crm-auth-brand"><img src={path('/brand/logo-dark.svg')} alt="Haus" /><span>CRM</span></div>
      <div className="crm-auth-card">
        <div className="crm-auth-icon"><LockKeyhole size={19} /></div>
        <p className="crm-overline">Haus / acesso restrito</p>
        <h1 id="crm-login-title">Entrar no CRM</h1>
        <p className="crm-auth-intro">Use as credenciais administrativas configuradas no Apps Script.</p>
        <form className="crm-auth-form" onSubmit={submit}>
          <label className="crm-field"><span>E-mail administrativo</span><input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="username" placeholder="admin@empresa.com" required /></label>
          <label className="crm-field"><span>Chave administrativa</span><div className="crm-auth-password"><input type={showKey ? 'text' : 'password'} value={adminKey} onChange={event => setAdminKey(event.target.value)} autoComplete="current-password" placeholder="Sua chave do Apps Script" required /><button type="button" onClick={() => setShowKey(value => !value)} aria-label={showKey ? 'Ocultar chave' : 'Mostrar chave'}>{showKey ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
          {!isCrmEndpointConfigured && <p className="crm-auth-note">Modo local: configure <code>VITE_CRM_ENDPOINT</code> com a URL implantada do Apps Script para validar o login real.</p>}
          {error && <p className="crm-auth-error" role="alert">{error}</p>}
          <button className="crm-button primary crm-auth-submit" type="submit" disabled={busy}>{busy ? 'Validando…' : <><LogIn size={16} />Entrar no CRM</>}</button>
        </form>
        <p className="crm-auth-security">A sessão é temporária e a chave não fica armazenada no navegador.</p>
      </div>
      <a className="crm-auth-back" href={path('/')}><ArrowLeft size={15} />Voltar ao site</a>
    </section>
  </main>
}

export function CrmAuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState(getCrmSession)
  useEffect(() => subscribeCrmAuth(() => setSession(getCrmSession())), [])
  return session ? <>{children}</> : <CrmLogin />
}

export function CrmLogoutButton({ onLogout }: { onLogout?: () => void }) {
  return <button type="button" onClick={() => { clearCrmSession(); onLogout?.() }}>Sair</button>
}
