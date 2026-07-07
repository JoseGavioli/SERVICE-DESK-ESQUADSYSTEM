import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Icone from './Icone'

// Miniatura da 1a pagina de um PDF (#31). O pdf.js e pesado, entao e carregado
// SOB DEMANDA (import() dinamico -> chunk separado, so baixa quando ha PDF pra
// mostrar). Renderiza uma vez e cacheia por caminho (a mesma miniatura serve o
// hero grande e a faixa de thumbs). Enquanto renderiza (ou se falhar), cai no
// icone de arquivo — nada quebra.

const cache = new Map() // caminho_storage -> dataURL (jpeg)

async function renderizarPdf(caminho) {
  // Baixa os bytes pelo cliente (RLS-protegido, sem depender de CORS).
  const { data, error } = await supabase.storage.from('anexos').download(caminho)
  if (error || !data) throw error || new Error('sem dados')
  const bytes = new Uint8Array(await data.arrayBuffer())

  // pdf.js sob demanda (+ o worker como URL, do jeito que o Vite entende).
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default

  const pdf = await pdfjs.getDocument({ data: bytes }).promise
  const page = await pdf.getPage(1)
  const base = page.getViewport({ scale: 1 })
  const escala = Math.min(2, 480 / base.width) // alvo ~480px de largura
  const viewport = page.getViewport({ scale: escala })

  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise

  return canvas.toDataURL('image/jpeg', 0.72)
}

export default function MiniaturaPdf({ caminho, alt, grande }) {
  const [thumb, setThumb] = useState(() => cache.get(caminho) || null)

  useEffect(() => {
    if (cache.has(caminho)) {
      setThumb(cache.get(caminho))
      return
    }
    let vivo = true
    renderizarPdf(caminho)
      .then((d) => {
        cache.set(caminho, d)
        if (vivo) setThumb(d)
      })
      .catch(() => {}) // falhou -> mantem o icone (fallback)
    return () => {
      vivo = false
    }
  }, [caminho])

  if (thumb) {
    return <img className="pdf-thumb" src={thumb} alt={alt || 'PDF'} loading="lazy" />
  }
  // Fallback enquanto renderiza (ou em erro): o mesmo icone de antes.
  return (
    <span className="hero-arquivo">
      <Icone nome="arquivo" size={grande ? 44 : 22} />
      {grande && alt && <span className="hero-arquivo-nome">{alt}</span>}
    </span>
  )
}
