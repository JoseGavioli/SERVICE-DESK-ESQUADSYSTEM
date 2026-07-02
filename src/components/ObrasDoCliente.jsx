import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Icone from './Icone'

// Lista + busca + criacao das obras de UM cliente (recebido por prop).
export default function ObrasDoCliente({ cliente, perfil }) {
  const [obras, setObras] = useState([])
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

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

  // Recarrega sempre que o cliente selecionado muda.
  useEffect(() => {
    carregar()
  }, [cliente.id])

  const termo = busca.trim().toLowerCase()
  const filtradas = termo
    ? obras.filter((o) => o.nome.toLowerCase().includes(termo))
    : obras

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
      <h3>Obras de “{cliente.nome}”</h3>

      <input
        type="search"
        placeholder="Buscar obra…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />

      {erro && <p className="erro">{erro}</p>}

      {carregando ? (
        <p>Carregando obras…</p>
      ) : filtradas.length === 0 ? (
        <p className="vazio">Nenhuma obra ainda.</p>
      ) : (
        <div className="cards">
          {filtradas.map((o) => (
            <div key={o.id} className="card card-estatico">
              <div className="card-corpo">
                <span className="id">#{o.id}</span>
                <span className="nome">{o.nome}</span>
                {o.endereco && <span className="obs">{o.endereco}</span>}
              </div>
              {podeEditar && (
                <button
                  type="button"
                  className="excluir"
                  title="Excluir obra"
                  onClick={() => excluirObra(o)}
                >
                  <Icone nome="lixeira" size={18} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <form className="form-novo" onSubmit={criarObra}>
        <h4><Icone nome="mais" size={16} /> Nova obra</h4>
        <input
          type="text"
          placeholder="Nome/identificação da obra"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Endereço (opcional)"
          value={endereco}
          onChange={(e) => setEndereco(e.target.value)}
        />
        <button type="submit" disabled={salvando || !nome.trim()}>
          {salvando ? 'Salvando…' : 'Criar obra'}
        </button>
      </form>
    </div>
  )
}
