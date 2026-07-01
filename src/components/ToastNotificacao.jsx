import { useEffect } from 'react'
import { textoNotificacao } from '../lib/notificacaoTexto'

// Pop-up (toast) que aparece no canto quando chega uma notificacao em tempo
// real. Clicavel (abre a demanda) e some sozinho depois de alguns segundos.
export default function ToastNotificacao({ notificacao, aoAbrir, aoFechar }) {
  useEffect(() => {
    if (!notificacao) return
    const t = setTimeout(() => aoFechar(), 6000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notificacao?.id])

  if (!notificacao) return null
  const n = notificacao

  return (
    <div className="toast-notif" role="status">
      <button type="button" className="toast-corpo" onClick={() => aoAbrir(n)}>
        <span className="toast-icone">🔔</span>
        <div>
          <div className="toast-titulo">{textoNotificacao(n)}</div>
          <div className="sub">
            Demanda #{n.demanda_id}
            {n.demanda?.tipo_demanda?.nome
              ? ` — ${n.demanda.tipo_demanda.nome}`
              : ''}
            {' · '}
            {new Date(n.created_at).toLocaleString('pt-BR')}
          </div>
        </div>
      </button>
      <button
        type="button"
        className="toast-fechar"
        onClick={aoFechar}
        aria-label="Fechar"
      >
        ×
      </button>
    </div>
  )
}
