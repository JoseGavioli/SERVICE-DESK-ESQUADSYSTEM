import Icone from './Icone'

// Barra de navegacao fixa no rodape (estilo app). Abas principais + um FAB
// VERMELHO no centro ("+", nova demanda) que salta acima da barra. "Mais" abre
// o menu lateral com o resto (Equipe/Tema/Sair).
const ABAS_ESQ = [
  { id: 'inicio', rotulo: 'Início', icone: 'casa' },
  { id: 'dashboard', rotulo: 'Dashboard', icone: 'painel' },
]
const ABAS_DIR = [{ id: 'clientes', rotulo: 'Clientes', icone: 'clientes' }]

export default function BottomNav({
  secao,
  aoNavegar,
  aoMais,
  menuAberto,
  aoNova,
  mostrarFab,
  novidadesCount,
}) {
  function item(a) {
    return (
      <button
        key={a.id}
        type="button"
        className={`bottom-nav-item ${secao === a.id ? 'ativo' : ''}`}
        onClick={() => aoNavegar(a.id)}
      >
        <span className="bottom-nav-icone">
          <Icone nome={a.icone} size={25} />
          {a.id === 'inicio' && novidadesCount > 0 && (
            <span className="bottom-nav-badge">{novidadesCount}</span>
          )}
        </span>
        <span className="bottom-nav-rotulo">{a.rotulo}</span>
      </button>
    )
  }

  return (
    <nav className="bottom-nav">
      {ABAS_ESQ.map(item)}
      {/* espaco central reservado para o FAB (so quando ele aparece) */}
      {mostrarFab && (
        <span className="bottom-nav-espaco" aria-hidden="true" />
      )}
      {ABAS_DIR.map(item)}
      <button
        type="button"
        className={`bottom-nav-item ${menuAberto ? 'ativo' : ''}`}
        onClick={aoMais}
      >
        <span className="bottom-nav-icone">
          <Icone nome="mais-opcoes" size={25} />
        </span>
        <span className="bottom-nav-rotulo">Mais</span>
      </button>

      {/* FAB central: nova demanda (so em Inicio/Dashboard). Camada externa =
          borda navy; interna = botao vermelho + glow (no anel, entre os dois). */}
      {mostrarFab && (
        <button
          type="button"
          className="bottom-nav-fab"
          onClick={aoNova}
          aria-label="Nova demanda"
          title="Nova demanda"
        >
          <span className="bottom-nav-fab-btn">
            <Icone nome="mais" size={35} />
          </span>
        </button>
      )}
    </nav>
  )
}
