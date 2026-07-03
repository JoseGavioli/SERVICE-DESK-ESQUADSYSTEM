import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { TRANSICOES } from '../lib/transicoes'
import Icone from './Icone'

// Acoes de status (so atendente/admin; vendedor nunca). No detalhe, aparece
// como uma BARRA fixa no rodape ("Alterar status", §C3) que COBRE o bottom-nav;
// ao tocar, sobe um bottom-sheet com as transicoes validas do status atual.
// Quando a transicao exige comentario (§13), o sheet troca para a caixa de
// motivo antes de confirmar. A mudanca em si vai pela funcao mover_status().
export default function AcoesStatus({ demanda, perfil, aoMover }) {
  const [aberto, setAberto] = useState(false) // sheet aberto?
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
  if (opcoes.length === 0) return null // estado terminal — sem barra (nav aparece)

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
      fechar()
      aoMover() // pede ao detalhe para recarregar tudo
    }
  }

  function clicar(t) {
    setErro('')
    if (t.exigeComentario) {
      setAcaoAtiva(t) // troca o sheet para a caixa de comentario obrigatorio
      setComentario('')
    } else {
      executar(t, null)
    }
  }

  function fechar() {
    setAberto(false)
    setAcaoAtiva(null)
    setComentario('')
    setErro('')
  }

  return (
    <>
      {/* Barra fixa no rodape (cobre o bottom-nav; so staff, so com acoes). */}
      <div className="det-barra-acao">
        <button
          type="button"
          className="btn-alterar-status"
          onClick={() => setAberto(true)}
        >
          <Icone nome="atualizar" size={18} /> Alterar status
        </button>
      </div>

      {/* Backdrop + bottom-sheet com as opcoes. */}
      <div
        className={`status-backdrop ${aberto ? 'aberto' : ''}`}
        onClick={fechar}
        aria-hidden="true"
      />
      <aside
        className={`status-sheet ${aberto ? 'aberto' : ''}`}
        role="dialog"
        aria-label="Alterar status"
      >
        <div className="sheet-handle" aria-hidden="true" />
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
              <strong>{acaoAtiva.rotulo}</strong> — explique o motivo
              (obrigatório):
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
                Voltar
              </button>
            </div>
          </form>
        ) : (
          <>
            <h3 className="status-sheet-titulo">Alterar status</h3>
            <div className="status-sheet-opcoes">
              {opcoes.map((t) => (
                <button
                  key={t.para}
                  type="button"
                  className={`status-opcao ${t.para === 'cancelada' ? 'perigo' : ''}`}
                  onClick={() => clicar(t)}
                  disabled={processando}
                >
                  {t.rotulo}
                </button>
              ))}
            </div>
          </>
        )}
      </aside>
    </>
  )
}
