// Gera UM par de chaves VAPID para o Web Push (#14) no formato do
// @negrel/webpush 0.5.0 e GRAVA em ARQUIVOS (nao imprime no terminal — copiar
// JSON longo de terminal quebra a linha e corrompe o valor).
//
// COMO RODAR (precisa do Deno), a partir da RAIZ do projeto:
//   deno run --allow-write supabase/gera-vapid-keys.ts
//
// Gera 2 arquivos (na raiz). Abra cada um, Ctrl+A, Ctrl+C e cole:
//   vapid-keys.txt    ->  secret VAPID_KEYS         (Supabase / Edge Function)
//   vapid-public.txt  ->  VITE_VAPID_PUBLIC_KEY     (Vercel + .env.local)
//
// As duas saem do MESMO par (o que faz servidor e navegador baterem).
// Os arquivos tem a chave PRIVADA — ja estao no .gitignore, NAO commite.
import {
  generateVapidKeys,
  exportVapidKeys,
  exportApplicationServerKey,
} from 'jsr:@negrel/webpush@0.5.0'

// extractable: true para conseguir exportar as chaves geradas.
const keys = await generateVapidKeys({ extractable: true })

const jwks = JSON.stringify(await exportVapidKeys(keys)) // 1 linha, sem quebras
const appServerKey = await exportApplicationServerKey(keys) // base64url

await Deno.writeTextFile('vapid-keys.txt', jwks)
await Deno.writeTextFile('vapid-public.txt', appServerKey)

console.log('')
console.log('Chaves geradas (do MESMO par). Abra cada arquivo, Ctrl+A/Ctrl+C e cole:')
console.log('  vapid-keys.txt    ->  secret VAPID_KEYS       (Supabase)')
console.log('  vapid-public.txt  ->  VITE_VAPID_PUBLIC_KEY   (Vercel + .env.local)')
console.log('')
console.log('NAO commite esses arquivos (tem a chave privada).')
console.log('')
