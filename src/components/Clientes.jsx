import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import ObrasDoCliente from './ObrasDoCliente'
import Icone from './Icone'

// Lista + busca-primeiro + criacao de clientes.
// Ao selecionar um cliente, mostra as obras dele (relacao 1 -> N).
export default function Clientes({ perfil }) {
  const [clientes, setClientes] = useState([])
  const [busca, setBusca] = useState('')
  const [selecionado, setSelecionado] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  // formulario de novo cliente
  const [novoNome, setNovoNome] = useState('')
  const [novaObs, setNovaObs] = useState('')
  const [salvando, setSalvando] = useState(false)

  // Editar/excluir e so para admin/atendente. O banco (RLS) garante isso
  // de verdade; aqui apenas escondemos o botao para nao confundir.
  const podeEditar = perfil.papel === 'admin' || perfil.papel === 'atendente'

  async function carregar() {
    setCarregando(true)
    const { data, error } = await supabase
      .from('cliente')
      .select('id, nome, observacoes')
      .order('nome')

    if (error) setErro('Não foi possível carregar os clientes.')
    else setClientes(data)
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  // Busca-primeiro: filtra em memoria pelo que foi digitado (instantaneo).
  const termo = busca.trim().toLowerCase()
  const filtrados = termo
    ? clientes.filter((c) => c.nome.toLowerCase().includes(termo))
    : clientes

  // Avisa (mas nao impede) se ja existe um cliente com nome igual.
  const nomeJaExiste = clientes.some(
    (c) => c.nome.toLowerCase() === novoNome.trim().toLowerCase(),
  )

  async function criarCliente(evento) {
    evento.preventDefault()
    setSalvando(true)
    setErro('')

    const { data, error } = await supabase
      .from('cliente')
      .insert({ nome: novoNome.trim(), observacoes: novaObs.trim() || null })
      .select('id, nome, observacoes')
      .single()

    if (error) {
      setErro('Não foi possível criar o cliente.')
    } else {
      setNovoNome('')
      setNovaObs('')
      setBusca('')
      await carregar()
      setSelecionado(data) // ja abre as obras do recem-criado
    }
    setSalvando(false)
  }

  async function excluirCliente(cliente) {
    if (!window.confirm(`Excluir o cliente "${cliente.nome}"?`)) return

    const { error } = await supabase.from('cliente').delete().eq('id', cliente.id)
    if (error) {
      setErro('Não foi possível excluir (o cliente pode ter obras vinculadas).')
    } else {
      if (selecionado?.id === cliente.id) setSelecionado(null)
      await carregar()
    }
  }

  if (carregando) return <p>Carregando clientes…</p>

  return (
    <div className="secao-clientes">
      <input
        type="search"
        placeholder="Buscar cliente pelo nome…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />

      {erro && <p className="erro">{erro}</p>}

      {filtrados.length === 0 ? (
        <p className="vazio">Nenhum cliente encontrado.</p>
      ) : (
        <div className="cards">
          {filtrados.map((c) => (
            <div
              key={c.id}
              className={`card ${selecionado?.id === c.id ? 'sel' : ''}`}
            >
              <button
                type="button"
                className="card-corpo"
                onClick={() => setSelecionado(c)}
              >
                <span className="id">#{c.id}</span>
                <span className="nome">{c.nome}</span>
                {c.observacoes && <span className="obs">{c.observacoes}</span>}
              </button>
              {podeEditar && (
                <button
                  type="button"
                  className="excluir"
                  title="Excluir cliente"
                  onClick={() => excluirCliente(c)}
                >
                  <Icone nome="lixeira" size={18} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Busca-primeiro: o "criar" aparece sempre, mas avisa se houver nome igual */}
      <form className="form-novo" onSubmit={criarCliente}>
        <h3><Icone nome="mais" size={18} /> Novo cliente</h3>
        <input
          type="text"
          placeholder="Nome do cliente"
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Observações (opcional)"
          value={novaObs}
          onChange={(e) => setNovaObs(e.target.value)}
        />
        {nomeJaExiste && (
          <p className="aviso">
            Já existe um cliente com esse nome — confira a lista acima antes de
            criar.
          </p>
        )}
        <button type="submit" disabled={salvando || !novoNome.trim()}>
          {salvando ? 'Salvando…' : 'Criar cliente'}
        </button>
      </form>

      {/* Obras do cliente selecionado */}
      {selecionado && <ObrasDoCliente cliente={selecionado} perfil={perfil} />}
    </div>
  )
}
