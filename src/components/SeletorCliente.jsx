import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Icone from './Icone'

// Lista para escolher um cliente. Renderiza SO o miolo — quem desenha a moldura
// e o <CardCampo> na Nova demanda (§issue #64).
//
// Busca-primeiro (§6, anti-duplicata): sem busca mostramos apenas os 5 ULTIMOS
// cadastrados, porque a lista inteira empurrava o resto do formulario para
// longe e, na pratica, o cliente recem-cadastrado e quase sempre o alvo.
// Digitou -> filtra a lista toda. Nao achou -> cria na hora.
const QUANTOS_RECENTES = 5

export default function SeletorCliente({ aoSelecionar }) {
  const [clientes, setClientes] = useState([])
  const [busca, setBusca] = useState('')
  const [erro, setErro] = useState('')
  const [criando, setCriando] = useState(false)

  useEffect(() => {
    async function carregar() {
      const { data, error } = await supabase
        .from('cliente')
        .select('id, nome, created_at')
        .order('nome')
      if (error) setErro('Erro ao carregar clientes.')
      else setClientes(data)
    }
    carregar()
  }, [])

  const termo = busca.trim().toLowerCase()
  // created_at e texto ISO — comparar como texto ja da a ordem cronologica.
  const recentes = [...clientes]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, QUANTOS_RECENTES)
  const mostrados = termo
    ? clientes.filter((c) => c.nome.toLowerCase().includes(termo))
    : recentes
  const nomeExato = clientes.some((c) => c.nome.toLowerCase() === termo)

  async function criar() {
    const nome = busca.trim()
    if (!nome) return
    setCriando(true)
    setErro('')
    const { data, error } = await supabase
      .from('cliente')
      .insert({ nome })
      .select('id, nome, created_at')
      .single()
    setCriando(false)
    if (error) {
      setErro('Erro ao criar cliente.')
    } else {
      setClientes((prev) => [...prev, data])
      aoSelecionar(data)
    }
  }

  return (
    <div className="escolher">
      <input
        type="search"
        placeholder="Buscar cliente…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        aria-label="Buscar cliente"
        autoFocus
      />
      {erro && <p className="erro">{erro}</p>}
      <p className="escolher-rot">
        {termo ? 'Resultados' : `Últimos ${QUANTOS_RECENTES} cadastrados`}
      </p>
      <ul className="escolher-lista">
        {mostrados.map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => aoSelecionar(c)}>
              {c.nome}
            </button>
          </li>
        ))}
        {mostrados.length === 0 && (
          <li className="escolher-vazio">Nenhum cliente encontrado.</li>
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
              <Icone nome="mais" size={16} /> Criar cliente “{busca.trim()}”
            </>
          )}
        </button>
      )}
    </div>
  )
}
