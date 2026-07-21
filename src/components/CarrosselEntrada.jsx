import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  comprimirImagemSePreciso,
  ehImagem,
  enviarAnexo,
  validarArquivo,
} from '../lib/anexos'
import { montarZip } from '../lib/zip'
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
  const [progresso, setProgresso] = useState('') // "2 de 5" (so com varios)
  const [baixandoZip, setBaixandoZip] = useState(false)
  const [progressoZip, setProgressoZip] = useState('') // "2 de 5" no download
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

  // Aceita VARIOS arquivos de uma vez. Manda um por vez (em serie) de proposito:
  // sao fotos de celular, e disparar N uploads simultaneos travaria a conexao —
  // em serie ainda da p/ mostrar "2 de 5". Um arquivo problematico NAO impede os
  // outros: seguimos e, no fim, dizemos quais falharam.
  async function enviar(files) {
    const lista = [...(files || [])]
    if (!lista.length) return
    setErro('')
    setEnviando(true) // cobre a compressao + o upload
    const falhas = []
    for (let i = 0; i < lista.length; i++) {
      const file = lista[i]
      setProgresso(lista.length > 1 ? `${i + 1} de ${lista.length}` : '')
      const arquivo = await comprimirImagemSePreciso(file) // #41
      const problema = validarArquivo('entrada', arquivo)
      if (problema) {
        falhas.push(`${file.name}: ${problema}`)
        continue
      }
      const { error } = await enviarAnexo(demanda.id, 'entrada', arquivo)
      if (error) falhas.push(`${file.name}: ${error}`)
    }
    setProgresso('')
    if (falhas.length) setErro(falhas.join(' · '))
    await carregar() // recarrega mesmo com falhas: os que passaram ja entraram
    setEnviando(false)
  }

  async function remover(a) {
    if (!window.confirm(`Remover "${a.nome_original}"?`)) return
    await supabase.storage.from('anexos').remove([a.caminho_storage])
    const { error } = await supabase.from('anexo').delete().eq('id', a.id)
    if (error) setErro('Não foi possível remover o anexo.')
    else carregar()
  }

  // Nome unico dentro do zip: dois PDFs com o mesmo nome_original nao podem
  // colidir. Na colisao, vira "nome (2).pdf", "nome (3).pdf"...
  function nomeUnicoNoZip(nome, usados) {
    if (!usados.has(nome)) {
      usados.add(nome)
      return nome
    }
    const ponto = nome.lastIndexOf('.')
    const base = ponto > 0 ? nome.slice(0, ponto) : nome
    const ext = ponto > 0 ? nome.slice(ponto) : ''
    let n = 2
    let novo = `${base} (${n})${ext}`
    while (usados.has(novo)) {
      n += 1
      novo = `${base} (${n})${ext}`
    }
    usados.add(novo)
    return novo
  }

  // Dispara o download de um Blob (sem abrir aba em branco).
  function baixarBlob(blob, nomeArquivo) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nomeArquivo
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  // Baixa TODOS os PDFs de entrada compactados num .zip (§nova função). Busca
  // cada um pelo Storage EM SERIE (com contador "2 de 5"); um que falhe nao
  // impede os outros. Usa .download() do supabase — passa pela RLS (so baixa o
  // que o usuario ja pode ver). O zip e montado no navegador (lib/zip.js).
  async function baixarPdfsEmZip() {
    const lista = anexos.filter((a) => /\.pdf$/i.test(a.nome_original))
    if (lista.length < 2) return
    setErro('')
    setBaixandoZip(true)
    try {
      const arquivos = []
      const usados = new Set()
      const falhas = []
      for (let i = 0; i < lista.length; i++) {
        setProgressoZip(`${i + 1} de ${lista.length}`)
        const a = lista[i]
        const { data, error } = await supabase.storage
          .from('anexos')
          .download(a.caminho_storage)
        if (error || !data) {
          falhas.push(a.nome_original)
          continue
        }
        const bytes = new Uint8Array(await data.arrayBuffer())
        arquivos.push({
          nome: nomeUnicoNoZip(a.nome_original, usados),
          dados: bytes,
        })
      }
      if (!arquivos.length) {
        setErro('Não foi possível baixar os PDFs.')
        return
      }
      baixarBlob(montarZip(arquivos), `demanda-${demanda.id}-pdfs.zip`)
      if (falhas.length) {
        setErro(`Não deu para incluir: ${falhas.join(', ')}.`)
      }
    } finally {
      setBaixandoZip(false)
      setProgressoZip('')
    }
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
        <span className="hero-add hero-add-enviando">
          {progresso ? `Enviando ${progresso}…` : 'Enviando…'}
        </span>
      ) : (
        <>
          <label className="hero-add">
            <Icone nome="mais" size={16} /> Adicionar
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,application/pdf"
              onChange={(e) => {
                enviar(e.target.files)
                e.target.value = ''
              }}
            />
          </label>
          {/* Sem `multiple`: a camera tira UMA foto por vez. */}
          <label className="hero-add">
            <Icone nome="camera" size={16} /> Tirar foto
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                enviar(e.target.files)
                e.target.value = ''
              }}
            />
          </label>
        </>
      )}
    </div>
  )

  // Baixar todos os PDFs de entrada num .zip. So aparece com 2+ PDFs (para 1
  // so, o proprio anexo ja abre). Qualquer um que ve o detalhe pode baixar.
  const pdfsEntrada = anexos.filter((a) => /\.pdf$/i.test(a.nome_original))
  const botaoBaixarPdfs = pdfsEntrada.length >= 2 && (
    <button
      type="button"
      className="hero-baixar-zip"
      onClick={baixarPdfsEmZip}
      disabled={baixandoZip}
    >
      {baixandoZip ? (
        progressoZip ? `Baixando ${progressoZip}…` : 'Compactando…'
      ) : (
        <>
          <Icone nome="arquivo" size={16} /> Baixar os {pdfsEntrada.length} PDFs
          (.zip)
        </>
      )}
    </button>
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

      {botaoBaixarPdfs}
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
