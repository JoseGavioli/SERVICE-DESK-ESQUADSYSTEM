import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { STATUS_ROTULO } from '../lib/status'
import { urgenciaEfetiva, estaCustoAtrasado, URGENCIA_NIVEIS } from '../lib/urgencia'
import Icone from './Icone'

// Ordem das boxes de status. "concluido" fica de fora (legado).
const STATUS_ORDEM = [
  'nao_iniciado',
  'em_andamento',
  'congelado',
  'em_revisao_custo',
  'enviado',
  'cancelada',
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

// Iniciais (ate 2 letras) para o avatar do perfil no topo.
function iniciais(nome) {
  if (!nome) return '?'
  const p = nome.trim().split(/\s+/)
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase()
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
export default function Dashboard({ perfil, aoAbrirComFiltro, naoLidas, aoAbrirNotif }) {
  const [dados, setDados] = useState(null)
  const ehStaff = perfil.papel !== 'vendedor'

  const carregar = useCallback(async () => {
    const [{ data: demandas }, { data: revs }] = await Promise.all([
      supabase
        .from('demanda')
        .select(
          'id, status, prazo, cancelamento_solicitado, vendedor_id, urgencia_manual, vendedor:perfil!vendedor_id(nome_completo)',
        ),
      supabase.rpc('datas_primeira_revisao'),
    ])
    // Data da 1a revisao de custo por demanda (RPC devolve { demanda_id, data }).
    const rev = {}
    for (const r of revs ?? []) rev[r.demanda_id] = r.data

    const porStatus = {}
    const porUrgencia = {}
    const porVendedor = {} // vendedor_id -> { nome, aberto }
    let emAberto = 0
    let atencao = 0

    for (const d of demandas ?? []) {
      porStatus[d.status] = (porStatus[d.status] ?? 0) + 1
      const terminal = TERMINAIS.includes(d.status)
      if (!terminal) emAberto += 1

      // "Atenção" = 1x por demanda: prazo vencido OU custo atrasado OU
      // cancelamento solicitado (mesma regra do atalho {soAtencao} da lista).
      const u = urgenciaEfetiva(d) // manual (gerente) ou calculada; null se terminal
      const prazoVencido = u?.nivel === 'atrasado'
      const custoAtras = estaCustoAtrasado(d.status, rev[d.id])
      if (prazoVencido || custoAtras || d.cancelamento_solicitado) atencao += 1

      // Urgencia so existe para nao-terminais (u == null nos terminais).
      if (u) porUrgencia[u.nivel] = (porUrgencia[u.nivel] ?? 0) + 1

      // Por vendedor: demandas ABERTAS por vendedor (so o staff usa).
      if (!terminal) {
        const vid = d.vendedor_id
        if (!porVendedor[vid]) {
          porVendedor[vid] = { nome: d.vendedor?.nome_completo || '—', aberto: 0 }
        }
        porVendedor[vid].aberto += 1
      }
    }

    setDados({ emAberto, atencao, porStatus, porUrgencia, porVendedor })
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
          .map(([id, v]) => ({ id, nome: v.nome, aberto: v.aberto }))
          .filter((v) => v.aberto > 0)
          .sort((a, b) => b.aberto - a.aberto)
      : []
  const maxVend = vendedores.reduce((m, v) => Math.max(m, v.aberto), 0)
  const temDistribuicao =
    statusVisiveis.length > 0 || urgVisiveis.length > 0 || vendedores.length > 1

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
          <span className="dash-avatar">{iniciais(perfil.nome_completo)}</span>
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

      {dados && (
        <>
          {/* 1. ATENÇÃO — o "o que fazer agora" (só aparece se houver) */}
          {dados.atencao > 0 && (
            <button
              type="button"
              className="box-inicio box-atencao"
              onClick={() => aoAbrirComFiltro({ soAtencao: true })}
            >
              <span className="box-atencao-icone">
                <Icone nome="aviso" size={22} />
              </span>
              <span className="box-atencao-texto">
                <span className="box-titulo">Precisam de atenção</span>
                <span className="box-hint">
                  prazo vencido, custo atrasado ou cancelamento pedido
                </span>
              </span>
              <span className="box-numero">{dados.atencao}</span>
            </button>
          )}

          {/* 2. EM ABERTO — a base do topo de foco */}
          <button
            type="button"
            className="box-inicio box-total"
            onClick={() => aoAbrirComFiltro({ soAtivas: true })}
          >
            <span className="box-titulo">Demandas em aberto</span>
            <span className="box-numero">{dados.emAberto}</span>
            <span className="box-hint">toque para ver</span>
          </button>

          {temDistribuicao && <p className="secao-rotulo">Distribuição</p>}

          {/* 3. POR STATUS — cartoes com anel (fatia no total) na cor do status */}
          {statusVisiveis.length > 0 && (
            <div className="anel-grade">
              {statusVisiveis.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="anel-card"
                  onClick={() =>
                    aoAbrirComFiltro(
                      s === 'enviado'
                        ? { status: s, ordenacao: 'recentes' }
                        : { status: s, ordenacao: 'urgencia' },
                    )
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

          {/* 4. POR URGÊNCIA — barra segmentada (proporção automática) + legenda */}
          {urgVisiveis.length > 0 && (
            <div className="card-resumo">
              <span className="box-titulo">Por urgência</span>
              <div className="urg-barra">
                {urgVisiveis.map((u) => (
                  <button
                    key={u.nivel}
                    type="button"
                    className="urg-seg"
                    style={{
                      flexGrow: u.count,
                      backgroundColor: URG_COR[u.nivel],
                    }}
                    onClick={() => aoAbrirComFiltro({ urgencia: u.nivel })}
                    aria-label={`${u.rotulo}: ${u.count}`}
                    title={`${u.rotulo}: ${u.count}`}
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
        </>
      )}
    </div>
  )
}
