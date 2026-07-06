import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Icone from './Icone'

// Lista + busca + criacao das obras de UM cliente (drill-in). "aoVoltar"
// retorna para a lista de clientes.
export default function ObrasDoCliente({ cliente, perfil, aoVoltar }) {
  const [obras, setObras] = useState([])
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const [mostrarForm, setMostrarForm] = useState(false)
  const [nome, setNome] = useState('')
  const [endereco, setEndereco] = useState('')
  const [salvando, setSalvando] = useState(false)

  const podeEditar = perfil.papel === 'admin' || perfil.papel === 'atendente'

  async function carregar() {
    setCarregando(true)
    const { data, error } = await supabase
      .from('obra')
      .select('id, nome, endereco')
      .eq('cliente_id', cliente.id)
      .order('nome')

    if (error) setErro('Não foi possível carregar as obras.')
    else setObras(data)
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [cliente.id])

  const termo = busca.trim().toLowerCase()
  const filtradas = termo
    ? obras.filter((o) => o.nome.toLowerCase().includes(termo))
    : obras

  function abrirForm() {
    setNome(busca.trim())
    setEndereco('')
    setMostrarForm(true)
  }

  async function criarObra(evento) {
    evento.preventDefault()
    setSalvando(true)
    setErro('')

    const { error } = await supabase.from('obra').insert({
      cliente_id: cliente.id,
      nome: nome.trim(),
      endereco: endereco.trim() || null,
    })

    if (error) {
      setErro('Não foi possível criar a obra.')
    } else {
      setNome('')
      setEndereco('')
      setBusca('')
      setMostrarForm(false)
      await carregar()
    }
    setSalvando(false)
  }

  async function excluirObra(obra) {
    if (!window.confirm(`Excluir a obra "${obra.nome}"?`)) return
    const { error } = await supabase.from('obra').delete().eq('id', obra.id)
    if (error) setErro('Não foi possível excluir a obra.')
    else await carregar()
  }

  return (
    <div className="secao-obras">
      <header className="obras-topo">
        <button
          type="button"
          className="det-topo-btn"
          onClick={aoVoltar}
          aria-label="Voltar aos clientes"
          title="Voltar aos clientes"
        >
          <Icone nome="voltar" size={20} />
        </button>
        <h3>Obras de “{cliente.nome}”</h3>
      </header>

      <div className="campo-busca">
        <span className="campo-busca-icone">
          <Icone nome="lupa" size={18} />
        </span>
        <input
          type="search"
          className="input-busca"
          placeholder="Buscar obra…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {erro && <p className="erro">{erro}</p>}

      {carregando ? (
        <p>Carregando obras…</p>
      ) : filtradas.length === 0 ? (
        <p className="vazio">Nenhuma obra ainda.</p>
      ) : (
        <ul className="lista-cad">
          {filtradas.map((o) => (
            <li key={o.id} className="cad-linha">
              <div className="cad-item cad-item-estatico">
                <span className="cad-avatar cad-avatar-obra">
                  <Icone nome="predio" size={20} />
                </span>
                <span className="cad-texto">
                  <strong className="cad-nome">{o.nome}</strong>
                  {o.endereco && <span className="cad-sub">{o.endereco}</span>}
                </span>
              </div>
              {podeEditar && (
                <button
                  type="button"
                  className="cad-excluir"
                  title="Excluir obra"
                  aria-label="Excluir obra"
                  onClick={() => excluirObra(o)}
                >
                  <Icone nome="lixeira" size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {mostrarForm ? (
        <form className="form-novo form-cad" onSubmit={criarObra}>
          <h4>Nova obra</h4>
          <input
            type="text"
            placeholder="Nome/identificação da obra"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            autoFocus
          />
          <input
            type="text"
            placeholder="Endereço (opcional)"
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
          />
          <div className="form-cad-acoes">
            <button type="submit" disabled={salvando || !nome.trim()}>
              {salvando ? 'Salvando…' : 'Criar obra'}
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
          <Icone nome="mais" size={18} /> Nova obra
        </button>
      )}
    </div>
  )
}
