import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { STATUS_ROTULO } from '../lib/status'
import { diasUteisDesde } from '../lib/urgencia'
import SeloUrgencia from './SeloUrgencia'
import LinhaTempoStatus from './LinhaTempoStatus'
import CarrosselEntrada from './CarrosselEntrada'
import Cancelamento from './Cancelamento'
import AcoesStatus from './AcoesStatus'
import HistoricoStatus from './HistoricoStatus'
import Comentarios from './Comentarios'
import Anexos from './Anexos'
import NovaDemanda from './NovaDemanda'
import AlterarPrazo from './AlterarPrazo'
import Icone from './Icone'

// Detalhe da demanda (campos somente leitura) + cancelamento, acoes de
// status, demanda-filha, historico e comentarios. Recebe o perfil para
// saber o que mostrar e aoAbrir para navegar a outra demanda (a filha nova).
// Iniciais (ate 2 letras) para o mini-avatar do autor.
function iniciais(nome) {
  if (!nome) return '?'
  const partes = nome.trim().split(/\s+/)
  const a = partes[0]?.[0] ?? ''
  const b = partes.length > 1 ? partes[partes.length - 1][0] : ''
  return (a + b).toUpperCase()
}

export default function DetalheDemanda({
  demandaId,
  codigo,
  perfil,
  aoVoltar,
  aoAbrir,
  aoVisto,
  naoLidas,
  aoAbrirNotif,
}) {
  const [d, setD] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [versao, setVersao] = useState(0) // muda apos uma acao p/ recarregar os filhos
  const [criandoFilha, setCriandoFilha] = useState(false)
  const [dataRevisao, setDataRevisao] = useState(null) // 1a entrada em revisao (§issue #13)

  async function carregar() {
    const { data, error } = await supabase
      .from('demanda')
      .select(
        'id, descricao, prazo, status, created_at, vendedor_id, obra_id, cancelamento_solicitado, origem, club_casa, rt, rt_percentual, arquiteto_engenheiro, tipo_demanda(nome), obra(nome, endereco, cliente(nome)), vendedor:perfil!vendedor_id(nome_completo)',
      )
      .eq('id', demandaId)
      .single()
    if (error) setErro('Não foi possível carregar a demanda.')
    else setD(data)

    // Data da 1a entrada em "revisao de custo" (para "ha X dias", §issue #13).
    const { data: rev } = await supabase
      .from('historico_status')
      .select('created_at')
      .eq('demanda_id', demandaId)
      .eq('para_status', 'em_revisao_custo')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    setDataRevisao(rev?.created_at ?? null)

    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [demandaId])

  // Marca a demanda como VISTA (zera a novidade dela) e pede ao Painel
  // para recarregar o contador. Usado ao abrir E ao agir na demanda.
  async function marcarVisto() {
    // visto_em explicito de proposito: num upsert, sem passar a coluna, o
    // caminho de UPDATE (quando a linha ja existe) NAO atualizaria a hora —
    // ela ficaria congelada na 1a visita e a demanda nunca sairia de novidade.
    await supabase
      .from('visualizacao')
      .upsert(
        {
          user_id: perfil.id,
          demanda_id: demandaId,
          visto_em: new Date().toISOString(),
        },
        { onConflict: 'user_id,demanda_id' },
      )
    if (aoVisto) aoVisto()
  }

  useEffect(() => {
    marcarVisto()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demandaId])

  // Apos mover status / (des)solicitar: recarrega a demanda, forca os
  // filhos a recarregar, e REMARCA como vista (o ator acabou de agir nela).
  function recarregar() {
    carregar()
    setVersao((v) => v + 1)
    marcarVisto()
  }

  if (carregando) return <p>Carregando…</p>

  if (erro) {
    return (
      <div className="detalhe-demanda">
        <p className="erro">{erro}</p>
        <button type="button" className="link" onClick={aoVoltar}>
          <Icone nome="voltar" size={16} /> Voltar
        </button>
      </div>
    )
  }

  // A "demanda-filha" (§11) esta OCULTA por ora — o dono vai confirmar com os
  // vendedores se e util antes de liberar (nada foi deletado/desativado).
  // Para REATIVAR, troque `false` pela condicao original:
  //   d.status === 'enviado' && perfil.id === d.vendedor_id
  const podeCriarFilha = false
  // Dias uteis em revisao de custo (§issue #13); null se nunca entrou.
  const diasRevisao = diasUteisDesde(dataRevisao)

  const criadaEm = new Date(d.created_at).toLocaleDateString('pt-BR')

  return (
    <div className="detalhe-demanda">
      {/* Topo: voltar + titulo + sino (§C1) */}
      <header className="det-topo">
        <button
          type="button"
          className="det-topo-btn"
          onClick={aoVoltar}
          aria-label="Voltar"
          title="Voltar"
        >
          <Icone nome="voltar" size={20} />
        </button>
        <span className="det-topo-titulo">Demanda #{codigo ?? d.id}</span>
        <button
          type="button"
          className="det-topo-btn"
          onClick={aoAbrirNotif}
          aria-label="Notificações"
          title="Notificações"
        >
          <Icone nome="sino" size={20} />
          {naoLidas > 0 && <span className="sino-badge">{naoLidas}</span>}
        </button>
      </header>

      {/* "Hero": anexos de entrada (o que o vendedor enviou) */}
      <CarrosselEntrada demanda={d} perfil={perfil} />

      {/* Tipo + Cliente/Obra + tags (status/urgencia) empilhadas */}
      <p className="det-tipo">{d.tipo_demanda?.nome}</p>
      <div className="det-nome-linha">
        <div className="det-nome">
          <h2 className="det-cliente">{d.obra?.cliente?.nome}</h2>
          <p className="det-obra">
            {d.obra?.nome}
            {d.obra?.endereco ? ` — ${d.obra.endereco}` : ''}
          </p>
        </div>
        <div className="det-tags">
          <span className={`status status-${d.status}`}>
            {STATUS_ROTULO[d.status]}
          </span>
          <SeloUrgencia prazo={d.prazo} status={d.status} />
        </div>
      </div>

      {/* Descricao */}
      <div className="det-secao">
        <h3 className="det-secao-titulo">Descrição</h3>
        <p className="det-descricao">{d.descricao}</p>
      </div>

      {/* Dados do orcamento: CLUB CASA, RT e arquiteto (§issue #35).
          CLUB CASA e RT sao sempre Sim/Nao; arquiteto so aparece se preenchido. */}
      <div className="det-extras">
        {d.origem && (
          <div className="det-extra">
            <span className="det-extra-rot">Origem</span>
            <span className="det-extra-val">{d.origem}</span>
          </div>
        )}
        <div className="det-extra">
          <span className="det-extra-rot">CLUB CASA</span>
          <span className={`det-extra-val ${d.club_casa ? 'sim' : ''}`}>
            {d.club_casa ? 'Sim' : 'Não'}
          </span>
        </div>
        <div className="det-extra">
          <span className="det-extra-rot">RT</span>
          <span className={`det-extra-val ${d.rt ? 'sim' : ''}`}>
            {d.rt
              ? `Sim${d.rt_percentual != null ? ` — ${d.rt_percentual}%` : ''}`
              : 'Não'}
          </span>
        </div>
        {d.arquiteto_engenheiro && (
          <div className="det-extra">
            <span className="det-extra-rot">Arquiteto/engenheiro</span>
            <span className="det-extra-val">{d.arquiteto_engenheiro}</span>
          </div>
        )}
      </div>

      {/* Prazo (logo apos os dados do orcamento) + ajustar prazo (staff, §#3) */}
      <div className="det-prazo-linha">
        <p className="det-prazo">
          <Icone nome="relogio" size={15} /> <strong>Prazo:</strong>{' '}
          {d.prazo?.split('-').reverse().join('/')}
        </p>
        <AlterarPrazo demanda={d} perfil={perfil} aoMudar={recarregar} />
      </div>

      {/* Anexos (box completa) */}
      <Anexos demanda={d} perfil={perfil} />

      {/* Autor + data de criacao */}
      <div className="det-autor">
        <span className="det-avatar">{iniciais(d.vendedor?.nome_completo)}</span>
        <div className="det-autor-info">
          <strong>{d.vendedor?.nome_completo}</strong>
          <span className="det-autor-sub">Autor da demanda</span>
        </div>
        <span className="det-autor-data">{criadaEm}</span>
      </div>

      {/* Andamento (linha do tempo) */}
      <section className="det-card">
        <h3 className="det-card-titulo">Andamento</h3>
        <LinhaTempoStatus status={d.status} diasRevisao={diasRevisao} />
      </section>

      {podeCriarFilha && (
        <div className="filha">
          {criandoFilha ? (
            <NovaDemanda
              obraFixa={{ id: d.obra_id, nome: d.obra?.nome }}
              demandaPaiId={d.id}
              aoCriar={(novoId) => {
                setCriandoFilha(false)
                aoAbrir(novoId) // abre a filha recem-criada
              }}
              aoCancelar={() => setCriandoFilha(false)}
            />
          ) : (
            <button
              type="button"
              className="botao-filha"
              onClick={() => setCriandoFilha(true)}
            >
              <Icone nome="mais" size={16} /> Criar demanda vinculada
            </button>
          )}
        </div>
      )}

      {/* Historico */}
      <HistoricoStatus key={`h${versao}`} demandaId={d.id} />

      {/* Comentarios */}
      <Comentarios key={`c${versao}`} demandaId={d.id} />

      {/* Solicitar cancelamento (so vendedor dono, em demanda nao-terminal) */}
      <Cancelamento demanda={d} perfil={perfil} aoMudar={recarregar} />

      {/* Rodape "Alterar status" (barra fixa; so staff, so com acoes) — §C3 */}
      <AcoesStatus demanda={d} perfil={perfil} aoMover={recarregar} />
    </div>
  )
}
