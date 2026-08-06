import { useEffect, useRef, useState } from 'react'
import Avatar from './Avatar'
import Icone from './Icone'
import { useContadoresLista } from '../lib/useContadoresLista'

// Menu lateral do MODO DESKTOP (§issue #83, B1). Substitui o bottom-nav e o
// menu "Mais" quando a tela e larga (useDesktop): tudo exposto de uma vez —
// navegacao, os recortes de status da lista (sub-menu do Inicio) e a area da
// conta. So o desenho: quem navega/filtra e o Painel, pelas funcoes que ja
// existiam (abrirDemandasComFiltro etc.).
//
// Os CONTADORES do sub-menu (Atencao N / Em aberto N) entram no B2 — os
// numeros hoje sao calculados dentro das telas.

// Sub-tela acende o item da MAE (mesma regra do SECAO_MAE do Painel).
const SECAO_RAIZ = {
  equipe: 'admin',
  erros: 'admin',
  relatorio: 'dashboard',
}

// Recortes do sub-menu do Inicio = os chips da lista de hoje, com os MESMOS
// filtros (e os mesmos que o Dashboard ja manda para a lista). `contador`
// aponta qual numero do useContadoresLista o recorte exibe (§B2).
const RECORTES = [
  { rotulo: 'Todas', filtro: {} },
  { rotulo: 'Atenção', filtro: { soAtencao: true }, contador: 'atencao', perigo: true },
  { rotulo: 'Em aberto', filtro: { soAtivas: true }, contador: 'emAberto' },
  { rotulo: 'Enviados', filtro: { status: 'enviado', ordenacao: 'recentes' } },
  { rotulo: 'Cancelados', filtro: { status: 'cancelada' } },
]

// Secoes que vivem no menu da CONTA: quando uma delas esta aberta, quem
// acende e o rodape (nenhum item do topo representa mais essas telas).
const CONTA_SECOES = ['perfil', 'admin']

const ROTULO_PAPEL = {
  admin: 'Admin',
  atendente: 'Atendente',
  gerente: 'Gerente',
  vendedor: 'Vendedor',
}

// FORA do MenuDesktop de proposito: componente definido dentro do render
// ganha identidade nova a cada render e o React REMONTA os botoes — quem
// navega por Tab perderia o foco (mesma licao do Miolo da FichaCards).
function Item({ alvo, icone, raiz, aoNavegar, children }) {
  const classes = ['md-item', raiz === alvo && 'ativo']
    .filter(Boolean)
    .join(' ')
  return (
    <button type="button" className={classes} onClick={() => aoNavegar(alvo)}>
      <Icone nome={icone} size={18} />
      {children}
    </button>
  )
}

export default function MenuDesktop({
  perfil,
  secao,
  aoNavegar,
  aoAbrirComFiltro,
  aoNovaDemanda,
  aoSair,
}) {
  const raiz = SECAO_RAIZ[secao] ?? secao
  // Numeros dos recortes (Atencao/Em aberto), em tempo real (§B2). Enquanto
  // carregam (null), o badge simplesmente nao aparece.
  const contadores = useContadoresLista(perfil)

  // Menu da conta (rodape do menu lateral).
  const [contaAberta, setContaAberta] = useState(false)
  const contaRef = useRef(null)

  // Fecha ao clicar FORA e no Esc — as duas saidas que todo mundo tenta por
  // reflexo. O `pointerdown` (e nao o click) fecha antes de o alvo receber o
  // clique, senao um clique num item do menu de tras chegaria com o menu
  // ainda aberto por cima.
  useEffect(() => {
    if (!contaAberta) return
    function foraDaqui(e) {
      if (!contaRef.current?.contains(e.target)) setContaAberta(false)
    }
    function noEsc(e) {
      if (e.key === 'Escape') setContaAberta(false)
    }
    document.addEventListener('pointerdown', foraDaqui)
    document.addEventListener('keydown', noEsc)
    return () => {
      document.removeEventListener('pointerdown', foraDaqui)
      document.removeEventListener('keydown', noEsc)
    }
  }, [contaAberta])

  function irPara(alvo) {
    setContaAberta(false)
    aoNavegar(alvo)
  }

  return (
    <aside className="menu-desktop">
      {/* A marca e a do APP, nao a da empresa: quem esta aqui dentro ja sabe
          onde trabalha — o que o topo precisa dizer e "voce esta no Service
          Desk". Mesmo par losango + nome da tela de login e do menu do
          celular. */}
      <div className="md-marca">
        <img src="/logo-icone.svg" alt="" className="md-logo" />
        <div>
          <div className="md-nome">
            Service<span>Desk</span>
          </div>
          <div className="md-sub">EsquadSystem</div>
        </div>
      </div>

      <Item alvo="inicio" icone="casa" raiz={raiz} aoNavegar={aoNavegar}>
        Início
      </Item>
      <div className="md-subnav">
        {RECORTES.map((r) => {
          const n = r.contador ? contadores[r.contador] : null
          return (
            <button
              key={r.rotulo}
              type="button"
              className="md-subitem"
              onClick={() => aoAbrirComFiltro(r.filtro)}
            >
              {r.rotulo}
              {n > 0 && (
                <span className={`md-num${r.perigo ? ' perigo' : ''}`}>{n}</span>
              )}
            </button>
          )
        })}
      </div>
      <Item alvo="dashboard" icone="painel" raiz={raiz} aoNavegar={aoNavegar}>
        Dashboard
      </Item>
      <Item alvo="clientes" icone="clientes" raiz={raiz} aoNavegar={aoNavegar}>
        Clientes
      </Item>

      <button type="button" className="md-nova" onClick={aoNovaDemanda}>
        <Icone nome="mais" size={18} /> Nova demanda
      </button>

      {/* Area da CONTA: perfil, administracao e sair sairam da navegacao e
          viraram um menu do proprio usuario (pedido do dono). Sao acoes
          "sobre mim", nao lugares do app — e o topo do menu fica so com o
          que e trabalho do dia. */}
      <div className="md-conta" ref={contaRef}>
        {contaAberta && (
          <div className="md-conta-menu" role="menu">
            <button
              type="button"
              role="menuitem"
              className="md-conta-item"
              onClick={() => irPara('perfil')}
            >
              <Icone nome="perfil" size={16} />
              Meu perfil
            </button>
            {perfil.papel === 'admin' && (
              <button
                type="button"
                role="menuitem"
                className="md-conta-item"
                onClick={() => irPara('admin')}
              >
                <Icone nome="admin" size={16} />
                Administração
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              className="md-conta-item"
              onClick={() => {
                setContaAberta(false)
                aoSair()
              }}
            >
              <Icone nome="sair" size={16} />
              Sair
            </button>
          </div>
        )}

        <button
          type="button"
          className={`md-rodape${contaAberta ? ' aberto' : ''}${
            CONTA_SECOES.includes(raiz) ? ' ativo' : ''
          }`}
          onClick={() => setContaAberta((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={contaAberta}
        >
          <Avatar
            nome={perfil.nome_completo}
            caminho={perfil.avatar_path}
            className="md-avatar"
          />
          <div className="md-quem">
            <strong>{perfil.nome_completo}</strong>
            <span>{ROTULO_PAPEL[perfil.papel] ?? perfil.papel}</span>
          </div>
          <Icone nome={contaAberta ? 'chevron-baixo' : 'chevron-cima'} size={16} />
        </button>
      </div>
    </aside>
  )
}
