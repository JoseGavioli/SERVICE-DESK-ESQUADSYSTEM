// Peças comuns das Edge Functions que agem em nome do ADMIN.
//
// Por que existe: `criar-usuario` e `resetar-senha` fazem a MESMA checagem de
// quem pode chamar. Duas cópias dessa checagem sao duas chances de esquecer —
// e ja esqueceram uma vez: a `criar-usuario` ficou meses sem conferir se o
// admin estava `ativo`. O portao mora num lugar so.
//
// Estas funcoes rodam com `service_role`, ou seja **por fora da RLS**. Aqui
// nao existe rede de seguranca do banco: o que este arquivo deixa passar,
// passa.

import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Minimo do Supabase Auth, repetido no front (`lib/senha.js`) so para evitar
// uma ida ao servidor. Quem REALMENTE barra e aqui.
export const SENHA_MINIMA = 6

export function json(obj: unknown, status: number) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export function clienteAdmin(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
}

type Portao =
  | { ok: true; callerId: string }
  | { ok: false; resposta: Response }

// Quem chamou? Identificado pelo TOKEN dele — nao por algo no corpo do pedido,
// que o chamador escreve. Devolve o id so quando e admin E esta ativo.
export async function exigirAdminAtivo(
  req: Request,
  admin: SupabaseClient,
): Promise<Portao> {
  const chamador = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: {
        headers: { Authorization: req.headers.get('Authorization') ?? '' },
      },
    },
  )

  const { data: u } = await chamador.auth.getUser()
  const callerId = u?.user?.id
  if (!callerId) return { ok: false, resposta: json({ error: 'Não autenticado.' }, 401) }

  const { data: perfil } = await admin
    .from('perfil')
    .select('papel, ativo')
    .eq('id', callerId)
    .single()

  // O `ativo` entra junto com o papel: desde a 0025 uma conta desativada nao
  // escreve NADA pela RLS. Sem esta linha, um admin desativado continuaria
  // agindo por aqui — o oposto de desativar alguem.
  if (perfil?.papel !== 'admin' || perfil?.ativo === false) {
    return {
      ok: false,
      resposta: json({ error: 'Apenas admin ativo pode fazer isso.' }, 403),
    }
  }

  return { ok: true, callerId }
}
