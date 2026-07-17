import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Icone from './Icone'

// Lista para escolher uma obra DO cliente recebido por prop. Igual ao
// SeletorCliente: renderiza so o miolo, os 5 ultimos por padrao, busca filtra
// tudo, e cria na hora se nao existir (§issue #64).
const QUANTOS_RECENTES = 5

export default function SeletorObra({ cliente, aoSelecionar }) {
  const [obras, setObras] = useState([])
  const [busca, setBusca] = useState('')
  const [erro, setErro] = useState('')
  const [criando, setCriando] = useState(false)

  useEffect(() => {
    async function carregar() {
      const { data, error } = await supabase
        .from('obra')
        .select('id, nome, created_at')
        .eq('cliente_id', cliente.id)
        .order('nome')
      if (error) setErro('Erro ao carregar obras.')
      else setObras(data)
    }
    carregar()
  }, [cliente.id])

  const termo = busca.trim().toLowerCase()
  const recentes = [...obras]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, QUANTOS_RECENTES)
  const mostradas = termo
    ? obras.filter((o) => o.nome.toLowerCase().includes(termo))
    : recentes
  const nomeExato = obras.some((o) => o.nome.toLowerCase() === termo)

  async function criar() {
    const nome = busca.trim()
    if (!nome) return
    setCriando(true)
    setErro('')
    const { data, error } = await supabase
      .from('obra')
      .insert({ cliente_id: cliente.id, nome })
      .select('id, nome, created_at')
      .single()
    setCriando(false)
    if (error) {
      setErro('Erro ao criar obra.')
    } else {
      setObras((prev) => [...prev, data])
      aoSelecionar(data)
    }
  }

  return (
    <div className="escolher">
      <input
        type="search"
        placeholder={`Buscar obra de ${cliente.nome}…`}
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        aria-label="Buscar obra"
        autoFocus
      />
      {erro && <p className="erro">{erro}</p>}
      <p className="escolher-rot">
        {termo ? 'Resultados' : `Últimas ${QUANTOS_RECENTES} cadastradas`}
      </p>
      <ul className="escolher-lista">
        {mostradas.map((o) => (
          <li key={o.id}>
            <button type="button" onClick={() => aoSelecionar(o)}>
              {o.nome}
            </button>
          </li>
        ))}
        {mostradas.length === 0 && (
          <li className="escolher-vazio">Nenhuma obra encontrada.</li>
        )}
      </ul>
      {termo && !nomeExato && (
        <button
          type="button"
          className="escolher-criar"
          onClick={criar}
          disabled={criando}
        >
          {criando ? (
            'Criando…'
          ) : (
            <>
              <Icone nome="mais" size={16} /> Criar obra “{busca.trim()}”
            </>
          )}
        </button>
      )}
    </div>
  )
}
