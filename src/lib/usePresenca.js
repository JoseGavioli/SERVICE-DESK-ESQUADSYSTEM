import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Presenca em tempo real (§issue #46): todo usuario logado "marca presenca"
// num canal compartilhado, e quem observa (admin/gerente) ve quem esta online.
// Usa o Presence do Supabase Realtime — NAO precisa de tabela/migracao. A chave
// de presenca e o id do perfil; entao presenceState() lista os ids online.
//
// Roda no Painel (a casca do app), para a presenca valer em QUALQUER tela
// enquanto o app esta aberto — nao so quando se abre a Equipe. Todo mundo
// marca presenca; a REGRA de quem PODE VER fica na UI (Equipe).
export function usePresenca(perfil) {
  const [online, setOnline] = useState(() => new Set())

  useEffect(() => {
    if (!perfil?.id) return
    const canal = supabase.channel('presenca-app', {
      config: { presence: { key: perfil.id } },
    })
    canal
      .on('presence', { event: 'sync' }, () => {
        // As chaves do presenceState sao os ids dos perfis online.
        setOnline(new Set(Object.keys(canal.presenceState())))
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          canal.track({ id: perfil.id }) // entra na lista de presentes
        }
      })
    return () => {
      supabase.removeChannel(canal)
    }
  }, [perfil?.id])

  return online
}
