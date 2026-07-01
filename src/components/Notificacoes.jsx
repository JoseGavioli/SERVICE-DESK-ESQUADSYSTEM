import { useState } from 'react'
import { textoNotificacao } from '../lib/notificacaoTexto'

// Tela de Notificacoes (aberta pelo sino do topo). Lista cronologica; cada
// item abre a demanda e marca como lida. Botoes para marcar todas como lidas
// e para LIMPAR (apagar) as proprias notificacoes, com confirmacao.

const TIPO_ICONE = {
  nova_demanda: '🆕',
  mudanca_status: '🔄',
  cancelamento_efetivado: '❌',
  novo_comentario: '💬',
  solicitacao_cancelamento: '⚠️',
}

export default function Notificacoes({
  notificacoes,
  aoAbrir,
  aoMarcarTodas,
  aoLimpar,
}) {
  const [confirmando, setConfirmando] = useState(false)
  const temNaoLida = notificacoes.some((n) => !n.lida)
  const temAlguma = notificacoes.length > 0

  return (
    <div className="bloco">
      <div className="cabecalho">
        <h2>Notificações</h2>
        <div className="acoes-notif">
          {temNaoLida && (
            <button type="button" className="link" onClick={aoMarcarTodas}>
              Marcar todas como lidas
            </button>
          )}
          {temAlguma && (
            <button
              type="button"
              className="link"
              onClick={() => setConfirmando(true)}
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {confirmando && (
        <div className="confirmar-limpar">
          <p>
            Apagar <strong>todas as suas</strong> notificações? Isso vale só para
            você e não pode ser desfeito.
          </p>
          <div className="acoes">
            <button
              type="button"
              className="perigo"
              onClick={() => {
                aoLimpar()
                setConfirmando(false)
              }}
            >
              Sim, limpar
            </button>
            <button
              type="button"
              className="link"
              onClick={() => setConfirmando(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {notificacoes.length === 0 ? (
        <p className="vazio">Nenhuma notificação por enquanto.</p>
      ) : (
        <ul className="lista-notif">
          {notificacoes.map((n) => (
            <li key={n.id} className={n.lida ? '' : 'nao-lida'}>
              <button
                type="button"
                className="notif-link"
                onClick={() => aoAbrir(n)}
                title="Abrir a demanda"
              >
                <span className="notif-icone">{TIPO_ICONE[n.tipo] ?? '🔔'}</span>
                <div>
                  <div className="notif-titulo">{textoNotificacao(n)}</div>
                  <div className="sub">
                    Demanda <strong>#{n.demanda_id}</strong>
                    {n.demanda?.tipo_demanda?.nome
                      ? ` — ${n.demanda.tipo_demanda.nome}`
                      : ''}
                    {' · '}
                    {new Date(n.created_at).toLocaleString('pt-BR')}
                  </div>
                </div>
                {!n.lida && (
                  <span className="ponto-nao-lida" aria-hidden="true" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
