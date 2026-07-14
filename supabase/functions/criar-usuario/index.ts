// Edge Function: cadastrar um novo usuario (SOMENTE admin pode chamar).
//
// Por que existe: criar o login de outra pessoa exige a service_role, que
// NAO pode ficar no frontend. Aqui no servidor ela fica segura.
//
// Fluxo: confere que quem chamou e admin -> cria o login no Auth (service_role)
// -> ajusta nome/papel no perfil (a linha o trigger handle_new_user ja cria).
//
// Variaveis SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY sao
// injetadas automaticamente no ambiente da funcao.

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

const PAPEIS = ['admin', 'atendente', 'vendedor']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const { email, senha, nome_completo, papel } = await req.json()

    if (!email || !senha || !nome_completo || !PAPEIS.includes(papel)) {
      return json({ error: 'Dados inválidos.' }, 400)
    }
    if (String(senha).length < 6) {
      return json({ error: 'A senha precisa ter ao menos 6 caracteres.' }, 400)
    }

    // 1) Confere que quem chamou e ADMIN (usando o token do proprio chamador).
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
      .select('papel')
      .eq('id', callerId)
      .single()
    if (perfilChamador?.papel !== 'admin') {
      return json({ error: 'Apenas admin pode cadastrar usuários.' }, 403)
    }

    // 2) Cria o login no Auth (ja confirmado, sem precisar de e-mail).
    const { data: novo, error: erroCria } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome_completo },
    })
    if (erroCria) return json({ error: erroCria.message }, 400)

    // 3) Ajusta o perfil (o trigger ja criou a linha; admin define nome/papel).
    await admin
      .from('perfil')
      .update({ nome_completo, papel })
      .eq('id', novo.user!.id)

    return json({ ok: true, id: novo.user!.id }, 200)
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500)
  }
})
