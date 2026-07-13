import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

// Presenca em tempo real (§issue #46). Todo usuario logado "marca presenca" no
// canal 'presenca-app'; admin/gerente veem quem esta online. Retorna:
//   { online, ultimoVisto }
//   - online:      Map(id -> { nome, em }) — quem esta online AGORA (ao vivo).
//   - ultimoVisto: Map(id -> ms) — a ultima vez que vimos cada pessoa online
//     NESTA sessao (para o "online ha X" logo que ela sai, sem re-buscar).
// Opcional `aoEntrar`: dispara com os NOVOS que ficaram online (avisa o admin).
//
// Alem da presenca ao vivo, grava um "heartbeat" no banco (registrar_presenca)
// a cada ~60s enquanto online — assim o `perfil.visto_em` guarda o ultimo
// momento online, e conseguimos mostrar "online ha X" de quem JA saiu (inclusive
// de quem saiu ANTES de voce abrir o app). Ver migracao 0033.
//
// Roda no Painel (a casca do app), para valer em QUALQUER tela com o app aberto.
export function usePresenca(perfil, { aoEntrar } = {}) {
  const [online, setOnline] = useState(() => new Map())
  const ultimoVisto = useRef(new Map()) // id -> ms (ultima vez visto online aqui)
  const aoEntrarRef = useRef(aoEntrar)
  aoEntrarRef.current = aoEntrar

  useEffect(() => {
    if (!perfil?.id) return
    let anterior = null // Set dos ids no sync anterior (null = 1o sync)
    let heartbeat = null
    const canal = supabase.channel('presenca-app', {
      config: { presence: { key: perfil.id } },
    })
    canal
      .on('presence', { event: 'sync' }, () => {
        const estado = canal.presenceState()
        const mapa = new Map()
        const agora = Date.now()
        for (const [id, arr] of Object.entries(estado)) {
          const meta = arr[0] || {}
          mapa.set(id, { nome: meta.nome, em: meta.em })
          ultimoVisto.current.set(id, agora) // visto online AGORA
        }
        const atual = new Set(mapa.keys())
        // Quem ENTROU agora (novo vs o sync anterior). Pula o 1o sync (senao
        // avisaria de todo mundo que ja estava online) e a propria sessao.
        if (anterior && aoEntrarRef.current) {
          const novos = [...atual].filter(
            (id) => !anterior.has(id) && id !== perfil.id,
          )
          if (novos.length) {
            aoEntrarRef.current(novos.map((id) => ({ id, ...mapa.get(id) })))
          }
        }
        anterior = atual
        setOnline(mapa)
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          canal.track({
            id: perfil.id,
            nome: perfil.nome_completo,
            em: Date.now(),
          })
          // Heartbeat: grava "visto por ultimo" no banco (ver migracao 0033).
          // O .then() e necessario: no supabase-js o rpc so DISPARA quando a
          // promise e consumida; o 2o arg engole erro (RPC/rede) em silencio.
          const bater = () =>
            supabase.rpc('registrar_presenca').then(
              () => {},
              () => {},
            )
          bater()
          heartbeat = setInterval(bater, 60000)
        }
      })
    return () => {
      if (heartbeat) clearInterval(heartbeat)
      supabase.removeChannel(canal)
    }
  }, [perfil?.id])

  return { online, ultimoVisto: ultimoVisto.current }
}

// Ultimo momento (ms) em que a pessoa foi vista online: o MAIOR entre o que
// observamos ao vivo nesta sessao (ultimoVisto) e o `visto_em` salvo no banco.
// Retorna null se nunca houve registro. (O "ao vivo" cobre quem sai enquanto
// voce olha; o do banco cobre quem ja estava offline quando voce abriu o app.)
export function ultimoVistoMs(id, ultimoVisto, vistoEmDb) {
  const local = ultimoVisto?.get(id) || 0
  const db = vistoEmDb ? new Date(vistoEmDb).getTime() : 0
  return Math.max(local, db) || null
}

// Rotulo de presenca. Se estiver online AO VIVO -> "online". Se estiver offline
// -> "online ha X" a partir do ultimo momento visto (ms). Sem registro nenhum
// -> "offline". Aproximado (heartbeat de ~60s) — e feature de curiosidade.
export function textoPresenca(aoVivo, vistoMs) {
  if (aoVivo) return 'online'
  if (!vistoMs) return 'offline'
  const min = Math.max(0, Math.floor((Date.now() - vistoMs) / 60000))
  if (min < 1) return 'online há instantes'
  if (min < 60) return `online há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) {
    const m = min % 60
    return `online há ${h}h${m > 0 ? String(m).padStart(2, '0') : ''}`
  }
  const dias = Math.floor(h / 24)
  return `online há ${dias}d`
}

// Forca um re-render a cada `ms` — para o "online ha X" ir atualizando sozinho
// enquanto a tela fica aberta (a presenca so avisa em mudancas, nao no tempo).
export function useTique(ms = 30000) {
  const [, set] = useState(0)
  useEffect(() => {
    const t = setInterval(() => set((n) => n + 1), ms)
    return () => clearInterval(t)
  }, [ms])
}
