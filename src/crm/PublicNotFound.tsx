import { ArrowLeft, RefreshCw } from 'lucide-react'

type PublicNotFoundProps = {
  kind: 'orçamento' | 'contrato'
  onRetry?: () => void
}

const path = (value: string) => `${import.meta.env.BASE_URL}${value.replace(/^\//, '')}`

export function PublicLoading({ label = 'Carregando proposta…' }: { label?: string }) {
  return <main className="crm-public-loading" aria-live="polite">
    <div className="crm-public-loader-mark"><img src={path('/brand/logo-dark.svg')} alt="Haus" /><span /></div>
    <strong>{label}</strong>
    <small>Um instante.</small>
  </main>
}

export function PublicNotFound({ kind, onRetry }: PublicNotFoundProps) {
  const label = kind === 'orçamento' ? 'Este orçamento' : 'Este contrato'

  return <main className="crm-public-page crm-not-found-page">
    <section className="crm-public-shell crm-not-found-shell" aria-labelledby="public-not-found-title">
      <header className="crm-not-found-header">
        <img className="crm-public-header-logo" src={path('/brand/logo-dark.svg')} alt="Haus" />
        <span className="crm-not-found-kicker">Haus / acesso público</span>
      </header>
      <div className="crm-not-found-body">
        <div className="crm-not-found-mark" aria-hidden="true"><span>404</span><i /><i /><i /></div>
        <p className="crm-overline">Link indisponível</p>
        <h1 id="public-not-found-title">{label} não está disponível</h1>
        <p className="crm-not-found-copy">O link pode estar incorreto, expirado ou ter sido removido. Confira o endereço ou peça um novo envio à Haus.</p>
        <div className="crm-not-found-actions">
          <a className="crm-button primary" href={path('/')}><ArrowLeft size={15} />Voltar ao início</a>
          {onRetry && <button className="crm-button secondary" type="button" onClick={onRetry}><RefreshCw size={15} />Tentar novamente</button>}
        </div>
      </div>
      <footer><span>haus.art.br</span><span>art &amp; tech</span></footer>
    </section>
  </main>
}
