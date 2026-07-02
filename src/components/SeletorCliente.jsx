import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Icone from './Icone'

// Selecionar um cliente com busca-primeiro. Se nao existir, cria na hora.
// Avisa o pai pelo callback aoSelecionar(cliente) — ou aoSelecionar(null)
// quando o usuario clica em "trocar".
export default function SeletorCliente({ selecionado, aoSelecionar }) {
  const [clientes, setClientes] = useState([])
  const [busca, setBusca] = useState('')
  const [erro, setErro] = useState('')
  const [criando, setCriando] = useState(false)

  async function carregar() {
    const { data, error } = await supabase
      .from('cliente')
      .select('id, nome')
      .order('nome')
    if (error) setErro('Erro ao carregar clientes.')
    else setClientes(data)
  }

  useEffect(() => {
    carregar()
  }, [])

  const termo = busca.trim().toLowerCase()
  const filtrados = termo
    ? clientes.filter((c) => c.nome.toLowerCase().includes(termo))
    : clientes
  const nomeExato = clientes.some((c) => c.nome.toLowerCase() === termo)

  async function criar() {
    const nome = busca.trim()
    if (!nome) return
    setCriando(true)
    setErro('')
    const { data, error } = await supabase
      .from('cliente')
      .insert({ nome })
      .select('id, nome')
      .single()
    setCriando(false)
    if (error) {
      setErro('Erro ao criar cliente.')
    } else {
      setClientes((prev) => [...prev, data])
      aoSelecionar(data)
      setBusca('')
    }
  }

  if (selecionado) {
    return (
      <div className="seletor selecionado">
        <span>
          Cliente: <strong>{selecionado.nome}</strong>
        </span>
        <button type="button" className="link" onClick={() => aoSelecionar(null)}>
          trocar
        </button>
      </div>
    )
  }

  return (
    <div className="seletor">
      <label>Cliente</label>
      <input
        type="search"
        placeholder="Buscar ou cadastrar cliente…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />
      {erro && <p className="erro">{erro}</p>}
      <ul className="lista">
        {filtrados.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className="link"
              onClick={() => aoSelecionar(c)}
            >
              {c.nome}
            </button>
          </li>
        ))}
        {filtrados.length === 0 && (
          <li className="vazio">Nenhum cliente encontrado.</li>
        )}
      </ul>
      {termo && !nomeExato && (
        <button type="button" onClick={criar} disabled={criando}>
          {criando ? 'Criando…' : (<><Icone nome="mais" size={16} /> Criar cliente "{busca.trim()}"</>)}
        </button>
      )}
    </div>
  )
}
