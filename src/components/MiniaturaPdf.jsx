import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatarTamanho } from '../lib/anexos'
import Icone from './Icone'

// Miniatura + "card" de um PDF de entrada (#31). Diferencia o PDF de uma foto:
// no hero grande mostra a 1a pagina + um rodape (selo PDF, nome, "N paginas ·
// tamanho"); nas thumbs pequenas mostra a 1a pagina + um selo "PDF" no canto.
//
// O pdf.js e pesado -> carregado SOB DEMANDA (import() dinamico = chunk lazy,
// so baixa quando ha PDF pra mostrar). Renderiza uma vez e cacheia por caminho.
// Enquanto renderiza / se falhar, cai no icone de arquivo — nada quebra.

const cache = new Map() // caminho_storage -> { thumb, paginas, tamanho }

async function renderizarPdf(caminho) {
  // Baixa os bytes pelo cliente (RLS-protegido, sem depender de CORS).
  const { data, error } = await supabase.storage.from('anexos').download(caminho)
  if (error || !data) throw error || new Error('sem dados')
  const tamanho = data.size
  const bytes = new Uint8Array(await data.arrayBuffer())

  // pdf.js sob demanda (+ o worker como URL, do jeito que o Vite entende).
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default

  const pdf = await pdfjs.getDocument({ data: bytes }).promise
  const paginas = pdf.numPages
  const page = await pdf.getPage(1)
  const base = page.getViewport({ scale: 1 })
  const escala = Math.min(2, 480 / base.width) // alvo ~480px de largura
  const viewport = page.getViewport({ scale: escala })

  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise

  return { thumb: canvas.toDataURL('image/jpeg', 0.72), paginas, tamanho }
}

export default function MiniaturaPdf({ caminho, alt, grande }) {
  const [dados, setDados] = useState(() => cache.get(caminho) || null)

  useEffect(() => {
    if (cache.has(caminho)) {
      setDados(cache.get(caminho))
      return
    }
    let vivo = true
    renderizarPdf(caminho)
      .then((d) => {
        cache.set(caminho, d)
        if (vivo) setDados(d)
      })
      .catch(() => {}) // falhou -> mantem o icone (fallback)
    return () => {
      vivo = false
    }
  }, [caminho])

  const previa = dados?.thumb ? (
    <img className="pdf-thumb" src={dados.thumb} alt={alt || 'PDF'} loading="lazy" />
  ) : (
    <span className="hero-arquivo">
      <Icone nome="arquivo" size={grande ? 44 : 22} />
    </span>
  )

  // Thumb pequena: so a previa + selo "PDF" no canto.
  if (!grande) {
    return (
      <span className="pdf-mini">
        {previa}
        <span className="pdf-mini-badge">PDF</span>
      </span>
    )
  }

  // Hero grande: card com previa + rodape (selo, nome, paginas · tamanho).
  const meta = dados
    ? `${dados.paginas} página${dados.paginas > 1 ? 's' : ''} · ${formatarTamanho(dados.tamanho)}`
    : null
  return (
    <span className="pdf-card">
      <span className="pdf-card-previa">{previa}</span>
      <span className="pdf-card-rodape">
        <span className="pdf-badge">PDF</span>
        <span className="pdf-card-info">
          <span className="pdf-card-nome">{alt}</span>
          {meta && <span className="pdf-card-meta">{meta}</span>}
        </span>
      </span>
    </span>
  )
}
