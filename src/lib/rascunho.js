// Rascunho da Nova demanda (§issue #82): o que o vendedor digitou e salvo no
// APARELHO (localStorage) enquanto ele preenche — um voltar sem querer, uma
// troca de tela ou ate fechar o app nao jogam o trabalho fora.
//
// Regras:
//  - chave POR USUARIO: aparelho compartilhado nao vaza rascunho entre contas;
//  - EXPIRA em 7 dias: rascunho fossil nao fica assombrando o formulario;
//  - anexos NAO entram (File nao serializa p/ localStorage; o aviso de
//    restauracao pede p/ escolher os arquivos de novo);
//  - tudo em try/catch: localStorage pode falhar (modo privado, quota) e o
//    rascunho e conveniencia — NUNCA pode derrubar o formulario.

const DIAS_VALIDADE = 7

function chave(perfilId) {
  return `rascunho-nova-demanda-${perfilId}`
}

// Salva { salvoEm, dados }. `dados` e o objeto que a NovaDemanda montar
// (campos simples + cliente/obra/proprietario como {id, nome} + a ficha).
export function salvarRascunho(perfilId, dados) {
  try {
    localStorage.setItem(
      chave(perfilId),
      JSON.stringify({ salvoEm: new Date().toISOString(), dados }),
    )
  } catch {
    // sem espaco / modo privado -> segue sem rascunho, sem alarde
  }
}

// Devolve { salvoEm, dados } ou null (inexistente, corrompido ou vencido).
export function carregarRascunho(perfilId) {
  try {
    const cru = localStorage.getItem(chave(perfilId))
    if (!cru) return null
    const r = JSON.parse(cru)
    if (!r?.dados || !r?.salvoEm) return null
    const idadeMs = Date.now() - new Date(r.salvoEm).getTime()
    if (!(idadeMs >= 0) || idadeMs > DIAS_VALIDADE * 24 * 60 * 60 * 1000) {
      limparRascunho(perfilId) // vencido (ou relogio maluco): fora
      return null
    }
    return r
  } catch {
    return null
  }
}

export function limparRascunho(perfilId) {
  try {
    localStorage.removeItem(chave(perfilId))
  } catch {
    // nada a fazer
  }
}
