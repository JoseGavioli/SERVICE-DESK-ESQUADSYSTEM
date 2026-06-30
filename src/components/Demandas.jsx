import { Fragment, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { STATUS_ROTULO } from '../lib/status'
import NovaDemanda from './NovaDemanda'
import DetalheDemanda from './DetalheDemanda'
import SeloUrgencia from './SeloUrgencia'

// Secao "Demandas": lista com as demandas-filhas ANINHADAS sob a pai (§11),
// codigo hierarquico (10, 10.1, 10.1.1), recolher/expandir, e abrir o detalhe.
// A RLS ja filtra (vendedor ve as proprias; admin/atendente veem todas).
export default function Demandas({ perfil }) {
  const [demandas, setDemandas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [criando, setCriando] = useState(false)
  const [detalheId, setDetalheId] = useState(null)
  const [recolhidos, setRecolhidos] = useState(new Set()) // ids com filhas escondidas

  async function carregar() {
    setCarregando(true)
    const { data, error } = await supabase
      .from('demanda')
      .select(
        'id, descricao, prazo, status, created_at, demanda_pai_id, cancelamento_solicitado, tipo_demanda(nome), obra(nome, cliente(nome))',
      )
      .order('created_at', { ascending: false })
    if (error) setErro('Não foi possível carregar as demandas.')
    else setDemandas(data)
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  function alternar(id) {
    setRecolhidos((prev) => {
      const novo = new Set(prev)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  // ── Arvore + codigos hierarquicos ──────────────────────────────
  const idsVisiveis = new Set(demandas.map((d) => d.id))
  const filhosPor = {}
  for (const d of demandas) {
    if (d.demanda_pai_id != null) {
      if (!filhosPor[d.demanda_pai_id]) filhosPor[d.demanda_pai_id] = []
      filhosPor[d.demanda_pai_id].push(d)
    }
  }
  function filhosDe(id) {
    return (filhosPor[id] || [])
      .slice()
      .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
  }
  const raizes = demandas.filter(
    (d) => d.demanda_pai_id == null || !idsVisiveis.has(d.demanda_pai_id),
  )
  // Codigo: raiz = proprio id; filha = codigoDoPai + "." + posicao (1-based).
  const codigos = {}
  function atribuirCodigos(d, codigo) {
    codigos[d.id] = codigo
    filhosDe(d.id).forEach((f, i) => atribuirCodigos(f, `${codigo}.${i + 1}`))
  }
  raizes.forEach((r) => atribuirCodigos(r, String(r.id)))

  if (criando) {
    return (
      <NovaDemanda
        aoCriar={(novoId) => {
          setCriando(false)
          carregar()
          setDetalheId(novoId) // abre a demanda recem-criada
        }}
        aoCancelar={() => setCriando(false)}
      />
    )
  }

  if (detalheId) {
    return (
      <DetalheDemanda
        key={detalheId}
        demandaId={detalheId}
        codigo={codigos[detalheId]}
        perfil={perfil}
        aoVoltar={() => setDetalheId(null)}
        aoAbrir={(id) => {
          carregar() // recarrega p/ o codigo da nova demanda entrar no mapa
          setDetalheId(id)
        }}
      />
    )
  }

  function renderItem(d, nivel) {
    const filhos = filhosDe(d.id)
    const temFilhos = filhos.length > 0
    const recolhido = recolhidos.has(d.id)
    return (
      <Fragment key={d.id}>
        <li>
          <div
            className="linha-demanda"
            style={nivel > 0 ? { paddingLeft: `${nivel * 1.4}rem` } : undefined}
          >
            <button
              type="button"
              className="item-demanda"
              onClick={() => setDetalheId(d.id)}
            >
              <div>
                {nivel > 0 && <span className="seta-filha">↪ </span>}
                <strong>#{codigos[d.id] ?? d.id}</strong> — {d.tipo_demanda?.nome}
                <div className="sub">
                  {d.obra?.cliente?.nome} / {d.obra?.nome} · prazo {d.prazo}
                </div>
              </div>
              <div className="badges">
                <span className={`status status-${d.status}`}>
                  {STATUS_ROTULO[d.status]}
                </span>
                <SeloUrgencia prazo={d.prazo} status={d.status} />
                {d.cancelamento_solicitado && (
                  <span className="marca-cancel">⚠️ cancelamento</span>
                )}
              </div>
            </button>
            {temFilhos && (
              <button
                type="button"
                className="toggle-filhas"
                onClick={() => alternar(d.id)}
                aria-label={recolhido ? 'Mostrar filhas' : 'Esconder filhas'}
                title={recolhido ? 'Mostrar filhas' : 'Esconder filhas'}
              >
                {recolhido ? '▸' : '▾'}
              </button>
            )}
          </div>
        </li>
        {temFilhos && !recolhido && filhos.map((f) => renderItem(f, nivel + 1))}
      </Fragment>
    )
  }

  return (
    <div className="secao-demandas">
      <div className="cabecalho">
        <h2>Demandas</h2>
        <button type="button" onClick={() => setCriando(true)}>
          ➕ Nova demanda
        </button>
      </div>

      {erro && <p className="erro">{erro}</p>}

      {carregando ? (
        <p>Carregando demandas…</p>
      ) : demandas.length === 0 ? (
        <p className="vazio">Nenhuma demanda ainda.</p>
      ) : (
        <ul className="lista-demandas">
          {raizes.map((d) => renderItem(d, 0))}
        </ul>
      )}
    </div>
  )
}
