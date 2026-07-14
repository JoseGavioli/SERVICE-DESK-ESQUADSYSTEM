// Menu "Mais" (drawer que desliza da esquerda). As telas principais vivem no
// bottom-nav; aqui ficam os EXTRAS: Equipe (admin), Tema e Sair.
// Cabecalho com a marca (icone + titulo + subtitulo, como no login).
export default function MenuLateral({
  aberto,
  aoFechar,
  perfil,
  secao,
  aoNavegar,
  aoSair,
}) {
  // "Meu perfil" (foto/senha do proprio usuario) — para todos os papeis.
  const itens = [{ id: 'perfil', rotulo: 'Meu perfil' }]
  // A Equipe é exclusiva do admin (gerência de usuários). O gerente vê os
  // vendedores online pelo Dashboard ("Por vendedor"), não por aqui (§#46).
  if (perfil.papel === 'admin') itens.push({ id: 'equipe', rotulo: 'Equipe' })
  itens.push({ id: 'tema', rotulo: 'Tema' })

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
              {it.rotulo}
            </button>
          ))}
          <button type="button" className="menu-sair" onClick={aoSair}>
            Sair
          </button>
        </nav>
      </aside>
    </>
  )
}
