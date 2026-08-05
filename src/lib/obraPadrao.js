import { supabase } from './supabase'

// Acha (ou cria) a obra padrao "Obra de {cliente}" quando nenhuma foi
// escolhida (§decisao da Fase 2 original). Roda sob a RLS do usuario logado
// (que ja pode criar obras). Era um helper interno da Nova demanda; virou
// compartilhado quando a FICHA de fechamento (§#80) passou a precisar do
// mesmo achar-ou-criar. Retorna o id da obra, ou null em caso de erro.
export async function obterOuCriarObraPadrao(cliente) {
  const nome = `Obra de ${cliente.nome}`
  const { data: existente } = await supabase
    .from('obra')
    .select('id')
    .eq('cliente_id', cliente.id)
    .eq('nome', nome)
    .limit(1)
    .maybeSingle()
  if (existente) return existente.id

  const { data: nova, error } = await supabase
    .from('obra')
    .insert({ cliente_id: cliente.id, nome })
    .select('id')
    .single()
  if (error) return null
  return nova.id
}
