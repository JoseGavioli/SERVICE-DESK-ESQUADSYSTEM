import Icone from './Icone'

// Topo da Nova demanda. Sao DOIS topos porque a tela tem dois modos:
//  - TELA CHEIA (aberta pelo "+"): hero com titulo + voltar + sino, igual as
//    outras telas do app;
//  - INLINE (demanda-filha, dentro do Detalhe): so um titulo — o hero do
//    Detalhe ja esta logo acima, e dois heros empilhados ficariam estranhos.
export default function NdCabecalho({
  comHero,
  ehFilha,
  aoCancelar,
  naoLidas,
  aoAbrirNotif,
}) {
  if (!comHero) {
    return (
      <h2 className="titulo-filha">
        {ehFilha ? 'Nova demanda vinculada' : 'Nova demanda'}
      </h2>
    )
  }

  return (
    <header className="hero-demandas">
      <h1 className="hero-titulo">Nova demanda</h1>
      <div className="hero-acoes">
        <button
          type="button"
          className="btn-circular"
          onClick={aoCancelar}
          aria-label="Voltar"
          title="Voltar"
        >
          <Icone nome="voltar" size={20} />
        </button>
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
  )
}
