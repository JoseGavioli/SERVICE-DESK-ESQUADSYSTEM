import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Icone from './Icone'

// Lista para escolher uma obra DO cliente recebido por prop. Igual ao
// SeletorCliente: renderiza so o miolo, os 5 ultimos por padrao, busca filtra
// tudo, e cria na hora se nao existir (§issue #64).
const QUANTOS_RECENTES = 5

export default function SeletorObra({ cliente, aoSelecionar, autoFoco = true }) {
  const [obras, setObras] = useState([])
  const [busca, setBusca] = useState('')
  const [erro, setErro] = useState('')
  const [criando, setCriando] = useState(false)
  // Obra nova precisa da cidade JUNTO (§#85 fase 3): o banco passa a exigir o
  // campo (0048), entao criar primeiro e completar depois deixaria de
  // funcionar. O clique em "Criar obra" abre este campo em vez de inserir.
  const [pedindoCidade, setPedindoCidade] = useState(false)
  const [cidade, setCidade] = useState('')

  useEffect(() => {
    // Trocou de cliente: o painel de "nova obra" (e o que foi digitado nele)
    // era do cliente ANTERIOR. O componente nao remonta na troca — so a prop
    // muda —, entao a limpeza e explicita.
    setPedindoCidade(false)
    setCidade('')
    async function carregar() {
      const { data, error } = await supabase
        .from('obra')
        .select('id, nome, cidade_estado, created_at')
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

  async function criar(evento) {
    evento?.preventDefault()
    // O Enter no campo de cidade chama isto direto, e o input nao desabilita
    // enquanto o insert esta em voo — sem esta linha, dois Enters criavam DUAS
    // obras com o mesmo nome.
    if (criando) return
    const nome = busca.trim()
    const cidadeLimpa = cidade.trim()
    if (!nome || !cidadeLimpa) return
    setCriando(true)
    setErro('')
    const { data, error } = await supabase
      .from('obra')
      .insert({ cliente_id: cliente.id, nome, cidade_estado: cidadeLimpa })
      .select('id, nome, cidade_estado, created_at')
      .single()
    setCriando(false)
    if (error) {
      setErro('Erro ao criar obra.')
    } else {
      setObras((prev) => [...prev, data])
      setPedindoCidade(false)
      setCidade('')
      aoSelecionar(data)
    }
  }

  return (
    <div className="escolher">
      <input
        type="search"
        placeholder={`Buscar obra de ${cliente.nome}…`}
        value={busca}
        onChange={(e) => {
          setBusca(e.target.value)
          // O painel de "nova obra" era do texto ANTERIOR: mantê-lo aberto
          // deixava criar "Casa A" com o campo dizendo "Casa B" — e, se o novo
          // texto bater com uma obra existente, criaria uma duplicata.
          setPedindoCidade(false)
          setCidade('')
        }}
        aria-label="Buscar obra"
        autoFocus={autoFoco}
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
      {termo && !nomeExato && !pedindoCidade && (
        <button
          type="button"
          className="escolher-criar"
          onClick={() => {
            setPedindoCidade(true)
            setErro('')
          }}
        >
          <Icone nome="mais" size={16} /> Criar obra “{busca.trim()}”
        </button>
      )}

      {/* A cidade vem ANTES do insert: depois da 0048 o banco recusa obra sem
          ela, entao nao da para criar agora e completar depois. */}
      {termo && pedindoCidade && !nomeExato && (
        <div className="escolher-nova-obra">
          <p className="escolher-rot">Nova obra “{busca.trim()}”</p>
          <input
            type="text"
            placeholder="Cidade e estado (ex.: Tatuí - SP)"
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            aria-label="Cidade e estado da obra"
            autoFocus
            onKeyDown={(e) => {
              // Enter aqui CRIA a obra; sem isto ele borbulharia e enviaria o
              // formulario inteiro da nova demanda.
              if (e.key === 'Enter') {
                e.preventDefault()
                e.stopPropagation()
                criar()
              }
            }}
          />
          <div className="escolher-nova-acoes">
            <button
              type="button"
              className="escolher-criar"
              onClick={criar}
              disabled={criando || !cidade.trim()}
            >
              {criando ? 'Criando…' : 'Criar obra'}
            </button>
            <button
              type="button"
              className="link"
              onClick={() => {
                setPedindoCidade(false)
                setCidade('')
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
