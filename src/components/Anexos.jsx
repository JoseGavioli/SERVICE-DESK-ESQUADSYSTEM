import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { enviarAnexo, validarArquivo, formatarTamanho, ehImagem } from '../lib/anexos'
import Lightbox from './Lightbox'
import Icone from './Icone'

// Anexos da demanda: entrada (vendedor dono) e saida (atendente/admin).
// Bucket privado -> download por LINK ASSINADO temporario. Imagens ganham
// MINIATURA e abrem num LIGHTBOX (com carrossel e zoom); PDF/outros abrem
// em nova guia.
export default function Anexos({ demanda, perfil }) {
  const [anexos, setAnexos] = useState([])
  const [urlsImagens, setUrlsImagens] = useState({}) // caminho_storage -> signedUrl
  const [lightboxIdx, setLightboxIdx] = useState(null) // indice na lista de imagens, ou null
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  const ehDono = perfil.id === demanda.vendedor_id
  const ehStaff = perfil.papel === 'admin' || perfil.papel === 'atendente'
  // Entrada: so o vendedor dono, e SO enquanto "nao iniciado" (depois trava).
  const podeEntrada = ehDono && demanda.status === 'nao_iniciado'
  // Saida: so staff, e SO no "concluido" (onde se anexa o orcamento final).
  const podeSaida = ehStaff && demanda.status === 'concluido'

  async function carregar() {
    setCarregando(true)
    const { data, error } = await supabase
      .from('anexo')
      .select(
        'id, tipo, nome_original, tamanho_bytes, caminho_storage, created_at, autor_id, autor:perfil(nome_completo)',
      )
      .eq('demanda_id', demanda.id)
      .order('created_at')

    if (error) {
      setErro('Não foi possível carregar os anexos.')
      setCarregando(false)
      return
    }
    setAnexos(data)

    // Links assinados das IMAGENS em lote (validade de 1h) p/ miniatura/lightbox.
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

  // Lista (na ordem exibida) das imagens que tem link pronto — alimenta o carrossel.
  const imagens = anexos
    .filter((a) => ehImagem(a.nome_original) && urlsImagens[a.caminho_storage])
    .map((a) => ({ id: a.id, url: urlsImagens[a.caminho_storage], nome: a.nome_original }))

  async function enviar(tipo, file) {
    if (!file) return
    setErro('')
    const problema = validarArquivo(tipo, file)
    if (problema) {
      setErro(problema)
      return
    }
    setEnviando(true)
    const { error } = await enviarAnexo(demanda.id, tipo, file)
    if (error) setErro(error)
    else await carregar()
    setEnviando(false)
  }

  // Abre em nova guia (usado para PDF/outros).
  async function baixar(anexo) {
    setErro('')
    const { data, error } = await supabase.storage
      .from('anexos')
      .createSignedUrl(anexo.caminho_storage, 60)
    if (error) setErro('Não foi possível gerar o link de download.')
    else window.open(data.signedUrl, '_blank')
  }

  // Imagem -> abre o lightbox no indice dela; outros -> nova guia.
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

  if (carregando) {
    return (
      <div className="anexos">
        <h3>Anexos</h3>
        <p>Carregando…</p>
      </div>
    )
  }

  const entrada = anexos.filter((a) => a.tipo === 'entrada')
  const saida = anexos.filter((a) => a.tipo === 'saida')

  return (
    <div className="anexos">
      <h3>Anexos</h3>
      {erro && <p className="erro">{erro}</p>}

      <h4>Entrada</h4>
      {renderLista(entrada)}
      {podeEntrada ? (
        <label className="enviar-arquivo">
          {enviando ? 'Enviando…' : (<><Icone nome="mais" size={16} /> Anexar entrada (JPG/PNG/PDF, ≤ 2 MB)</>)}
          <input
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            disabled={enviando}
            onChange={(e) => {
              enviar('entrada', e.target.files[0])
              e.target.value = ''
            }}
          />
        </label>
      ) : (
        ehDono && (
          <p className="anexo-dica">
            Anexos de entrada só até a demanda ser iniciada (“Não iniciado”).
          </p>
        )
      )}

      <h4>Saída</h4>
      {renderLista(saida)}
      {podeSaida ? (
        <label className="enviar-arquivo">
          {enviando ? 'Enviando…' : (<><Icone nome="mais" size={16} /> Anexar saída (≤ 10 MB)</>)}
          <input
            type="file"
            disabled={enviando}
            onChange={(e) => {
              enviar('saida', e.target.files[0])
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
