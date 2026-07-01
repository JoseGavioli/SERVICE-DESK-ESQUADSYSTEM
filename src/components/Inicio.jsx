import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { STATUS_ROTULO } from '../lib/status'

// Ordem das boxes de status na Inicio. "concluido" fica de fora (legado).
const STATUS_ORDEM = [
  'nao_iniciado',
  'em_andamento',
  'congelado',
  'em_revisao_custo',
  'enviado',
  'cancelada',
]

// Status terminais: NAO entram no total da box "DEMANDAS" (mas tem box propria).
const TERMINAIS = ['enviado', 'cancelada']

// Tela inicial: um "painel" de boxes clicaveis, em tempo real.
//  - Botao "incluir nova demanda": abre o formulario de nova demanda.
//  - Box "DEMANDAS": total das EM ABERTO (sem terminais) -> abre Demandas "só ativas".
//  - Uma box por status (com a cor do status) -> abre Demandas filtrada por
//    aquele status, ordenada pela mais urgente primeiro.
// A RLS decide o que cada um ve (vendedor = as proprias; staff = todas).
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
        <>
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
                  className="box-inicio"
                  style={{ borderLeftColor: `var(--st-${s}-fg)` }}
                  onClick={() => aoAbrirComFiltro({ status: s, ordenar: true })}
                >
                  <span
                    className="box-titulo"
                    style={{ color: `var(--st-${s}-fg)` }}
                  >
                    {tituloBox(s)}
                  </span>
                  <span className="box-numero">{dados.contagem[s]}</span>
                  <span className="box-hint">toque para ver</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
