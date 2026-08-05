import { CampoFicha, SimNaoFicha } from './FiCampo'

// Secao "Pedido" da ficha (§#80): data, proposta, valor, pagamento e NF.
export default function FiPedido({ ficha, mudar }) {
  return (
    <>
      <CampoFicha
        rotulo="Data do pedido"
        tipo="date"
        valor={ficha.data_pedido}
        aoMudar={(v) => mudar('data_pedido', v)}
      />
      <CampoFicha
        rotulo="Nº da proposta"
        valor={ficha.num_proposta}
        aoMudar={(v) => mudar('num_proposta', v)}
      />
      <CampoFicha
        rotulo="Valor (R$)"
        inputMode="decimal"
        placeholder="45.000,00"
        valor={ficha.valor}
        aoMudar={(v) => mudar('valor', v)}
      />
      <CampoFicha
        rotulo="Forma de pagamento"
        valor={ficha.forma_pagamento}
        aoMudar={(v) => mudar('forma_pagamento', v)}
      />
      <CampoFicha
        rotulo="Forma de envio de cobrança"
        valor={ficha.envio_cobranca}
        aoMudar={(v) => mudar('envio_cobranca', v)}
      />
      <SimNaoFicha
        rotulo="Com NF?"
        valor={ficha.com_nf}
        aoMudar={(v) => mudar('com_nf', v)}
      />
      <SimNaoFicha
        rotulo="Com ½ NF?"
        valor={ficha.com_meia_nf}
        aoMudar={(v) => mudar('com_meia_nf', v)}
      />
    </>
  )
}
