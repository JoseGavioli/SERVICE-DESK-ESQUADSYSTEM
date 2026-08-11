// Edge Function: cadastrar um novo usuario (SOMENTE admin ATIVO pode chamar).
//
// Por que existe: criar o login de outra pessoa exige a service_role, que NAO
// pode ficar no frontend. Aqui no servidor ela fica segura.
//
// Fluxo: confere quem chamou (portao em ../_shared/admin.ts) -> cria o login
// no Auth -> ajusta nome/papel/celular no perfil (a LINHA do perfil o gatilho
// handle_new_user ja criou, com papel 'vendedor' por padrao — §migracao 0003).
//
// VERIFY JWT FICA LIGADO nesta funcao (o contrario da enviar-push): ela
// identifica o chamador pelo token que ele manda. Ver supabase/config.toml.

import {
  clienteAdmin,
  corsHeaders,
  exigirAdminAtivo,
  json,
  SENHA_MINIMA,
} from '../_shared/admin.ts'

// Os QUATRO papeis do app (§5 do CLAUDE.md). O `gerente` faltava aqui: esta
// funcao foi escrita antes da migracao 0030 criar o papel, e cadastrar um
// gerente devolvia "Dados invalidos".
const PAPEIS = ['admin', 'atendente', 'gerente', 'vendedor']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // O PORTAO VEM PRIMEIRO, antes de olhar o corpo. Validar antes de
    // autorizar faz a funcao responder coisas diferentes para quem nao tem
    // nada a ver com ela — daria para descobrir quais papeis existem so
    // batendo aqui com corpos diferentes, sem token nenhum.
    const admin = clienteAdmin()
    const portao = await exigirAdminAtivo(req, admin)
    if (!portao.ok) return portao.resposta

    const corpo = await req.json()
    const email = String(corpo?.email ?? '').trim()
    const senha = String(corpo?.senha ?? '')
    const nome_completo = String(corpo?.nome_completo ?? '').trim()
    const papel = String(corpo?.papel ?? '')
    const celular = String(corpo?.celular ?? '').trim()

    if (!email || !nome_completo || !PAPEIS.includes(papel)) {
      return json({ error: 'Preencha email, nome e um papel válido.' }, 400)
    }
    if (senha.length < SENHA_MINIMA) {
      return json(
        { error: `A senha precisa ter ao menos ${SENHA_MINIMA} caracteres.` },
        400,
      )
    }

    // Cria o login no Auth, ja confirmado (nao dependemos de SMTP).
    const { data: novo, error: erroCria } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome_completo },
    })
    if (erroCria) {
      // A mensagem do Auth vem em ingles. Traduzimos a mais comum de longe —
      // as outras seguem cruas, que e melhor que uma frase generica.
      const jaExiste = /already been registered|already exists/i.test(
        erroCria.message,
      )
      return json(
        {
          error: jaExiste
            ? 'Já existe um usuário com esse email.'
            : erroCria.message,
        },
        400,
      )
    }

    // Ajusta o perfil. O gatilho ja criou a linha (papel 'vendedor'); aqui o
    // admin define o que escolheu. `celular` e opcional: so grava quando veio
    // algo, para nao apagar com string vazia.
    const { error: erroPerfil } = await admin
      .from('perfil')
      .update({ nome_completo, papel, ...(celular ? { celular } : {}) })
      .eq('id', novo.user!.id)

    // O login FOI criado. Se o ajuste do perfil falhar, dizemos exatamente
    // isso: a pessoa ja consegue entrar, e o admin so precisa corrigir o papel
    // na tela de Equipe. Fingir erro geral faria o admin tentar de novo e
    // esbarrar em "email ja existe".
    if (erroPerfil) {
      return json(
        {
          ok: true,
          id: novo.user!.id,
          aviso:
            'Login criado, mas não foi possível salvar nome/papel. Ajuste na Equipe.',
        },
        200,
      )
    }

    return json({ ok: true, id: novo.user!.id }, 200)
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500)
  }
})
