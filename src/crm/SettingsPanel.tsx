import { useState } from 'react'
import { X } from 'lucide-react'
import { isCrmDemo } from './repository'
import type { CompanySettings } from './types'

export function SettingsPanel({ close, stages, companySettings, onSaveStages, onSaveCompanySettings }: { close: () => void; stages: string[]; companySettings: CompanySettings; onSaveStages: (stages: string[]) => void; onSaveCompanySettings: (settings: CompanySettings) => Promise<void> }) {
  const endpoint = ((import.meta.env.VITE_CRM_ENDPOINT as string | undefined) || 'https://script.google.com/macros/s/AKfycbwhBycqlcQUB6SOYGVy2tPDJFk0-aT5vc--8YiFznpZslbpz_zrtgFBsumt7KnzPVhi/exec')
  const [stageText, setStageText] = useState(stages.join(', '))
  const [form, setForm] = useState(companySettings)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const update = (key: keyof CompanySettings, value: string) => setForm(current => ({ ...current, [key]: value }))
  const save = async () => {
    const nextStages = stageText.split(',').map(stage => stage.trim()).filter(Boolean).filter((stage, index, list) => list.indexOf(stage) === index)
    if (!nextStages.length) return
    setBusy(true)
    setError('')
    try {
      onSaveStages(nextStages)
      await onSaveCompanySettings(form)
      close()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar as configurações.')
    } finally { setBusy(false) }
  }
  return <div className="crm-modal-backdrop" onClick={close}><div className="crm-modal crm-settings-modal" onClick={event => event.stopPropagation()}><div className="crm-drawer-header"><div><p className="crm-overline">Haus / CRM</p><h2>Configurações</h2></div><button className="crm-icon-button" onClick={close} aria-label="Fechar configurações"><X size={17} /></button></div><div className="crm-settings-list"><div><strong>Fonte de dados</strong><span>{isCrmDemo ? 'Modo demonstração local' : 'Google Apps Script conectado'}</span></div><div><strong>Endpoint</strong><span>{endpoint}</span></div><div><strong>Planilha de dados</strong><span>Link interno para a planilha usada pelo CRM.</span>{form.spreadsheetUrl ? <a className="crm-settings-link" href={form.spreadsheetUrl} target="_blank" rel="noreferrer">Abrir planilha ↗</a> : <small>Adicione o link abaixo.</small>}<input className="crm-settings-input" value={form.spreadsheetUrl} onChange={event => update('spreadsheetUrl', event.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." aria-label="Link da planilha" /></div><div><strong>Dados da Haus</strong><span>Usados na identificação da contratada nos novos contratos.</span><div className="crm-settings-grid"><label className="crm-field"><span>Nome fantasia</span><input value={form.tradeName} onChange={event => update('tradeName', event.target.value)} /></label><label className="crm-field"><span>Razão social</span><input value={form.legalName} onChange={event => update('legalName', event.target.value)} /></label><label className="crm-field"><span>CNPJ</span><input value={form.cnpj} onChange={event => update('cnpj', event.target.value)} /></label><label className="crm-field"><span>Representante</span><input value={form.representative} onChange={event => update('representative', event.target.value)} /></label><label className="crm-field crm-settings-full"><span>Endereço</span><textarea value={form.address} onChange={event => update('address', event.target.value)} /></label></div></div><div><strong>Etapas dos projetos</strong><span>Separe as etapas por vírgula.</span><input className="crm-settings-input" value={stageText} onChange={event => setStageText(event.target.value)} aria-label="Etapas dos projetos" /></div>{error && <p className="crm-form-error" role="alert">{error}</p>}<div><strong>Próximo passo</strong><span>{isCrmDemo ? 'Configure o endpoint e recarregue o CRM para usar a planilha.' : 'O CRM está pronto para sincronizar com a planilha.'}</span></div></div><div className="crm-form-actions"><button className="crm-button secondary" onClick={close} disabled={busy}>Cancelar</button><button className="crm-button primary" onClick={() => void save()} disabled={busy}>{busy ? 'Salvando…' : 'Salvar configurações'}</button></div></div></div>
}
