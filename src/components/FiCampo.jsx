// Campos basicos da ficha de pedido de vendas (§issue #80). Reusam as classes
// .campo-linha/.campo-rot do form de Nova demanda — a ficha fala a mesma
// lingua visual do resto do app.

// Linha "rotulo em cima, input embaixo" (ou inline p/ inputs curtos).
export function CampoFicha({
  rotulo,
  valor,
  aoMudar,
  tipo = 'text',
  inputMode,
  placeholder,
}) {
  return (
    <label className="campo-linha">
      <span className="campo-rot">{rotulo}</span>
      <input
        type={tipo}
        inputMode={inputMode}
        placeholder={placeholder}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
      />
    </label>
  )
}

// Toggle Sim/Nao (checkbox estilizado, como o "Tem RT?" das condicoes).
export function SimNaoFicha({ rotulo, valor, aoMudar }) {
  return (
    <label className="campo-linha campo-inline">
      <span className="campo-rot">{rotulo}</span>
      <input
        type="checkbox"
        className="campo-check"
        checked={valor}
        onChange={(e) => aoMudar(e.target.checked)}
      />
    </label>
  )
}

// Porcentagem (0–100) com o "%" do lado, como na RT das condicoes.
export function PctFicha({ rotulo, valor, aoMudar }) {
  return (
    <label className="campo-linha campo-inline">
      <span className="campo-rot">{rotulo}</span>
      <span className="campo-pct">
        <input
          type="number"
          min="0"
          max="100"
          step="0.5"
          className="input-pct"
          value={valor}
          onChange={(e) => aoMudar(e.target.value)}
          aria-label={rotulo}
        />
        <span>%</span>
      </span>
    </label>
  )
}
