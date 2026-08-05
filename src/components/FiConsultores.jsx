import { CampoFicha, PctFicha } from './FiCampo'

// Secao "Consultores e comissao" (§#80): o 1º consultor e SEMPRE o vendedor
// dono da demanda (nome travado — so a % dele e digitavel) + ate 2 extras,
// como os 3 pares nome+% do papel.
export default function FiConsultores({ ficha, mudar, nomeVendedor }) {
  return (
    <>
      <p className="fi-consultor-fixo">
        <strong>{nomeVendedor}</strong>
        <span> — consultor responsável</span>
      </p>
      <PctFicha
        rotulo="Comissão"
        valor={ficha.comissao_pct}
        aoMudar={(v) => mudar('comissao_pct', v)}
      />
      <CampoFicha
        rotulo="2º consultor (se houver)"
        valor={ficha.consultor2_nome}
        aoMudar={(v) => mudar('consultor2_nome', v)}
      />
      {String(ficha.consultor2_nome).trim() !== '' && (
        <PctFicha
          rotulo="Comissão do 2º"
          valor={ficha.consultor2_pct}
          aoMudar={(v) => mudar('consultor2_pct', v)}
        />
      )}
      <CampoFicha
        rotulo="3º consultor (se houver)"
        valor={ficha.consultor3_nome}
        aoMudar={(v) => mudar('consultor3_nome', v)}
      />
      {String(ficha.consultor3_nome).trim() !== '' && (
        <PctFicha
          rotulo="Comissão do 3º"
          valor={ficha.consultor3_pct}
          aoMudar={(v) => mudar('consultor3_pct', v)}
        />
      )}
    </>
  )
}
