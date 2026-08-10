// Edge Function: cadastrar um novo usuario (SOMENTE admin ATIVO pode chamar).
//
// Por que existe: criar o login de outra pessoa exige a service_role, que NAO
// pode ficar no frontend. Aqui no servidor ela fica segura.
//
// Fluxo: confere quem chamou -> cria o login no Auth (service_role) -> ajusta
// nome/papel/celular no perfil (a LINHA do perfil o gatilho handle_new_user
// ja criou, com papel 'vendedor' por padrao — §migracao 0003).
//
// VERIFY JWT FICA LIGADO nesta funcao (o contrario da enviar-push): ela
// identifica o chamador pelo token que ele manda. Ver supabase/config.toml.
//
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY sao injetadas
// automaticamente no ambiente da funcao.

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(obj: unknown, status: number) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Os QUATRO papeis do app (§5 do CLAUDE.md). O `gerente` faltava aqui: esta
// funcao foi escrita antes da migracao 0030 criar o papel, e cadastrar um
// gerente devolvia "Dados invalidos".
const PAPEIS = ['admin', 'atendente', 'gerente', 'vendedor']

const SENHA_MINIMA = 6

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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

    // 1) Quem chamou? Identificado pelo TOKEN dele, nao por algo no corpo do
    //    pedido — o corpo o chamador escreve, o token nao.
    const chamador = createClient(url, anonKey, {
      global: {
        headers: { Authorization: req.headers.get('Authorization') ?? '' },
      },
    })
    const { data: u } = await chamador.auth.getUser()
    const callerId = u?.user?.id
    if (!callerId) return json({ error: 'Não autenticado.' }, 401)

    const admin = createClient(url, serviceKey)
    const { data: perfilChamador } = await admin
      .from('perfil')
      .select('papel, ativo')
      .eq('id', callerId)
      .single()

    // O `ativo` entra junto com o papel: desde a 0025 uma conta desativada nao
    // escreve NADA pela RLS, e esta funcao roda com service_role — ou seja,
    // POR FORA da RLS. Sem esta linha, um admin desativado continuaria
    // conseguindo criar logins, que e o oposto de desativar alguem.
    if (perfilChamador?.papel !== 'admin' || perfilChamador?.ativo === false) {
      return json({ error: 'Apenas admin ativo pode cadastrar usuários.' }, 403)
    }

    // 2) Cria o login no Auth, ja confirmado (nao dependemos de SMTP).
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

    // 3) Ajusta o perfil. O gatilho ja criou a linha (papel 'vendedor'); aqui
    //    o admin define o que escolheu. `celular` e opcional: so grava quando
    //    veio algo, para nao apagar com string vazia.
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
