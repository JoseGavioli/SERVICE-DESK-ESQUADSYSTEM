import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

// Colunas buscadas (com autor e cliente para descrever a notificacao).
const SELECT =
  'id, tipo, lida, created_at, demanda_id, de_status, para_status, autor:perfil!autor_id(nome_completo), demanda(tipo_demanda(nome), obra(cliente(nome)))'

// Concentra as notificacoes do usuario: carrega a lista, ESCUTA novas em
// tempo real (Supabase Realtime), dispara o pop-up (toast) e expoe acoes
// para marcar como lida. Fonte unica do sino, da tela e do pop-up.
export function useNotificacoes(perfil) {
  const [notificacoes, setNotificacoes] = useState([])
  const [toast, setToast] = useState(null)

  const carregar = useCallback(async () => {
    if (!perfil) return
    const { data } = await supabase
      .from('notificacao')
      .select(SELECT)
      .order('created_at', { ascending: false })
      .limit(100)
    if (data) setNotificacoes(data)
  }, [perfil])

  useEffect(() => {
    carregar()
  }, [carregar])

  // Tempo real: chegou notificacao para mim -> busca com os dados
  // relacionados, poe no topo da lista e mostra o pop-up.
  useEffect(() => {
    if (!perfil) return
    const canal = supabase
      .channel(`notif-${perfil.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificacao',
          filter: `destinatario_id=eq.${perfil.id}`,
        },
        async (payload) => {
          const { data } = await supabase
            .from('notificacao')
            .select(SELECT)
            .eq('id', payload.new.id)
            .single()
          if (data) {
            setNotificacoes((prev) => [
              data,
              ...prev.filter((n) => n.id !== data.id),
            ])
            setToast(data)
          }
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [perfil])

  const naoLidas = notificacoes.filter((n) => !n.lida).length

  async function marcarLida(id) {
    setNotificacoes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, lida: true } : n)),
    )
    await supabase.from('notificacao').update({ lida: true }).eq('id', id)
  }

  async function marcarTodasLidas() {
    setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })))
    await supabase
      .from('notificacao')
      .update({ lida: true })
      .eq('destinatario_id', perfil.id)
      .eq('lida', false)
  }

  // Marca como lidas TODAS as notificacoes de uma demanda (ao abri-la).
  async function marcarLidaDemanda(demandaId) {
    setNotificacoes((prev) =>
      prev.map((n) => (n.demanda_id === demandaId ? { ...n, lida: true } : n)),
    )
    if (!perfil) return
    await supabase
      .from('notificacao')
      .update({ lida: true })
      .eq('destinatario_id', perfil.id)
      .eq('demanda_id', demandaId)
      .eq('lida', false)
  }

  // Apaga TODAS as notificacoes do usuario (a RLS garante que so as dele).
  async function limparTodas() {
    setNotificacoes([])
    if (!perfil) return
    await supabase
      .from('notificacao')
      .delete()
      .eq('destinatario_id', perfil.id)
  }

  const descartarToast = () => setToast(null)

  return {
    notificacoes,
    naoLidas,
    marcarLida,
    marcarLidaDemanda,
    marcarTodasLidas,
    limparTodas,
    toast,
    descartarToast,
  }
}
