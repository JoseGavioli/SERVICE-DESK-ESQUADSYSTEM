import { supabase } from './supabase'

// Helpers do avatar de usuario, compartilhados pelas telas (Equipe, lista de
// demandas, detalhe, comentarios, dashboard). A foto mora no bucket PUBLICO
// 'avatares' (migracao 0034), entao a URL e direta (sem assinar).

// Iniciais (ate 2 letras) — usadas quando o usuario ainda nao tem foto.
export function iniciais(nome) {
  if (!nome) return '?'
  const p = nome.trim().split(/\s+/)
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase()
}

// URL publica da foto a partir do caminho salvo em perfil.avatar_path.
export function urlAvatar(caminho) {
  if (!caminho) return null
  return supabase.storage.from('avatares').getPublicUrl(caminho).data.publicUrl
}
