import { useState } from 'react'
import { textoNotificacao } from '../lib/notificacaoTexto'
import EstadoVazio from './EstadoVazio'

// Drawer de Notificacoes: desliza da DIREITA (aberto pelo sino do topo), com
// backdrop escurecido atras — mesmo padrao do menu lateral (que vem da esquerda).
// Lista cronologica; cada item abre a demanda e marca como lida. Botoes para
// marcar todas como lidas e para LIMPAR (apagar) as proprias, com confirmacao.

const TIPO_ICONE = {
  nova_demanda: '🆕',
  mudanca_status: '🔄',
  cancelamento_efetivado: '❌',
  novo_comentario: '💬',
  solicitacao_cancelamento: '⚠️',
  prazo_proximo: '⏰',
  prazo_vencido: '⏰',
  custo_atrasado: '⏰',
}

export default function Notificacoes({
  aberto,
  aoFechar,
  notificacoes,
  aoAbrir,
  aoMarcarTodas,
  aoLimpar,
}) {
  const [confirmando, setConfirmando] = useState(false)
  const temNaoLida = notificacoes.some((n) => !n.lida)
  const temAlguma = notificacoes.length > 0

  return (
    <>
      <div
        className={`menu-backdrop ${aberto ? 'aberto' : ''}`}
        onClick={aoFechar}
        aria-hidden="true"
      />
      <aside className={`drawer-notif ${aberto ? 'aberto' : ''}`} aria-label="Notificações">
        <div className="drawer-notif-topo">
          <strong>Notificações</strong>
          <button
            type="button"
            className="fechar-drawer"
            onClick={aoFechar}
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {temAlguma && (
          <div className="acoes-notif">
            {temNaoLida && (
              <button type="button" className="link" onClick={aoMarcarTodas}>
                Marcar todas como lidas
              </button>
            )}
            <button
              type="button"
              className="link"
              onClick={() => setConfirmando(true)}
            >
              Limpar
            </button>
          </div>
        )}

        {confirmando && (
          <div className="confirmar-limpar">
            <p>
              Apagar <strong>todas as suas</strong> notificações? Isso vale só
              para você e não pode ser desfeito.
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
          <EstadoVazio
            icone="🔔"
            titulo="Tudo em dia"
            dica="Nenhuma notificação por enquanto."
          />
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
                  {!n.lida && <span className="ponto-nao-lida" aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </>
  )
}
