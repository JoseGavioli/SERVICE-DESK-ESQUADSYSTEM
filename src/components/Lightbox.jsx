import { useEffect, useRef, useState } from 'react'
import Icone from './Icone'

// Visualizador de imagens em tela cheia, com carrossel (‹ ›, setas) e
// zoom (🔍 +/−, e arrastar para mover quando ampliado). Recebe a lista
// de imagens [{ url, nome }] e o indice inicial.
export default function Lightbox({ imagens, indiceInicial, aoFechar }) {
  const [i, setI] = useState(indiceInicial)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const arraste = useRef(null) // { x, y, panX, panY } durante o arrasto

  const atual = imagens[i]
  const temVarias = imagens.length > 1

  function resetarVista() {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }
  function anterior() {
    setI((v) => (v - 1 + imagens.length) % imagens.length)
    resetarVista()
  }
  function proxima() {
    setI((v) => (v + 1) % imagens.length)
    resetarVista()
  }
  function maisZoom() {
    setZoom((z) => Math.min(z + 0.5, 4))
  }
  function menosZoom() {
    setZoom((z) => {
      const novo = Math.max(z - 0.5, 1)
      if (novo === 1) setPan({ x: 0, y: 0 })
      return novo
    })
  }

  // Teclado: Esc fecha, setas navegam, +/- dao zoom.
  useEffect(() => {
    function aoTeclar(e) {
      if (e.key === 'Escape') aoFechar()
      else if (e.key === 'ArrowLeft' && temVarias) anterior()
      else if (e.key === 'ArrowRight' && temVarias) proxima()
      else if (e.key === '+' || e.key === '=') maisZoom()
      else if (e.key === '-') menosZoom()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [temVarias, imagens.length])

  // Arrastar para mover a imagem quando ela esta ampliada.
  // Pointer Events funcionam para mouse E toque (celular) num so conjunto.
  function aoPressionar(e) {
    if (zoom === 1) return
    arraste.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
    // segue o ponteiro mesmo se o dedo/cursor sair da area
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  function aoMover(e) {
    if (!arraste.current) return
    setPan({
      x: arraste.current.panX + (e.clientX - arraste.current.x),
      y: arraste.current.panY + (e.clientY - arraste.current.y),
    })
  }
  function aoSoltar() {
    arraste.current = null
  }

  return (
    <div className="lightbox" role="dialog" aria-modal="true">
      <div className="lightbox-barra">
        <button
          type="button"
          onClick={menosZoom}
          disabled={zoom <= 1}
          aria-label="Diminuir zoom"
        >
          <Icone nome="zoom-menos" size={20} />
        </button>
        <span className="zoom-nivel">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          onClick={maisZoom}
          disabled={zoom >= 4}
          aria-label="Aumentar zoom"
        >
          <Icone nome="zoom-mais" size={20} />
        </button>
        <button type="button" onClick={aoFechar} aria-label="Fechar">
          <Icone nome="fechar" size={20} />
        </button>
      </div>

      {temVarias && (
        <button
          type="button"
          className="nav nav-ant"
          onClick={anterior}
          aria-label="Imagem anterior"
        >
          ‹
        </button>
      )}

      <div
        className="lightbox-palco"
        onPointerDown={aoPressionar}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerCancel={aoSoltar}
        onClick={(e) => {
          // clicar no fundo (fora da imagem), sem zoom, fecha
          if (e.target === e.currentTarget && zoom === 1) aoFechar()
        }}
      >
        <img
          src={atual.url}
          alt={atual.nome}
          draggable={false}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            cursor: zoom > 1 ? 'grab' : 'default',
          }}
        />
      </div>

      {temVarias && (
        <button
          type="button"
          className="nav nav-prox"
          onClick={proxima}
          aria-label="Próxima imagem"
        >
          ›
        </button>
      )}

      <div className="lightbox-legenda">
        {atual.nome}
        {temVarias ? ` · ${i + 1}/${imagens.length}` : ''}
      </div>
    </div>
  )
}
