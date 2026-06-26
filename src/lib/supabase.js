// ───────────────────────────────────────────────────────────────
// Cliente central do Supabase.
//
// Toda a comunicacao do app com o backend (login/Auth, banco de dados
// e storage) passa por ESTE objeto unico, importado de onde precisar.
// Ter um so lugar evita repeticao e mantem a configuracao num ponto so.
// ───────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

// As chaves NAO ficam escritas no codigo: vem do arquivo .env.local,
// que nunca vai pro Git. No Vite, variaveis expostas ao frontend
// precisam comecar com VITE_ e sao lidas via import.meta.env.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Checagem amigavel: se faltar alguma variavel, avisamos cedo e claro,
// em vez de deixar estourar um erro confuso mais para a frente.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Faltam variaveis de ambiente do Supabase. ' +
    'Confira o arquivo .env.local (use o .env.example como modelo).'
  )
}

// createClient monta o "cliente" que sabe conversar com o SEU projeto.
// A chave publishable (anon) e segura no frontend: a protecao real dos
// dados acontece na RLS (Row Level Security) la no banco.
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
