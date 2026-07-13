import { urgenciaEfetiva } from '../lib/urgencia'

// Selo colorido de urgencia. Usa a urgencia EFETIVA (manual do gerente, se
// houver, senao a calculada pelo prazo). Nao renderiza em demanda terminal
// (enviado/cancelada), onde a urgencia nao se aplica.
export default function SeloUrgencia({ demanda }) {
  const u = urgenciaEfetiva(demanda)
  if (!u) return null

  const dica = u.manual
    ? 'Urgência definida manualmente'
    : u.diasUteis === null
      ? 'Prazo vencido'
      : `${u.diasUteis} dia(s) útil(eis) restante(s)`

  return (
    <span className={`urgencia urgencia-${u.nivel}`} title={dica}>
      {u.rotulo}
    </span>
  )
}
