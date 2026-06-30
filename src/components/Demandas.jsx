import { Fragment, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { STATUS_ROTULO } from '../lib/status'
import { calcularUrgencia, URGENCIA_NIVEIS } from '../lib/urgencia'
import NovaDemanda from './NovaDemanda'
import DetalheDemanda from './DetalheDemanda'
import SeloUrgencia from './SeloUrgencia'
import FiltrosDemandas from './FiltrosDemandas'

// Rank de urgencia (0 = mais critico) para ordenar a fila.
const RANK_URGENCIA = Object.fromEntries(
  URGENCIA_NIVEIS.map((u, i) => [u.nivel, i]),
)

const FILTROS_VAZIOS = {
  busca: '',
  status: '',
  urgencia: '',
  soAtivas: false,
  ordenar: false,
}

// Secao "Demandas". Sem filtro: arvore aninhada (pai ↪ filha) com codigo
// hierarquico e recolher/expandir. Com filtro: lista plana dos resultados.
// A RLS ja restringe (vendedor ve as proprias; admin/atendente veem todas).
export default function Demandas({ perfil, novidades, recarregarNovidades }) {
  const [demandas, setDemandas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [criando, setCriando] = useState(false)
  const [detalheId, setDetalheId] = useState(null)
  const [recolhidos, setRecolhidos] = useState(new Set())
  const [f, setF] = useState(FILTROS_VAZIOS)

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
  const codigos = {}
  function atribuirCodigos(d, codigo) {
    codigos[d.id] = codigo
    filhosDe(d.id).forEach((fi, i) => atribuirCodigos(fi, `${codigo}.${i + 1}`))
  }
  raizes.forEach((r) => atribuirCodigos(r, String(r.id)))

  // ── Filtros ────────────────────────────────────────────────────
  const filtrando =
    f.busca.trim() !== '' ||
    f.status !== '' ||
    f.urgencia !== '' ||
    f.soAtivas ||
    f.ordenar

  function calcularLista() {
    const termo = f.busca.trim().toLowerCase()
    let lista = demandas.filter((d) => {
      if (f.status && d.status !== f.status) return false
      if (f.soAtivas && (d.status === 'enviado' || d.status === 'cancelada'))
        return false
      if (f.urgencia) {
        const u = calcularUrgencia(d.prazo, d.status)
        if (!u || u.nivel !== f.urgencia) return false
      }
      if (termo) {
        const alvo = [
          codigos[d.id],
          d.tipo_demanda?.nome,
          d.obra?.cliente?.nome,
          d.obra?.nome,
          d.descricao,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!alvo.includes(termo)) return false
      }
      return true
    })
    if (f.ordenar) {
      const rank = (d) => {
        const u = calcularUrgencia(d.prazo, d.status)
        return u ? RANK_URGENCIA[u.nivel] : 99 // terminais por ultimo
      }
      lista = lista.slice().sort((a, b) => rank(a) - rank(b))
    }
    return lista
  }

  if (criando) {
    return (
      <NovaDemanda
        aoCriar={(novoId) => {
          setCriando(false)
          carregar()
          setDetalheId(novoId)
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
          carregar()
          setDetalheId(id)
        }}
        aoVisto={recarregarNovidades}
      />
    )
  }

  // Conteudo clicavel de uma linha (reutilizado na arvore e na lista plana).
  function botaoDemanda(d, nivel) {
    return (
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
          {novidades?.has(d.id) && (
            <span className="novidade-marca">novidade</span>
          )}
        </div>
      </button>
    )
  }

  function renderArvore(d, nivel) {
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
            {botaoDemanda(d, nivel)}
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
        {temFilhos && !recolhido && filhos.map((fi) => renderArvore(fi, nivel + 1))}
      </Fragment>
    )
  }

  const listaFiltrada = filtrando ? calcularLista() : []

  return (
    <div className="secao-demandas">
      <div className="cabecalho">
        <h2>Demandas</h2>
        <button type="button" onClick={() => setCriando(true)}>
          ➕ Nova demanda
        </button>
      </div>

      <FiltrosDemandas f={f} setF={setF} />

      {erro && <p className="erro">{erro}</p>}

      {carregando ? (
        <p>Carregando demandas…</p>
      ) : demandas.length === 0 ? (
        <p className="vazio">Nenhuma demanda ainda.</p>
      ) : filtrando ? (
        listaFiltrada.length === 0 ? (
          <p className="vazio">Nenhuma demanda encontrada com esses filtros.</p>
        ) : (
          <ul className="lista-demandas">
            {listaFiltrada.map((d) => (
              <li key={d.id}>
                <div className="linha-demanda">{botaoDemanda(d, 0)}</div>
              </li>
            ))}
          </ul>
        )
      ) : (
        <ul className="lista-demandas">
          {raizes.map((d) => renderArvore(d, 0))}
        </ul>
      )}
    </div>
  )
}
