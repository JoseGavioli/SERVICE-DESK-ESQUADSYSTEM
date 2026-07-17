import CardCampo from './CardCampo'
import Calendario from './Calendario'
import { textoPrazo } from '../lib/novaDemanda'

// Card do Prazo (§issue #64). Agora e um card SANFONA como os outros: o toque
// expande um calendario DENTRO do card (Calendario), no lugar do calendario
// nativo do sistema, que abria flutuando por cima e destoava. Escolher o dia
// grava o prazo e fecha o card.
export default function NdPrazo({
  prazo,
  aoMudar,
  faltando,
  aberto,
  aoAlternar,
  aoFechar,
}) {
  return (
    <CardCampo
      id="card-prazo"
      icone="calendario"
      titulo="Prazo"
      subtitulo={prazo ? textoPrazo(prazo) : 'Escolher a data'}
      preenchido={Boolean(prazo)}
      faltando={faltando}
      aberto={aberto}
      aoClicar={aoAlternar}
    >
      <Calendario
        valor={prazo}
        aoEscolher={(iso) => {
          aoMudar(iso)
          aoFechar()
        }}
      />
    </CardCampo>
  )
}
