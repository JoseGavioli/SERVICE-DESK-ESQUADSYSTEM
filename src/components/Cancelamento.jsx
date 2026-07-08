import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Icone from './Icone'

// Casa unica das acoes de cancelamento (§12 + issues #36/#33), no mesmo lugar:
//  - Ha SOLICITACAO pendente: uma box mostra o MOTIVO do vendedor (texto +
//    autor + data, §issue #33) e, para o STAFF, os botoes "Aceitar
//    cancelamento" (aceita direto — o vendedor ja explicou) e "Descartar".
//  - Sem solicitacao: STAFF (admin/atendente) ve "Cancelar demanda" (com motivo
//    obrigatorio §13); VENDEDOR dono ve "Solicitar cancelamento".
// O vendedor so SOLICITA (§5); o staff EFETIVA (regra no banco, migracao 0027).

// Data + hora curtas ('08/07/2026 14:30') para o rodape do motivo.
function formatarQuando(iso) {
  const d = new Date(iso)
  const data = d.toLocaleDateString('pt-BR')
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${data} ${hora}`
}

export default function Cancelamento({ demanda, perfil, aoMudar }) {
  const [pedindo, setPedindo] = useState(false) // form de motivo aberto?
  const [motivo, setMotivo] = useState('')
  const [processando, setProcessando] = useState(false)
  const [erro, setErro] = useState('')
  const [solicitacao, setSolicitacao] = useState(null) // {texto, created_at, autor}

  const terminal = demanda.status === 'enviado' || demanda.status === 'cancelada'
  const ehStaff = perfil.papel === 'admin' || perfil.papel === 'atendente'
  const souDono = perfil.id === demanda.vendedor_id
  const solicitado = demanda.cancelamento_solicitado

  // Busca o motivo (comentario da solicitacao) para mostrar dentro da box (#33).
  // Pega o MAIS RECENTE (a demanda pode ter sido solicitada, descartada e
  // solicitada de novo). So quando ha solicitacao pendente.
  useEffect(() => {
    if (!solicitado) {
      setSolicitacao(null)
      return
    }
    let vivo = true
    supabase
      .from('comentario')
      .select('texto, created_at, autor:perfil(nome_completo)')
      .eq('demanda_id', demanda.id)
      .eq('contexto', 'solicitacao_cancelamento')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (vivo) setSolicitacao(data || null)
      })
    return () => {
      vivo = false
    }
  }, [demanda.id, solicitado])

  // Em terminal (enviado/cancelada) nao ha nada a cancelar.
  if (terminal) return null

  const podeEfetivar = ehStaff // staff cancela qualquer demanda nao-terminal
  const podeSolicitar = perfil.papel === 'vendedor' && souDono && !solicitado

  // Nada a mostrar (ex.: atendente sem solicitacao pendente).
  if (!solicitado && !podeEfetivar && !podeSolicitar) return null

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

  // Aceitar a solicitacao: o vendedor ja deu o motivo, entao o staff aceita
  // direto (com confirmacao), sem redigitar. O comentario automatico satisfaz
  // a regra §13 (cancelar exige comentario) e deixa claro no historico.
  async function aceitar() {
    if (
      !window.confirm(
        'Aceitar o cancelamento desta demanda? Esta ação é definitiva.',
      )
    ) {
      return
    }
    setProcessando(true)
    setErro('')
    const { error } = await supabase.rpc('mover_status', {
      p_demanda_id: demanda.id,
      p_novo_status: 'cancelada',
      p_comentario: 'Cancelamento aceito (solicitado pelo vendedor).',
    })
    setProcessando(false)
    if (error) setErro(error.message || 'Não foi possível cancelar.')
    else aoMudar()
  }

  // Sem solicitacao: staff cancela por iniciativa propria (motivo obrigatorio);
  // vendedor solicita (motivo obrigatorio). Discriminado pelo papel.
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

  // ── Ha solicitacao pendente: box com o motivo + acoes de staff (#33) ──
  if (solicitado) {
    return (
      <div className="cancelamento">
        <div className="aviso-cancelamento">
          <p className="aviso-cancel-cab">
            <Icone nome="aviso" size={15} />{' '}
            <strong>Cancelamento solicitado</strong>
          </p>
          {solicitacao ? (
            <blockquote className="aviso-cancel-motivo">
              “{solicitacao.texto}”
              <span className="aviso-cancel-autor">
                — {solicitacao.autor?.nome_completo || 'vendedor'}
                {solicitacao.created_at
                  ? `, ${formatarQuando(solicitacao.created_at)}`
                  : ''}
              </span>
            </blockquote>
          ) : (
            <p className="aviso-cancel-motivo aviso-cancel-vazio">
              O motivo está nos comentários.
            </p>
          )}
          {ehStaff && (
            <div className="aviso-cancel-acoes">
              <button
                type="button"
                className="perigo"
                onClick={aceitar}
                disabled={processando}
              >
                {processando ? 'Cancelando…' : 'Aceitar cancelamento'}
              </button>
              <button
                type="button"
                className="btn-descartar"
                onClick={descartar}
                disabled={processando}
              >
                {processando ? '…' : 'Descartar solicitação'}
              </button>
            </div>
          )}
          {erro && <p className="erro">{erro}</p>}
        </div>
      </div>
    )
  }

  // ── Sem solicitacao: staff cancela / vendedor solicita ──
  const rotuloBotao = ehStaff ? 'Cancelar demanda' : 'Solicitar cancelamento'
  const rotuloConfirmar = ehStaff
    ? 'Confirmar cancelamento'
    : 'Confirmar solicitação'

  return (
    <div className="cancelamento">
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
          <button
            type="button"
            className="perigo"
            onClick={() => setPedindo(true)}
          >
            {rotuloBotao}
          </button>
          {erro && <p className="erro">{erro}</p>}
        </div>
      )}
    </div>
  )
}
