import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { STATUS_ROTULO } from '../lib/status'
import { calcularUrgencia, estaCustoAtrasado, URGENCIA_NIVEIS } from '../lib/urgencia'
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

// nivel de urgencia -> sufixo do token de cor (--ur-<suf>-bg / -fg)
const URG_TOKEN = {
  atrasado: 'atrasado',
  muito_urgente: 'muito',
  urgente: 'urgente',
  pouco_urgente: 'pouco',
  sem_urgencia: 'sem',
}

// Tela "Dashboard" (Resumo): hero + widgets ACIONAVEIS em tempo real, cada um
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
          'id, status, prazo, cancelamento_solicitado, vendedor_id, vendedor:perfil!vendedor_id(nome_completo)',
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
      const u = calcularUrgencia(d.prazo, d.status) // null se terminal
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
      <header className="hero-demandas">
        <h1 className="hero-titulo">Resumo</h1>
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

          {/* 3. POR STATUS — grade compacta na cor de cada status */}
          {statusVisiveis.length > 0 && (
            <div className="grade-status">
              {statusVisiveis.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="box-inicio box-status-cor"
                  style={{ '--c': `var(--st-${s}-fg)` }}
                  onClick={() =>
                    aoAbrirComFiltro(
                      s === 'enviado'
                        ? { status: s, ordenacao: 'recentes' }
                        : { status: s, ordenacao: 'urgencia' },
                    )
                  }
                >
                  <span className="box-titulo">{tituloStatus(s)}</span>
                  <span className="box-numero">{dados.porStatus[s]}</span>
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
                      backgroundColor: `var(--ur-${URG_TOKEN[u.nivel]}-bg)`,
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
                        backgroundColor: `var(--ur-${URG_TOKEN[u.nivel]}-bg)`,
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
                  <li key={v.id} className="vend-item">
                    <span className="vend-nome">{v.nome}</span>
                    <span className="vend-barra">
                      <span
                        className="vend-fill"
                        style={{ width: `${maxVend ? (v.aberto / maxVend) * 100 : 0}%` }}
                      />
                    </span>
                    <span className="vend-num">{v.aberto}</span>
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
