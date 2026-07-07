import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Dashboard from './Dashboard'
import Demandas from './Demandas'
import Clientes from './Clientes'
import Equipe from './Equipe'
import MenuLateral from './MenuLateral'
import BottomNav from './BottomNav'
import Tema from './Tema'
import Notificacoes from './Notificacoes'
import ToastNotificacao from './ToastNotificacao'
import Icone from './Icone'
import { useNotificacoes } from '../lib/useNotificacoes'

// Nome exibido no cabecalho para cada secao.
const NOME_TELA = {
  inicio: 'Início',
  dashboard: 'Dashboard',
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
  const [secao, setSecao] = useState('inicio') // inicio(lista)|dashboard|clientes|equipe|tema
  const [menuAberto, setMenuAberto] = useState(false)
  const [notifAberto, setNotifAberto] = useState(false) // drawer do sino (notificacoes)
  const [demandaInicial, setDemandaInicial] = useState(null) // demanda a abrir ao ir p/ Demandas
  const [filtroInicial, setFiltroInicial] = useState(null) // filtro a aplicar ao ir p/ Demandas
  const [criarInicial, setCriarInicial] = useState(false) // abrir o form de nova demanda
  const [detalheAberto, setDetalheAberto] = useState(false) // detalhe de demanda aberto
  const [criandoAberto, setCriandoAberto] = useState(false) // form de nova demanda aberto
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

  // Notificacoes/Dashboard: vai para a lista (Inicio) ja abrindo a demanda.
  function abrirDemanda(id) {
    setDemandaInicial(id)
    setSecao('inicio')
  }

  // Dashboard: vai para a lista (Inicio) ja com um filtro ({} = sem filtro).
  function abrirDemandasComFiltro(filtro) {
    setFiltroInicial(filtro)
    setSecao('inicio')
  }

  // Dashboard: vai para a lista (Inicio) ja abrindo o form de nova demanda.
  function abrirNovaDemanda() {
    setCriarInicial(true)
    setSecao('inicio')
  }

  useEffect(() => {
    async function buscarPerfil() {
      const { data, error } = await supabase
        .from('perfil')
        .select('id, nome_completo, papel, ativo')
        .eq('id', sessao.user.id)
        .single()

      if (error) {
        setErro('Seu usuário ainda não tem um perfil cadastrado.')
      } else if (!data.ativo) {
        // Conta desativada: a RLS (migracao 0025) ja bloqueia as ACOES no
        // banco; aqui barramos logo na entrada, com aviso claro.
        setErro('Sua conta está desativada. Fale com o administrador para reativá-la.')
      } else {
        setPerfil(data)
      }
      setCarregando(false)
    }
    buscarPerfil()
  }, [sessao])

  // Deep-link do Web Push: uma URL "/?demanda=12" (do toque na notificacao)
  // abre a demanda 12 e limpa a query, para um refresh nao reabrir.
  useEffect(() => {
    const alvo = new URLSearchParams(window.location.search).get('demanda')
    if (alvo) {
      abrirDemanda(Number(alvo))
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

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

  // Telas com "hero" proprio (titulo grande + acoes) no lugar da barra de topo
  // enxuta: Inicio, Clientes, Equipe e Dashboard.
  const telaComHero =
    secao === 'inicio' ||
    secao === 'clientes' ||
    secao === 'equipe' ||
    secao === 'dashboard'

  return (
    <div className="app">
      {/* Inicio, Clientes e Equipe tem "hero" (titulo grande + acoes) dentro do
          proprio componente; nas demais telas fica esta barra enxuta. */}
      {!telaComHero && (
        <header className="topo">
          <span className="titulo-tela">{NOME_TELA[secao] ?? ''}</span>
          <button
            type="button"
            className="sino"
            onClick={() => setNotifAberto(true)}
            aria-label="Notificações"
            title="Notificações"
          >
            <Icone nome="sino" size={20} />
            {naoLidas > 0 && <span className="sino-badge">{naoLidas}</span>}
          </button>
        </header>
      )}

      <MenuLateral
        aberto={menuAberto}
        aoFechar={() => setMenuAberto(false)}
        perfil={perfil}
        secao={secao}
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

      <section
        key={secao}
        className={`conteudo${telaComHero ? ' sem-topo' : ''}`}
      >
        {secao === 'inicio' && (
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
            naoLidas={naoLidas}
            aoAbrirNotif={() => setNotifAberto(true)}
            aoDetalhe={setDetalheAberto}
            aoCriando={setCriandoAberto}
          />
        )}
        {secao === 'dashboard' && (
          <Dashboard
            perfil={perfil}
            aoAbrirComFiltro={abrirDemandasComFiltro}
            naoLidas={naoLidas}
            aoAbrirNotif={() => setNotifAberto(true)}
          />
        )}
        {secao === 'clientes' && (
          <Clientes
            perfil={perfil}
            naoLidas={naoLidas}
            aoAbrirNotif={() => setNotifAberto(true)}
          />
        )}
        {secao === 'equipe' && (
          <Equipe
            perfil={perfil}
            naoLidas={naoLidas}
            aoAbrirNotif={() => setNotifAberto(true)}
          />
        )}
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

      {/* Escondemos o bottom-nav (e o FAB) quando ele conflitaria com uma
          barra fixa de rodape: (a) staff no detalhe (barra "Alterar status");
          (b) form de nova demanda aberto (barra "Criar demanda" — senao o FAB
          "+" espia por cima dela). */}
      {!((perfil.papel !== 'vendedor' && detalheAberto) || criandoAberto) && (
        <BottomNav
          secao={secao}
          aoNavegar={(s) => {
            setSecao(s)
            setMenuAberto(false)
          }}
          aoMais={() => setMenuAberto((v) => !v)}
          menuAberto={menuAberto}
          aoNova={abrirNovaDemanda}
          mostrarFab={secao === 'inicio' || secao === 'dashboard'}
          novidadesCount={demandasComNovidade.size}
        />
      )}
    </div>
  )
}
