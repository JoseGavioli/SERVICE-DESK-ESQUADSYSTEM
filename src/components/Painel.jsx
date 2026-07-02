import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Inicio from './Inicio'
import Demandas from './Demandas'
import Clientes from './Clientes'
import Equipe from './Equipe'
import MenuLateral from './MenuLateral'
import Tema from './Tema'
import Notificacoes from './Notificacoes'
import ToastNotificacao from './ToastNotificacao'
import { useNotificacoes } from '../lib/useNotificacoes'

// Nome exibido no cabecalho para cada secao.
const NOME_TELA = {
  inicio: 'Início',
  demandas: 'Demandas',
  clientes: 'Clientes',
  equipe: 'Equipe',
  tema: 'Tema',
}

// Casca do app logado: cabecalho enxuto (menu + nome da tela + sino), menu
// lateral (drawer) com os atalhos / Tema / Sair, e a "secao" ativa.
export default function Painel({ sessao }) {
  const [perfil, setPerfil] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [secao, setSecao] = useState('inicio') // inicio|demandas|clientes|equipe|tema|notificacoes
  const [menuAberto, setMenuAberto] = useState(false)
  const [notifAberto, setNotifAberto] = useState(false) // drawer do sino (notificacoes)
  const [demandaInicial, setDemandaInicial] = useState(null) // demanda a abrir ao ir p/ Demandas
  const [filtroInicial, setFiltroInicial] = useState(null) // filtro a aplicar ao ir p/ Demandas
  const [criarInicial, setCriarInicial] = useState(false) // abrir o form de nova demanda
  const {
    notificacoes,
    naoLidas,
    marcarLida,
    marcarLidaDemanda,
    marcarTodasLidas,
    limparTodas,
    toast,
    descartarToast,
  } = useNotificacoes(perfil)

  // Demandas com "novidade" = tem QUALQUER notificacao NAO LIDA (status, novo
  // comentario, nova demanda, cancelamento). Deriva do sistema de notificacoes,
  // entao ja respeita a regra user-to-user (nunca as suas proprias acoes).
  const demandasComNovidade = new Set(
    notificacoes.filter((n) => !n.lida).map((n) => n.demanda_id),
  )
  // Subconjunto: demandas com COMENTARIO novo (mostra o "• novo" no 💬).
  const demandasComComentarioNovo = new Set(
    notificacoes
      .filter((n) => !n.lida && n.tipo === 'novo_comentario')
      .map((n) => n.demanda_id),
  )

  // Chamado pela Inicio/Notificacoes: vai para Demandas ja abrindo a demanda.
  function abrirDemanda(id) {
    setDemandaInicial(id)
    setSecao('demandas')
  }

  // Chamado pela Inicio: vai para Demandas ja com um filtro ({} = sem filtro).
  function abrirDemandasComFiltro(filtro) {
    setFiltroInicial(filtro)
    setSecao('demandas')
  }

  // Chamado pela Inicio: vai para Demandas ja abrindo o form de nova demanda.
  function abrirNovaDemanda() {
    setCriarInicial(true)
    setSecao('demandas')
  }

  useEffect(() => {
    async function buscarPerfil() {
      const { data, error } = await supabase
        .from('perfil')
        .select('id, nome_completo, papel')
        .eq('id', sessao.user.id)
        .single()

      if (error) {
        setErro('Seu usuário ainda não tem um perfil cadastrado.')
      } else {
        setPerfil(data)
      }
      setCarregando(false)
    }
    buscarPerfil()
  }, [sessao])

  async function sair() {
    await supabase.auth.signOut()
  }

  if (carregando) {
    return (
      <main className="tela">
        <div className="cartao">Carregando…</div>
      </main>
    )
  }

  if (erro) {
    return (
      <main className="tela">
        <div className="cartao">
          <p className="erro">{erro}</p>
          <button type="button" onClick={sair}>
            Sair
          </button>
        </div>
      </main>
    )
  }

  return (
    <div className="app">
      <header className="topo">
        <div className="topo-esq">
          <button
            type="button"
            className="botao-menu"
            onClick={() => setMenuAberto(true)}
            aria-label="Abrir menu"
          >
            ☰
          </button>
          <span className="titulo-tela">{NOME_TELA[secao] ?? ''}</span>
        </div>
        <button
          type="button"
          className="sino"
          onClick={() => setNotifAberto(true)}
          aria-label="Notificações"
          title="Notificações"
        >
          🔔
          {naoLidas > 0 && <span className="sino-badge">{naoLidas}</span>}
        </button>
      </header>

      <MenuLateral
        aberto={menuAberto}
        aoFechar={() => setMenuAberto(false)}
        perfil={perfil}
        secao={secao}
        novidadesCount={demandasComNovidade.size}
        aoNavegar={(s) => {
          setSecao(s)
          setMenuAberto(false)
        }}
        aoSair={sair}
      />

      <Notificacoes
        aberto={notifAberto}
        aoFechar={() => setNotifAberto(false)}
        notificacoes={notificacoes}
        aoAbrir={(n) => {
          marcarLida(n.id)
          setNotifAberto(false)
          abrirDemanda(n.demanda_id)
        }}
        aoMarcarTodas={marcarTodasLidas}
        aoLimpar={limparTodas}
      />

      <section className="conteudo">
        {secao === 'inicio' && (
          <Inicio
            perfil={perfil}
            aoAbrirComFiltro={abrirDemandasComFiltro}
            aoNovaDemanda={abrirNovaDemanda}
          />
        )}
        {secao === 'demandas' && (
          <Demandas
            perfil={perfil}
            novidades={demandasComNovidade}
            comentariosNovos={demandasComComentarioNovo}
            marcarLidaDemanda={marcarLidaDemanda}
            demandaInicial={demandaInicial}
            aoConsumirInicial={() => setDemandaInicial(null)}
            filtroInicial={filtroInicial}
            aoConsumirFiltro={() => setFiltroInicial(null)}
            criarInicial={criarInicial}
            aoConsumirCriar={() => setCriarInicial(false)}
            aoVoltarInicio={() => setSecao('inicio')}
          />
        )}
        {secao === 'clientes' && <Clientes perfil={perfil} />}
        {secao === 'equipe' && <Equipe perfil={perfil} />}
        {secao === 'tema' && <Tema />}
      </section>

      <ToastNotificacao
        notificacao={toast}
        aoAbrir={(n) => {
          marcarLida(n.id)
          abrirDemanda(n.demanda_id)
          descartarToast()
        }}
        aoFechar={descartarToast}
      />
    </div>
  )
}
