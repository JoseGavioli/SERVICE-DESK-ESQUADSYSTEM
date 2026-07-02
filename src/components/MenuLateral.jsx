// Menu lateral (drawer) que desliza da esquerda, sobre o conteudo, com um
// fundo escurecido atras. Fecha ao escolher um item ou tocar no fundo.
// Cabecalho com a marca (icone + titulo + subtitulo, como no login), depois
// os atalhos das telas, "Tema" e "Sair".

const ITENS_BASE = [
  { id: 'inicio', rotulo: 'Início' },
  { id: 'dashboard', rotulo: 'Dashboard' },
  { id: 'clientes', rotulo: 'Clientes' },
]

export default function MenuLateral({
  aberto,
  aoFechar,
  perfil,
  secao,
  novidadesCount,
  aoNavegar,
  aoSair,
}) {
  const itens = [...ITENS_BASE]
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
              {it.id === 'inicio' && novidadesCount > 0 && (
                <span className="badge-menu">{novidadesCount}</span>
              )}
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
