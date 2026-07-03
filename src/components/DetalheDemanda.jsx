import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { STATUS_ROTULO } from '../lib/status'
import { diasUteisDesde } from '../lib/urgencia'
import SeloUrgencia from './SeloUrgencia'
import LinhaTempoStatus from './LinhaTempoStatus'
import Cancelamento from './Cancelamento'
import AcoesStatus from './AcoesStatus'
import HistoricoStatus from './HistoricoStatus'
import Comentarios from './Comentarios'
import Anexos from './Anexos'
import NovaDemanda from './NovaDemanda'
import Icone from './Icone'

// Detalhe da demanda (campos somente leitura) + cancelamento, acoes de
// status, demanda-filha, historico e comentarios. Recebe o perfil para
// saber o que mostrar e aoAbrir para navegar a outra demanda (a filha nova).
export default function DetalheDemanda({
  demandaId,
  codigo,
  perfil,
  aoVoltar,
  aoAbrir,
  aoVisto,
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
        'id, descricao, prazo, status, created_at, vendedor_id, obra_id, cancelamento_solicitado, tipo_demanda(nome), obra(nome, endereco, cliente(nome)), vendedor:perfil!vendedor_id(nome_completo)',
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

  // So o vendedor dono cria filha, e so de uma demanda ENVIADA (§5/§11).
  const podeCriarFilha = d.status === 'enviado' && perfil.id === d.vendedor_id
  // Dias uteis em revisao de custo (§issue #13); null se nunca entrou.
  const diasRevisao = diasUteisDesde(dataRevisao)

  return (
    <div className="detalhe-demanda">
      <button type="button" className="botao-voltar" onClick={aoVoltar}>
        <Icone nome="voltar" size={20} /> Voltar
      </button>

      <header className="det-cabecalho">
        <h2>Demanda #{codigo ?? d.id}</h2>
        <div className="badges-linha">
          <span className={`status status-${d.status}`}>
            {STATUS_ROTULO[d.status]}
          </span>
          <SeloUrgencia prazo={d.prazo} status={d.status} />
        </div>
      </header>

      <section className="det-card">
        <h3 className="det-card-titulo">Andamento</h3>
        <LinhaTempoStatus status={d.status} diasRevisao={diasRevisao} />
      </section>

      <AcoesStatus demanda={d} perfil={perfil} aoMover={recarregar} />

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

      <section className="det-card det-info">
        <div className="info-linha">
          <span className="info-rot">Tipo</span>
          <span className="info-val">{d.tipo_demanda?.nome}</span>
        </div>
        <div className="info-linha">
          <span className="info-rot">Cliente</span>
          <span className="info-val">{d.obra?.cliente?.nome}</span>
        </div>
        <div className="info-linha">
          <span className="info-rot">Obra</span>
          <span className="info-val">
            {d.obra?.nome}
            {d.obra?.endereco ? ` — ${d.obra.endereco}` : ''}
          </span>
        </div>
        <div className="info-linha">
          <span className="info-rot">Vendedor</span>
          <span className="info-val">{d.vendedor?.nome_completo}</span>
        </div>
        <div className="info-linha">
          <span className="info-rot">Prazo</span>
          <span className="info-val">
            {d.prazo?.split('-').reverse().join('/')}
          </span>
        </div>
        <div className="info-linha">
          <span className="info-rot">Criada em</span>
          <span className="info-val">
            {new Date(d.created_at).toLocaleString('pt-BR', {
              dateStyle: 'short',
              timeStyle: 'short',
            })}
          </span>
        </div>
      </section>

      <section className="det-card">
        <h3 className="det-card-titulo">Descrição</h3>
        <p className="det-descricao">{d.descricao}</p>
      </section>

      <Anexos demanda={d} perfil={perfil} />

      <Cancelamento demanda={d} perfil={perfil} aoMudar={recarregar} />

      <HistoricoStatus key={`h${versao}`} demandaId={d.id} />

      <Comentarios key={`c${versao}`} demandaId={d.id} />
    </div>
  )
}
