// Gera UM par de chaves VAPID para o Web Push (#14) no formato do
// @negrel/webpush 0.5.0 e IMPRIME as duas chaves na tela (sem arquivo, pra
// evitar pegadinha de redirect/encoding no PowerShell).
//
// COMO RODAR (precisa do Deno), a partir da RAIZ do projeto:
//   deno run supabase/gera-vapid-keys.ts
//
// Depois copie da saida:
//   - VAPID_KEYS            -> secret do Supabase (Edge Function)
//   - VITE_VAPID_PUBLIC_KEY -> Env Var da Vercel (e .env.local)
//
// As DUAS saem do MESMO par — e o que garante que servidor e navegador batem.
import {
  generateVapidKeys,
  exportVapidKeys,
  exportApplicationServerKey,
} from 'jsr:@negrel/webpush@0.5.0'

// extractable: true para conseguir exportar as chaves geradas.
const keys = await generateVapidKeys({ extractable: true })

const jwks = await exportVapidKeys(keys) // { publicKey, privateKey } (JWK)
const appServerKey = await exportApplicationServerKey(keys) // base64url

console.log('')
console.log('================  VAPID_KEYS  ================')
console.log('(secret do Supabase — cole TUDO abaixo, 1 linha)')
console.log(JSON.stringify(jwks))
console.log('')
console.log('==========  VITE_VAPID_PUBLIC_KEY  ===========')
console.log('(Vercel + .env.local)')
console.log(appServerKey)
console.log('==============================================')
console.log('')
