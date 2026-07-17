import { useState } from 'react'
import Icone from './Icone'

// Calendario inline, desenhado dentro do card do Prazo (§issue #64). Substitui o
// calendario NATIVO do sistema (showPicker), que abria flutuando por cima e
// destoava dos outros cards. Aqui a escolha da data acontece DENTRO do card,
// como o Tipo e a Origem.
//
// Sem dependencia (§5): e so uma grade de mes montada com o Date nativo.
//
// Acessibilidade: cada dia e um <button> alcancavel por Tab e o dia escolhido e
// anunciado no aria-label. NAO implementamos a navegacao por setas do padrao
// ARIA de date-picker (roving tabindex + Arrow*): e bastante codigo para um app
// mobile-first interno onde o uso e por toque; todos os dias ja sao alcancaveis
// e escolher um fecha o card. Fica registrado como decisao, nao esquecimento.

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
// Cabecalho dos dias da semana, comecando no domingo (getDay(): 0 = domingo).
const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

// (ano, mes 0-based, dia) -> "AAAA-MM-DD". Montamos a string pelos NUMEROS, nunca
// por new Date(...).toISOString(): o toISOString converte para UTC e, no nosso
// fuso, gravaria o dia ANTERIOR. Mesma armadilha que o textoPrazo evita.
function paraIso(ano, mes, dia) {
  const mm = String(mes + 1).padStart(2, '0')
  const dd = String(dia).padStart(2, '0')
  return `${ano}-${mm}-${dd}`
}

export default function Calendario({ valor, aoEscolher }) {
  // valor selecionado (se houver), lido pelos numeros -> [ano, mes(1-based), dia].
  const sel = valor ? valor.split('-').map(Number) : null
  const hoje = new Date()

  // Mes que aparece na tela: o do valor ja escolhido, senao o mes atual. Guardo o
  // 1o dia do mes (a navegacao anda de mes em mes a partir dele).
  const [mesVisivel, setMesVisivel] = useState(() =>
    sel
      ? new Date(sel[0], sel[1] - 1, 1)
      : new Date(hoje.getFullYear(), hoje.getMonth(), 1),
  )

  const ano = mesVisivel.getFullYear()
  const mes = mesVisivel.getMonth() // 0-based
  // Em que dia da semana o mes comeca (0 = domingo) -> quantas celulas vazias no inicio.
  const comecaEm = new Date(ano, mes, 1).getDay()
  // Dia 0 do mes SEGUINTE = ultimo dia deste mes (cobre fevereiro/ano bissexto sozinho).
  const totalDias = new Date(ano, mes + 1, 0).getDate()

  // O Date normaliza o estouro do mes: mes -1 vira dezembro do ano anterior, e
  // mes 12 vira janeiro do proximo — a virada de ano sai de graca.
  function andarMes(delta) {
    setMesVisivel(new Date(ano, mes + delta, 1))
  }

  const ehHoje = (dia) =>
    dia === hoje.getDate() &&
    mes === hoje.getMonth() &&
    ano === hoje.getFullYear()
  const ehSelecionado = (dia) =>
    sel && sel[0] === ano && sel[1] === mes + 1 && sel[2] === dia

  // Celulas: primeiro os vazios ate o dia certo da semana, depois os dias.
  const celulas = []
  for (let i = 0; i < comecaEm; i++) celulas.push(null)
  for (let d = 1; d <= totalDias; d++) celulas.push(d)

  return (
    <div className="calendario">
      <div className="cal-cabecalho">
        <button
          type="button"
          className="cal-nav"
          onClick={() => andarMes(-1)}
          aria-label="Mês anterior"
        >
          <Icone nome="chevron-esquerda" size={18} />
        </button>
        <span className="cal-mes">
          {MESES[mes]} {ano}
        </span>
        <button
          type="button"
          className="cal-nav"
          onClick={() => andarMes(1)}
          aria-label="Próximo mês"
        >
          <Icone nome="chevron-direita" size={18} />
        </button>
      </div>

      <div className="cal-grade">
        {DIAS_SEMANA.map((d, i) => (
          <span key={i} className="cal-dow">
            {d}
          </span>
        ))}
      </div>

      <div className="cal-grade">
        {celulas.map((dia, i) =>
          dia === null ? (
            <span key={i} className="cal-vazio" />
          ) : (
            <button
              key={i}
              type="button"
              className={`cal-dia${ehSelecionado(dia) ? ' sel' : ''}${
                ehHoje(dia) ? ' hoje' : ''
              }`}
              onClick={() => aoEscolher(paraIso(ano, mes, dia))}
              aria-label={`${dia} de ${MESES[mes]} de ${ano}${
                ehSelecionado(dia) ? ' (selecionado)' : ''
              }`}
              aria-pressed={ehSelecionado(dia)}
              aria-current={ehHoje(dia) ? 'date' : undefined}
            >
              {dia}
            </button>
          ),
        )}
      </div>
    </div>
  )
}
