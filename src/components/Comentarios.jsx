import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { STATUS_ROTULO } from '../lib/status'
import Avatar from './Avatar'

// Rotulo para comentarios de cancelamento (os de mudanca de status
// mostram a transicao concreta, vinda do historico_status).
const CONTEXTO_ROTULO = {
  solicitacao_cancelamento: 'Solicitação de cancelamento',
  mudanca_status: 'Mudança de status',
  mudanca_prazo: 'Prazo alterado',
  anexo_pos_envio: 'Anexo após o envio',
}

// Lista + caixa de novo comentario de uma demanda. Qualquer um que ve a
// demanda pode comentar (a RLS garante; o autor e sempre o usuario logado).
export default function Comentarios({ demandaId }) {
  const [comentarios, setComentarios] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  async function carregar() {
    setCarregando(true)
    // Puxamos junto a transicao ligada ao comentario (quando houver):
    // o historico_status aponta para o comentario por comentario_id.
    const { data, error } = await supabase
      .from('comentario')
      .select(
        'id, texto, contexto, created_at, autor:perfil(nome_completo, avatar_path), transicao:historico_status(de_status, para_status)',
      )
      .eq('demanda_id', demandaId)
      .order('created_at')
    if (error) setErro('Não foi possível carregar os comentários.')
    else setComentarios(data)
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [demandaId])

  async function enviar(evento) {
    evento.preventDefault()
    setEnviando(true)
    setErro('')
    // autor_id NAO e enviado: o banco preenche com auth.uid() (default + RLS).
    const { error } = await supabase.from('comentario').insert({
      demanda_id: demandaId,
      texto: texto.trim(),
    })
    setEnviando(false)
    if (error) {
      setErro('Não foi possível enviar o comentário.')
    } else {
      setTexto('')
      carregar()
    }
  }

  return (
    <div className="comentarios">
      <h3>Comentários</h3>

      {erro && <p className="erro">{erro}</p>}

      {carregando ? (
        <p>Carregando…</p>
      ) : comentarios.length === 0 ? (
        <p className="vazio">Nenhum comentário ainda.</p>
      ) : (
        <ul className="lista-comentarios">
          {comentarios.map((c) => {
            const t = c.transicao?.[0] // transicao vinculada (se for mudanca de status)
            return (
              <li key={c.id} className="coment-item">
                <Avatar
                  nome={c.autor?.nome_completo}
                  caminho={c.autor?.avatar_path}
                  className="coment-avatar"
                />
                <div className="coment-corpo">
                  <div className="coment-cab">
                    <strong className="coment-autor">
                      {c.autor?.nome_completo || 'Alguém'}
                    </strong>
                    <span className="coment-quando">
                      {new Date(c.created_at).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  {t ? (
                    <span className="chip-coment chip-coment-transicao">
                      {STATUS_ROTULO[t.de_status]} → {STATUS_ROTULO[t.para_status]}
                    </span>
                  ) : c.contexto ? (
                    <span
                      className={`chip-coment ${
                        c.contexto === 'mudanca_prazo'
                          ? 'chip-coment-prazo'
                          : 'chip-coment-cancel'
                      }`}
                    >
                      {CONTEXTO_ROTULO[c.contexto]}
                    </span>
                  ) : null}
                  <p className="coment-texto">{c.texto}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <form className="form-comentario" onSubmit={enviar}>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escreva um comentário…"
          rows={3}
          required
        />
        <button type="submit" disabled={enviando || !texto.trim()}>
          {enviando ? 'Enviando…' : 'Comentar'}
        </button>
      </form>
    </div>
  )
}
