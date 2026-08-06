import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { todasAsLinhas } from './paginacao'
import { urgenciaEfetiva, estaCustoAtrasado } from './urgencia'

// Contadores dos recortes do menu lateral DESKTOP (§#83, B2): "Em aberto" e
// "Atencao", com a MESMA regua do resto do app — atencao = prazo vencido OU
// custo atrasado OU cancelamento solicitado, calculada por lib/urgencia
// (fonte unica; nada de copia da regra). Busca as abertas em paginas
// (lib/paginacao, §#77) e escuta a tabela `demanda` em tempo real. A RLS
// decide o escopo de graca: vendedor conta as DELE, staff conta tudo.
const ABERTOS = [
  'nao_iniciado',
  'em_andamento',
  'congelado',
  'em_revisao_custo',
  'concluido',
]

export function useContadoresLista(perfil) {
  // null = ainda carregando (o menu esconde o numero em vez de mostrar 0).
  const [contadores, setContadores] = useState({ emAberto: null, atencao: null })

  useEffect(() => {
    if (!perfil?.id) return
    let vivo = true

    async function carregar() {
      const { data: abertas } = await todasAsLinhas((de, ate) =>
        supabase
          .from('demanda')
          .select('id, status, prazo, urgencia_manual, cancelamento_solicitado')
          .in('status', ABERTOS)
          .order('id')
          .range(de, ate),
      )
      if (!vivo || !abertas) return

      // Custo atrasado precisa da 1a entrada em revisao — so das que ESTAO la
      // (RPC filtrada, mesma disciplina do Dashboard §#77).
      const idsEmRevisao = abertas
        .filter((d) => d.status === 'em_revisao_custo')
        .map((d) => d.id)
      const rev = {}
      if (idsEmRevisao.length) {
        const { data: revs } = await supabase
          .rpc('datas_primeira_revisao')
          .in('demanda_id', idsEmRevisao)
        if (!vivo) return
        for (const r of revs ?? []) rev[r.demanda_id] = r.data
      }

      let atencao = 0
      for (const d of abertas) {
        const u = urgenciaEfetiva(d)
        if (
          u?.nivel === 'atrasado' ||
          estaCustoAtrasado(d.status, rev[d.id]) ||
          d.cancelamento_solicitado
        ) {
          atencao += 1
        }
      }
      setContadores({ emAberto: abertas.length, atencao })
    }
    carregar()

    // Tempo real: qualquer mudanca em demanda recalcula (mesmo padrao do
    // Dashboard). Canal proprio para nao disputar com o dele.
    const canal = supabase
      .channel('contadores-menu-desktop')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'demanda' },
        () => carregar(),
      )
      .subscribe()

    return () => {
      vivo = false
      supabase.removeChannel(canal)
    }
  }, [perfil?.id])

  return contadores
}
