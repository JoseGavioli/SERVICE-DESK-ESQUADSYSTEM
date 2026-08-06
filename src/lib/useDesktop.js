import { useEffect, useState } from 'react'

// Estamos numa tela de DESKTOP? (§issue #83, modo desktop)
//
// O corte e por LARGURA MINIMA (>= 900px), nao por orientacao: celular
// deitado continua com a cara de app. O hook existe porque o menu lateral e
// o bottom-nav sao COMPONENTES diferentes — o que nao vale para o tamanho
// atual nao deve nem montar (esconder por CSS deixaria dois menus vivos no
// DOM disputando foco e eventos). Reage ao vivo se a janela redimensionar.
const CONSULTA = '(min-width: 900px)'
// A LISTA + DETALHE lado a lado (§B4) pede mais espaco que o resto do modo
// desktop: em 900px sobrariam ~210px para o detalhe depois do menu e da lista
// — pior que a tela cheia. Por isso o split tem um corte proprio.
const CONSULTA_LARGA = '(min-width: 1200px)'

function useConsulta(consulta) {
  const [bate, setBate] = useState(() => window.matchMedia(consulta).matches)

  useEffect(() => {
    const mq = window.matchMedia(consulta)
    const aoMudar = (e) => setBate(e.matches)
    mq.addEventListener('change', aoMudar)
    return () => mq.removeEventListener('change', aoMudar)
  }, [consulta])

  return bate
}

export function useDesktop() {
  return useConsulta(CONSULTA)
}

// Tela larga o bastante para as DUAS colunas da tela de demandas (§#83 B4).
export function useTelaLarga() {
  return useConsulta(CONSULTA_LARGA)
}
