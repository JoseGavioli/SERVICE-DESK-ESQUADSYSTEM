import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import EstadoVazio from './EstadoVazio'
import Icone from './Icone'

// Demandas antigas (anteriores a migracao 0029) nao tem origem. Mostramos como
// "Sem origem" em vez de esconder — senao os totais nao fechariam.
const SEM_ORIGEM = 'Sem origem'

// ⚠️ TEMPORARIO — REVERTER (pedido do dono, so p/ conferir o layout do PDF).
// A regra REAL: so meses ENCERRADOS (o relatorio de um mes libera no dia 1o do
// seguinte; o mes corrente NUNCA aparece — §18 do CLAUDE.md). Como o app entrou
// no ar em julho/2026, todo mes ja fechado esta VAZIO e nao havia como ver o
// relatorio. Entao, por ora, incluimos o mes corrente — rotulado como parcial,
// para nao mentir enquanto isso.
// PARA VOLTAR AO NORMAL: trocar `INCLUI_MES_CORRENTE` para false e apagar isto.
const INCLUI_MES_CORRENTE = true

function mesesFechados(n = 12) {
  const hoje = new Date()
  const lista = []
  for (let i = INCLUI_MES_CORRENTE ? 0 : 1; i <= n; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
    const emAndamento = i === 0
    const nome = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    lista.push({
      valor: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      rotulo: emAndamento ? `${nome} (em andamento — parcial)` : nome,
    })
  }
  return lista
}

// Relatorio MENSAL por vendedor (§pedido do gerente). So staff/gerente — o
// vendedor nao emite (a UI esconde; e a RLS so lhe daria as proprias demandas).
// Sem migracao: le a `demanda` direto (a RLS ja deixa admin/atendente/gerente
// verem todas) e agrega aqui.
export default function Relatorio({ naoLidas, aoAbrirNotif, aoVoltar }) {
  const meses = mesesFechados()
  const [mes, setMes] = useState(meses[0].valor)
  const [linhas, setLinhas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let vivo = true
    async function carregar() {
      setCarregando(true)
      setErro('')
      // Limites do mes no fuso LOCAL (o navegador do dono roda no Brasil):
      // new Date(ano, mes, 1) e a meia-noite local, e toISOString() converte
      // para o instante UTC certo — que e o que o created_at guarda.
      const [ano, m] = mes.split('-').map(Number)
      const inicio = new Date(ano, m - 1, 1)
      const fim = new Date(ano, m, 1) // 1o dia do mes seguinte (exclusivo)

      const { data, error } = await supabase
        .from('demanda')
        .select(
          'id, created_at, origem, status, vendedor_id, vendedor:perfil!vendedor_id(nome_completo), obra(cliente(nome))',
        )
        .gte('created_at', inicio.toISOString())
        .lt('created_at', fim.toISOString())
        .order('created_at')

      if (!vivo) return
      if (error) setErro('Não foi possível carregar o relatório.')
      else setLinhas(data ?? [])
      setCarregando(false)
    }
    carregar()
    return () => {
      vivo = false
    }
  }, [mes])

  // Agrega: vendedor -> total -> origem -> clientes.
  const porVendedor = {}
  for (const d of linhas) {
    const vid = d.vendedor_id
    if (!porVendedor[vid]) {
      porVendedor[vid] = {
        nome: d.vendedor?.nome_completo || '—',
        total: 0,
        origens: {},
      }
    }
    const v = porVendedor[vid]
    v.total += 1
    const o = d.origem || SEM_ORIGEM
    if (!v.origens[o]) v.origens[o] = []
    v.origens[o].push({
      id: d.id,
      cliente: d.obra?.cliente?.nome || '—',
      cancelada: d.status === 'cancelada',
    })
  }
  const vendedores = Object.values(porVendedor).sort((a, b) =>
    a.nome.localeCompare(b.nome, 'pt-BR'),
  )
  const rotuloMes = meses.find((x) => x.valor === mes)?.rotulo ?? mes

  return (
    <div className="secao-relatorio">
      <header className="hero-demandas nao-imprimir">
        <h1 className="hero-titulo">Relatório</h1>
        <div className="hero-acoes">
          {aoVoltar && (
            <button
              type="button"
              className="btn-circular"
              onClick={aoVoltar}
              aria-label="Voltar"
              title="Voltar"
            >
              <Icone nome="voltar" size={20} />
            </button>
          )}
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

      <div className="rel-barra nao-imprimir">
        <label className="rel-mes">
          Mês
          <select value={mes} onChange={(e) => setMes(e.target.value)}>
            {meses.map((x) => (
              <option key={x.valor} value={x.valor}>
                {x.rotulo}
              </option>
            ))}
          </select>
        </label>
        {linhas.length > 0 && (
          <button
            type="button"
            className="btn-imprimir"
            onClick={() => window.print()}
          >
            <Icone nome="arquivo" size={16} /> Imprimir / PDF
          </button>
        )}
      </div>

      {erro && <p className="erro">{erro}</p>}

      {/* Cabecalho que SO aparece no papel (na tela o titulo ja esta no hero). */}
      <div className="rel-cabecalho-impressao">
        <strong>Service Desk — EsquadSystem</strong>
        <span>Relatório de demandas — {rotuloMes}</span>
      </div>

      {carregando ? (
        <p>Carregando relatório…</p>
      ) : linhas.length === 0 ? (
        <EstadoVazio
          nome="lista"
          titulo="Nenhuma demanda neste mês"
          dica={`Não houve demandas criadas em ${rotuloMes}.`}
        />
      ) : (
        <>
          <p className="rel-total-geral">
            <strong>{linhas.length}</strong> demanda(s) em {rotuloMes} ·{' '}
            {vendedores.length} vendedor(es)
          </p>

          {vendedores.map((v) => (
            <div key={v.nome} className="rel-vendedor">
              <div className="rel-vend-cab">
                <strong className="rel-vend-nome">{v.nome}</strong>
                <span className="rel-vend-total">{v.total} demanda(s)</span>
              </div>

              {/* Origens da MAIOR para a menor (o que mais traz demanda). */}
              {Object.entries(v.origens)
                .sort((a, b) => b[1].length - a[1].length)
                .map(([origem, itens]) => (
                  <div key={origem} className="rel-origem">
                    <div className="rel-origem-cab">
                      <span className="rel-origem-nome">{origem}</span>
                      <span className="rel-origem-qtd">{itens.length}</span>
                    </div>
                    <ul className="rel-clientes">
                      {itens.map((it) => (
                        <li key={it.id}>
                          {it.cliente}
                          {/* Cancelada CONTA (foi solicitada) mas fica marcada,
                              para nao inflar o numero em silencio. */}
                          {it.cancelada && (
                            <span className="rel-cancelada">cancelada</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
