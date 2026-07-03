import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ehImagem } from '../lib/anexos'
import Lightbox from './Lightbox'
import Icone from './Icone'

// "Hero" do detalhe: mostra os anexos de ENTRADA (o que o vendedor enviou —
// o "produto") como uma imagem grande + faixa de miniaturas + contador no
// canto. Imagem abre no lightbox (carrossel/zoom); PDF/outro abre em nova guia.
export default function CarrosselEntrada({ demandaId }) {
  const [anexos, setAnexos] = useState([])
  const [urls, setUrls] = useState({}) // caminho_storage -> signedUrl (imagens)
  const [selecionado, setSelecionado] = useState(0)
  const [lightboxIdx, setLightboxIdx] = useState(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      const { data } = await supabase
        .from('anexo')
        .select('id, nome_original, caminho_storage')
        .eq('demanda_id', demandaId)
        .eq('tipo', 'entrada')
        .order('created_at')
      const lista = data || []
      setAnexos(lista)
      setSelecionado(0)

      // Links assinados só das imagens (validade 1h) p/ miniatura/lightbox.
      const caminhos = lista
        .filter((a) => ehImagem(a.nome_original))
        .map((a) => a.caminho_storage)
      if (caminhos.length) {
        const { data: urlsData } = await supabase.storage
          .from('anexos')
          .createSignedUrls(caminhos, 3600)
        const mapa = {}
        if (urlsData)
          for (const u of urlsData) if (u.signedUrl) mapa[u.path] = u.signedUrl
        setUrls(mapa)
      } else {
        setUrls({})
      }
      setCarregando(false)
    }
    carregar()
  }, [demandaId])

  // Imagens (com link pronto) que alimentam o lightbox, na ordem exibida.
  const imagens = anexos
    .filter((a) => ehImagem(a.nome_original) && urls[a.caminho_storage])
    .map((a) => ({ id: a.id, url: urls[a.caminho_storage], nome: a.nome_original }))

  async function abrir(a) {
    if (ehImagem(a.nome_original) && urls[a.caminho_storage]) {
      const idx = imagens.findIndex((img) => img.id === a.id)
      setLightboxIdx(idx >= 0 ? idx : 0)
    } else {
      const { data } = await supabase.storage
        .from('anexos')
        .createSignedUrl(a.caminho_storage, 60)
      if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    }
  }

  if (carregando) {
    return <div className="hero-anexo hero-anexo-vazio">Carregando…</div>
  }

  if (anexos.length === 0) {
    return (
      <div className="hero-anexo hero-anexo-vazio">
        <Icone nome="lista" size={34} />
        <span>Sem anexos de entrada</span>
      </div>
    )
  }

  // Miniatura de um anexo: imagem (thumb) ou placeholder de PDF/arquivo.
  function preview(a, grande) {
    const url = urls[a.caminho_storage]
    if (ehImagem(a.nome_original) && url) {
      return <img src={url} alt={a.nome_original} loading="lazy" />
    }
    return (
      <span className="hero-arquivo">
        <Icone nome="arquivo" size={grande ? 44 : 22} />
        {grande && <span className="hero-arquivo-nome">{a.nome_original}</span>}
      </span>
    )
  }

  const atual = anexos[selecionado] ?? anexos[0]

  return (
    <div className="hero-anexo">
      <button
        type="button"
        className="hero-principal"
        onClick={() => abrir(atual)}
        title={atual.nome_original}
      >
        {preview(atual, true)}
        <span className="hero-contador">
          <Icone nome="lista" size={13} /> {anexos.length}
        </span>
      </button>

      {anexos.length > 1 && (
        <div className="hero-carrossel">
          {anexos.map((a, i) => (
            <button
              key={a.id}
              type="button"
              className={`hero-thumb ${i === selecionado ? 'ativo' : ''}`}
              onClick={() => setSelecionado(i)}
              title={a.nome_original}
            >
              {preview(a, false)}
            </button>
          ))}
        </div>
      )}

      {lightboxIdx !== null && (
        <Lightbox
          imagens={imagens}
          indiceInicial={lightboxIdx}
          aoFechar={() => setLightboxIdx(null)}
        />
      )}
    </div>
  )
}
