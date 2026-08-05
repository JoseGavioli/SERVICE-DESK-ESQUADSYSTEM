import { CampoFicha, SimNaoFicha, PctFicha } from './FiCampo'

// Secao "Arquitetura e Engenharia" (§#80). O sim/nao + % da RT NAO sao
// colunas da ficha: gravam nos campos rt/rt_percentual que a demanda ja tem
// (uma fonte so — decisao da 0045). Dados bancarios/beneficiario sao da ficha.
//
// `rtTravada` (edicao, §F3): depois de criada, a RT pertence a demanda e nao
// ha caminho de update direto nela (RLS: todo update de demanda passa por
// funcao) — o toggle e a % ficam travados; o resto da secao segue editavel.
export default function FiRt({ ficha, mudar, rtTravada }) {
  return (
    <>
      <SimNaoFicha
        rotulo="Tem RT?"
        valor={ficha.rt}
        aoMudar={(v) => mudar('rt', v)}
        desabilitado={rtTravada}
      />
      {ficha.rt && (
        <>
          <PctFicha
            rotulo="Porcentagem"
            valor={ficha.rt_percentual}
            aoMudar={(v) => mudar('rt_percentual', v)}
            desabilitado={rtTravada}
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
      {rtTravada && (
        <p className="nd-dica">
          A RT (sim/não e %) é da demanda e foi definida na criação — aqui só
          os dados bancários e o beneficiário podem mudar.
        </p>
      )}
    </>
  )
}
