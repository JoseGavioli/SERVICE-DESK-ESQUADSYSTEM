// Monta a frase que descreve o que aconteceu na notificacao, a partir do
// tipo e (para status) da transicao real de_status -> para_status.
// Ex.: "Adriana iniciou a demanda de Casa Silva".

function verboStatus(de, para) {
  switch (para) {
    case 'em_andamento':
      if (de === 'nao_iniciado') return 'iniciou a demanda'
      if (de === 'congelado') return 'descongelou a demanda'
      return 'retomou a demanda' // volta de revisao/concluido
    case 'em_revisao_custo':
      if (de === 'em_andamento') return 'enviou para revisão de custo a demanda'
      return 'devolveu para revisão de custo a demanda'
    case 'congelado':
      return 'congelou a demanda'
    case 'enviado':
      return 'marcou como enviada a demanda'
    case 'concluido':
      return 'concluiu a demanda' // legado
    default:
      return 'atualizou a demanda'
  }
}

export function textoNotificacao(n) {
  const autor = n.autor?.nome_completo ?? 'Alguém'
  const cliente = n.demanda?.obra?.cliente?.nome
  const deCliente = cliente ? ` de ${cliente}` : ''

  switch (n.tipo) {
    case 'nova_demanda':
      return `${autor} criou uma demanda${cliente ? ` para ${cliente}` : ''}`
    case 'novo_comentario':
      return `${autor} comentou na demanda${deCliente}`
    case 'solicitacao_cancelamento':
      return `${autor} solicitou o cancelamento da demanda${deCliente}`
    case 'cancelamento_efetivado':
      return `${autor} cancelou a demanda${deCliente}`
    case 'mudanca_status':
      return `${autor} ${verboStatus(n.de_status, n.para_status)}${deCliente}`
    // Notificacoes do SISTEMA (job diario, migracao 0020) — nao tem autor.
    case 'prazo_vencido':
      return `⏰ O prazo da demanda${deCliente} venceu`
    case 'custo_atrasado':
      return `⏰ O custo da demanda${deCliente} está atrasado (5+ dias em revisão)`
    default:
      return `${autor} atualizou a demanda${deCliente}`
  }
}
