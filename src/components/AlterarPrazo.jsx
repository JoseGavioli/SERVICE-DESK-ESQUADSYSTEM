import { useState } from 'react'
import { supabase } from '../lib/supabase'
import Icone from './Icone'

// Botao "Ajustar prazo" no detalhe (§issue #3). So o STAFF (admin/atendente) e
// so em demanda nao-terminal. Abre um seletor de data + motivo opcional e chama
// alterar_prazo(), que atualiza o prazo e registra a mudanca nos comentarios
// (contexto 'mudanca_prazo'). A descricao continua imutavel — so o prazo muda.
export default function AlterarPrazo({ demanda, perfil, aoMudar }) {
  const [editando, setEditando] = useState(false)
  const [novoPrazo, setNovoPrazo] = useState(demanda.prazo || '')
  const [motivo, setMotivo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const ehStaff = perfil.papel === 'admin' || perfil.papel === 'atendente'
  const terminal = demanda.status === 'enviado' || demanda.status === 'cancelada'
  if (!ehStaff || terminal) return null

  async function salvar(evento) {
    evento.preventDefault()
    if (!novoPrazo) {
      setErro('Escolha a nova data.')
      return
    }
    setSalvando(true)
    setErro('')
    const { error } = await supabase.rpc('alterar_prazo', {
      p_demanda_id: demanda.id,
      p_novo_prazo: novoPrazo,
      p_motivo: motivo.trim() || null,
    })
    setSalvando(false)
    if (error) {
      setErro(error.message || 'Não foi possível alterar o prazo.')
      return
    }
    setEditando(false)
    setMotivo('')
    aoMudar()
  }

  if (!editando) {
    return (
      <button
        type="button"
        className="btn-ajustar-prazo"
        onClick={() => {
          setNovoPrazo(demanda.prazo || '')
          setErro('')
          setEditando(true)
        }}
      >
        <Icone nome="editar" size={14} /> Ajustar prazo
      </button>
    )
  }

  return (
    <form className="ajustar-prazo" onSubmit={salvar}>
      <label className="ajustar-prazo-campo">
        Novo prazo
        <input
          type="date"
          value={novoPrazo}
          onChange={(e) => setNovoPrazo(e.target.value)}
          required
        />
      </label>
      <label className="ajustar-prazo-campo">
        Motivo <span className="opc">(opcional)</span>
        <input
          type="text"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ex.: cliente pediu mais prazo"
        />
      </label>
      <div className="acoes">
        <button type="submit" disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar prazo'}
        </button>
        <button
          type="button"
          className="link"
          onClick={() => {
            setEditando(false)
            setErro('')
          }}
        >
          Cancelar
        </button>
      </div>
      {erro && <p className="erro">{erro}</p>}
    </form>
  )
}
