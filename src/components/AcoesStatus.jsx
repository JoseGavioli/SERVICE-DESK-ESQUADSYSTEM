import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { TRANSICOES } from '../lib/transicoes'

// Botoes de transicao de status (so atendente/admin; vendedor nunca).
// Quando a transicao exige comentario (§13), abre uma caixa antes de
// confirmar. A mudanca em si vai pela funcao mover_status() no banco.
export default function AcoesStatus({ demanda, perfil, aoMover }) {
  const [acaoAtiva, setAcaoAtiva] = useState(null) // transicao aguardando comentario
  const [comentario, setComentario] = useState('')
  const [processando, setProcessando] = useState(false)
  const [erro, setErro] = useState('')

  // Vendedor nunca move status (a UI esconde; o banco tambem barra).
  if (perfil.papel === 'vendedor') return null

  // Opcoes do status atual, filtrando as exclusivas do admin (cancelar).
  const opcoes = (TRANSICOES[demanda.status] || []).filter(
    (t) => !t.soAdmin || perfil.papel === 'admin',
  )
  if (opcoes.length === 0) return null // estado terminal

  async function executar(transicao, texto) {
    setProcessando(true)
    setErro('')
    const { error } = await supabase.rpc('mover_status', {
      p_demanda_id: demanda.id,
      p_novo_status: transicao.para,
      p_comentario: texto || null,
    })
    setProcessando(false)
    if (error) {
      setErro(error.message || 'Não foi possível mover o status.')
    } else {
      setAcaoAtiva(null)
      setComentario('')
      aoMover() // pede ao detalhe para recarregar tudo
    }
  }

  function clicar(t) {
    setErro('')
    if (t.exigeComentario) {
      setAcaoAtiva(t) // abre a caixa de comentario obrigatorio
      setComentario('')
    } else {
      executar(t, null)
    }
  }

  return (
    <div className="acoes-status">
      <h3>Mover status</h3>
      {erro && <p className="erro">{erro}</p>}

      {acaoAtiva ? (
        <form
          className="form-transicao"
          onSubmit={(e) => {
            e.preventDefault()
            executar(acaoAtiva, comentario.trim())
          }}
        >
          <p>
            <strong>{acaoAtiva.rotulo}</strong> — explique o motivo (obrigatório):
          </p>
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            rows={3}
            required
          />
          <div className="acoes">
            <button type="submit" disabled={processando || !comentario.trim()}>
              {processando ? 'Movendo…' : 'Confirmar'}
            </button>
            <button
              type="button"
              className="link"
              onClick={() => setAcaoAtiva(null)}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="botoes-transicao">
          {opcoes.map((t) => (
            <button
              key={t.para}
              type="button"
              className={t.para === 'cancelada' ? 'perigo' : ''}
              onClick={() => clicar(t)}
              disabled={processando}
            >
              {t.rotulo}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
