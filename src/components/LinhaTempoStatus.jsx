import Icone from './Icone'
import { STATUS_ROTULO } from '../lib/status'

// Linha do tempo (stepper vertical) do fluxo da demanda — 5 passos SEMPRE:
// Não iniciado → Em andamento → Em revisão de custo → Concluído → Enviado.
// Casos especiais:
//  - congelado: pausa no passo "Em andamento" (tag ❄ congelado);
//  - cancelada: terminal de falha — bloco vermelho no lugar do stepper.
const PASSOS = [
  'nao_iniciado',
  'em_andamento',
  'em_revisao_custo',
  'concluido',
  'enviado',
]

// Ate qual passo (indice) a demanda chegou, por status.
const INDICE = {
  nao_iniciado: 0,
  em_andamento: 1,
  congelado: 1,
  em_revisao_custo: 2,
  concluido: 3,
  enviado: 4,
}

export default function LinhaTempoStatus({ status, diasRevisao }) {
  // Cancelada: terminal de falha — bloco vermelho.
  if (status === 'cancelada') {
    return (
      <div className="linha-tempo-cancelada">
        <span className="lt-no-cancel">
          <Icone nome="cancelado" size={18} />
        </span>
        <div className="lt-texto">
          <strong>Cancelada</strong>
          <span className="lt-sub">Demanda encerrada por cancelamento.</span>
        </div>
      </div>
    )
  }

  const alcancado = INDICE[status] ?? 0
  const enviado = status === 'enviado'
  const congelado = status === 'congelado'

  return (
    <ol className="linha-tempo">
      {PASSOS.map((p, i) => {
        // "feito" = passos anteriores; o proprio "Enviado" tambem conta.
        const feito = i < alcancado || (enviado && i === alcancado)
        const atual = i === alcancado && !enviado
        const sucesso = p === 'enviado' && enviado
        const estado = sucesso
          ? 'sucesso'
          : feito
            ? 'feito'
            : atual
              ? 'atual'
              : 'futuro'
        return (
          <li key={p} className={`lt-passo lt-${estado}`}>
            <span className="lt-no">
              {feito || sucesso ? (
                <Icone nome="check" size={15} strokeWidth={3} />
              ) : (
                <span className="lt-ponto" />
              )}
            </span>
            <div className="lt-texto">
              <strong>{STATUS_ROTULO[p]}</strong>
              {atual && congelado && p === 'em_andamento' && (
                <span className="lt-congelado">
                  <Icone nome="neve" size={13} /> congelado
                </span>
              )}
              {atual && p === 'em_revisao_custo' && diasRevisao != null && (
                <span className={`lt-sub ${diasRevisao >= 5 ? 'atrasado' : ''}`}>
                  {diasRevisao === 0
                    ? 'desde hoje'
                    : `há ${diasRevisao} ${
                        diasRevisao === 1 ? 'dia útil' : 'dias úteis'
                      }`}
                  {diasRevisao >= 5 && ' — custo atrasado'}
                </span>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
