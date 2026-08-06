import Avatar from './Avatar'
import Icone from './Icone'

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
// filtros (e os mesmos que o Dashboard ja manda para a lista).
const RECORTES = [
  { rotulo: 'Todas', filtro: {} },
  { rotulo: 'Atenção', filtro: { soAtencao: true } },
  { rotulo: 'Em aberto', filtro: { soAtivas: true } },
  { rotulo: 'Enviados', filtro: { status: 'enviado', ordenacao: 'recentes' } },
  { rotulo: 'Cancelados', filtro: { status: 'cancelada' } },
]

const ROTULO_PAPEL = {
  admin: 'Admin',
  atendente: 'Atendente',
  gerente: 'Gerente',
  vendedor: 'Vendedor',
}

// FORA do MenuDesktop de proposito: componente definido dentro do render
// ganha identidade nova a cada render e o React REMONTA os botoes — quem
// navega por Tab perderia o foco (mesma licao do Miolo da FichaCards).
function Item({ alvo, icone, raiz, aoNavegar, children, discreto }) {
  const classes = ['md-item', raiz === alvo && 'ativo', discreto && 'discreto']
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

  return (
    <aside className="menu-desktop">
      <div className="md-marca">
        <img src="/logo-icone.svg" alt="" className="md-logo" />
        <div>
          <div className="md-nome">
            ESQUAD<span>SYSTEM</span>
          </div>
          <div className="md-sub">Orçamentos &amp; Revisões</div>
        </div>
      </div>

      <Item alvo="inicio" icone="casa" raiz={raiz} aoNavegar={aoNavegar}>
        Início
      </Item>
      <div className="md-subnav">
        {RECORTES.map((r) => (
          <button
            key={r.rotulo}
            type="button"
            className="md-subitem"
            onClick={() => aoAbrirComFiltro(r.filtro)}
          >
            {r.rotulo}
          </button>
        ))}
      </div>
      <Item alvo="dashboard" icone="painel" raiz={raiz} aoNavegar={aoNavegar}>
        Dashboard
      </Item>
      <Item alvo="clientes" icone="clientes" raiz={raiz} aoNavegar={aoNavegar}>
        Clientes
      </Item>

      <div className="md-sep" />

      <Item alvo="perfil" icone="perfil" raiz={raiz} aoNavegar={aoNavegar}>
        Meu perfil
      </Item>
      {perfil.papel === 'admin' && (
        <Item alvo="admin" icone="admin" raiz={raiz} aoNavegar={aoNavegar}>
          Administração
        </Item>
      )}
      <button type="button" className="md-item discreto" onClick={aoSair}>
        <Icone nome="sair" size={18} />
        Sair
      </button>

      <button type="button" className="md-nova" onClick={aoNovaDemanda}>
        <Icone nome="mais" size={18} /> Nova demanda
      </button>

      <div className="md-rodape">
        <Avatar
          nome={perfil.nome_completo}
          caminho={perfil.avatar_path}
          className="md-avatar"
        />
        <div className="md-quem">
          <strong>{perfil.nome_completo}</strong>
          <span>{ROTULO_PAPEL[perfil.papel] ?? perfil.papel}</span>
        </div>
      </div>
    </aside>
  )
}
