// Edge Function `enviar-push` (Deno) — Web Push, #14 Fase 3.
//
// Chamada por um Database Webhook no INSERT de `notificacao` (a linha nova vem
// em `record`). Monta o texto do aviso, lê as assinaturas do destinatario
// (service_role, ignora RLS) e envia um Web Push criptografado para cada
// aparelho, apagando a assinatura que morreu (404/410).
//
// SECRETS (Supabase > Edge Functions > enviar-push > Secrets):
//   VAPID_KEYS      = o JSON (JWKS) impresso no STDOUT do gerador do negrel
//   VAPID_SUBJECT   = "mailto:voce@esquadsystem.com"
//   PUSH_HOOK_SECRET= string longa aleatoria (o mesmo valor vai no header
//                     x-hook-secret do Database Webhook)
//   SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao injetados automaticamente.
//
// O Database Webhook (POST) deve mandar os headers:
//   Authorization: Bearer <ANON_KEY>   (satisfaz o verify_jwt da plataforma)
//   x-hook-secret: <PUSH_HOOK_SECRET>  (o nosso portao de verdade)
//
// Versao FIXADA (a API muda entre versoes; 0.5.0 exporta so o modulo principal).
import * as webpush from 'jsr:@negrel/webpush@0.5.0'
import { createClient } from 'jsr:@supabase/supabase-js@2'

// Só estes tipos disparam push por enquanto (user-to-user). Os de SISTEMA
// (prazo_proximo/prazo_vencido/custo_atrasado, sem autor) ficam de fora — a
// decidir depois, para não incomodar com push diário.
const TIPOS_PUSH = new Set([
  'nova_demanda',
  'mudanca_status',
  'cancelamento_efetivado',
  'novo_comentario',
  'solicitacao_cancelamento',
])

// Porta Deno de src/lib/notificacaoTexto.js (mantida em sincronia com ele).
function verboStatus(de: string, para: string) {
  switch (para) {
    case 'em_andamento':
      if (de === 'nao_iniciado') return 'iniciou a demanda'
      if (de === 'congelado') return 'descongelou a demanda'
      return 'retomou a demanda'
    case 'em_revisao_custo':
      if (de === 'em_andamento') return 'enviou para revisão de custo a demanda'
      return 'devolveu para revisão de custo a demanda'
    case 'congelado':
      return 'congelou a demanda'
    case 'enviado':
      return 'marcou como enviada a demanda'
    case 'concluido':
      return 'concluiu a demanda'
    default:
      return 'atualizou a demanda'
  }
}

function textoNotificacao(
  tipo: string,
  autor: string,
  cliente: string | null,
  deStatus: string,
  paraStatus: string,
) {
  const deCliente = cliente ? ` de ${cliente}` : ''
  switch (tipo) {
    case 'nova_demanda':
      return `${autor} criou uma demanda${cliente ? ` para ${cliente}` : ''}`
    case 'novo_comentario':
      return `${autor} comentou na demanda${deCliente}`
    case 'solicitacao_cancelamento':
      return `${autor} solicitou o cancelamento da demanda${deCliente}`
    case 'cancelamento_efetivado':
      return `${autor} cancelou a demanda${deCliente}`
    case 'mudanca_status':
      return `${autor} ${verboStatus(deStatus, paraStatus)}${deCliente}`
    default:
      return `${autor} atualizou a demanda${deCliente}`
  }
}

// VAPID + servidor (uma vez, no cold start).
const vapidKeys = await webpush.importVapidKeys(
  JSON.parse(Deno.env.get('VAPID_KEYS')!),
  { extractable: false },
)
const appServer = await webpush.ApplicationServer.new({
  contactInformation: Deno.env.get('VAPID_SUBJECT')!,
  vapidKeys,
})

// service_role: lê TODAS as assinaturas (ignora RLS). Só existe aqui, no servidor.
const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  // Portão: só o webhook (que conhece o segredo) passa.
  if (req.headers.get('x-hook-secret') !== Deno.env.get('PUSH_HOOK_SECRET')) {
    return new Response('nao autorizado', { status: 401 })
  }

  const { record } = await req.json()
  if (!record?.destinatario_id || !TIPOS_PUSH.has(record.tipo)) {
    return new Response('ignorado', { status: 200 }) // nada a enviar
  }

  // 1) Texto do aviso (autor + cliente + transição de status).
  const { data: autor } = await admin
    .from('perfil')
    .select('nome_completo')
    .eq('id', record.autor_id)
    .single()
  const { data: dem } = await admin
    .from('demanda')
    .select('obra:obra_id ( cliente:cliente_id ( nome ) )')
    .eq('id', record.demanda_id)
    .single()
  // @ts-ignore — embed aninhado do PostgREST
  const cliente = dem?.obra?.cliente?.nome ?? null

  const corpo = textoNotificacao(
    record.tipo,
    autor?.nome_completo ?? 'Alguém',
    cliente,
    record.de_status,
    record.para_status,
  )
  const payload = JSON.stringify({
    titulo: 'Service Desk',
    corpo,
    url: `/?demanda=${record.demanda_id}`, // deep-link lido pelo Painel
    tag: `demanda-${record.demanda_id}`,
  })

  // 2) Assinaturas do destinatário (vários aparelhos).
  const { data: assinaturas } = await admin
    .from('assinatura_push')
    .select('id, endpoint, p256dh, auth')
    .eq('perfil_id', record.destinatario_id)

  // 3) Envia para cada endpoint; apaga a que morreu (404/410 Gone).
  await Promise.all(
    (assinaturas ?? []).map(async (a) => {
      try {
        const sub = appServer.subscribe({
          endpoint: a.endpoint,
          keys: { p256dh: a.p256dh, auth: a.auth },
        })
        await sub.pushTextMessage(payload, {})
      } catch (err) {
        const status =
          (err as { response?: { status?: number }; status?: number })
            ?.response?.status ?? (err as { status?: number })?.status
        if (status === 404 || status === 410) {
          await admin.from('assinatura_push').delete().eq('id', a.id)
        } else {
          console.error('push falhou', a.endpoint, status, err)
        }
      }
    }),
  )

  return new Response('ok', { status: 200 })
})
