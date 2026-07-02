// Calculo de URGENCIA a partir do prazo (§8). Feito na hora de exibir,
// entao muda sozinho com o passar do tempo (nao fica guardado no banco).
//
// LIMITES (n = dias uteis (seg-sex) de hoje ate o prazo; feriados ignorados, §8):
//   prazo ja passou -> Atrasado
//   n <= 1          -> Muito urgente (inclui "vence hoje", n = 0)
//   n = 2 ou 3      -> Urgente
//   n = 4 ou 5      -> Pouco urgente
//   n >= 6          -> Sem urgencia (+ de 5 dias uteis)
// Sao so estas constantes; mudar aqui muda o app inteiro.
const MUITO_MAX = 1 //   n <= 1 -> Muito urgente
const URGENTE_MAX = 3 // n <= 3 -> Urgente (n = 2 ou 3)
const POUCO_MAX = 5 //   n <= 5 -> Pouco urgente (n = 4 ou 5); n >= 6 -> Sem urgencia

// Niveis de urgencia, do mais critico ao menos (ordem usada na ordenacao
// e nos filtros). Exportado para reuso (ex.: dropdown de filtro).
export const URGENCIA_NIVEIS = [
  { nivel: 'atrasado', rotulo: 'Atrasado' },
  { nivel: 'muito_urgente', rotulo: 'Muito urgente' },
  { nivel: 'urgente', rotulo: 'Urgente' },
  { nivel: 'pouco_urgente', rotulo: 'Pouco urgente' },
  { nivel: 'sem_urgencia', rotulo: 'Sem urgência' },
]
const ROTULO = Object.fromEntries(URGENCIA_NIVEIS.map((u) => [u.nivel, u.rotulo]))

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
    return { nivel: 'atrasado', rotulo: ROTULO.atrasado, diasUteis: null }
  }

  const n = diasUteisEntre(hoje, prazo)
  let nivel
  if (n <= MUITO_MAX) nivel = 'muito_urgente'
  else if (n <= URGENTE_MAX) nivel = 'urgente'
  else if (n <= POUCO_MAX) nivel = 'pouco_urgente'
  else nivel = 'sem_urgencia'

  return { nivel, rotulo: ROTULO[nivel], diasUteis: n }
}

// ── CUSTO ATRASADO (em "em revisao de custo") ──────────────────────
// Uma demanda esta com o CUSTO ATRASADO quando ja passaram >= DIAS_CUSTO_ATRASADO
// dias UTEIS desde a 1a vez que entrou em 'em_revisao_custo' e ela ainda nao
// foi enviada nem cancelada. O relogio comeca na 1a entrada em revisao e NAO
// reseta se voltar para 'em_andamento'; so "zera" ao ser enviada (volta ao
// normal) ou cancelada (encerra). A data da 1a revisao vem do RPC
// datas_primeira_revisao (migracao 0019).
// (NAO confundir com a URGENCIA 'Atrasado', que e sobre o prazo do orcamento.)
const DIAS_CUSTO_ATRASADO = 5

export function estaCustoAtrasado(status, dataPrimeiraRevisaoIso) {
  if (!dataPrimeiraRevisaoIso) return false // nunca entrou em revisao de custo
  if (status === 'enviado' || status === 'cancelada') return false

  const de = new Date(dataPrimeiraRevisaoIso)
  de.setHours(0, 0, 0, 0)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  if (hoje <= de) return false

  return diasUteisEntre(de, hoje) >= DIAS_CUSTO_ATRASADO
}

// Dias uteis desde uma data (ISO) ate hoje. Usado no detalhe para mostrar
// "ha X dias uteis em revisao de custo" (§issue #13) — mesma conta do alerta.
export function diasUteisDesde(dataIso) {
  if (!dataIso) return null
  const de = new Date(dataIso)
  de.setHours(0, 0, 0, 0)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  if (hoje <= de) return 0
  return diasUteisEntre(de, hoje)
}
