// Peças comuns das telas que lidam com senha de OUTRA pessoa: o cadastro de
// membro (§#16) e o reset de senha. As duas conversam com Edge Functions e
// mostram a senha na tela uma única vez.
//
// Mora aqui e não em cada tela porque é justamente o tipo de regra que
// desencontra quando existe em dois lugares — o §8 do CLAUDE.md conta a mesma
// história sobre a urgência.

// Mínimo do Supabase Auth. Repetido em `_shared/admin.ts` (o lado servidor,
// que é quem REALMENTE barra) e no "Meu perfil"; aqui serve só para não
// gastar uma ida ao servidor com uma senha curta.
export const SENHA_MINIMA = 6

const TAMANHO_SUGERIDO = 8
// Sem os caracteres que se confundem quando alguém LÊ a senha em voz alta ou
// copia dela de um print: l/I/1 e O/0 ficaram de fora.
const ALFABETO = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function senhaSugerida() {
  const sorteio = new Uint32Array(TAMANHO_SUGERIDO)
  crypto.getRandomValues(sorteio)
  return Array.from(sorteio, (n) => ALFABETO[n % ALFABETO.length]).join('')
}

// O `invoke` NÃO entrega o corpo da resposta quando ela não é 2xx: o
// `error.message` vem sempre a MESMA frase em inglês ("Edge Function returned
// a non-2xx status code"). O texto que a função escreveu — "Já existe um
// usuário com esse email", "Apenas admin ativo pode fazer isso" — está no
// `error.context`, que é um Response ainda por ler. Sem isto, a função fica
// bem-educada por dentro e muda para o inglês na hora de falar com o usuário.
export async function mensagemDoErro(erro, padrao) {
  try {
    const corpo = await erro?.context?.json?.()
    if (corpo?.error) return corpo.error
  } catch {
    // resposta sem corpo JSON (falha de rede, timeout): cai no padrão
  }
  return padrao
}

// Copia para a área de transferência. Devolve `true`/`false` em vez de deixar
// estourar: a falha aqui é comum e sem gravidade (a janela pode não estar em
// foco), e o certo é dizer "copie à mão", não quebrar a tela.
export async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    return false
  }
}
