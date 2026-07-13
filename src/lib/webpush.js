// Web Push no CLIENTE — só APIs nativas (Notification, PushManager,
// ServiceWorkerRegistration), sem biblioteca. Guarda/apaga a assinatura do
// aparelho na tabela `assinatura_push`. O ENVIO do push é do servidor (uma
// Edge Function, nas próximas fases).
import { supabase } from './supabase'

// Chave PÚBLICA VAPID (base64url), definida na Vercel como VITE_VAPID_PUBLIC_KEY.
// A privada é segredo do servidor — nunca entra aqui.
const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY

export function pushSuportado() {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

// iOS/iPadOS só expõe o PushManager quando o PWA está INSTALADO na tela inicial
// (standalone). Fora disso, não dá para assinar — avisamos para instalar.
export function precisaInstalarNoIOS() {
  const ehIOS = /iP(hone|ad|od)/.test(navigator.userAgent)
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  return ehIOS && !standalone
}

// VAPID pública (base64url) -> Uint8Array, formato exigido pelo
// applicationServerKey do subscribe().
function base64UrlParaUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

// A assinatura existente foi criada com a MESMA chave VAPID de agora? Se a
// chave do servidor mudou (rotacao), a assinatura velha vira "lixo": o
// subscribe() com a chave nova daria erro ("different applicationServerKey")
// e o servidor (chave nova) nao consegue mais enviar para ela. Comparamos os
// bytes da chave guardada na assinatura (sub.options.applicationServerKey) com
// a atual. Se nao der para conferir (navegador sem options), tratamos como
// DIFERENTE, por seguranca (re-assina).
function mesmaChaveVapid(sub, chaveAtual) {
  const guardada = sub.options && sub.options.applicationServerKey
  if (!guardada) return false
  const a = new Uint8Array(guardada)
  const b = new Uint8Array(chaveAtual)
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

// Grava (ou atualiza, por endpoint) a assinatura deste aparelho.
async function salvarAssinatura(sub) {
  const json = sub.toJSON() // { endpoint, keys: { p256dh, auth } }
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('sem_sessao')

  const { error } = await supabase.from('assinatura_push').upsert(
    {
      perfil_id: user.id,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: navigator.userAgent,
    },
    { onConflict: 'endpoint' },
  )
  if (error) throw error
}

// Estado do push neste aparelho, para a UI decidir o que mostrar:
//   'nao_suportado' | 'ios_instalar' | 'negado' | 'ligado' | 'desligado'
// Usa getRegistration() (resolve na hora) em vez de .ready (que esperaria um SW).
export async function estadoPush() {
  if (!pushSuportado()) {
    return precisaInstalarNoIOS() ? 'ios_instalar' : 'nao_suportado'
  }
  if (Notification.permission === 'denied') return 'negado'
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = reg ? await reg.pushManager.getSubscription() : null
  return sub ? 'ligado' : 'desligado'
}

// LIGAR — precisa ser chamado DENTRO de um gesto do usuário (onClick), pois
// Notification.requestPermission() exige interação.
export async function ativarPush() {
  if (!pushSuportado()) throw new Error('nao_suportado')
  if (!VAPID_PUBLIC) throw new Error('sem_chave_vapid')

  const permissao = await Notification.requestPermission()
  if (permissao !== 'granted') throw new Error('permissao_negada')

  const reg = await navigator.serviceWorker.ready
  const chave = base64UrlParaUint8Array(VAPID_PUBLIC)

  let sub = await reg.pushManager.getSubscription()
  // Se ja existe assinatura mas de uma chave VAPID ANTIGA (pos-rotacao),
  // remove antes de assinar de novo — senao ficaria presa na chave velha
  // (era isso que travava o Windows/Edge apos a troca de chave).
  if (sub && !mesmaChaveVapid(sub, chave)) {
    await sub.unsubscribe()
    sub = null
  }
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: chave,
    })
  }
  await salvarAssinatura(sub)
}

// DESLIGAR neste aparelho: apaga do banco e cancela a subscription local.
export async function desativarPush() {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = reg ? await reg.pushManager.getSubscription() : null
  if (sub) {
    await supabase.from('assinatura_push').delete().eq('endpoint', sub.endpoint)
    await sub.unsubscribe()
  }
}

// Re-sincroniza no boot (quando a permissão já é 'granted'): garante que a
// assinatura atual está salva, cobrindo rotação/expiração sem depender do
// frágil evento pushsubscriptionchange. (Usado a partir da Fase 5.)
export async function sincronizarPush() {
  if (!pushSuportado() || Notification.permission !== 'granted') return
  if (!VAPID_PUBLIC) return
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) return
  let sub = await reg.pushManager.getSubscription()
  if (!sub) return // nao tinha assinatura -> nada a sincronizar (liga no toggle)

  // AUTO-CONSERTO: se a assinatura e de uma chave VAPID antiga, troca pela
  // atual sem precisar do usuario mexer no toggle. Como a permissao ja e
  // 'granted', da para assinar de novo aqui mesmo, no boot. Resolve sozinho o
  // aparelho que ficou preso na chave velha (ex.: o PWA do Windows).
  const chave = base64UrlParaUint8Array(VAPID_PUBLIC)
  if (!mesmaChaveVapid(sub, chave)) {
    await sub.unsubscribe()
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: chave,
    })
  }
  await salvarAssinatura(sub)
}
