import Icone from './Icone'

// Barra de navegacao fixa no rodape (estilo app). As abas principais ficam
// aqui; "Mais" abre o menu lateral com o resto (Equipe/Tema/Sair).
const ABAS = [
  { id: 'inicio', rotulo: 'Início', icone: 'casa' },
  { id: 'dashboard', rotulo: 'Dashboard', icone: 'painel' },
  { id: 'clientes', rotulo: 'Clientes', icone: 'clientes' },
]

export default function BottomNav({ secao, aoNavegar, aoMais, novidadesCount }) {
  return (
    <nav className="bottom-nav">
      {ABAS.map((a) => (
        <button
          key={a.id}
          type="button"
          className={`bottom-nav-item ${secao === a.id ? 'ativo' : ''}`}
          onClick={() => aoNavegar(a.id)}
        >
          <span className="bottom-nav-icone">
            <Icone nome={a.icone} size={22} />
            {a.id === 'inicio' && novidadesCount > 0 && (
              <span className="bottom-nav-badge">{novidadesCount}</span>
            )}
          </span>
          <span className="bottom-nav-rotulo">{a.rotulo}</span>
        </button>
      ))}
      <button type="button" className="bottom-nav-item" onClick={aoMais}>
        <span className="bottom-nav-icone">
          <Icone nome="mais-opcoes" size={22} />
        </span>
        <span className="bottom-nav-rotulo">Mais</span>
      </button>
    </nav>
  )
}
