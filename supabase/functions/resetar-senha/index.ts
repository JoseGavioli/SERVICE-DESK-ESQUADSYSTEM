// Edge Function: definir uma nova senha para OUTRA pessoa (só admin ATIVO).
//
// Por que existe: quem esqueceu a senha nao consegue entrar, e portanto nao
// consegue usar o "Meu perfil" para troca-la. Antes disso o admin tinha de
// abrir o painel do Supabase. Trocar a senha de outro exige a service_role,
// que nao pode viver no frontend.
//
// A pessoa continua podendo trocar sozinha depois, em Meu perfil — esta
// funcao e a saida de emergencia, nao o caminho normal.
//
// VERIFY JWT LIGADO (como a criar-usuario): o portao identifica o chamador
// pelo token dele. Ver supabase/config.toml.

import {
  clienteAdmin,
  corsHeaders,
  exigirAdminAtivo,
  json,
  SENHA_MINIMA,
} from '../_shared/admin.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // O PORTAO VEM PRIMEIRO, antes de olhar o corpo — quem nao pode chamar
    // nao merece nem uma mensagem de validacao diferente. Aqui isso pesa mais
    // que na criar-usuario: o corpo carrega o ID DE OUTRA PESSOA, e responder
    // "esse membro nao existe" para quem nao esta logado transformaria a
    // funcao num verificador de ids.
    const admin = clienteAdmin()
    const portao = await exigirAdminAtivo(req, admin)
    if (!portao.ok) return portao.resposta

    const corpo = await req.json()
    const id = String(corpo?.id ?? '').trim()
    const senha = String(corpo?.senha ?? '')

    if (!id) return json({ error: 'Diga de quem é a senha.' }, 400)
    if (senha.length < SENHA_MINIMA) {
      return json(
        { error: `A senha precisa ter ao menos ${SENHA_MINIMA} caracteres.` },
        400,
      )
    }

    // O admin NAO reseta a si mesmo por aqui. Ele tem o "Meu perfil", que pede
    // a senha duas vezes; esta porta nao pede confirmacao nenhuma, e um erro
    // de digitacao aqui trancaria para fora justamente quem conserta as
    // coisas. Mesma familia das travas do LinhaPerfil (nao muda o proprio
    // papel, nao se desativa).
    if (id === portao.callerId) {
      return json(
        { error: 'Para trocar a sua própria senha, use o Meu perfil.' },
        400,
      )
    }

    // Confere que o alvo existe COMO PERFIL do app. Sem isto, um id qualquer
    // de auth.users passaria — e a mensagem de erro do Auth nao diria o que
    // aconteceu.
    const { data: alvo } = await admin
      .from('perfil')
      .select('nome_completo')
      .eq('id', id)
      .single()

    if (!alvo) return json({ error: 'Esse membro não existe.' }, 404)

    const { error } = await admin.auth.admin.updateUserById(id, {
      password: senha,
    })
    if (error) return json({ error: error.message }, 400)

    return json({ ok: true, nome: alvo.nome_completo }, 200)
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500)
  }
})
