import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ehImagem, enviarAnexo, validarArquivo } from '../lib/anexos'
import Lightbox from './Lightbox'
import MiniaturaPdf from './MiniaturaPdf'
import Icone from './Icone'

// "Hero" do detalhe: os anexos de ENTRADA (o que o vendedor enviou — o
// "produto"). Imagem = miniatura (abre no lightbox); PDF/outro = icone (abre
// em nova guia); contador no canto + faixa de miniaturas. O vendedor DONO pode
// ADICIONAR e REMOVER, mas SO enquanto a demanda esta "Nao iniciado" (§C4).
export default function CarrosselEntrada({ demanda, perfil }) {
  const [anexos, setAnexos] = useState([])
  const [urls, setUrls] = useState({}) // caminho_storage -> signedUrl (imagens)
  const [selecionado, setSelecionado] = useState(0)
  const [lightboxIdx, setLightboxIdx] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  // Gerenciar entrada: so o vendedor dono, e SO enquanto "nao iniciado".
  const podeGerenciar =
    perfil.id === demanda.vendedor_id && demanda.status === 'nao_iniciado'

  async function carregar() {
    setCarregando(true)
    const { data } = await supabase
      .from('anexo')
      .select('id, nome_original, caminho_storage')
      .eq('demanda_id', demanda.id)
      .eq('tipo', 'entrada')
      .order('created_at')
    const lista = data || []
    setAnexos(lista)
    setSelecionado((s) => Math.min(s, Math.max(0, lista.length - 1)))

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

  useEffect(() => {
    carregar()
  }, [demanda.id])

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

  async function enviar(file) {
    if (!file) return
    setErro('')
    const problema = validarArquivo('entrada', file)
    if (problema) {
      setErro(problema)
      return
    }
    setEnviando(true)
    const { error } = await enviarAnexo(demanda.id, 'entrada', file)
    if (error) setErro(error)
    else await carregar()
    setEnviando(false)
  }

  async function remover(a) {
    if (!window.confirm(`Remover "${a.nome_original}"?`)) return
    await supabase.storage.from('anexos').remove([a.caminho_storage])
    const { error } = await supabase.from('anexo').delete().eq('id', a.id)
    if (error) setErro('Não foi possível remover o anexo.')
    else carregar()
  }

  // Miniatura de um anexo: imagem (thumb) ou placeholder de PDF/arquivo.
  function preview(a, grande) {
    const url = urls[a.caminho_storage]
    if (ehImagem(a.nome_original) && url) {
      return <img src={url} alt={a.nome_original} loading="lazy" />
    }
    // PDF: miniatura da 1a pagina (pdf.js sob demanda); fallback = icone (#31).
    if (/\.pdf$/i.test(a.nome_original)) {
      return (
        <MiniaturaPdf
          caminho={a.caminho_storage}
          alt={a.nome_original}
          grande={grande}
        />
      )
    }
    return (
      <span className="hero-arquivo">
        <Icone nome="arquivo" size={grande ? 44 : 22} />
        {grande && <span className="hero-arquivo-nome">{a.nome_original}</span>}
      </span>
    )
  }

  // Botoes de adicionar: escolher arquivo OU tirar foto (camera no celular).
  const botaoAdicionar = podeGerenciar && (
    <div className="hero-add-acoes">
      {enviando ? (
        <span className="hero-add hero-add-enviando">Enviando…</span>
      ) : (
        <>
          <label className="hero-add">
            <Icone nome="mais" size={16} /> Adicionar
            <input
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              onChange={(e) => {
                enviar(e.target.files[0])
                e.target.value = ''
              }}
            />
          </label>
          <label className="hero-add">
            <Icone nome="camera" size={16} /> Tirar foto
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                enviar(e.target.files[0])
                e.target.value = ''
              }}
            />
          </label>
        </>
      )}
    </div>
  )

  if (carregando) {
    return <div className="hero-anexo hero-anexo-vazio">Carregando…</div>
  }

  const atual = anexos[Math.min(selecionado, anexos.length - 1)] ?? anexos[0]

  return (
    <div className="hero-anexo">
      {anexos.length === 0 ? (
        <div className="hero-anexo-vazio">
          <Icone nome="lista" size={34} />
          <span>Sem anexos de entrada</span>
        </div>
      ) : (
        <>
          <div className="hero-principal-wrap">
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
            {podeGerenciar && (
              <button
                type="button"
                className="hero-remover"
                onClick={() => remover(atual)}
                aria-label="Remover este anexo"
                title="Remover este anexo"
              >
                <Icone nome="lixeira" size={16} />
              </button>
            )}
          </div>

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
        </>
      )}

      {botaoAdicionar}
      {erro && <p className="erro">{erro}</p>}

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
