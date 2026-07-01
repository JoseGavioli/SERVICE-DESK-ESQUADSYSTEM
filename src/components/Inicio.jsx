import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { STATUS_ROTULO } from '../lib/status'

// Ordem em que os status "em aberto" (nao terminais) aparecem na quebra.
const STATUS_ABERTOS = [
  'nao_iniciado',
  'em_andamento',
  'congelado',
  'em_revisao_custo',
  'concluido',
]

// Tela inicial: boas-vindas + demandas em aberto (total e por status),
// atualizado em TEMPO REAL. As notificacoes ficam no sino do topo.
//
// O total NAO filtra por vendedor_id de proposito: a RLS ja decide o que
// cada um ve (vendedor = as proprias; admin/atendente = todas).
export default function Inicio({ perfil }) {
  const [emAberto, setEmAberto] = useState(null) // { total, porStatus }

  const carregar = useCallback(async () => {
    const { data: abertas } = await supabase
      .from('demanda')
      .select('status')
      .not('status', 'in', '(enviado,cancelada)')
    const porStatus = {}
    for (const d of abertas ?? []) {
      porStatus[d.status] = (porStatus[d.status] ?? 0) + 1
    }
    setEmAberto({ total: abertas?.length ?? 0, porStatus })
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  // Tempo real: qualquer mudanca em demandas visiveis re-conta o resumo.
  useEffect(() => {
    const canal = supabase
      .channel('inicio-demandas')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'demanda' },
        () => carregar(),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [carregar])

  return (
    <div className="bloco">
      <h1>Bem-vindo 👋</h1>
      <p>
        Olá, <strong>{perfil.nome_completo}</strong>!
      </p>

      {emAberto !== null && (
        <div className="resumo-aberto">
          {emAberto.total === 0 ? (
            'Você não possui demandas em aberto no momento.'
          ) : (
            <>
              <p className="resumo-titulo">
                Você possui <strong>{emAberto.total}</strong> demanda
                {emAberto.total > 1 ? 's' : ''} em aberto — consulte-as na tela
                de <strong>Demandas</strong>.
              </p>
              <ul className="resumo-status">
                {STATUS_ABERTOS.filter((s) => emAberto.porStatus[s]).map((s) => (
                  <li key={s}>
                    <span className={`status status-${s}`}>
                      {STATUS_ROTULO[s]}
                    </span>
                    <strong>{emAberto.porStatus[s]}</strong>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}
