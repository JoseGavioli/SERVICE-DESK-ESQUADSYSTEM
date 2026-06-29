// Calculo de URGENCIA a partir do prazo (§8). Feito na hora de exibir,
// entao muda sozinho com o passar do tempo (nao fica guardado no banco).
//
// LIMITES (PROVISORIOS — a alinhar com os vendedores, §17 #1). Sao apenas
// estas duas constantes; mudar aqui muda o app inteiro.
//   n = dias uteis (seg-sex) de hoje ate o prazo (feriados ignorados, §8).
const TRANQUILO_MIN = 4 // n >= 4      -> Tranquilo
const URGENTE_MAX = 1 //   n <= 1      -> Urgente (inclui "vence hoje", n = 0)
//                          n = 2 ou 3 -> Pouco urgente
//                          prazo ja passou -> Muito urgente

const ROTULO = {
  tranquilo: 'Tranquilo',
  pouco_urgente: 'Pouco urgente',
  urgente: 'Urgente',
  muito_urgente: 'Muito urgente',
}

// 'YYYY-MM-DD' -> Date na meia-noite LOCAL. Fazemos manualmente para
// evitar o desvio de fuso (new Date('2026-06-30') seria interpretado
// como UTC e poderia "voltar" um dia no horario do Brasil).
function dataLocal(str) {
  const [ano, mes, dia] = str.split('-').map(Number)
  return new Date(ano, mes - 1, dia)
}

// Conta dias uteis APOS 'de' ate 'ate' (inclusive). Assume ate >= de.
function diasUteisEntre(de, ate) {
  let n = 0
  const cursor = new Date(de)
  while (cursor < ate) {
    cursor.setDate(cursor.getDate() + 1)
    const dia = cursor.getDay() // 0 = domingo ... 6 = sabado
    if (dia !== 0 && dia !== 6) n++
  }
  return n
}

// Retorna { nivel, rotulo, diasUteis } — ou null se a demanda esta em
// estado terminal (urgencia nao faz sentido em enviado/cancelada).
export function calcularUrgencia(prazoStr, status) {
  if (status === 'enviado' || status === 'cancelada') return null

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const prazo = dataLocal(prazoStr)

  if (prazo < hoje) {
    return { nivel: 'muito_urgente', rotulo: ROTULO.muito_urgente, diasUteis: null }
  }

  const n = diasUteisEntre(hoje, prazo)
  let nivel
  if (n >= TRANQUILO_MIN) nivel = 'tranquilo'
  else if (n <= URGENTE_MAX) nivel = 'urgente'
  else nivel = 'pouco_urgente'

  return { nivel, rotulo: ROTULO[nivel], diasUteis: n }
}
