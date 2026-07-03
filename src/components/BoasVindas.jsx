// Tela de boas-vindas (onboarding), exibida antes do login quando nao ha
// sessao. Estilo da referencia: logo em cima, painel navy embaixo com titulo,
// texto e o botao "Continuar". "aoContinuar" leva para o Login.
export default function BoasVindas({ aoContinuar }) {
  return (
    <main className="boas-vindas">
      <div className="bv-top">
        <img className="bv-logo" src="/logo-icone.svg" alt="EsquadSystem" />
      </div>

      <div className="bv-painel">
        <div className="bv-dots" aria-hidden="true">
          <span className="bv-dot ativo" />
          <span className="bv-dot" />
          <span className="bv-dot" />
        </div>

        <h1 className="bv-titulo">Bem-vindo ao Service Desk</h1>
        <p className="bv-texto">
          Acompanhe seus orçamentos e revisões da EsquadSystem em um só lugar —
          com histórico, status e avisos em tempo real.
        </p>

        <button type="button" className="bv-continuar" onClick={aoContinuar}>
          Continuar
        </button>
      </div>
    </main>
  )
}
