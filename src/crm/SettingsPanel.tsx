import { useState } from 'react'
import { X } from 'lucide-react'
import { isCrmDemo } from './repository'

export function SettingsPanel({ close, stages, onSaveStages }: { close: () => void; stages: string[]; onSaveStages: (stages: string[]) => void }) {
  const endpoint = ((import.meta.env.VITE_CRM_ENDPOINT as string | undefined) || 'https://script.google.com/macros/s/AKfycbwhBycqlcQUB6SOYGVy2tPDJFk0-aT5vc--8YiFznpZslbpz_zrtgFBsumt7KnzPVhi/exec')
  const [stageText, setStageText] = useState(stages.join(', '))
  const saveStages = () => {
    const next = stageText.split(',').map(stage => stage.trim()).filter(Boolean).filter((stage, index, list) => list.indexOf(stage) === index)
    if (next.length) onSaveStages(next)
    close()
  }
  return <div className="crm-modal-backdrop" onClick={close}><div className="crm-modal crm-settings-modal" onClick={event => event.stopPropagation()}><div className="crm-drawer-header"><div><p className="crm-overline">Haus / CRM</p><h2>Configurações</h2></div><button className="crm-icon-button" onClick={close} aria-label="Fechar configurações"><X size={17} /></button></div><div className="crm-settings-list"><div><strong>Fonte de dados</strong><span>{isCrmDemo ? 'Modo demonstração local' : 'Google Apps Script conectado'}</span></div><div><strong>Endpoint</strong><span>{endpoint || 'VITE_CRM_ENDPOINT não configurado'}</span></div><div><strong>Etapas dos projetos</strong><span>Separe as etapas por vírgula. Elas aparecem nos filtros, no kanban e na edição.</span><input className="crm-settings-input" value={stageText} onChange={event => setStageText(event.target.value)} aria-label="Etapas dos projetos" /></div><div><strong>Próximo passo</strong><span>{isCrmDemo ? 'Configure o endpoint e recarregue o CRM para usar a planilha.' : 'O CRM está pronto para sincronizar com a planilha.'}</span></div></div><div className="crm-form-actions"><button className="crm-button secondary" onClick={close}>Cancelar</button><button className="crm-button primary" onClick={saveStages}>Salvar etapas</button></div></div></div>
}
