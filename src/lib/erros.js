import { supabase } from './supabase'

// Registro de erros do front (§rede de seguranca, passo 2). Grava na tabela
// erro_log (migracao 0035) para o admin ver o que quebrou no aparelho de quem.
//
// REGRA DE OURO: registrar um erro NUNCA pode lancar outro erro — senao vira
// um loop (o erro do log dispara o log de novo). Por isso tudo aqui vive
// dentro de try/catch e as falhas sao engolidas de proposito.

// Trava anti-enxurrada: uma tela quebrando em loop poderia gravar centenas de
// linhas. Limitamos por sessao e ignoramos repetidos.
const MAX_POR_SESSAO = 10
const jaRegistrados = new Set()
let quantidade = 0

// origem: 'boundary-topo' | 'boundary-tela' | 'window' | 'promise'
// componente: a pilha de componentes do React (diz QUAL tela quebrou)
export async function registrarErro(origem, erro, componente) {
  try {
    if (quantidade >= MAX_POR_SESSAO) return
    const mensagem = String(erro?.message || erro || 'erro desconhecido').slice(0, 500)

    // Mesmo erro, mesma origem -> grava uma vez so por sessao.
    const chave = `${origem}|${mensagem}`
    if (jaRegistrados.has(chave)) return
    jaRegistrados.add(chave)
    quantidade += 1

    // perfil_id NAO e enviado: o banco preenche com auth.uid() (default + RLS).
    await supabase.from('erro_log').insert({
      origem,
      mensagem,
      stack: erro?.stack ? String(erro.stack).slice(0, 4000) : null,
      componente: componente ? String(componente).slice(0, 2000) : null,
      url: window.location.href,
      user_agent: navigator.userAgent,
    })
  } catch {
    /* de proposito: o log nunca pode derrubar o app */
  }
}

// Erros FORA da renderizacao do React (assincronos, handlers de evento) — o
// ErrorBoundary nao pega esses. Chamar UMA vez, no boot (main.jsx).
export function ligarCapturaGlobal() {
  window.addEventListener('error', (e) => {
    registrarErro('window', e.error || new Error(e.message))
  })
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason
    registrarErro('promise', r instanceof Error ? r : new Error(String(r)))
  })
}
