import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import ObrasDoCliente from './ObrasDoCliente'
import Icone from './Icone'

// Iniciais (ate 2 letras) para o avatar do cliente.
function iniciais(nome) {
  if (!nome) return '?'
  const p = nome.trim().split(/\s+/)
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase()
}

// Lista + busca-primeiro + criacao de clientes. Ao tocar num cliente, faz
// DRILL-IN para as obras dele (relacao 1 -> N).
export default function Clientes({ perfil }) {
  const [clientes, setClientes] = useState([])
  const [busca, setBusca] = useState('')
  const [selecionado, setSelecionado] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  // formulario de novo cliente (aparece so ao tocar em "+ Novo cliente")
  const [mostrarForm, setMostrarForm] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novaObs, setNovaObs] = useState('')
  const [salvando, setSalvando] = useState(false)

  // Editar/excluir e so para admin/atendente. O banco (RLS) garante de verdade;
  // aqui apenas escondemos o botao para nao confundir.
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

  // "+ Novo cliente": abre o form ja com o termo buscado no nome (anti-duplicata).
  function abrirForm() {
    setNovoNome(busca.trim())
    setNovaObs('')
    setMostrarForm(true)
  }

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
      setMostrarForm(false)
      await carregar()
      setSelecionado(data) // ja entra nas obras do recem-criado
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

  // Drill-in: cliente selecionado -> tela das obras dele.
  if (selecionado) {
    return (
      <ObrasDoCliente
        cliente={selecionado}
        perfil={perfil}
        aoVoltar={() => setSelecionado(null)}
      />
    )
  }

  if (carregando) return <p>Carregando clientes…</p>

  return (
    <div className="secao-clientes">
      <div className="campo-busca">
        <span className="campo-busca-icone">
          <Icone nome="lupa" size={18} />
        </span>
        <input
          type="search"
          className="input-busca"
          placeholder="Buscar cliente pelo nome…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {erro && <p className="erro">{erro}</p>}

      {filtrados.length === 0 ? (
        <p className="vazio">Nenhum cliente encontrado.</p>
      ) : (
        <ul className="lista-cad">
          {filtrados.map((c) => (
            <li key={c.id} className="cad-linha">
              <button
                type="button"
                className="cad-item"
                onClick={() => setSelecionado(c)}
              >
                <span className="cad-avatar">{iniciais(c.nome)}</span>
                <span className="cad-texto">
                  <strong className="cad-nome">{c.nome}</strong>
                  {c.observacoes && (
                    <span className="cad-sub">{c.observacoes}</span>
                  )}
                </span>
                <span className="cad-chevron">
                  <Icone nome="chevron-direita" size={20} />
                </span>
              </button>
              {podeEditar && (
                <button
                  type="button"
                  className="cad-excluir"
                  title="Excluir cliente"
                  aria-label="Excluir cliente"
                  onClick={() => excluirCliente(c)}
                >
                  <Icone nome="lixeira" size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Busca-primeiro: o "criar" aparece ao tocar no botao (avisa se ha nome igual) */}
      {mostrarForm ? (
        <form className="form-novo form-cad" onSubmit={criarCliente}>
          <h3>Novo cliente</h3>
          <input
            type="text"
            placeholder="Nome do cliente"
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            required
            autoFocus
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
          <div className="form-cad-acoes">
            <button type="submit" disabled={salvando || !novoNome.trim()}>
              {salvando ? 'Salvando…' : 'Criar cliente'}
            </button>
            <button
              type="button"
              className="link"
              onClick={() => setMostrarForm(false)}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="botao-novo-cad" onClick={abrirForm}>
          <Icone nome="mais" size={18} /> Novo cliente
        </button>
      )}
    </div>
  )
}
