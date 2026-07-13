import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

// Presenca em tempo real (§issue #46). Todo usuario logado "marca presenca" no
// canal 'presenca-app'; admin/gerente veem quem esta online. Retorna um
// Map(id -> { nome, em }) — `em` = quando a pessoa entrou (p/ "online ha X").
// `online.has(id)` continua funcionando (Map). Opcional `aoEntrar`: dispara com
// os NOVOS que ficaram online (usado p/ avisar o admin).
//
// Roda no Painel (a casca do app), para valer em QUALQUER tela com o app aberto.
export function usePresenca(perfil, { aoEntrar } = {}) {
  const [online, setOnline] = useState(() => new Map())
  const aoEntrarRef = useRef(aoEntrar)
  aoEntrarRef.current = aoEntrar

  useEffect(() => {
    if (!perfil?.id) return
    let anterior = null // Set dos ids no sync anterior (null = 1o sync)
    const canal = supabase.channel('presenca-app', {
      config: { presence: { key: perfil.id } },
    })
    canal
      .on('presence', { event: 'sync' }, () => {
        const estado = canal.presenceState()
        const mapa = new Map()
        for (const [id, arr] of Object.entries(estado)) {
          const meta = arr[0] || {}
          mapa.set(id, { nome: meta.nome, em: meta.em })
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
        }
      })
    return () => {
      supabase.removeChannel(canal)
    }
  }, [perfil?.id])

  return online
}

// "online ha X" a partir do timestamp de entrada. Aproximado (usa o relogio de
// quem entrou); serve para o gestor ter uma nocao, nao para cronometrar.
export function textoOnline(em) {
  if (!em) return 'online'
  const min = Math.max(0, Math.floor((Date.now() - em) / 60000))
  if (min < 1) return 'online agora'
  if (min < 60) return `online há ${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return `online há ${h}h${m > 0 ? String(m).padStart(2, '0') : ''}`
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
