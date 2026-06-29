// Mapa de transicoes para a INTERFACE: para cada status, quais acoes
// aparecem (rotulo amigavel), o status de destino, se exige comentario
// (§13) e se e exclusiva do admin (cancelar, §12).
//
// IMPORTANTE: a fonte da verdade e a funcao mover_status() no banco —
// isto aqui so decide quais botoes desenhar. Se divergirem, o banco manda.
export const TRANSICOES = {
  nao_iniciado: [
    { para: 'em_andamento', rotulo: 'Iniciar', exigeComentario: false },
    { para: 'cancelada', rotulo: 'Cancelar', exigeComentario: true, soAdmin: true },
  ],
  em_andamento: [
    { para: 'em_revisao_custo', rotulo: 'Enviar p/ revisão de custo', exigeComentario: false },
    { para: 'congelado', rotulo: 'Congelar', exigeComentario: true },
    { para: 'cancelada', rotulo: 'Cancelar', exigeComentario: true, soAdmin: true },
  ],
  congelado: [
    { para: 'em_andamento', rotulo: 'Descongelar', exigeComentario: false },
    { para: 'cancelada', rotulo: 'Cancelar', exigeComentario: true, soAdmin: true },
  ],
  em_revisao_custo: [
    { para: 'concluido', rotulo: 'Concluir', exigeComentario: false },
    { para: 'em_andamento', rotulo: 'Voltar p/ em andamento', exigeComentario: true },
    { para: 'cancelada', rotulo: 'Cancelar', exigeComentario: true, soAdmin: true },
  ],
  concluido: [
    { para: 'enviado', rotulo: 'Marcar como enviado', exigeComentario: false },
    { para: 'em_revisao_custo', rotulo: 'Voltar p/ revisão de custo', exigeComentario: true },
    { para: 'em_andamento', rotulo: 'Voltar p/ em andamento', exigeComentario: true },
    { para: 'cancelada', rotulo: 'Cancelar', exigeComentario: true, soAdmin: true },
  ],
  enviado: [], // terminal
  cancelada: [], // terminal
}
