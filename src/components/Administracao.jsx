import Icone from './Icone'

// Tela "Administracao" (SO admin, §issue #55). O menu "Mais" ia inchando com as
// ferramentas de admin (Equipe, Erros — e em breve Tipos #18 e Cadastro #16).
// Aqui elas ficam juntas, cada uma com um SUBTITULO explicando o que faz (coisa
// que um menu plano nao permite), e o menu volta a ser curto para todo mundo.
//
// Agrupamos SO a area do admin de proposito: para o vendedor o menu ja era
// minusculo, e aninhar so custaria um toque a mais sem ajudar ninguem.
const ITENS = [
  {
    id: 'equipe',
    icone: 'equipe',
    titulo: 'Equipe',
    sub: 'Membros, papéis, contato e quem está online.',
  },
  {
    id: 'erros',
    icone: 'bug',
    titulo: 'Erros',
    sub: 'O que quebrou no aparelho dos usuários.',
  },
]

export default function Administracao({ aoNavegar, naoLidas, aoAbrirNotif }) {
  return (
    <div className="secao-admin">
      <header className="hero-demandas">
        <h1 className="hero-titulo">Administração</h1>
        <div className="hero-acoes">
          <button
            type="button"
            className="btn-circular"
            onClick={aoAbrirNotif}
            aria-label="Notificações"
            title="Notificações"
          >
            <Icone nome="sino" size={20} />
            {naoLidas > 0 && <span className="sino-badge">{naoLidas}</span>}
          </button>
        </div>
      </header>

      <ul className="lista-admin">
        {ITENS.map((it) => (
          <li key={it.id}>
            <button
              type="button"
              className="admin-card"
              onClick={() => aoNavegar(it.id)}
            >
              <span className="admin-icone">
                <Icone nome={it.icone} size={20} />
              </span>
              <span className="admin-texto">
                <strong className="admin-titulo">{it.titulo}</strong>
                <span className="admin-sub">{it.sub}</span>
              </span>
              <Icone nome="chevron-direita" size={18} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
