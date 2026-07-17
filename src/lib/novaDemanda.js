// Regras e formatacoes da tela "Nova demanda" (§issue #64). Ficam aqui, fora do
// componente, porque sao funcoes PURAS: entram valores, sai um resultado. Da
// para ler (e conferir) a regra inteira sem passar por JSX nenhum.

// As origens do lead (§`0029`). Lista fixa: virar tabela so vale a pena quando
// alguem precisar cadastrar origem nova sem mexer no codigo (como os tipos, §10).
export const ORIGENS = [
  'Marketing',
  'Club Casa',
  'Indicação',
  'Balcão',
  'Instagram',
]

// "2026-07-20" -> "20/07/2026 · segunda-feira".
// Montamos a data pelos NUMEROS, e nao com new Date("2026-07-20"): a string ISO
// e lida como UTC e, no nosso fuso, isso mostraria o dia ANTERIOR.
export function textoPrazo(iso) {
  const [ano, mes, dia] = iso.split('-').map(Number)
  const d = new Date(ano, mes - 1, dia)
  return `${d.toLocaleDateString('pt-BR')} · ${d.toLocaleDateString('pt-BR', {
    weekday: 'long',
  })}`
}

// ["cliente","tipo","origem"] -> "cliente, tipo e origem"
export function listaPt(itens) {
  if (itens.length <= 1) return itens.join('')
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`
}

// Texto longo -> previa curta para caber no subtitulo do card.
export function resumir(texto, max = 42) {
  const t = texto.trim().replace(/\s+/g, ' ')
  return t.length > max ? `${t.slice(0, max)}…` : t
}

// O que falta para criar a demanda.
//
// Esta regra ja foi METADE aqui e metade no `required` dos <select>. Quando os
// <select> viraram cards, o `required` iria junto — e a ORIGEM, que e
// obrigatoria (§6), passaria a ser opcional EM SILENCIO. Por isso a regra
// inteira vive num lugar so, agora.
//
// A OBRA nao entra de proposito: ela e opcional — sem escolha, a demanda cai na
// "Obra de {cliente}" (achar-ou-criar, no componente).
export function calcularFaltantes({
  ehFilha,
  cliente,
  tipoId,
  descricao,
  prazo,
  origem,
  rt,
  rtPercentual,
}) {
  const faltantes = []
  if (!ehFilha && !cliente) faltantes.push({ id: 'cliente', nome: 'cliente' })
  if (!tipoId) faltantes.push({ id: 'tipo', nome: 'tipo' })
  if (!descricao.trim()) faltantes.push({ id: 'descricao', nome: 'descrição' })
  if (!prazo) faltantes.push({ id: 'prazo', nome: 'prazo' })
  if (!origem) faltantes.push({ id: 'origem', nome: 'origem' })
  if (rt && String(rtPercentual).trim() === '')
    faltantes.push({ id: 'condicoes', nome: '% da RT' })
  return faltantes
}
