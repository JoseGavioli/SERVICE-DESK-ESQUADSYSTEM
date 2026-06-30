import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { STATUS_ROTULO } from '../lib/status'
import SeloUrgencia from './SeloUrgencia'
import Cancelamento from './Cancelamento'
import AcoesStatus from './AcoesStatus'
import HistoricoStatus from './HistoricoStatus'
import Comentarios from './Comentarios'
import Anexos from './Anexos'
import NovaDemanda from './NovaDemanda'

// Detalhe da demanda (campos somente leitura) + cancelamento, acoes de
// status, demanda-filha, historico e comentarios. Recebe o perfil para
// saber o que mostrar e aoAbrir para navegar a outra demanda (a filha nova).
export default function DetalheDemanda({
  demandaId,
  codigo,
  perfil,
  aoVoltar,
  aoAbrir,
}) {
  const [d, setD] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [versao, setVersao] = useState(0) // muda apos uma acao p/ recarregar os filhos
  const [criandoFilha, setCriandoFilha] = useState(false)

  async function carregar() {
    const { data, error } = await supabase
      .from('demanda')
      .select(
        'id, descricao, prazo, status, created_at, vendedor_id, obra_id, cancelamento_solicitado, tipo_demanda(nome), obra(nome, endereco, cliente(nome)), vendedor:perfil(nome_completo)',
      )
      .eq('id', demandaId)
      .single()
    if (error) setErro('Não foi possível carregar a demanda.')
    else setD(data)
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [demandaId])

  // Apos mover status / (des)solicitar: recarrega a demanda e forca os
  // filhos (historico/comentarios) a recarregar trocando a "versao".
  function recarregar() {
    carregar()
    setVersao((v) => v + 1)
  }

  if (carregando) return <p>Carregando…</p>

  if (erro) {
    return (
      <div className="detalhe-demanda">
        <p className="erro">{erro}</p>
        <button type="button" className="link" onClick={aoVoltar}>
          ← Voltar
        </button>
      </div>
    )
  }

  // So o vendedor dono cria filha, e so de uma demanda ENVIADA (§5/§11).
  const podeCriarFilha = d.status === 'enviado' && perfil.id === d.vendedor_id

  return (
    <div className="detalhe-demanda">
      <button type="button" className="link" onClick={aoVoltar}>
        ← Voltar
      </button>

      <h2>Demanda #{codigo ?? d.id}</h2>
      <div className="badges-linha">
        <span className={`status status-${d.status}`}>
          {STATUS_ROTULO[d.status]}
        </span>
        <SeloUrgencia prazo={d.prazo} status={d.status} />
      </div>

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
              ➕ Criar demanda-filha
            </button>
          )}
        </div>
      )}

      <dl>
        <dt>Tipo</dt>
        <dd>{d.tipo_demanda?.nome}</dd>

        <dt>Cliente</dt>
        <dd>{d.obra?.cliente?.nome}</dd>

        <dt>Obra</dt>
        <dd>
          {d.obra?.nome}
          {d.obra?.endereco ? ` — ${d.obra.endereco}` : ''}
        </dd>

        <dt>Vendedor</dt>
        <dd>{d.vendedor?.nome_completo}</dd>

        <dt>Prazo</dt>
        <dd>{d.prazo}</dd>

        <dt>Criada em</dt>
        <dd>{new Date(d.created_at).toLocaleString('pt-BR')}</dd>
      </dl>

      <div className="descricao">
        <h3>Descrição</h3>
        <p>{d.descricao}</p>
      </div>

      <Anexos demanda={d} perfil={perfil} />

      <Cancelamento demanda={d} perfil={perfil} aoMudar={recarregar} />

      <AcoesStatus demanda={d} perfil={perfil} aoMover={recarregar} />

      <HistoricoStatus key={`h${versao}`} demandaId={d.id} />

      <Comentarios key={`c${versao}`} demandaId={d.id} />
    </div>
  )
}
