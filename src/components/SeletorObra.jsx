import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Selecionar uma obra DO cliente recebido por prop, com busca-primeiro.
// Cria na hora se nao existir. Avisa o pai por aoSelecionar(obra | null).
export default function SeletorObra({ cliente, selecionado, aoSelecionar }) {
  const [obras, setObras] = useState([])
  const [busca, setBusca] = useState('')
  const [erro, setErro] = useState('')
  const [criando, setCriando] = useState(false)

  async function carregar() {
    const { data, error } = await supabase
      .from('obra')
      .select('id, nome')
      .eq('cliente_id', cliente.id)
      .order('nome')
    if (error) setErro('Erro ao carregar obras.')
    else setObras(data)
  }

  useEffect(() => {
    carregar()
  }, [cliente.id])

  const termo = busca.trim().toLowerCase()
  const filtradas = termo
    ? obras.filter((o) => o.nome.toLowerCase().includes(termo))
    : obras
  const nomeExato = obras.some((o) => o.nome.toLowerCase() === termo)

  async function criar() {
    const nome = busca.trim()
    if (!nome) return
    setCriando(true)
    setErro('')
    const { data, error } = await supabase
      .from('obra')
      .insert({ cliente_id: cliente.id, nome })
      .select('id, nome')
      .single()
    setCriando(false)
    if (error) {
      setErro('Erro ao criar obra.')
    } else {
      setObras((prev) => [...prev, data])
      aoSelecionar(data)
      setBusca('')
    }
  }

  if (selecionado) {
    return (
      <div className="seletor selecionado">
        <span>
          Obra: <strong>{selecionado.nome}</strong>
        </span>
        <button type="button" className="link" onClick={() => aoSelecionar(null)}>
          trocar
        </button>
      </div>
    )
  }

  return (
    <div className="seletor">
      <label>Obra (de {cliente.nome})</label>
      <input
        type="search"
        placeholder="Buscar ou cadastrar obra…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />
      {erro && <p className="erro">{erro}</p>}
      <ul className="lista">
        {filtradas.map((o) => (
          <li key={o.id}>
            <button
              type="button"
              className="link"
              onClick={() => aoSelecionar(o)}
            >
              {o.nome}
            </button>
          </li>
        ))}
        {filtradas.length === 0 && (
          <li className="vazio">Nenhuma obra encontrada.</li>
        )}
      </ul>
      {termo && !nomeExato && (
        <button type="button" onClick={criar} disabled={criando}>
          {criando ? 'Criando…' : `➕ Criar obra "${busca.trim()}"`}
        </button>
      )}
    </div>
  )
}
