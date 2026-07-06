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

// Lista + busca-primeiro + criacao/edicao de clientes. Ao tocar num cliente,
// abre as obras dele numa BOX abaixo (accordion), nao em outra tela.
export default function Clientes({ perfil, naoLidas, aoAbrirNotif }) {
  const [clientes, setClientes] = useState([])
  const [busca, setBusca] = useState('')
  const [expandidoId, setExpandidoId] = useState(null) // accordion das obras
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  // form de NOVO cliente
  const [mostrarForm, setMostrarForm] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novaObs, setNovaObs] = useState('')

  // EDICAO de cliente (in-place)
  const [editandoId, setEditandoId] = useState(null)
  const [editNome, setEditNome] = useState('')
  const [editObs, setEditObs] = useState('')

  const [salvando, setSalvando] = useState(false)

  // Editar/excluir e so para admin/atendente. O banco (RLS) garante de verdade.
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

  const termo = busca.trim().toLowerCase()
  const filtrados = termo
    ? clientes.filter((c) => c.nome.toLowerCase().includes(termo))
    : clientes

  // Duplicata na CRIACAO e na EDICAO (case-insensitive; na edicao ignora o proprio).
  const nomeJaExiste = clientes.some(
    (c) => c.nome.trim().toLowerCase() === novoNome.trim().toLowerCase(),
  )
  const editNomeDuplicado = clientes.some(
    (c) =>
      c.id !== editandoId &&
      c.nome.trim().toLowerCase() === editNome.trim().toLowerCase(),
  )

  // Accordion: abre/fecha as obras de um cliente (um por vez).
  function toggleObras(id) {
    setEditandoId(null)
    setExpandidoId((atual) => (atual === id ? null : id))
  }

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
      setExpandidoId(data.id) // ja abre as obras do recem-criado
    }
    setSalvando(false)
  }

  function iniciarEdicao(c) {
    setExpandidoId(null)
    setEditandoId(c.id)
    setEditNome(c.nome)
    setEditObs(c.observacoes ?? '')
    setErro('')
  }

  async function salvarEdicao(evento) {
    evento.preventDefault()
    setSalvando(true)
    setErro('')
    const { error } = await supabase
      .from('cliente')
      .update({ nome: editNome.trim(), observacoes: editObs.trim() || null })
      .eq('id', editandoId)

    if (error) setErro('Não foi possível salvar o cliente.')
    else {
      setEditandoId(null)
      await carregar()
    }
    setSalvando(false)
  }

  async function excluirCliente(cliente) {
    if (!window.confirm(`Excluir o cliente "${cliente.nome}"?`)) return
    const { error } = await supabase.from('cliente').delete().eq('id', cliente.id)
    if (error) {
      setErro('Não foi possível excluir (o cliente pode ter obras vinculadas).')
    } else {
      if (expandidoId === cliente.id) setExpandidoId(null)
      await carregar()
    }
  }

  if (carregando) return <p>Carregando clientes…</p>

  return (
    <div className="secao-clientes">
      <header className="hero-demandas">
        <h1 className="hero-titulo">Clientes</h1>
        <div className="hero-acoes">
          <button
            type="button"
            className="btn-circular"
            onClick={aoAbrirNotif}
            aria-label="Notificações"
            title="Notificações"
          >
            <Icone nome="sino" size={20} />
            {naoLidas > 0 && <span className="sino-badge">{naoLidas}</span>}
          </button>
        </div>
      </header>

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
            <li key={c.id} className="cad-bloco">
              {editandoId === c.id ? (
                <form className="form-novo form-cad" onSubmit={salvarEdicao}>
                  <h3>Editar cliente</h3>
                  <input
                    type="text"
                    placeholder="Nome do cliente"
                    value={editNome}
                    onChange={(e) => setEditNome(e.target.value)}
                    required
                    autoFocus
                  />
                  <input
                    type="text"
                    placeholder="Observações (opcional)"
                    value={editObs}
                    onChange={(e) => setEditObs(e.target.value)}
                  />
                  {editNomeDuplicado && (
                    <p className="aviso">
                      Já existe outro cliente com esse nome — evite duplicatas
                      (ex.: “JOÃO” e “joão”).
                    </p>
                  )}
                  <div className="form-cad-acoes">
                    <button type="submit" disabled={salvando || !editNome.trim()}>
                      {salvando ? 'Salvando…' : 'Salvar'}
                    </button>
                    <button
                      type="button"
                      className="link"
                      onClick={() => setEditandoId(null)}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className={`cad-linha ${expandidoId === c.id ? 'aberto' : ''}`}>
                    <button
                      type="button"
                      className="cad-item"
                      onClick={() => toggleObras(c.id)}
                    >
                      <span className="cad-avatar">{iniciais(c.nome)}</span>
                      <span className="cad-texto">
                        <strong className="cad-nome">{c.nome}</strong>
                        {c.observacoes && (
                          <span className="cad-sub">{c.observacoes}</span>
                        )}
                      </span>
                      <span
                        className={`cad-chevron ${expandidoId === c.id ? 'aberto' : ''}`}
                      >
                        <Icone nome="chevron-direita" size={20} />
                      </span>
                    </button>
                    {podeEditar && (
                      <button
                        type="button"
                        className="cad-editar"
                        title="Editar cliente"
                        aria-label="Editar cliente"
                        onClick={() => iniciarEdicao(c)}
                      >
                        <Icone nome="editar" size={16} />
                      </button>
                    )}
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
                  </div>
                  {expandidoId === c.id && (
                    <div className="obras-box">
                      <ObrasDoCliente cliente={c} perfil={perfil} />
                    </div>
                  )}
                </>
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
