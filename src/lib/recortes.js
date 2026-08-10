// Os RECORTES de status da lista (§#83 B1) — os mesmos que no celular são os
// chips do cabeçalho, e que no desktop viram o sub-menu do "Início".
//
// Vivem aqui, e não dentro do MenuDesktop, porque duas partes precisam deles e
// precisam CONCORDAR: o menu, que desenha os botões, e a lista, que diz qual
// está aplicado. Com a lista em dois lugares, bastaria alguém mexer num filtro
// para o menu acender o recorte errado — e ninguém perceberia.
//
// `contador` aponta qual número do useContadoresLista o recorte exibe (§B2).
export const RECORTES = [
  { rotulo: 'Todas', filtro: {} },
  { rotulo: 'Atenção', filtro: { soAtencao: true }, contador: 'atencao', perigo: true },
  { rotulo: 'Em aberto', filtro: { soAtivas: true }, contador: 'emAberto' },
  { rotulo: 'Enviados', filtro: { status: 'enviado', ordenacao: 'recentes' } },
  { rotulo: 'Cancelados', filtro: { status: 'cancelada' } },
]

// Qual recorte a lista está mostrando AGORA? Devolve o rótulo, ou `null`
// quando o que está na tela não é nenhum deles.
//
// A pergunta é só sobre o RECORTE (status / atenção), de propósito: busca,
// vendedor, urgência e ordenação são filtros aplicados POR CIMA. Quem está em
// "Em aberto" e digita um nome na busca continua em "Em aberto" — apagar o
// destaque ali faria o menu piscar a cada tecla.
//
// A ordem dos testes importa: `soAtencao` e `soAtivas` podem conviver com um
// status, e o recorte mais específico é o que a pessoa escolheu por último.
export function recorteAtivo(f) {
  if (!f) return null
  if (f.soAtencao) return 'Atenção'
  if (f.soAtivas) return 'Em aberto'
  if (f.status === 'enviado') return 'Enviados'
  if (f.status === 'cancelada') return 'Cancelados'
  // "Todas" é a ausência de recorte — mas só quando não há OUTRO recorte na
  // tela. Com um status exato escolhido no "Filtrar" (ex.: Congelado), ou com
  // o chip "Cancelamentos a decidir" ligado, nenhum item do menu representa o
  // que está sendo mostrado: acender "Todas" ali seria mentira.
  if (f.status || f.soCancelamentoSolicitado) return null
  return 'Todas'
}
