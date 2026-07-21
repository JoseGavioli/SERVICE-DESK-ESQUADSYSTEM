import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { STATUS_ROTULO } from '../lib/status'
import { urgenciaEfetiva, estaCustoAtrasado, URGENCIA_NIVEIS } from '../lib/urgencia'
import { textoPresenca, ultimoVistoMs, useTique } from '../lib/usePresenca'
import { textoNotificacao } from '../lib/notificacaoTexto'
import { haQuantoTempo } from '../lib/tempo'
import Avatar from './Avatar'
import EstadoVazio from './EstadoVazio'
import Icone from './Icone'

// Anéis "Por status": só a FILA EM ABERTO. "concluido" entra (foi reativado na
// migração 0022 e está no fluxo). "enviado" sai dos anéis e vira um contador à
// parte (§Bloco A): é terminal e permanente — na base do arco iria, com o tempo,
// encolher as fatias das abertas. "cancelada" não é exibida (decisão do dono).
const STATUS_ORDEM = [
  'nao_iniciado',
  'em_andamento',
  'congelado',
  'em_revisao_custo',
  'concluido',
]
// Terminais NAO entram no "em aberto" nem em "por vendedor".
const TERMINAIS = ['enviado', 'cancelada']

// Cor FORTE de cada nivel (a cor da TAG de urgencia, nao o tint apagado).
// 'atrasado' ja tem -bg solido (#c62828/#b71c1c); os demais usam -fg (o -bg
// deles e so um tint claro, que ficava "lavado" na barra).
const URG_COR = {
  atrasado: 'var(--ur-atrasado-bg)',
  muito_urgente: 'var(--ur-muito-fg)',
  urgente: 'var(--ur-urgente-fg)',
  pouco_urgente: 'var(--ur-pouco-fg)',
  sem_urgencia: 'var(--ur-sem-fg)',
}

const ROTULO_PAPEL = {
  admin: 'Admin',
  atendente: 'Atendente',
  gerente: 'Gerente',
  vendedor: 'Vendedor',
}

// Motivo de cada item de "Precisam de atenção" (§Bloco B): rótulo + cor forte.
// A ordem (mais grave primeiro) é dada pelo `ordem` calculado no carregar().
// 'atrasado' usa o rótulo do NÍVEL de urgência (não "prazo vencido"): o nível
// pode vir de override manual do gerente com prazo futuro, e aí "prazo vencido"
// seria falso (§revisão Bloco B). "Atrasado" é verdadeiro nos dois casos.
const MOTIVO = {
  atrasado: { rotulo: 'atrasado', cor: 'var(--ur-atrasado-bg)' },
  custo: { rotulo: 'custo atrasado', cor: 'var(--ur-urgente-fg)' },
  cancelamento: { rotulo: 'cancelamento pedido', cor: 'var(--texto-suave)' },
}

// Anel (gauge) SVG: arco proporcional (valor/total) na cor do status, com a
// contagem no centro. Comeca no topo (rotate -90) e cresce no sentido horario.
function Anel({ valor, total, cor }) {
  const raio = 30
  const circ = 2 * Math.PI * raio
  const arco = (total > 0 ? valor / total : 0) * circ
  return (
    <svg className="anel" viewBox="0 0 72 72" aria-hidden="true">
      <circle className="anel-track" cx="36" cy="36" r={raio} />
      <circle
        className="anel-arco"
        cx="36"
        cy="36"
        r={raio}
        transform="rotate(-90 36 36)"
        style={{ stroke: cor, strokeDasharray: `${arco} ${circ}` }}
      />
      <text
        className="anel-num"
        x="36"
        y="36"
        textAnchor="middle"
        dominantBaseline="central"
        style={{ fill: cor }}
      >
        {valor}
      </text>
    </svg>
  )
}

// Tela "Dashboard" (Resumo): perfil no topo + widgets ACIONAVEIS em tempo real,
// abrindo a LISTA ja filtrada. Respeita o papel via RLS (o vendedor ve os
// numeros DELE; admin/atendente veem a fila toda).
export default function Dashboard({
  perfil,
  online = new Map(),
  vistos = new Map(),
  aoAbrirComFiltro,
  aoAbrirRelatorio,
  aoAbrirDemanda,
  notificacoes = [],
  aoAbrirNotificacao,
  naoLidas,
  aoAbrirNotif,
}) {
  const [dados, setDados] = useState(null)
  const ehStaff = perfil.papel !== 'vendedor'
  // Efetivar cancelamento é só do Admin/Atendente (§12) — o gerente NÃO decide.
  // O chip "Cancelamentos a decidir" usa isto (e não `ehStaff`, que inclui o
  // gerente): não faz sentido oferecer a ele uma fila em que não pode agir.
  const podeDecidirCancel =
    perfil.papel === 'admin' || perfil.papel === 'atendente'
  useTique() // faz o "online há X" atualizar sozinho enquanto a tela fica aberta

  const carregar = useCallback(async () => {
    const [{ data: demandas }, { data: revs }, { data: equipe }] =
      await Promise.all([
        supabase
          .from('demanda')
          .select(
            'id, status, prazo, cancelamento_solicitado, vendedor_id, urgencia_manual, obra(nome, cliente(nome)), vendedor:perfil!vendedor_id(nome_completo, papel)',
          ),
        supabase.rpc('datas_primeira_revisao'),
        // Vendedores ativos — base do widget "Vendedores online" (§#46).
        // `visto_em` = ultimo momento online (p/ "online ha X" de quem saiu).
        supabase
          .from('perfil')
          .select('id, nome_completo, visto_em, avatar_path')
          .eq('papel', 'vendedor')
          .eq('ativo', true)
          .order('nome_completo'),
      ])
    // Data da 1a revisao de custo por demanda (RPC devolve { demanda_id, data }).
    const rev = {}
    for (const r of revs ?? []) rev[r.demanda_id] = r.data

    const porStatus = {}
    const porUrgencia = {}
    const porVendedor = {} // vendedor_id -> { nome, aberto }
    const itensAtencao = [] // as demandas em atenção (para LISTAR, não só contar)
    let emAberto = 0
    let atencao = 0
    let cancelamentos = 0 // só cancelamento solicitado (chip do staff, §Bloco B)

    for (const d of demandas ?? []) {
      porStatus[d.status] = (porStatus[d.status] ?? 0) + 1
      const terminal = TERMINAIS.includes(d.status)
      if (!terminal) emAberto += 1

      // "Atenção" = 1x por demanda: prazo vencido OU custo atrasado OU
      // cancelamento solicitado (mesma regra do atalho {soAtencao} da lista).
      const u = urgenciaEfetiva(d) // manual (gerente) ou calculada; null se terminal
      const prazoVencido = u?.nivel === 'atrasado'
      const custoAtras = estaCustoAtrasado(d.status, rev[d.id])
      if (d.cancelamento_solicitado) cancelamentos += 1
      if (prazoVencido || custoAtras || d.cancelamento_solicitado) {
        atencao += 1
        // motivo mais grave manda (prazo vencido > custo atrasado > cancelamento)
        const motivo = prazoVencido
          ? 'atrasado'
          : custoAtras
            ? 'custo'
            : 'cancelamento'
        itensAtencao.push({
          id: d.id,
          cliente: d.obra?.cliente?.nome ?? 'Cliente',
          obra: d.obra?.nome ?? '',
          motivo,
          ordem: motivo === 'atrasado' ? 0 : motivo === 'custo' ? 1 : 2,
        })
      }

      // Urgencia so existe para nao-terminais (u == null nos terminais).
      if (u) porUrgencia[u.nivel] = (porUrgencia[u.nivel] ?? 0) + 1

      // Por vendedor: demandas ABERTAS por vendedor (so o staff usa).
      if (!terminal) {
        const vid = d.vendedor_id
        if (!porVendedor[vid]) {
          porVendedor[vid] = {
            nome: d.vendedor?.nome_completo || '—',
            papel: d.vendedor?.papel,
            aberto: 0,
          }
        }
        porVendedor[vid].aberto += 1
      }
    }

    itensAtencao.sort((a, b) => a.ordem - b.ordem)

    setDados({
      emAberto,
      atencao,
      cancelamentos,
      itensAtencao,
      porStatus,
      porUrgencia,
      porVendedor,
      equipe: equipe ?? [],
    })
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  // Tempo real: qualquer mudanca em demandas visiveis recalcula os widgets.
  useEffect(() => {
    const canal = supabase
      .channel('dashboard-demandas')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'demanda' },
        () => carregar(),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [carregar])

  // Para o VENDEDOR, "Enviado" aparece como "Recebido" (ponto de vista dele).
  function tituloStatus(s) {
    if (s === 'enviado' && perfil.papel === 'vendedor') return 'Recebido'
    return STATUS_ROTULO[s]
  }

  // Recortes derivados (so quando ja carregou).
  const statusVisiveis = dados
    ? STATUS_ORDEM.filter((s) => dados.porStatus[s] > 0)
    : []
  // Total (soma dos status visiveis) = base do arco de cada anel.
  const totalStatus = statusVisiveis.reduce((n, s) => n + dados.porStatus[s], 0)
  const urgVisiveis = dados
    ? URGENCIA_NIVEIS.map((u) => ({
        ...u,
        count: dados.porUrgencia[u.nivel] ?? 0,
      })).filter((u) => u.count > 0)
    : []
  const vendedores =
    dados && ehStaff
      ? Object.entries(dados.porVendedor)
          .map(([id, v]) => ({ id, nome: v.nome, papel: v.papel, aberto: v.aberto }))
          .filter((v) => v.aberto > 0)
          .sort((a, b) => b.aberto - a.aberto)
      : []
  const maxVend = vendedores.reduce((m, v) => Math.max(m, v.aberto), 0)
  // "Enviado" fora dos anéis, como contador (§Bloco A). Entra na "Distribuição".
  const enviados = dados?.porStatus?.enviado ?? 0
  const temDistribuicao =
    statusVisiveis.length > 0 ||
    urgVisiveis.length > 0 ||
    vendedores.length > 1 ||
    enviados > 0

  return (
    <div className="secao-dashboard">
      <header className="dash-topo">
        <div className="dash-titulo-linha">
          <h1 className="hero-titulo">Dashboard</h1>
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
        <div className="dash-perfil">
          <Avatar
            nome={perfil.nome_completo}
            caminho={perfil.avatar_path}
            className="dash-avatar"
          />
          <div className="dash-perfil-texto">
            <strong className="dash-nome">
              {perfil.nome_completo || 'Usuário'}
            </strong>
            <span className="dash-papel">
              {ROTULO_PAPEL[perfil.papel] ?? perfil.papel}
            </span>
          </div>
        </div>
      </header>

      {/* RELATORIO mensal — logo abaixo do perfil, em destaque (pedido do dono).
          So staff/gerente: o vendedor nao emite. Fica FORA do `dados &&` de
          proposito: e navegacao, nao depende dos numeros carregarem. */}
      {ehStaff && (
        <button
          type="button"
          className="admin-card box-relatorio"
          onClick={aoAbrirRelatorio}
        >
          <span className="admin-icone">
            <Icone nome="arquivo" size={20} />
          </span>
          <span className="admin-texto">
            <strong className="admin-titulo">Relatório mensal</strong>
            <span className="admin-sub">
              Demandas por vendedor e origem, mês a mês.
            </span>
          </span>
          <Icone nome="chevron-direita" size={18} />
        </button>
      )}

      {/* Enquanto os números não vêm: placeholder no lugar do bloco em branco
          (no 3G do celular a tela em branco parecia quebrada). §Bloco A */}
      {!dados && (
        <div className="dash-carregando" aria-busy="true" aria-live="polite">
          <span className="skel-linha" />
          <span className="skel-linha" />
          <span className="skel-linha curta" />
        </div>
      )}

      {dados && (
        <>
          {/* 1. ATENÇÃO / EM ABERTO — a fila do dia. Sem nada em aberto, um
              único estado vazio acolhedor (não há o que precisar de atenção
              quando não há fila). Com fila: atenção — ou "tudo em dia" — + a box
              "em aberto". §Bloco A */}
          {dados.emAberto === 0 ? (
            <div className="card-resumo">
              <EstadoVazio
                nome="check"
                titulo="Nenhuma demanda em aberto"
                dica={
                  ehStaff
                    ? 'Tudo em dia por aqui.'
                    : 'Toque no + para pedir um orçamento.'
                }
              />
            </div>
          ) : (
            <>
              {/* KPIs lado a lado: os dois números-cabeça (§Bloco B). */}
              <div className="dash-kpis">
                <button
                  type="button"
                  className={`dash-kpi${dados.atencao > 0 ? ' perigo' : ''}`}
                  onClick={() => aoAbrirComFiltro({ soAtencao: true })}
                >
                  <span className="dash-kpi-rot">Precisam de atenção</span>
                  <span className="dash-kpi-num">{dados.atencao}</span>
                </button>
                <button
                  type="button"
                  className="dash-kpi"
                  onClick={() => aoAbrirComFiltro({ soAtivas: true })}
                >
                  <span className="dash-kpi-rot">Em aberto</span>
                  <span className="dash-kpi-num">{dados.emAberto}</span>
                </button>
              </div>

              {/* Atenção como ITENS acionáveis: cada linha abre o detalhe da
                  demanda. Sem nada em atenção, um "tudo em dia" calmo (a ausência
                  de card seria ambígua). §Bloco B */}
              {dados.atencao > 0 ? (
                <div className="card-resumo atencao-lista">
                  <span className="box-titulo box-titulo-perigo">
                    Precisam de atenção
                  </span>
                  <ul className="atencao-itens">
                    {dados.itensAtencao.slice(0, 4).map((it) => (
                      <li key={it.id}>
                        <button
                          type="button"
                          className="atencao-item"
                          onClick={() => aoAbrirDemanda(it.id)}
                        >
                          <span
                            className="atencao-faixa"
                            style={{ background: MOTIVO[it.motivo].cor }}
                          />
                          <span className="atencao-quem">
                            <span className="atencao-cliente">{it.cliente}</span>
                            {it.obra && (
                              <span className="atencao-obra">{it.obra}</span>
                            )}
                          </span>
                          <span
                            className="atencao-motivo"
                            style={{ color: MOTIVO[it.motivo].cor }}
                          >
                            {MOTIVO[it.motivo].rotulo}
                          </span>
                          <Icone nome="chevron-direita" size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                  {dados.atencao > 4 && (
                    <button
                      type="button"
                      className="atencao-ver-todas"
                      onClick={() => aoAbrirComFiltro({ soAtencao: true })}
                    >
                      ver todas ({dados.atencao})
                    </button>
                  )}
                </div>
              ) : (
                <div className="box-inicio box-tudo-ok">
                  <span className="box-tudo-ok-icone">
                    <Icone nome="check" size={20} />
                  </span>
                  <span className="box-hint">
                    Tudo em dia — nada precisa de atenção agora.
                  </span>
                </div>
              )}

              {/* Cancelamentos a decidir: só Admin/Atendente (quem efetiva,
                  §12 — o gerente não decide), e só se houver. É a única ação
                  "decidir sim/não" e trava o vendedor (§Bloco B). */}
              {podeDecidirCancel && dados.cancelamentos > 0 && (
                <button
                  type="button"
                  className="box-inicio chip-decidir"
                  onClick={() =>
                    aoAbrirComFiltro({ soCancelamentoSolicitado: true })
                  }
                >
                  <Icone nome="cancelado" size={18} />
                  <span className="chip-decidir-txt">
                    Cancelamentos a decidir
                  </span>
                  <span className="chip-decidir-num">{dados.cancelamentos}</span>
                </button>
              )}
            </>
          )}

          {/* Novidades nas suas demandas (só vendedor): o "o que mexeu no que eu
              pedi", reusando a fonte única de notificações (§Bloco B). Fica fora
              do ramo "em aberto" para aparecer mesmo sem fila aberta. */}
          {!ehStaff && notificacoes.length > 0 && (
            <div className="card-resumo">
              <span className="box-titulo">Novidades nas suas demandas</span>
              <ul className="novidades">
                {notificacoes.slice(0, 5).map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      className={`novidade${n.lida ? '' : ' nao-lida'}`}
                      onClick={() => aoAbrirNotificacao(n)}
                    >
                      <span className="novidade-ponto" aria-hidden="true" />
                      <span className="novidade-texto">
                        {textoNotificacao(n)}
                        <span className="novidade-quando">
                          {haQuantoTempo(n.created_at)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {temDistribuicao && <p className="secao-rotulo">Distribuição</p>}

          {/* 3. POR STATUS — cartões com anel (fatia da FILA EM ABERTO) na cor
              do status. Só status em aberto entram aqui (§Bloco A). */}
          {statusVisiveis.length > 0 && (
            <div className="anel-grade">
              {statusVisiveis.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="anel-card"
                  onClick={() =>
                    aoAbrirComFiltro({ status: s, ordenacao: 'urgencia' })
                  }
                >
                  <span className="anel-card-titulo">{tituloStatus(s)}</span>
                  <Anel
                    valor={dados.porStatus[s]}
                    total={totalStatus}
                    cor={`var(--st-${s}-fg)`}
                  />
                </button>
              ))}
            </div>
          )}

          {/* "Enviado" fora dos anéis (terminal e permanente): contador simples.
              Para o vendedor aparece como "Recebido". "Cancelada" não é exibida. */}
          {enviados > 0 && (
            <button
              type="button"
              className="box-inicio status-contador"
              onClick={() =>
                aoAbrirComFiltro({ status: 'enviado', ordenacao: 'recentes' })
              }
            >
              <span className="sc-rotulo">{tituloStatus('enviado')}</span>
              <span className="sc-num">{enviados}</span>
            </button>
          )}

          {/* 4. POR URGÊNCIA — barra segmentada (proporção, só visual) + legenda
              como alvo de toque. A barra deixou de ser clicável: no celular um
              segmento fino é quase impossível de acertar com o dedo (§Bloco A). */}
          {urgVisiveis.length > 0 && (
            <div className="card-resumo">
              <span className="box-titulo">Por urgência</span>
              <div className="urg-barra" aria-hidden="true">
                {urgVisiveis.map((u) => (
                  <span
                    key={u.nivel}
                    className="urg-seg"
                    style={{
                      flexGrow: u.count,
                      backgroundColor: URG_COR[u.nivel],
                    }}
                  />
                ))}
              </div>
              <div className="urg-legenda">
                {urgVisiveis.map((u) => (
                  <button
                    key={u.nivel}
                    type="button"
                    className="urg-item"
                    onClick={() => aoAbrirComFiltro({ urgencia: u.nivel })}
                  >
                    <span
                      className="urg-ponto"
                      style={{
                        backgroundColor: URG_COR[u.nivel],
                      }}
                    />
                    <span className="urg-rotulo">{u.rotulo}</span>
                    <span className="urg-num">{u.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 5. POR VENDEDOR — só staff e só se houver mais de um com abertas */}
          {vendedores.length > 1 && (
            <div className="card-resumo">
              <span className="box-titulo">Por vendedor</span>
              <ul className="vend-lista">
                {vendedores.map((v) => (
                  <li key={v.id}>
                    <button
                      type="button"
                      className="vend-item"
                      onClick={() =>
                        aoAbrirComFiltro({ vendedor: v.id, soAtivas: true })
                      }
                      title={`Ver as demandas em aberto de ${v.nome}`}
                    >
                      <span className="vend-nome">{v.nome}</span>
                      <span className="vend-barra">
                        <span
                          className="vend-fill"
                          style={{ width: `${maxVend ? (v.aberto / maxVend) * 100 : 0}%` }}
                        />
                      </span>
                      <span className="vend-num">{v.aberto}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 6. VENDEDORES ONLINE — presença em tempo real (§#46, só staff) */}
          {ehStaff && dados.equipe.length > 0 && (
            <div className="card-resumo">
              <span className="box-titulo">Vendedores online</span>
              <ul className="online-lista">
                {dados.equipe.map((v) => {
                  const aoVivo = online.has(v.id)
                  const vistoMs = ultimoVistoMs(v.id, vistos, v.visto_em)
                  return (
                    <li
                      key={v.id}
                      className={`online-item ${aoVivo ? 'esta-online' : ''}`}
                    >
                      <span className="online-avatar-wrap">
                        <Avatar
                          nome={v.nome_completo}
                          caminho={v.avatar_path}
                          className="online-avatar"
                        />
                        <span className="online-status" aria-hidden="true" />
                      </span>
                      <span className="online-nome">{v.nome_completo}</span>
                      <span className="online-quando">
                        {textoPresenca(aoVivo, vistoMs)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
