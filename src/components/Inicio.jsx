import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { STATUS_ROTULO } from '../lib/status'

// Ordem das boxes de status no dashboard. "concluido" fica de fora (legado).
const STATUS_ORDEM = [
  'nao_iniciado',
  'em_andamento',
  'congelado',
  'em_revisao_custo',
  'enviado',
  'cancelada',
]

// Status terminais: NAO entram no total da box "DEMANDAS EM ABERTO".
const TERMINAIS = ['enviado', 'cancelada']

// Tela inicial: botoes de acao + um "Dashboard" (boxes clicaveis, em tempo real).
//  - "incluir nova demanda": abre o form de nova demanda.
//  - Dashboard: box "DEMANDAS EM ABERTO" (total sem terminais) + uma box por
//    status (fundo na cor do status), cada uma abrindo Demandas ja filtrada.
export default function Inicio({ perfil, aoAbrirComFiltro, aoNovaDemanda }) {
  const [dados, setDados] = useState(null) // { emAberto, contagem }

  const carregar = useCallback(async () => {
    const { data } = await supabase.from('demanda').select('status')
    const contagem = {}
    for (const d of data ?? []) {
      contagem[d.status] = (contagem[d.status] ?? 0) + 1
    }
    const emAberto = (data ?? []).filter(
      (d) => !TERMINAIS.includes(d.status),
    ).length
    setDados({ emAberto, contagem })
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  // Tempo real: qualquer mudanca em demandas visiveis recalcula as boxes.
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

  // Para o VENDEDOR, "Enviado" aparece como "Recebido" (ponto de vista dele).
  function tituloBox(s) {
    if (s === 'enviado' && perfil.papel === 'vendedor') return 'Recebido'
    return STATUS_ROTULO[s]
  }

  const visiveis = dados
    ? STATUS_ORDEM.filter((s) => dados.contagem[s] > 0)
    : []

  return (
    <div className="bloco">
      <p className="saudacao">
        Olá, <strong>{perfil.nome_completo}</strong> 👋
      </p>

      <button
        type="button"
        className="box-inicio box-novo"
        onClick={aoNovaDemanda}
      >
        <span className="box-novo-mais" aria-hidden="true">
          +
        </span>
        <span className="box-novo-texto">incluir nova demanda</span>
      </button>

      {dados && (
        <div className="dashboard">
          <h2 className="dashboard-titulo">Dashboard</h2>

          <button
            type="button"
            className="box-inicio box-total"
            onClick={() => aoAbrirComFiltro({ soAtivas: true })}
          >
            <span className="box-titulo">DEMANDAS EM ABERTO</span>
            <span className="box-numero">{dados.emAberto}</span>
            <span className="box-hint">toque para ver</span>
          </button>

          {visiveis.length > 0 && (
            <div className="grade-status">
              {visiveis.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="box-inicio box-status-cor"
                  style={{
                    '--c': `var(--st-${s}-fg)`,
                    '--cbg': `var(--st-${s}-bg)`,
                  }}
                  onClick={() =>
                    aoAbrirComFiltro(
                      s === 'enviado'
                        ? { status: s, ordenarRecente: true }
                        : { status: s, ordenar: true },
                    )
                  }
                >
                  <span className="box-titulo">{tituloBox(s)}</span>
                  <span className="box-numero">{dados.contagem[s]}</span>
                  <span className="box-hint">toque para ver</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
