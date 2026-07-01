import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Inicio from './Inicio'
import Demandas from './Demandas'
import Clientes from './Clientes'
import Equipe from './Equipe'
import BotaoTema from './BotaoTema'
import Notificacoes from './Notificacoes'
import ToastNotificacao from './ToastNotificacao'
import { useNotificacoes } from '../lib/useNotificacoes'

// Casca do app logado: carrega o perfil do usuario, mostra a barra do
// topo (nome/papel/Sair), um menu (com contador de novidades nas
// Demandas) e renderiza a "secao" ativa.
export default function Painel({ sessao }) {
  const [perfil, setPerfil] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [secao, setSecao] = useState('inicio') // 'inicio' | 'demandas' | 'clientes' | 'equipe'
  const [demandaInicial, setDemandaInicial] = useState(null) // demanda a abrir ao ir p/ Demandas
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
        <div className="marca-topo">
          <img
            className="logo-topo"
            src="/logo-icone.svg"
            alt="EsquadSystem"
          />
          <div>
            <strong>Controle de Demandas</strong>
            <span className="quem">
              {' '}
              — {perfil.nome_completo} ({perfil.papel})
            </span>
          </div>
        </div>
        <div className="acoes-topo">
          <button
            type="button"
            className="sino"
            onClick={() => setSecao('notificacoes')}
            aria-label="Notificações"
            title="Notificações"
          >
            🔔
            {naoLidas > 0 && <span className="sino-badge">{naoLidas}</span>}
          </button>
          <BotaoTema />
          <button type="button" className="link" onClick={sair}>
            Sair
          </button>
        </div>
      </header>

      <nav className="menu">
        <button
          type="button"
          className={secao === 'inicio' ? 'ativo' : ''}
          onClick={() => setSecao('inicio')}
        >
          Início
        </button>
        <button
          type="button"
          className={secao === 'demandas' ? 'ativo' : ''}
          onClick={() => setSecao('demandas')}
        >
          Demandas
          {demandasComNovidade.size > 0 && (
            <span className="badge-menu">{demandasComNovidade.size}</span>
          )}
        </button>
        <button
          type="button"
          className={secao === 'clientes' ? 'ativo' : ''}
          onClick={() => setSecao('clientes')}
        >
          Clientes
        </button>
        {perfil.papel === 'admin' && (
          <button
            type="button"
            className={secao === 'equipe' ? 'ativo' : ''}
            onClick={() => setSecao('equipe')}
          >
            Equipe
          </button>
        )}
      </nav>

      <section className="conteudo">
        {secao === 'inicio' && <Inicio perfil={perfil} />}
        {secao === 'notificacoes' && (
          <Notificacoes
            notificacoes={notificacoes}
            aoAbrir={(n) => {
              marcarLida(n.id)
              abrirDemanda(n.demanda_id)
            }}
            aoMarcarTodas={marcarTodasLidas}
            aoLimpar={limparTodas}
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
          />
        )}
        {secao === 'clientes' && <Clientes perfil={perfil} />}
        {secao === 'equipe' && <Equipe perfil={perfil} />}
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
