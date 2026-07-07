// Gera o par de chaves VAPID para o Web Push (#14), no formato que a Edge
// Function `enviar-push` espera (@negrel/webpush 0.5.0).
//
// A versao 0.5.0 NAO expoe mais o subcomando ./cmd/generate-vapid-keys, entao
// chamamos os helpers do modulo principal aqui.
//
// COMO RODAR (precisa do Deno):
//   deno run jsr:... nao; rode este arquivo:
//   deno run supabase/gera-vapid-keys.ts > vapid.json
//
// Resultado:
//   - STDOUT  -> vapid.json  = o JSON de JWKs  -> vai no secret VAPID_KEYS
//   - STDERR  -> a chave publica base64url     -> vai em VITE_VAPID_PUBLIC_KEY
//
// Guarde o vapid.json com seguranca e NAO o commite.
import {
  generateVapidKeys,
  exportVapidKeys,
  exportApplicationServerKey,
} from 'jsr:@negrel/webpush@0.5.0'

// extractable: true para conseguir exportar as chaves geradas.
const keys = await generateVapidKeys({ extractable: true })

const jwks = await exportVapidKeys(keys) // { publicKey, privateKey } (JWK)
const appServerKey = await exportApplicationServerKey(keys) // base64url

// stdout: o JSON que vira o secret VAPID_KEYS.
console.log(JSON.stringify(jwks, null, 2))

// stderr: a chave publica para o frontend (nao "suja" o vapid.json).
console.error('\n──────────────────────────────────────────────')
console.error('VITE_VAPID_PUBLIC_KEY (frontend / Vercel):')
console.error(appServerKey)
console.error('──────────────────────────────────────────────')
