import { useState } from 'react'
import { supabase } from '../lib/supabase'
import Icone from './Icone'

// Cuida do fluxo de cancelamento (§12) nos dois lados:
//  - se ja foi solicitado: mostra o aviso (e, para o admin, "Descartar");
//  - senao, e o vendedor dono numa demanda nao-terminal: mostra o botao
//    "Solicitar cancelamento" (com motivo obrigatorio).
// O admin EFETIVA o cancelamento pelo botao "Cancelar" em Mover status.
export default function Cancelamento({ demanda, perfil, aoMudar }) {
  const [pedindo, setPedindo] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [processando, setProcessando] = useState(false)
  const [erro, setErro] = useState('')

  const terminal = demanda.status === 'enviado' || demanda.status === 'cancelada'
  const souDono = perfil.id === demanda.vendedor_id

  async function descartar() {
    setProcessando(true)
    setErro('')
    const { error } = await supabase.rpc('descartar_solicitacao_cancelamento', {
      p_demanda_id: demanda.id,
    })
    setProcessando(false)
    if (error) setErro(error.message || 'Erro ao descartar.')
    else aoMudar()
  }

  async function solicitar(evento) {
    evento.preventDefault()
    setProcessando(true)
    setErro('')
    const { error } = await supabase.rpc('solicitar_cancelamento', {
      p_demanda_id: demanda.id,
      p_motivo: motivo.trim(),
    })
    setProcessando(false)
    if (error) {
      setErro(error.message || 'Erro ao solicitar.')
    } else {
      setPedindo(false)
      setMotivo('')
      aoMudar()
    }
  }

  // Ja existe uma solicitacao pendente: aviso (+ descartar, para admin).
  if (demanda.cancelamento_solicitado) {
    return (
      <div className="aviso-cancelamento">
        <p>
          <Icone nome="aviso" size={15} /> <strong>Cancelamento solicitado</strong> — o motivo está nos
          comentários.
        </p>
        {perfil.papel === 'admin' && (
          <div className="acoes">
            <span className="dica">
              Para efetivar, use “Cancelar” em Mover status. Ou:
            </span>
            <button type="button" onClick={descartar} disabled={processando}>
              {processando ? '…' : 'Descartar solicitação'}
            </button>
          </div>
        )}
        {erro && <p className="erro">{erro}</p>}
      </div>
    )
  }

  // Botao de solicitar: so o VENDEDOR dono, em demanda nao-terminal.
  if (perfil.papel !== 'vendedor' || !souDono || terminal) return null

  return (
    <div className="cancelamento">
      {pedindo ? (
        <form className="form-transicao" onSubmit={solicitar}>
          <p>
            <strong>Solicitar cancelamento</strong> — explique o motivo
            (obrigatório):
          </p>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            required
          />
          <div className="acoes">
            <button type="submit" disabled={processando || !motivo.trim()}>
              {processando ? 'Enviando…' : 'Confirmar solicitação'}
            </button>
            <button
              type="button"
              className="link"
              onClick={() => setPedindo(false)}
            >
              Voltar
            </button>
          </div>
          {erro && <p className="erro">{erro}</p>}
        </form>
      ) : (
        <button
          type="button"
          className="perigo"
          onClick={() => setPedindo(true)}
        >
          Solicitar cancelamento
        </button>
      )}
    </div>
  )
}
