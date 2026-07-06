import { Fragment, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { STATUS_ROTULO } from '../lib/status'
import { calcularUrgencia, URGENCIA_NIVEIS, estaCustoAtrasado } from '../lib/urgencia'
import NovaDemanda from './NovaDemanda'
import DetalheDemanda from './DetalheDemanda'
import SeloUrgencia from './SeloUrgencia'
import FiltrosDemandas from './FiltrosDemandas'
import EstadoVazio from './EstadoVazio'
import Icone from './Icone'

// Rank de urgencia (0 = mais critico) para ordenar a fila.
const RANK_URGENCIA = Object.fromEntries(
  URGENCIA_NIVEIS.map((u, i) => [u.nivel, i]),
)

const FILTROS_VAZIOS = {
  busca: '',
  status: '',
  urgencia: '',
  soAtivas: false,
  soAtencao: false, // atalho "precisam de atencao" (§issue #4)
  ordenacao: 'padrao', // padrao | urgencia | recentes | antigas
}

// Chips de status no cabecalho (segmentos, estilo referencia). Cada chip mapeia
// para um recorte de `f`: status e soAtivas. "Todas" = sem recorte.
const ABAS_STATUS = [
  { id: 'todas', rotulo: 'Todas' },
  { id: 'em_aberto', rotulo: 'Em aberto' },
  { id: 'enviados', rotulo: 'Enviados' },
  { id: 'cancelados', rotulo: 'Cancelados' },
]

// Status finalizados que ganham destaque (borda colorida) na lista.
const STATUS_FINAL = ['enviado', 'cancelada']

// Iniciais (ate 2 letras) para o mini-avatar do vendedor.
function iniciais(nome) {
  const partes = nome.trim().split(/\s+/)
  const a = partes[0]?.[0] ?? ''
  const b = partes.length > 1 ? partes[partes.length - 1][0] : ''
  return (a + b).toUpperCase()
}

// Secao "Demandas". Sem filtro: arvore aninhada (pai ↪ filha) com codigo
// hierarquico e recolher/expandir. Com filtro: lista plana dos resultados.
// A RLS ja restringe (vendedor ve as proprias; admin/atendente veem todas).
export default function Demandas({
  perfil,
  novidades,
  comentariosNovos,
  marcarLidaDemanda,
  demandaInicial,
  aoConsumirInicial,
  filtroInicial,
  aoConsumirFiltro,
  criarInicial,
  aoConsumirCriar,
  naoLidas,
  aoAbrirNotif,
  aoDetalhe,
}) {
  const [demandas, setDemandas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [criando, setCriando] = useState(false)
  const [detalheId, setDetalheId] = useState(null)
  const [recolhidos, setRecolhidos] = useState(new Set())
  const [f, setF] = useState(FILTROS_VAZIOS)
  const [buscaAberta, setBuscaAberta] = useState(false) // barra de busca (lupa)
  // Mapa demanda_id -> data da 1a entrada em "revisao de custo" (para o atraso).
  const [datasRevisao, setDatasRevisao] = useState({})

  // silencioso: recarrega sem mostrar o skeleton (ex.: ao voltar do detalhe,
  // para refletir mudancas de status sem "piscar" a lista inteira).
  async function carregar({ silencioso = false } = {}) {
    if (!silencioso) setCarregando(true)
    const [{ data, error }, { data: datas }] = await Promise.all([
      supabase
        .from('demanda')
        .select(
          'id, descricao, prazo, status, created_at, demanda_pai_id, cancelamento_solicitado, tipo_demanda(nome), obra(nome, cliente(nome)), vendedor:perfil!vendedor_id(nome_completo), comentario(count)',
        )
        .order('created_at', { ascending: false }),
      supabase.rpc('datas_primeira_revisao'),
    ])
    if (error) setErro('Não foi possível carregar as demandas.')
    else setDemandas(data)
    if (datas) {
      const mapa = {}
      for (const r of datas) mapa[r.demanda_id] = r.data
      setDatasRevisao(mapa)
    }
    setCarregando(false)
  }

  // Custo atrasado: >= 5 dias uteis em revisao de custo (§alerta).
  function custoAtrasado(d) {
    return estaCustoAtrasado(d.status, datasRevisao[d.id])
  }
  // Prazo do orcamento ja venceu (urgencia "Atrasado").
  function prazoVencido(d) {
    return calcularUrgencia(d.prazo, d.status)?.nivel === 'atrasado'
  }
  // Demanda que "chama a atencao" (fundo vermelho + topo): custo atrasado
  // OU prazo vencido. O que diferencia os dois e a tag/selo exibido.
  function precisaAtencao(d) {
    return custoAtrasado(d) || prazoVencido(d)
  }
  // Atalho "Precisam de atencao" (§issue #4): o vermelho acima + as demandas
  // com cancelamento SOLICITADO (aguardando o admin decidir).
  function mereceAtencao(d) {
    return precisaAtencao(d) || d.cancelamento_solicitado
  }

  useEffect(() => {
    carregar()
  }, [])

  // Veio da Inicio clicando numa notificacao: abre a demanda direto.
  useEffect(() => {
    if (demandaInicial) {
      setDetalheId(demandaInicial)
      aoConsumirInicial?.()
    }
  }, [demandaInicial])

  // Veio da Inicio clicando numa box: aplica o filtro ({} = limpa/mostra todas).
  useEffect(() => {
    if (filtroInicial) {
      setDetalheId(null)
      setF({ ...FILTROS_VAZIOS, ...filtroInicial })
      aoConsumirFiltro?.()
    }
  }, [filtroInicial])

  // Veio da Inicio clicando em "incluir nova demanda": abre o form.
  useEffect(() => {
    if (criarInicial) {
      setCriando(true)
      aoConsumirCriar?.()
    }
  }, [criarInicial])

  // Avisa o Painel quando um detalhe abre/fecha (p/ ele esconder o bottom-nav
  // e o FAB quando o staff esta no detalhe). Reseta ao desmontar.
  useEffect(() => {
    aoDetalhe?.(!!detalheId)
  }, [detalheId])
  useEffect(() => () => aoDetalhe?.(false), [])

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
    f.soAtencao ||
    f.ordenacao !== 'padrao'

  // Quantas demandas visiveis "merecem atencao" (para o atalho, §issue #4).
  const qtdAtencao = demandas.filter(mereceAtencao).length

  function calcularLista() {
    const termo = f.busca.trim().toLowerCase()
    let lista = demandas.filter((d) => {
      if (f.soAtencao && !mereceAtencao(d)) return false
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
    if (f.ordenacao === 'recentes') {
      lista = lista
        .slice()
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    } else if (f.ordenacao === 'antigas') {
      lista = lista
        .slice()
        .sort((a, b) => (a.created_at > b.created_at ? 1 : -1))
    } else if (f.ordenacao === 'urgencia') {
      const rank = (d) => {
        const u = calcularUrgencia(d.prazo, d.status)
        return u ? RANK_URGENCIA[u.nivel] : 99 // terminais por ultimo
      }
      lista = lista.slice().sort((a, b) => rank(a) - rank(b))
    }
    // 'padrao' = mantem a ordem base (mais recentes primeiro, do carregar)
    // Demandas que precisam de atencao sempre no topo (evidencia), preservando
    // a ordem acima dentro de cada grupo (o sort do JS e estavel).
    return lista
      .slice()
      .sort((a, b) => (precisaAtencao(a) ? 0 : 1) - (precisaAtencao(b) ? 0 : 1))
  }

  // ── Handlers do filtro ──────────────────────────────────────────
  // A busca aplica AO VIVO; os filtros estruturados so no botao "Filtrar".
  function aoBuscar(v) {
    setF((prev) => ({ ...prev, busca: v }))
  }
  function aoAplicarFiltros(rascunho) {
    setF((prev) => ({ ...prev, ...rascunho }))
  }
  // "Filtrar" avancado cuida so de urgencia + ordenacao (status vive nos chips).
  function aoRemoverFiltro(campo) {
    const PADRAO = { urgencia: '', ordenacao: 'padrao' }
    setF((prev) => ({ ...prev, [campo]: PADRAO[campo] }))
  }
  function aoLimparFiltros() {
    setF((prev) => ({ ...prev, urgencia: '', ordenacao: 'padrao' }))
  }

  // ── Chips de status + busca (cabecalho) ─────────────────────────
  // Qual chip esta ativo (deriva de f) e como aplicar cada um.
  const abaAtiva =
    f.status === 'enviado'
      ? 'enviados'
      : f.status === 'cancelada'
        ? 'cancelados'
        : f.soAtivas
          ? 'em_aberto'
          : 'todas'
  function selecionarAba(aba) {
    setF((prev) => ({
      ...prev,
      status:
        aba === 'enviados' ? 'enviado' : aba === 'cancelados' ? 'cancelada' : '',
      soAtivas: aba === 'em_aberto',
    }))
  }
  // A lupa abre/fecha a barra de busca; ao fechar, limpa o termo (nao deixa
  // filtro escondido ativo).
  function alternarBusca() {
    setBuscaAberta((v) => {
      if (v) aoBuscar('')
      return !v
    })
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
        aoVoltar={() => {
          setDetalheId(null)
          carregar({ silencioso: true }) // reflete o que mudou no detalhe
        }}
        aoAbrir={(id) => {
          carregar({ silencioso: true })
          setDetalheId(id)
        }}
        aoVisto={() => marcarLidaDemanda(detalheId)}
        naoLidas={naoLidas}
        aoAbrirNotif={aoAbrirNotif}
      />
    )
  }

  // Conteudo clicavel de uma linha (reutilizado na arvore e na lista plana).
  function botaoDemanda(d, nivel) {
    const qtdComent = d.comentario?.[0]?.count ?? 0
    const comentNovo = comentariosNovos?.has(d.id)
    const custoAtras = custoAtrasado(d)
    const atencao = precisaAtencao(d)
    const destaque = STATUS_FINAL.includes(d.status) ? ` fim-${d.status}` : ''
    return (
      <button
        type="button"
        className={`item-demanda${destaque}${atencao ? ' atencao' : ''}`}
        onClick={() => setDetalheId(d.id)}
      >
        <div>
          {nivel > 0 && (
            <span className="seta-filha">
              <Icone nome="seta-filha" size={13} />{' '}
            </span>
          )}
          <strong>#{codigos[d.id] ?? d.id}</strong> —{' '}
          <strong className="cliente-nome">{d.obra?.cliente?.nome}</strong>
          <div className="sub">{d.obra?.nome}</div>
          <div className="sub">
            <strong>{d.tipo_demanda?.nome}</strong> · criada em{' '}
            {new Date(d.created_at).toLocaleDateString('pt-BR')}
          </div>
          {perfil.papel !== 'vendedor' && d.vendedor?.nome_completo && (
            <div className="vendedor-linha">
              <span className="avatar-mini">
                {iniciais(d.vendedor.nome_completo)}
              </span>
              {d.vendedor.nome_completo}
            </div>
          )}
        </div>
        <div className="badges">
          {custoAtras && (
            <span className="selo-custo-atrasado">
              <Icone nome="relogio" size={12} /> custo atrasado
            </span>
          )}
          <span className={`status status-${d.status}`}>
            {STATUS_ROTULO[d.status]}
          </span>
          <SeloUrgencia prazo={d.prazo} status={d.status} />
          {d.cancelamento_solicitado && (
            <span className="marca-cancel">
              <Icone nome="aviso" size={12} /> cancelamento
            </span>
          )}
          {novidades?.has(d.id) && (
            <span className="novidade-marca">novidade</span>
          )}
          {(qtdComent > 0 || comentNovo) && (
            <span className={`coment ${comentNovo ? 'coment-novo' : ''}`}>
              <Icone nome="chat" size={13} /> {qtdComent}
              {comentNovo ? ' • novo' : ''}
            </span>
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
                <Icone
                  nome={recolhido ? 'chevron-direita' : 'chevron-baixo'}
                  size={16}
                />
              </button>
            )}
          </div>
        </li>
        {temFilhos && !recolhido && filhos.map((fi) => renderArvore(fi, nivel + 1))}
      </Fragment>
    )
  }

  const listaFiltrada = filtrando ? calcularLista() : []
  // Na arvore, as raizes que precisam de atencao sobem para o topo (as filhas
  // seguem aninhadas; os codigos hierarquicos nao mudam, pois derivam do id).
  const raizesOrdenadas = [...raizes].sort(
    (a, b) => (precisaAtencao(a) ? 0 : 1) - (precisaAtencao(b) ? 0 : 1),
  )

  return (
    <div className="secao-demandas">
      <header className="hero-demandas">
        <h1 className="hero-titulo">Orçamentos e Revisões</h1>
        <div className="hero-acoes">
          <button
            type="button"
            className={`btn-circular ${buscaAberta ? 'ativo' : ''}`}
            onClick={alternarBusca}
            aria-label="Buscar"
            aria-pressed={buscaAberta}
          >
            <Icone nome="lupa" size={20} />
          </button>
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

      <p className="saudacao">
        Olá, <strong>{perfil.nome_completo}</strong> 👋
      </p>

      <div className="chips-status">
        {ABAS_STATUS.map((a, i) => (
          <Fragment key={a.id}>
            <button
              type="button"
              className={`chip-status ${abaAtiva === a.id ? 'ativo' : ''}`}
              onClick={() => selecionarAba(a.id)}
            >
              {a.rotulo}
            </button>
            {/* "Atenção" entra logo apos "Todas", quando ha demandas na flag (#2). */}
            {i === 0 && qtdAtencao > 0 && (
              <button
                type="button"
                className={`chip-status chip-atencao ${f.soAtencao ? 'ativo' : ''}`}
                onClick={() =>
                  setF((prev) => ({ ...prev, soAtencao: !prev.soAtencao }))
                }
                aria-pressed={f.soAtencao}
              >
                <Icone nome="aviso" size={14} /> Atenção
                <span className="chip-contador">{qtdAtencao}</span>
              </button>
            )}
          </Fragment>
        ))}
      </div>

      {/* Busca + Filtrar avancado aparecem JUNTOS, so ao tocar na lupa (#1). */}
      {buscaAberta && (
        <>
          <input
            type="search"
            className="busca busca-solta"
            placeholder="Buscar (cliente, obra, descrição)…"
            value={f.busca}
            onChange={(e) => aoBuscar(e.target.value)}
            autoFocus
          />
          <FiltrosDemandas
            f={f}
            aoAplicar={aoAplicarFiltros}
            aoRemover={aoRemoverFiltro}
            aoLimpar={aoLimparFiltros}
          />
        </>
      )}

      {erro && <p className="erro">{erro}</p>}

      {carregando ? (
        <div className="caixa-lista">
          <ul className="lista-demandas">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i}>
                <div className="skel-item">
                  <div className="skel-linha skel-lg" />
                  <div className="skel-linha skel-md" />
                  <div className="skel-linha skel-sm" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : demandas.length === 0 ? (
        <EstadoVazio
          nome="lista"
          titulo="Nenhuma demanda ainda"
          dica="Toque no + para criar a primeira."
        />
      ) : filtrando ? (
        listaFiltrada.length === 0 ? (
          <EstadoVazio
            nome="lupa"
            titulo="Nada com esses filtros"
            dica="Tente afrouxar a busca ou limpar os filtros."
          />
        ) : (
          <div className="caixa-lista">
            <ul className="lista-demandas">
              {listaFiltrada.map((d) => (
                <li key={d.id}>
                  <div className="linha-demanda">{botaoDemanda(d, 0)}</div>
                </li>
              ))}
            </ul>
          </div>
        )
      ) : (
        <div className="caixa-lista">
          <ul className="lista-demandas">
            {raizesOrdenadas.map((d) => renderArvore(d, 0))}
          </ul>
        </div>
      )}

    </div>
  )
}
