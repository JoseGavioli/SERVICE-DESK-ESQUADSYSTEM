// Busca TODAS as paginas de uma consulta (§Bloco C, issues #77/#78).
//
// O PostgREST corta QUALQUER resposta em ~1000 linhas — inclusive resultado de
// funcao (RPC). Uma tela que busca "tudo" numa query so passa a SUBCONTAR em
// silencio quando os dados crescem alem do corte. Este helper busca em paginas
// ate acabar, e e usado pelo Dashboard e pela lista de Demandas.
//
// `montar(de, ate)` recebe os indices da pagina e deve devolver a consulta JA
// com filtros e `.order()` — sem order a paginacao nao e estavel (o banco
// poderia repetir/pular linhas entre paginas).
//
// ATENCAO: "pagina menor que PAGINA" = acabou. Isso assume PAGINA <= max-rows
// do PostgREST (default 1000). Se um dia o max-rows do projeto for REDUZIDO,
// baixe PAGINA junto — senao toda pagina volta "curta" e o loop para na
// primeira, subcontando de novo.
export const PAGINA = 1000

// Devolve { data, error } no mesmo formato do supabase-js: qualquer pagina com
// erro falha o todo (data: null) — parcial silencioso e exatamente o bug que
// este helper existe para evitar.
//
// O teto de 100 paginas (100 mil linhas) e um para-choque contra loop infinito
// se `montar` esquecer o `.range()` (ai toda "pagina" voltaria cheia e igual).
// Nenhuma tela real chega perto disso.
export async function todasAsLinhas(montar) {
  const linhas = []
  for (let de = 0; de < 100 * PAGINA; de += PAGINA) {
    const { data, error } = await montar(de, de + PAGINA - 1)
    if (error) return { data: null, error }
    linhas.push(...(data ?? []))
    if (!data || data.length < PAGINA) break
  }
  return { data: linhas, error: null }
}
