import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { STATUS_ROTULO } from '../lib/status'

// Tela inicial: boas-vindas + quantas demandas o usuario tem em aberto +
// as notificacoes (mudancas de status nao vistas, mais recentes primeiro).
export default function Inicio({ perfil }) {
  const [emAberto, setEmAberto] = useState(null)
  const [notificacoes, setNotificacoes] = useState([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function carregar() {
      // Demandas do usuario que NAO estao em estado terminal.
      const { count } = await supabase
        .from('demanda')
        .select('id', { count: 'exact', head: true })
        .eq('vendedor_id', perfil.id)
        .not('status', 'in', '(enviado,cancelada)')
      setEmAberto(count ?? 0)

      const { data } = await supabase.rpc('notificacoes')
      if (data) setNotificacoes(data)
      setCarregando(false)
    }
    carregar()
  }, [perfil.id])

  return (
    <div className="bloco">
      <h1>Bem-vindo 👋</h1>
      <p>
        Olá, <strong>{perfil.nome_completo}</strong>!
      </p>

      {emAberto !== null && (
        <p className="resumo-aberto">
          {emAberto === 0 ? (
            'Você não possui demandas em aberto no momento.'
          ) : (
            <>
              Você possui <strong>{emAberto}</strong> demanda
              {emAberto > 1 ? 's' : ''} em aberto — consulte-as na tela de{' '}
              <strong>Demandas</strong>.
            </>
          )}
        </p>
      )}

      <div className="notificacoes-inicio">
        <h3>Notificações</h3>
        {carregando ? (
          <p className="dica">Carregando…</p>
        ) : notificacoes.length === 0 ? (
          <p className="dica">Nenhuma novidade por enquanto.</p>
        ) : (
          <ul className="lista-notif">
            {notificacoes.map((n) => (
              <li key={n.historico_id}>
                <span className={`status status-${n.para_status}`}>
                  {STATUS_ROTULO[n.para_status]}
                </span>
                <div>
                  <div>
                    Demanda <strong>#{n.demanda_id}</strong> —{' '}
                    {STATUS_ROTULO[n.de_status]} → {STATUS_ROTULO[n.para_status]}
                  </div>
                  <div className="sub">
                    por {n.autor_nome} ·{' '}
                    {new Date(n.quando).toLocaleString('pt-BR')}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
