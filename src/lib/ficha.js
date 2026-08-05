// Regras e formatacoes da FICHA DE PEDIDO DE VENDAS (§issue #80). Funcoes
// PURAS, fora dos componentes — da para conferir a regra sem passar por JSX.

// Texto padrao da demanda quando o vendedor nao escreve a "Informacao
// adicional" (a coluna descricao e obrigatoria no banco; decisao do dono).
export const DESCRICAO_PADRAO_FECHAMENTO =
  'Fechamento — ver ficha de pedido de vendas.'

// "Hoje" como AAAA-MM-DD no fuso LOCAL — montado pelos numeros, nunca por
// toISOString() (que e UTC e, a noite, viraria o dia seguinte; §lib/novaDemanda).
export function hojeIsoLocal() {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

// Estado inicial da ficha: um campo por coluna da tabela ficha_fechamento
// (menos demanda_id). Strings vazias viram null na hora de salvar.
export function fichaVazia(hojeIso) {
  return {
    data_pedido: hojeIso,
    num_proposta: '',
    valor: '',
    forma_pagamento: '',
    envio_cobranca: '',
    com_nf: false,
    com_meia_nf: false,
    comissao_pct: '',
    consultor2_nome: '',
    consultor2_pct: '',
    consultor3_nome: '',
    consultor3_pct: '',
    cliente_data_nasc: '',
    cliente_endereco: '',
    cliente_telefone1: '',
    cliente_cep: '',
    cliente_cidade_uf: '',
    cliente_cpf: '',
    cliente_rg: '',
    cliente_telefone2: '',
    cliente_email: '',
    rt: false, // vira demanda.rt (nao e coluna da ficha)
    rt_percentual: '', // vira demanda.rt_percentual
    rt_dados_bancarios: '',
    rt_beneficiario: '',
    mestre_obra: '',
    obra_telefone: '',
    obra_email: '',
    obra_endereco: '',
    obra_bairro: '',
    obra_cep: '',
    obra_cidade_uf: '',
    medicao_contramarco: '',
    fiscal_obra: '',
    particularidades: '',
    vig_contramarcos: '',
    vig_domus: '',
    vig_esquadrias: '',
    vig_brises: '',
    vig_guarda_corpo: '',
  }
}

// "45.000,00" -> 45000. SO para campo de TEXTO digitado em formato BR (ponto
// de milhar, virgula decimal) — hoje, apenas o "Valor (R$)". NUNCA use em
// value de <input type="number">: por spec do HTML ele sai SEMPRE com ponto
// decimal ("2.5"), e este parser leria como milhar ("25" — achado da revisao).
export function numeroBr(texto) {
  const t = String(texto ?? '').trim()
  if (!t) return null
  const n = Number(t.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

// Value de <input type="number"> (as porcentagens da ficha) -> numero ou null.
// Number() direto: o value ja vem normalizado com ponto decimal.
export function numeroInput(valor) {
  const t = String(valor ?? '').trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

// Monta a linha para o INSERT em ficha_fechamento a partir do estado da tela.
// Texto vazio -> null (a ficha no papel tambem circula com campos em branco).
export function montarInsertFicha(ficha, demandaId) {
  const txt = (v) => {
    const t = String(v ?? '').trim()
    return t || null
  }
  return {
    demanda_id: demandaId,
    data_pedido: ficha.data_pedido || null,
    num_proposta: txt(ficha.num_proposta),
    valor: numeroBr(ficha.valor),
    forma_pagamento: txt(ficha.forma_pagamento),
    envio_cobranca: txt(ficha.envio_cobranca),
    com_nf: ficha.com_nf,
    com_meia_nf: ficha.com_meia_nf,
    // Porcentagens vem de <input type="number"> -> numeroInput (NAO numeroBr).
    comissao_pct: numeroInput(ficha.comissao_pct),
    consultor2_nome: txt(ficha.consultor2_nome),
    consultor2_pct: numeroInput(ficha.consultor2_pct),
    consultor3_nome: txt(ficha.consultor3_nome),
    consultor3_pct: numeroInput(ficha.consultor3_pct),
    cliente_data_nasc: ficha.cliente_data_nasc || null,
    cliente_endereco: txt(ficha.cliente_endereco),
    cliente_telefone1: txt(ficha.cliente_telefone1),
    cliente_cep: txt(ficha.cliente_cep),
    cliente_cidade_uf: txt(ficha.cliente_cidade_uf),
    cliente_cpf: txt(ficha.cliente_cpf),
    cliente_rg: txt(ficha.cliente_rg),
    cliente_telefone2: txt(ficha.cliente_telefone2),
    cliente_email: txt(ficha.cliente_email),
    rt_dados_bancarios: txt(ficha.rt_dados_bancarios),
    rt_beneficiario: txt(ficha.rt_beneficiario),
    mestre_obra: txt(ficha.mestre_obra),
    obra_telefone: txt(ficha.obra_telefone),
    obra_email: txt(ficha.obra_email),
    obra_endereco: txt(ficha.obra_endereco),
    obra_bairro: txt(ficha.obra_bairro),
    obra_cep: txt(ficha.obra_cep),
    obra_cidade_uf: txt(ficha.obra_cidade_uf),
    medicao_contramarco: txt(ficha.medicao_contramarco),
    fiscal_obra: txt(ficha.fiscal_obra),
    particularidades: txt(ficha.particularidades),
    vig_contramarcos: txt(ficha.vig_contramarcos),
    vig_domus: txt(ficha.vig_domus),
    vig_esquadrias: txt(ficha.vig_esquadrias),
    vig_brises: txt(ficha.vig_brises),
    vig_guarda_corpo: txt(ficha.vig_guarda_corpo),
  }
}

// Subtitulos dos cards fechados (mostram o que ja foi preenchido).
export function subPedido(f) {
  const partes = []
  if (String(f.num_proposta).trim()) partes.push(`Nº ${f.num_proposta.trim()}`)
  if (String(f.valor).trim()) partes.push(`R$ ${String(f.valor).trim()}`)
  if (String(f.forma_pagamento).trim()) partes.push(f.forma_pagamento.trim())
  return partes.length ? partes.join(' · ') : 'Proposta, valor e pagamento'
}

export function subConsultores(f, nomeVendedor) {
  const partes = [
    `${nomeVendedor}${String(f.comissao_pct).trim() ? ` ${f.comissao_pct}%` : ''}`,
  ]
  if (String(f.consultor2_nome).trim()) partes.push(f.consultor2_nome.trim())
  if (String(f.consultor3_nome).trim()) partes.push(f.consultor3_nome.trim())
  return partes.join(' · ')
}

export function subDadosCliente(f) {
  const partes = []
  if (String(f.cliente_cpf).trim()) partes.push(`CPF ${f.cliente_cpf.trim()}`)
  if (String(f.cliente_telefone1).trim()) partes.push(f.cliente_telefone1.trim())
  if (String(f.cliente_cidade_uf).trim()) partes.push(f.cliente_cidade_uf.trim())
  return partes.length ? partes.join(' · ') : 'CPF, endereço e contatos'
}

export function subRt(f) {
  if (!f.rt) return 'RT, dados bancários — se houver'
  const pct = String(f.rt_percentual).trim()
  return `RT${pct ? ` ${pct}%` : ''}${String(f.rt_beneficiario).trim() ? ` · ${f.rt_beneficiario.trim()}` : ''}`
}

export function subDadosObra(f) {
  const partes = []
  if (String(f.mestre_obra).trim()) partes.push(f.mestre_obra.trim())
  if (String(f.obra_bairro).trim()) partes.push(f.obra_bairro.trim())
  if (String(f.obra_cidade_uf).trim()) partes.push(f.obra_cidade_uf.trim())
  return partes.length ? partes.join(' · ') : 'Mestre de obra e endereço'
}

export function subVigencia(f) {
  const n = [
    f.vig_contramarcos,
    f.vig_domus,
    f.vig_esquadrias,
    f.vig_brises,
    f.vig_guarda_corpo,
  ].filter((v) => String(v).trim()).length
  return n ? `${n} de 5 preenchidos` : 'Contramarcos, esquadrias, brises…'
}
