import { calcularUrgencia } from '../lib/urgencia'

// Selo colorido de urgencia. Nao renderiza nada em demanda terminal
// (enviado/cancelada), onde a urgencia nao se aplica.
export default function SeloUrgencia({ prazo, status }) {
  const u = calcularUrgencia(prazo, status)
  if (!u) return null

  const dica =
    u.diasUteis === null
      ? 'Prazo vencido'
      : `${u.diasUteis} dia(s) útil(eis) restante(s)`

  return (
    <span className={`urgencia urgencia-${u.nivel}`} title={dica}>
      {u.rotulo}
    </span>
  )
}
