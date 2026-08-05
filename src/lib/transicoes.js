// Mapa de transicoes para a INTERFACE: para cada status, quais acoes
// aparecem (rotulo amigavel), o status de destino, se exige comentario
// (§13) e se e exclusiva do admin (cancelar, §12).
//
// `icone` e da ACAO, nao do destino: "Descongelar" e "Voltar p/ em andamento"
// vao os dois para 'em_andamento', mas nao sao a mesma coisa. Ja a COR do
// botao vem do destino (ver .status-opcao[data-para] no App.css).
//
// IMPORTANTE: a fonte da verdade e a funcao mover_status() no banco —
// isto aqui so decide quais botoes desenhar. Se divergirem, o banco manda.
export const TRANSICOES = {
  nao_iniciado: [
    { para: 'em_andamento', rotulo: 'Iniciar', icone: 'play', exigeComentario: false },
    { para: 'cancelada', rotulo: 'Cancelar', icone: 'cancelado', exigeComentario: true, soAdmin: true },
  ],
  em_andamento: [
    { para: 'em_revisao_custo', rotulo: 'Enviar p/ revisão de custo', icone: 'calculadora', exigeComentario: false },
    { para: 'congelado', rotulo: 'Congelar', icone: 'neve', exigeComentario: true },
    { para: 'cancelada', rotulo: 'Cancelar', icone: 'cancelado', exigeComentario: true, soAdmin: true },
  ],
  congelado: [
    { para: 'em_andamento', rotulo: 'Descongelar', icone: 'play', exigeComentario: false },
    { para: 'cancelada', rotulo: 'Cancelar', icone: 'cancelado', exigeComentario: true, soAdmin: true },
  ],
  em_revisao_custo: [
    { para: 'concluido', rotulo: 'Concluir (orçamento pronto)', icone: 'check', exigeComentario: false },
    { para: 'em_andamento', rotulo: 'Voltar p/ em andamento', icone: 'voltar', exigeComentario: true },
    { para: 'cancelada', rotulo: 'Cancelar', icone: 'cancelado', exigeComentario: true, soAdmin: true },
  ],
  // Concluido (§0022): orçamento pronto — é aqui que o atendente anexa a SAÍDA
  // (o orçamento) antes de "Marcar como enviado". A "volta" é só para
  // 'em_andamento' (§0023): revisão de custo só vem DEPOIS do andamento.
  concluido: [
    { para: 'enviado', rotulo: 'Marcar como enviado', icone: 'enviar', exigeComentario: false },
    { para: 'em_andamento', rotulo: 'Voltar p/ em andamento', icone: 'voltar', exigeComentario: true },
    { para: 'cancelada', rotulo: 'Cancelar', icone: 'cancelado', exigeComentario: true, soAdmin: true },
  ],
  enviado: [], // terminal
  cancelada: [], // terminal
}

// Trilho do FECHAMENTO (tipo com ficha, §issue #80): a revisao de custo e
// PULADA — de "em andamento" vai direto a "concluido". So o em_andamento
// difere; os demais status usam o mapa normal (inclusive em_revisao_custo:
// fechamento ANTIGO que ja estava la precisa conseguir sair).
const EM_ANDAMENTO_COM_FICHA = [
  { para: 'concluido', rotulo: 'Concluir (pedido pronto)', icone: 'check', exigeComentario: false },
  { para: 'congelado', rotulo: 'Congelar', icone: 'neve', exigeComentario: true },
  { para: 'cancelada', rotulo: 'Cancelar', icone: 'cancelado', exigeComentario: true, soAdmin: true },
]

// Use SEMPRE esta funcao (nao o mapa direto) quando a demanda estiver na mao:
// ela escolhe o trilho pela flag `com_ficha` do tipo (banco decide igual, na
// mover_status — se divergirem, o banco manda).
export function transicoesDe(status, comFicha) {
  if (comFicha && status === 'em_andamento') return EM_ANDAMENTO_COM_FICHA
  return TRANSICOES[status] || []
}
