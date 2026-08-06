import { useEffect, useState } from 'react'

// Estamos numa tela de DESKTOP? (§issue #83, modo desktop)
//
// O corte e por LARGURA MINIMA (>= 900px), nao por orientacao: celular
// deitado continua com a cara de app. O hook existe porque o menu lateral e
// o bottom-nav sao COMPONENTES diferentes — o que nao vale para o tamanho
// atual nao deve nem montar (esconder por CSS deixaria dois menus vivos no
// DOM disputando foco e eventos). Reage ao vivo se a janela redimensionar.
const CONSULTA = '(min-width: 900px)'

export function useDesktop() {
  const [desktop, setDesktop] = useState(
    () => window.matchMedia(CONSULTA).matches,
  )

  useEffect(() => {
    const mq = window.matchMedia(CONSULTA)
    const aoMudar = (e) => setDesktop(e.matches)
    mq.addEventListener('change', aoMudar)
    return () => mq.removeEventListener('change', aoMudar)
  }, [])

  return desktop
}
