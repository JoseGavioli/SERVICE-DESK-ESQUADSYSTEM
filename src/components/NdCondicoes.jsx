// Miolo do card "Condições comerciais" da Nova demanda (§issue #64).
//
// O CLUB CASA saiu daqui (decisao do dono): ele ja e uma das ORIGENS, e
// perguntar de novo abria a porta para a demanda dizer "veio do Club Casa" e
// "nao e Club Casa" ao mesmo tempo. Hoje o campo `club_casa` e DERIVADO da
// origem, na hora de salvar. O toggle que era dele passou para a RT.
export default function NdCondicoes({
  rt,
  aoMudarRt,
  rtPercentual,
  aoMudarPercentual,
  arquiteto,
  aoMudarArquiteto,
}) {
  return (
    <>
      <label className="campo-linha campo-inline">
        <span className="campo-rot">Tem RT?</span>
        <input
          type="checkbox"
          className="campo-check"
          checked={rt}
          onChange={(e) => aoMudarRt(e.target.checked)}
        />
      </label>

      {/* A % so aparece se tem RT — e ai vira obrigatoria (validada no pai). */}
      {rt && (
        <label className="campo-linha campo-inline">
          <span className="campo-rot">Porcentagem</span>
          <span className="campo-pct">
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              className="input-pct"
              value={rtPercentual}
              onChange={(e) => aoMudarPercentual(e.target.value)}
              aria-label="Porcentagem da RT"
            />
            <span>%</span>
          </span>
        </label>
      )}

      <label className="campo-linha">
        <span className="campo-rot">
          Arquiteto/engenheiro <em>(se houver)</em>
        </span>
        <input
          type="text"
          value={arquiteto}
          onChange={(e) => aoMudarArquiteto(e.target.value)}
        />
      </label>
    </>
  )
}
