import { CampoFicha } from './FiCampo'

// Secao "Vigencia do contrato" (§#80): texto livre porque os formatos variam
// no papel (datas, "30 dias", "conforme cronograma"...).
export default function FiVigencia({ ficha, mudar }) {
  return (
    <>
      <CampoFicha
        rotulo="Contramarcos"
        valor={ficha.vig_contramarcos}
        aoMudar={(v) => mudar('vig_contramarcos', v)}
      />
      <CampoFicha
        rotulo="Esquadrias"
        valor={ficha.vig_esquadrias}
        aoMudar={(v) => mudar('vig_esquadrias', v)}
      />
      <CampoFicha
        rotulo="Domus"
        valor={ficha.vig_domus}
        aoMudar={(v) => mudar('vig_domus', v)}
      />
      <CampoFicha
        rotulo="Brises"
        valor={ficha.vig_brises}
        aoMudar={(v) => mudar('vig_brises', v)}
      />
      <CampoFicha
        rotulo="Guarda-corpo"
        valor={ficha.vig_guarda_corpo}
        aoMudar={(v) => mudar('vig_guarda_corpo', v)}
      />
    </>
  )
}
