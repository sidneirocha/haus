import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, X } from 'lucide-react'

type Toast = { id: number; message: string; tone: 'success' | 'error' }
type ToastContextValue = { notify: (message: string, tone?: Toast['tone']) => void }
const ToastContext = createContext<ToastContextValue | null>(null)

export type ConfirmOptions = {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
}

type ConfirmContextValue = (options: ConfirmOptions) => Promise<boolean>
const ConfirmContext = createContext<ConfirmContextValue | null>(null)

export function announce(message: string, tone: Toast['tone'] = 'success') {
  window.dispatchEvent(new CustomEvent('crm-toast', { detail: { message, tone } }))
}

export function useToast() {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useToast precisa estar dentro de ToastProvider.')
  return value
}

export function Spinner({ label = 'Carregando' }: { label?: string }) {
  return <span className="crm-spinner" role="status" aria-label={label} />
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext)
  if (!confirm) throw new Error('useConfirm precisa estar dentro de ConfirmProvider.')
  return confirm
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((accepted: boolean) => void) | null>(null)

  const finish = (accepted: boolean) => {
    resolver.current?.(accepted)
    resolver.current = null
    setPending(null)
  }

  const confirm: ConfirmContextValue = options => new Promise(resolve => {
    if (resolver.current) resolver.current(false)
    resolver.current = resolve
    setPending(options)
  })

  useEffect(() => {
    if (!pending) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [pending])

  return <ConfirmContext.Provider value={confirm}>
    {children}
    {pending && <div className="crm-confirm-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) finish(false) }}>
      <section className="crm-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="crm-confirm-title" aria-describedby="crm-confirm-message">
        <div className="crm-confirm-icon"><AlertTriangle size={18} /></div>
        <h2 id="crm-confirm-title">{pending.title}</h2>
        <p id="crm-confirm-message">{pending.message}</p>
        <div className="crm-confirm-actions">
          <button className="crm-button secondary" type="button" onClick={() => finish(false)}>{pending.cancelLabel ?? 'Cancelar'}</button>
          <button className="crm-button danger" type="button" autoFocus onClick={() => finish(true)}>{pending.confirmLabel ?? 'Excluir'}</button>
        </div>
      </section>
    </div>}
  </ConfirmContext.Provider>
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const notify = (message: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random()
    setItems(current => [...current, { id, message, tone }].slice(-4))
    window.setTimeout(() => setItems(current => current.filter(item => item.id !== id)), 4200)
  }
  useEffect(() => {
    const onToast = (event: Event) => { const detail = (event as CustomEvent<{ message: string; tone?: Toast['tone'] }>).detail; if (detail?.message) notify(detail.message, detail.tone) }
    window.addEventListener('crm-toast', onToast)
    return () => window.removeEventListener('crm-toast', onToast)
  }, [])
  return <ToastContext.Provider value={{ notify }}>{children}<div className="crm-toasts" aria-live="polite">{items.map(item => <div className={`crm-toast ${item.tone}`} key={item.id}><span>{item.tone === 'success' ? <Check size={15} /> : <X size={15} />}</span>{item.message}</div>)}</div></ToastContext.Provider>
}
