import Icone from './Icone'

// Menu "Mais" (drawer que desliza da esquerda). As telas principais vivem no
// bottom-nav; aqui ficam os EXTRAS: Meu perfil, Equipe (admin), Tema e Sair.
// Cabecalho com a marca (icone + titulo + subtitulo, como no login).
export default function MenuLateral({
  aberto,
  aoFechar,
  perfil,
  secao,
  aoNavegar,
  aoSair,
}) {
  // "Meu perfil" (foto, senha e o TEMA) — para todos os papeis. O tema virou um
  // toggle la dentro: era uma tela inteira para UM ajuste.
  const itens = [{ id: 'perfil', rotulo: 'Meu perfil', icone: 'perfil' }]
  // A Equipe é exclusiva do admin (gerência de usuários). O gerente vê os
  // vendedores online pelo Dashboard ("Por vendedor"), não por aqui (§#46).
  // Ferramentas de admin (Equipe, Erros, ...) vivem juntas numa tela so
  // (§issue #55) — assim o menu nao incha conforme elas crescem.
  if (perfil.papel === 'admin')
    itens.push({ id: 'admin', rotulo: 'Administração', icone: 'admin' })

  return (
    <>
      <div
        className={`menu-backdrop ${aberto ? 'aberto' : ''}`}
        onClick={aoFechar}
        aria-hidden="true"
      />
      <aside className={`menu-lateral ${aberto ? 'aberto' : ''}`}>
        <div className="menu-cabecalho">
          <img className="menu-logo" src="/logo-icone.svg" alt="EsquadSystem" />
          <strong className="menu-titulo">Service Desk - EsquadSystem</strong>
          <span className="menu-subtitulo">Orçamentos &amp; Revisões</span>
        </div>

        <nav className="menu-itens">
          {itens.map((it) => (
            <button
              key={it.id}
              type="button"
              className={secao === it.id ? 'ativo' : ''}
              onClick={() => aoNavegar(it.id)}
            >
              <Icone nome={it.icone} size={18} />
              {it.rotulo}
            </button>
          ))}
          <button type="button" className="menu-sair" onClick={aoSair}>
            <Icone nome="sair" size={18} />
            Sair
          </button>
        </nav>
      </aside>
    </>
  )
}
