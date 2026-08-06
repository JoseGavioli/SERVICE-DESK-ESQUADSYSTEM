import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { limparRascunho } from '../lib/rascunho'
import Dashboard from './Dashboard'
import Demandas from './Demandas'
import Clientes from './Clientes'
import Equipe from './Equipe'
import MeuPerfil from './MeuPerfil'
import Erros from './Erros'
import Relatorio from './Relatorio'
import Administracao from './Administracao'
import MenuLateral from './MenuLateral'
import MenuDesktop from './MenuDesktop'
import ErrorBoundary from './ErrorBoundary'
import { registrarErro } from '../lib/erros'
import BottomNav from './BottomNav'
import Notificacoes from './Notificacoes'
import ToastNotificacao from './ToastNotificacao'
import Icone from './Icone'
import { useNotificacoes } from '../lib/useNotificacoes'
import { useBotaoVoltar } from '../lib/useBotaoVoltar'
import { useDesktop } from '../lib/useDesktop'
import { useTiposComFicha } from '../lib/useTiposComFicha'
import { usePresenca } from '../lib/usePresenca'
import { sincronizarPush } from '../lib/webpush'

// Timer do toast "ficou online" (§#46) — fora do componente para nao virar hook.
let timerAvisoOnline = null

// Nome exibido no cabecalho para cada secao.
const NOME_TELA = {
  inicio: 'Início',
  dashboard: 'Dashboard',
  clientes: 'Clientes',
  admin: 'Administração',
  equipe: 'Equipe',
  perfil: 'Meu perfil',
  erros: 'Erros',
  relatorio: 'Relatório',
}

// Telas que vivem DENTRO de outra (§#55): o "voltar" delas voa para a mae,
// nao para a Inicio. Vale para o botao na tela e para o voltar do Android.
const SECAO_MAE = {
  equipe: 'admin',
  erros: 'admin',
  relatorio: 'dashboard',
}

// Casca do app logado: cabecalho enxuto (menu + nome da tela + sino), menu
// lateral (drawer) com os atalhos / Sair, e a "secao" ativa.
export default function Painel({ sessao }) {
  const [perfil, setPerfil] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [secao, setSecao] = useState('inicio') // inicio(lista)|dashboard|clientes|admin|equipe|erros|perfil
  const [menuAberto, setMenuAberto] = useState(false)
  const [notifAberto, setNotifAberto] = useState(false) // drawer do sino (notificacoes)
  const [demandaInicial, setDemandaInicial] = useState(null) // demanda a abrir ao ir p/ Demandas
  const [filtroInicial, setFiltroInicial] = useState(null) // filtro a aplicar ao ir p/ Demandas
  // Abrir o form de nova demanda. Deixou de ser boolean (§#85): agora carrega
  // QUAL caminho o menu escolheu — `{ tipoId }`, com `tipoId` nulo no
  // "Orcamento" (o form pergunta o tipo la dentro) e preenchido no tipo com
  // ficha. `null` = nao ha pedido de abertura.
  const [criarInicial, setCriarInicial] = useState(null)
  // Menu do botao "Nova demanda": 'fab' (celular) | 'lateral' (desktop) | null.
  const [menuNovaEm, setMenuNovaEm] = useState(null)
  const tiposComFicha = useTiposComFicha()
  const [detalheAberto, setDetalheAberto] = useState(false) // detalhe de demanda aberto
  const [criandoAberto, setCriandoAberto] = useState(false) // form de nova demanda aberto
  const [buscaAberta, setBuscaAberta] = useState(false) // barra de busca da lista (§#40)
  const [pedidoVoltar, setPedidoVoltar] = useState(0) // sinal p/ o Demandas fechar o topo
  const [avisoSair, setAvisoSair] = useState(false) // "toque de novo para sair" (§#40)
  // Modo desktop (§#83): tela larga troca bottom-nav + menu "Mais" pelo menu
  // lateral. So decide QUAL casca monta — as telas sao as mesmas.
  const desktop = useDesktop()

  // Cruzou para o desktop com o menu "Mais" aberto? Fecha-o: orfao, ele
  // consumiria um "voltar" invisivel e reapareceria sozinho ao estreitar
  // (achado da revisao do B1).
  useEffect(() => {
    if (desktop) setMenuAberto(false)
  }, [desktop])
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
  // Presenca (online) em tempo real (§issue #46). Quando alguem fica online, o
  // ADMIN recebe um aviso in-app (toast). So enquanto o app do admin esta aberto.
  const [avisoOnline, setAvisoOnline] = useState(null)
  const { online, ultimoVisto } = usePresenca(perfil, {
    aoEntrar: (novos) => {
      if (perfil?.papel !== 'admin') return
      const nome = novos[0]?.nome || 'Alguém'
      const extra = novos.length > 1 ? ` +${novos.length - 1}` : ''
      setAvisoOnline(`${nome}${extra} ficou online`)
      clearTimeout(timerAvisoOnline)
      timerAvisoOnline = setTimeout(() => setAvisoOnline(null), 4000)
    },
  })

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

  // Vai para a lista (Inicio) ja abrindo o form de nova demanda, no caminho
  // que o menu escolheu (§#85).
  function abrirNovaDemanda(tipoId = null) {
    setMenuNovaEm(null)
    setCriarInicial({ tipoId })
    setSecao('inicio')
  }

  // O menu do "+" e EFEMERO (§#85): qualquer troca de tela o fecha. Sem isto
  // ele sobreviveria escondido — o BottomNav so o desenha junto com o FAB, e
  // ao voltar para a Inicio (onde o FAB reaparece) o menu voltaria sozinho,
  // sem ninguem ter pedido.
  // `desktop` entra na lista porque o menu vive em DOIS lugares (FAB e barra):
  // cruzar o corte de 900px trocaria o dono do menu e ele voltaria sozinho no
  // outro canto.
  useEffect(() => {
    setMenuNovaEm(null)
  }, [secao, detalheAberto, criandoAberto, desktop])

  // ── Botao "voltar" do celular (§issue #40) ──────────────────────
  // O Demandas "sobrepoe" a Inicio quando ha um detalhe, o form de nova
  // demanda OU a busca aberta — nesses casos o voltar pede a ele que feche o
  // topo (via pedidoVoltar). A ordem geral de desempilhamento: menu -> sino ->
  // (detalhe/form/busca do Demandas) -> outra secao -> raiz.
  const demandasSobrepoe = detalheAberto || criandoAberto || buscaAberta
  function podeVoltar() {
    // O menu do "+" (§#85) entra na pilha: sem ele aqui, abrir o menu e tocar
    // em voltar cairia direto no "toque de novo para sair" — com o menu ainda
    // na tela. Ele e o mais raso (abriu por ultimo), entao fecha primeiro.
    return (
      menuNovaEm ||
      menuAberto ||
      notifAberto ||
      demandasSobrepoe ||
      secao !== 'inicio'
    )
  }
  function voltarUmNivel() {
    if (menuNovaEm) setMenuNovaEm(null)
    else if (menuAberto) setMenuAberto(false)
    else if (notifAberto) setNotifAberto(false)
    else if (demandasSobrepoe) setPedidoVoltar((v) => v + 1)
    // Sub-tela (Equipe/Erros) volta para a Administracao; o resto, para a Inicio.
    else if (secao !== 'inicio') setSecao(SECAO_MAE[secao] ?? 'inicio')
  }
  useBotaoVoltar({
    podeVoltar,
    voltar: voltarUmNivel,
    aoPedirSair: () => {
      setAvisoSair(true)
      setTimeout(() => setAvisoSair(false), 2000)
    },
  })

  useEffect(() => {
    async function buscarPerfil() {
      const { data, error } = await supabase
        .from('perfil')
        .select('id, nome_completo, papel, ativo, avatar_path')
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

  // Re-sincroniza a assinatura de push no boot (quando a permissao ja e
  // 'granted'): garante a assinatura salva, cobrindo expiracao/rotacao/troca
  // de aparelho sem depender do fragil evento pushsubscriptionchange.
  useEffect(() => {
    sincronizarPush().catch(() => {})
  }, [])

  async function sair() {
    // Sair LIMPA o rascunho da Nova demanda (§#82): ele pode conter CPF e
    // dados bancarios da ficha — nao deve sobreviver no aparelho a um
    // logout explicito (aparelho emprestado/compartilhado).
    if (perfil?.id) limparRascunho(perfil.id)
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
    secao === 'perfil' ||
    secao === 'erros' ||
    secao === 'admin' ||
    secao === 'relatorio' ||
    secao === 'dashboard'

  return (
    <div className={`app${desktop ? ' desktop' : ''}`}>
      {/* Menu lateral do desktop (§#83): navegacao + recortes + conta, tudo
          exposto. No celular quem faz esse papel e o bottom-nav + "Mais". */}
      {desktop && (
        <MenuDesktop
          perfil={perfil}
          secao={secao}
          aoNavegar={(s) => {
            // Ja na Inicio com detalhe/form/busca por cima: "Inicio" desce UM
            // nivel (com a trava de descarte do form, §#82) em vez de ser um
            // clique morto (achado da revisao do B1).
            if (s === 'inicio' && secao === 'inicio' && demandasSobrepoe) {
              setPedidoVoltar((v) => v + 1)
              return
            }
            setSecao(s)
          }}
          aoAbrirComFiltro={abrirDemandasComFiltro}
          aoNovaDemanda={() =>
            setMenuNovaEm((v) => (v === 'lateral' ? null : 'lateral'))
          }
          menuNovaAberto={menuNovaEm === 'lateral'}
          formAberto={criandoAberto}
          tiposComFicha={tiposComFicha}
          aoEscolherNova={abrirNovaDemanda}
          aoSair={sair}
        />
      )}

      <div className="app-conteudo">
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

      {!desktop && (
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
      )}

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
        {/* Se UMA tela quebrar, o boundary mostra o aviso AQUI e o menu/barra
            continuam. A key={secao} da <section> ja remonta (reseta) ao trocar
            de tela. */}
        <ErrorBoundary
          onError={(erro, info) =>
            registrarErro('boundary-tela', erro, info?.componentStack)
          }
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
            tiposComFicha={tiposComFicha}
            aoConsumirCriar={() => setCriarInicial(null)}
            naoLidas={naoLidas}
            aoAbrirNotif={() => setNotifAberto(true)}
            aoDetalhe={setDetalheAberto}
            aoCriando={setCriandoAberto}
            aoBuscando={setBuscaAberta}
            pedidoVoltar={pedidoVoltar}
          />
        )}
        {secao === 'dashboard' && (
          <Dashboard
            perfil={perfil}
            online={online}
            vistos={ultimoVisto}
            aoAbrirComFiltro={abrirDemandasComFiltro}
            aoAbrirRelatorio={() => setSecao('relatorio')}
            aoAbrirDemanda={abrirDemanda}
            notificacoes={notificacoes}
            aoAbrirNotificacao={(n) => {
              marcarLida(n.id)
              abrirDemanda(n.demanda_id)
            }}
            naoLidas={naoLidas}
            aoAbrirNotif={() => setNotifAberto(true)}
          />
        )}
        {secao === 'relatorio' && (
          <Relatorio
            naoLidas={naoLidas}
            aoAbrirNotif={() => setNotifAberto(true)}
            aoVoltar={() => setSecao('dashboard')}
          />
        )}
        {secao === 'clientes' && (
          <Clientes
            perfil={perfil}
            naoLidas={naoLidas}
            aoAbrirNotif={() => setNotifAberto(true)}
          />
        )}
        {secao === 'admin' && (
          <Administracao
            aoNavegar={setSecao}
            naoLidas={naoLidas}
            aoAbrirNotif={() => setNotifAberto(true)}
          />
        )}
        {secao === 'equipe' && (
          <Equipe
            perfil={perfil}
            online={online}
            vistos={ultimoVisto}
            naoLidas={naoLidas}
            aoAbrirNotif={() => setNotifAberto(true)}
            aoVoltar={() => setSecao('admin')}
          />
        )}
        {secao === 'perfil' && (
          <MeuPerfil
            perfil={perfil}
            email={sessao.user.email}
            naoLidas={naoLidas}
            aoAbrirNotif={() => setNotifAberto(true)}
          />
        )}
        {secao === 'erros' && (
          <Erros
            naoLidas={naoLidas}
            aoAbrirNotif={() => setNotifAberto(true)}
            aoVoltar={() => setSecao('admin')}
          />
        )}
        </ErrorBoundary>
      </section>

      {/* "Toque de novo para sair" — 1o voltar na Inicio (§#40, Android). */}
      {avisoSair && (
        <div className="aviso-sair" role="status">
          Toque em voltar de novo para sair
        </div>
      )}

      {/* Aviso pro admin quando alguem fica online (§#46). */}
      {avisoOnline && (
        <div className="aviso-online" role="status">
          <span className="aviso-online-dot" aria-hidden="true" />
          {avisoOnline}
        </div>
      )}

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
          "+" espia por cima dela). No desktop ele nem monta (§#83). */}
      {!desktop &&
        !((perfil.papel !== 'vendedor' && detalheAberto) || criandoAberto) && (
          <BottomNav
            secao={secao}
            aoNavegar={(s) => {
              setSecao(s)
              setMenuAberto(false)
            }}
            aoMais={() => setMenuAberto((v) => !v)}
            menuAberto={menuAberto}
            aoNova={() => setMenuNovaEm((v) => (v === 'fab' ? null : 'fab'))}
            menuNovaAberto={menuNovaEm === 'fab'}
            tiposComFicha={tiposComFicha}
            aoEscolherNova={abrirNovaDemanda}
            mostrarFab={secao === 'inicio' || secao === 'dashboard'}
            novidadesCount={demandasComNovidade.size}
          />
        )}
      </div>
    </div>
  )
}
