import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { enviarAnexo, validarArquivo, formatarTamanho, ehImagem } from '../lib/anexos'
import Lightbox from './Lightbox'
import Icone from './Icone'

// Anexos de SAIDA (o orcamento entregue ao vendedor). A ENTRADA e gerenciada
// no topo do detalhe (CarrosselEntrada). Bucket privado -> link assinado;
// imagens ganham miniatura + lightbox, PDF/outros abrem em nova guia. O staff
// anexa a saida SO no status "Concluido" (§C2); todos podem ver/baixar.
export default function Anexos({ demanda, perfil }) {
  const [anexos, setAnexos] = useState([])
  const [urlsImagens, setUrlsImagens] = useState({}) // caminho_storage -> signedUrl
  const [lightboxIdx, setLightboxIdx] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  const ehStaff = perfil.papel === 'admin' || perfil.papel === 'atendente'
  // Saida: so staff, e SO no "concluido" (onde se anexa o orcamento final).
  const podeSaida = ehStaff && demanda.status === 'concluido'

  async function carregar() {
    setCarregando(true)
    const { data, error } = await supabase
      .from('anexo')
      .select(
        'id, nome_original, tamanho_bytes, caminho_storage, created_at, autor_id, autor:perfil(nome_completo)',
      )
      .eq('demanda_id', demanda.id)
      .eq('tipo', 'saida')
      .order('created_at')

    if (error) {
      setErro('Não foi possível carregar os anexos.')
      setCarregando(false)
      return
    }
    setAnexos(data)

    const caminhosImg = data
      .filter((a) => ehImagem(a.nome_original))
      .map((a) => a.caminho_storage)
    if (caminhosImg.length) {
      const { data: urls } = await supabase.storage
        .from('anexos')
        .createSignedUrls(caminhosImg, 3600)
      const mapa = {}
      if (urls) for (const u of urls) if (u.signedUrl) mapa[u.path] = u.signedUrl
      setUrlsImagens(mapa)
    } else {
      setUrlsImagens({})
    }
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [demanda.id])

  const imagens = anexos
    .filter((a) => ehImagem(a.nome_original) && urlsImagens[a.caminho_storage])
    .map((a) => ({ id: a.id, url: urlsImagens[a.caminho_storage], nome: a.nome_original }))

  async function enviar(file) {
    if (!file) return
    setErro('')
    const problema = validarArquivo('saida', file)
    if (problema) {
      setErro(problema)
      return
    }
    setEnviando(true)
    const { error } = await enviarAnexo(demanda.id, 'saida', file)
    if (error) setErro(error)
    else await carregar()
    setEnviando(false)
  }

  async function baixar(anexo) {
    setErro('')
    // download: <nome> faz o Storage servir com Content-Disposition attachment
    // usando o NOME ORIGINAL (em vez do caminho uuid-nome do bucket) — #34.
    const { data, error } = await supabase.storage
      .from('anexos')
      .createSignedUrl(anexo.caminho_storage, 60, { download: anexo.nome_original })
    if (error) {
      setErro('Não foi possível gerar o link de download.')
      return
    }
    // Dispara o download sem abrir aba em branco.
    const a = document.createElement('a')
    a.href = data.signedUrl
    a.download = anexo.nome_original
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  function abrir(anexo) {
    if (ehImagem(anexo.nome_original) && urlsImagens[anexo.caminho_storage]) {
      const idx = imagens.findIndex((img) => img.id === anexo.id)
      setLightboxIdx(idx >= 0 ? idx : 0)
    } else {
      baixar(anexo)
    }
  }

  async function excluir(anexo) {
    if (!window.confirm(`Excluir "${anexo.nome_original}"?`)) return
    await supabase.storage.from('anexos').remove([anexo.caminho_storage])
    const { error } = await supabase.from('anexo').delete().eq('id', anexo.id)
    if (error) setErro('Não foi possível excluir o anexo.')
    else carregar()
  }

  function podeExcluir(a) {
    return a.autor_id === perfil.id || perfil.papel === 'admin'
  }

  function renderLista(itens) {
    if (itens.length === 0) return <p className="vazio">Nenhum.</p>
    return (
      <ul className="lista-anexos">
        {itens.map((a) => {
          const url = urlsImagens[a.caminho_storage]
          return (
            <li key={a.id}>
              {url && (
                <button
                  type="button"
                  className="miniatura-btn"
                  onClick={() => abrir(a)}
                  title="Expandir"
                >
                  <img
                    className="miniatura"
                    src={url}
                    alt={a.nome_original}
                    loading="lazy"
                  />
                </button>
              )}
              <button type="button" className="link" onClick={() => abrir(a)}>
                {a.nome_original}
              </button>
              <span className="meta">
                {formatarTamanho(a.tamanho_bytes)} · {a.autor?.nome_completo}
              </span>
              {podeExcluir(a) && (
                <button
                  type="button"
                  className="excluir"
                  title="Excluir anexo"
                  onClick={() => excluir(a)}
                >
                  <Icone nome="lixeira" size={16} />
                </button>
              )}
            </li>
          )
        })}
      </ul>
    )
  }

  // A box de saida so aparece em "Concluido" (p/ anexar/ver) ou quando JA ha
  // saida (ex.: "Enviado", p/ o vendedor ver o orcamento entregue). Mesma
  // regra p/ staff e vendedor. Antes disso, nem renderiza.
  if (carregando) {
    if (demanda.status !== 'concluido') return null
    return (
      <div className="anexos">
        <h3>Anexos (saída)</h3>
        <p>Carregando…</p>
      </div>
    )
  }

  const mostrar = demanda.status === 'concluido' || anexos.length > 0
  if (!mostrar) return null

  return (
    <div className="anexos">
      <h3>Anexos (saída)</h3>
      {erro && <p className="erro">{erro}</p>}
      {renderLista(anexos)}
      {podeSaida ? (
        <label className="enviar-arquivo">
          {enviando ? 'Enviando…' : (<><Icone nome="mais" size={16} /> Anexar saída (≤ 10 MB)</>)}
          <input
            type="file"
            disabled={enviando}
            onChange={(e) => {
              enviar(e.target.files[0])
              e.target.value = ''
            }}
          />
        </label>
      ) : (
        ehStaff && (
          <p className="anexo-dica">
            A saída (orçamento) é anexada quando a demanda está em “Concluído”.
          </p>
        )
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
