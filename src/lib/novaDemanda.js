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
// A OBRA e obrigatoria desde a §#85 fase 3, e com ela a CIDADE. Antes, quem
// nao escolhesse caia numa "Obra de {cliente}" criada em silencio — 16 das 36
// obras do banco nasceram assim, sem endereco nenhum. Esse fallback acabou.
// A cidade e cobrada em dois casos: obra ANTIGA que ainda nao tem o campo
// (o form pede na hora e grava na obra) e obra NOVA (o seletor ja pede junto).
//
// FECHAMENTO (tipo com ficha, §#80): o CLIENTE e obrigatorio como em todo tipo
// — ele voltou para o formulario na §#85 fase 2 (chegou a ser escolhido dentro
// da ficha). O que este modo dispensa e outra coisa: a descricao vira
// "Informacao adicional" (opcional) e origem/condicoes nem aparecem.
export function calcularFaltantes({
  ehFilha,
  ehFechamento,
  cliente,
  obra,
  cidadeObra,
  tipoId,
  descricao,
  prazo,
  origem,
  rt,
  rtPercentual,
}) {
  const faltantes = []
  // O cliente e obrigatorio em TODO tipo (§#85 fase 2). Ele chegou a ser
  // dispensado no fechamento porque era escolhido dentro da ficha; agora que
  // voltou para o formulario, a exigencia volta com ele — assim o botao
  // "Preencher ficha" nao abre a ficha de um fechamento sem dono.
  if (!ehFilha && !cliente) faltantes.push({ id: 'cliente', nome: 'cliente' })
  // Na FILHA a obra vem travada da demanda-pai — nao ha o que escolher (§11),
  // e por isso ela fica de fora das duas regras abaixo. A cidade tambem: a
  // filha e a CONTINUACAO de uma obra que ja existe, e cobrar ali um campo que
  // ela nao escolheu seria travar a continuacao por causa do cadastro. A obra
  // se completa quando for usada numa demanda nova — que e o caminho comum.
  if (!ehFilha && !obra) faltantes.push({ id: 'obra', nome: 'obra' })
  // Obra antiga sem cidade: o campo aparece dentro do card da obra, entao o
  // faltante aponta para o mesmo card.
  if (!ehFilha && obra && !obra.cidade_estado && !String(cidadeObra ?? '').trim())
    faltantes.push({ id: 'obra', nome: 'cidade e estado da obra' })
  if (!tipoId) faltantes.push({ id: 'tipo', nome: 'tipo' })
  if (!ehFechamento && !descricao.trim())
    faltantes.push({ id: 'descricao', nome: 'descrição' })
  if (!prazo) faltantes.push({ id: 'prazo', nome: 'prazo' })
  // Na filha a origem é herdada do pai (escondida) — não é obrigatória aqui.
  if (!ehFilha && !ehFechamento && !origem)
    faltantes.push({ id: 'origem', nome: 'origem' })
  if (!ehFechamento && rt && String(rtPercentual).trim() === '')
    faltantes.push({ id: 'condicoes', nome: '% da RT' })
  return faltantes
}
