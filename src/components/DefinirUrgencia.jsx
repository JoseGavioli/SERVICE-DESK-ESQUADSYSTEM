import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { URGENCIA_NIVEIS } from '../lib/urgencia'

// Controle de urgencia MANUAL (§issue #44): so gerente/admin, e so em demanda
// nao-terminal. Um dropdown com "Automatico (pelo prazo)" + os 5 niveis. Ao
// escolher, grava urgencia_manual (ou null = volta ao calculo pelo prazo).
export default function DefinirUrgencia({ demanda, perfil, aoMudar }) {
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const pode = perfil.papel === 'admin' || perfil.papel === 'gerente'
  const terminal = demanda.status === 'enviado' || demanda.status === 'cancelada'
  if (!pode || terminal) return null

  async function mudar(evento) {
    const nivel = evento.target.value || null // '' = automatico
    setSalvando(true)
    setErro('')
    const { error } = await supabase.rpc('definir_urgencia', {
      p_demanda_id: demanda.id,
      p_nivel: nivel,
    })
    setSalvando(false)
    if (error) setErro(error.message || 'Não foi possível definir a urgência.')
    else aoMudar()
  }

  return (
    <label className="definir-urgencia">
      <span className="definir-urgencia-rot">Urgência (gerente)</span>
      <select
        value={demanda.urgencia_manual || ''}
        onChange={mudar}
        disabled={salvando}
      >
        <option value="">Automático (pelo prazo)</option>
        {URGENCIA_NIVEIS.map((u) => (
          <option key={u.nivel} value={u.nivel}>
            {u.rotulo}
          </option>
        ))}
      </select>
      {erro && <p className="erro">{erro}</p>}
    </label>
  )
}
