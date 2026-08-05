import { CampoFicha, SimNaoFicha, PctFicha } from './FiCampo'

// Secao "Arquitetura e Engenharia" (§#80). O sim/nao + % da RT NAO sao
// colunas da ficha: gravam nos campos rt/rt_percentual que a demanda ja tem
// (uma fonte so — decisao da 0045). Dados bancarios/beneficiario sao da ficha.
export default function FiRt({ ficha, mudar }) {
  return (
    <>
      <SimNaoFicha
        rotulo="Tem RT?"
        valor={ficha.rt}
        aoMudar={(v) => mudar('rt', v)}
      />
      {ficha.rt && (
        <>
          <PctFicha
            rotulo="Porcentagem"
            valor={ficha.rt_percentual}
            aoMudar={(v) => mudar('rt_percentual', v)}
          />
          <CampoFicha
            rotulo="Dados bancários"
            valor={ficha.rt_dados_bancarios}
            aoMudar={(v) => mudar('rt_dados_bancarios', v)}
          />
          <CampoFicha
            rotulo="Nome do beneficiário"
            valor={ficha.rt_beneficiario}
            aoMudar={(v) => mudar('rt_beneficiario', v)}
          />
        </>
      )}
    </>
  )
}
