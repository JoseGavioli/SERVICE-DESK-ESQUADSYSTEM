// Gráfico de pizza "Origem das demandas" (gerente/admin). SVG montado na mão,
// SEM dependência (§5) — como os anéis do Dashboard. Cores: paleta CATEGÓRICA
// validada (skill dataviz), uma por origem. Abaixo, a tabela com as contagens
// (é o "relief" que substitui a cor sozinha — identidade nunca é só cor).

// Ordem e cor fixas por origem (a cor SEGUE a origem, nunca o tamanho da fatia).
const COR = {
  Marketing: 'var(--org-marketing)',
  'Club Casa': 'var(--org-clubcasa)',
  Indicação: 'var(--org-indicacao)',
  Balcão: 'var(--org-balcao)',
  Instagram: 'var(--org-instagram)',
  'Sem origem': 'var(--org-sem)',
}

// (cx, cy, r, ângulo em graus, 0 = topo) -> ponto na borda do círculo.
function pontoBorda(cx, cy, r, graus) {
  const rad = ((graus - 90) * Math.PI) / 180
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]
}

// itens: [{ origem, count }] já na ordem e só com count > 0.
export default function PizzaOrigens({ itens }) {
  const total = itens.reduce((s, i) => s + i.count, 0)
  if (total === 0) return null

  const cx = 50
  const cy = 50
  const r = 46
  const umaSo = itens.length === 1

  let acumulado = 0
  const fatias = itens.map((it) => {
    const inicio = (acumulado / total) * 360
    acumulado += it.count
    const fim = (acumulado / total) * 360
    const [x1, y1] = pontoBorda(cx, cy, r, inicio)
    const [x2, y2] = pontoBorda(cx, cy, r, fim)
    const arcoGrande = fim - inicio > 180 ? 1 : 0
    const d = `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${arcoGrande} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`
    return { origem: it.origem, count: it.count, d }
  })

  return (
    <div className="pizza-wrap">
      <svg
        className="pizza"
        viewBox="0 0 100 100"
        role="img"
        aria-label="Demandas por origem"
      >
        {/* Uma origem só = círculo cheio (o path de fatia degeneraria). O
            stroke na cor da superfície cria o vão de 2px entre as fatias. */}
        {umaSo ? (
          <circle cx={cx} cy={cy} r={r} fill={COR[itens[0].origem]} />
        ) : (
          fatias.map((f) => (
            <path
              key={f.origem}
              d={f.d}
              fill={COR[f.origem]}
              stroke="var(--surface)"
              strokeWidth="1.5"
            />
          ))
        )}
      </svg>

      <table className="pizza-tabela">
        <tbody>
          {itens.map((it) => (
            <tr key={it.origem}>
              <th scope="row">
                <span
                  className="pizza-cor"
                  style={{ background: COR[it.origem] }}
                  aria-hidden="true"
                />
                {it.origem}
              </th>
              <td className="pizza-num">{it.count}</td>
              <td className="pizza-pct">
                {Math.round((it.count / total) * 100)}%
              </td>
            </tr>
          ))}
          <tr className="pizza-total">
            <th scope="row">Total</th>
            <td className="pizza-num">{total}</td>
            <td className="pizza-pct">100%</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
