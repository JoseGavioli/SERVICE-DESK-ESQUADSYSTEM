import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { STATUS_ROTULO } from '../lib/status'

// Linha do tempo das transicoes de status de uma demanda (mais recente
// primeiro). So leitura — quem escreve aqui e a funcao mover_status().
export default function HistoricoStatus({ demandaId }) {
  const [itens, setItens] = useState([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function carregar() {
      const { data } = await supabase
        .from('historico_status')
        .select('id, de_status, para_status, created_at, autor:perfil(nome_completo)')
        .eq('demanda_id', demandaId)
        .order('created_at', { ascending: false })
      setItens(data || [])
      setCarregando(false)
    }
    carregar()
  }, [demandaId])

  if (carregando || itens.length === 0) return null

  return (
    <div className="historico">
      <h3>Histórico de status</h3>
      <ul className="lista-historico">
        {itens.map((h) => (
          <li key={h.id}>
            <span className="quando">
              {new Date(h.created_at).toLocaleString('pt-BR')}
            </span>
            <span>
              {STATUS_ROTULO[h.de_status]} →{' '}
              <strong>{STATUS_ROTULO[h.para_status]}</strong>
            </span>
            <span className="por">por {h.autor?.nome_completo}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
