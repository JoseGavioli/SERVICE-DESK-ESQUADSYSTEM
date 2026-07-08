import { useState } from 'react'
import { supabase } from '../lib/supabase'
import Icone from './Icone'

// Casa unica das acoes de cancelamento (§12 + §issue #36), no mesmo lugar
// para os dois lados:
//  - STAFF (admin ou atendente): efetiva o cancelamento com "Cancelar demanda"
//    (mover_status -> cancelada, com motivo obrigatorio §13). Se ja houver
//    solicitacao, tambem pode "Descartar solicitacao".
//  - VENDEDOR dono: "Solicitar cancelamento" (com motivo obrigatorio).
// O vendedor so SOLICITA (§5); o staff EFETIVA (regra reforcada no banco,
// migracao 0027 — a UI aqui apenas espelha). Antes o admin efetivava pelo
// sheet "Alterar status"; agora e aqui, no mesmo lugar do "Solicitar".
export default function Cancelamento({ demanda, perfil, aoMudar }) {
  const [pedindo, setPedindo] = useState(false) // form de motivo aberto?
  const [motivo, setMotivo] = useState('')
  const [processando, setProcessando] = useState(false)
  const [erro, setErro] = useState('')

  const terminal = demanda.status === 'enviado' || demanda.status === 'cancelada'
  const ehStaff = perfil.papel === 'admin' || perfil.papel === 'atendente'
  const souDono = perfil.id === demanda.vendedor_id
  const solicitado = demanda.cancelamento_solicitado

  // Em terminal (enviado/cancelada) nao ha nada a cancelar.
  if (terminal) return null

  const podeEfetivar = ehStaff // staff cancela qualquer demanda nao-terminal
  const podeSolicitar = perfil.papel === 'vendedor' && souDono && !solicitado

  // Nada a mostrar (ex.: atendente sem solicitacao pendente).
  if (!solicitado && !podeEfetivar && !podeSolicitar) return null

  // O botao principal muda de acordo com o papel: staff efetiva, vendedor pede.
  const rotuloBotao = ehStaff ? 'Cancelar demanda' : 'Solicitar cancelamento'
  const rotuloConfirmar = ehStaff
    ? 'Confirmar cancelamento'
    : 'Confirmar solicitação'

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

  // Confirma o motivo: staff -> efetiva (mover_status); vendedor -> solicita.
  async function confirmar(evento) {
    evento.preventDefault()
    setProcessando(true)
    setErro('')
    const { error } = ehStaff
      ? await supabase.rpc('mover_status', {
          p_demanda_id: demanda.id,
          p_novo_status: 'cancelada',
          p_comentario: motivo.trim(),
        })
      : await supabase.rpc('solicitar_cancelamento', {
          p_demanda_id: demanda.id,
          p_motivo: motivo.trim(),
        })
    setProcessando(false)
    if (error) {
      setErro(error.message || 'Não foi possível concluir.')
    } else {
      setPedindo(false)
      setMotivo('')
      aoMudar()
    }
  }

  return (
    <div className="cancelamento">
      {solicitado && (
        <div className="aviso-cancelamento">
          <p>
            <Icone nome="aviso" size={15} />{' '}
            <strong>Cancelamento solicitado</strong> — o motivo está nos
            comentários.
          </p>
        </div>
      )}

      {pedindo ? (
        <form className="form-transicao" onSubmit={confirmar}>
          <p>
            <strong>{rotuloBotao}</strong> — explique o motivo (obrigatório):
          </p>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            required
          />
          <div className="acoes">
            <button type="submit" disabled={processando || !motivo.trim()}>
              {processando ? 'Enviando…' : rotuloConfirmar}
            </button>
            <button
              type="button"
              className="link"
              onClick={() => {
                setPedindo(false)
                setErro('')
              }}
            >
              Voltar
            </button>
          </div>
          {erro && <p className="erro">{erro}</p>}
        </form>
      ) : (
        <div className="cancel-acoes">
          {(podeEfetivar || podeSolicitar) && (
            <button
              type="button"
              className="perigo"
              onClick={() => setPedindo(true)}
            >
              {rotuloBotao}
            </button>
          )}
          {solicitado && ehStaff && (
            <button
              type="button"
              className="btn-descartar"
              onClick={descartar}
              disabled={processando}
            >
              {processando ? '…' : 'Descartar solicitação'}
            </button>
          )}
          {erro && <p className="erro">{erro}</p>}
        </div>
      )}
    </div>
  )
}
