import { CampoFicha } from './FiCampo'

// Secao "Dados da obra" (§#80): contato do mestre de obra + endereco. Sao
// dados DA FICHA (retrato do pedido) — a entidade `obra` do app so tem
// nome/endereco e continua como esta.
export default function FiDadosObra({ ficha, mudar }) {
  return (
    <>
      <CampoFicha
        rotulo="Mestre de obra"
        valor={ficha.mestre_obra}
        aoMudar={(v) => mudar('mestre_obra', v)}
      />
      <CampoFicha
        rotulo="Telefone"
        tipo="tel"
        valor={ficha.obra_telefone}
        aoMudar={(v) => mudar('obra_telefone', v)}
      />
      <CampoFicha
        rotulo="E-mail"
        tipo="email"
        valor={ficha.obra_email}
        aoMudar={(v) => mudar('obra_email', v)}
      />
      <CampoFicha
        rotulo="Endereço"
        valor={ficha.obra_endereco}
        aoMudar={(v) => mudar('obra_endereco', v)}
      />
      <CampoFicha
        rotulo="Bairro"
        valor={ficha.obra_bairro}
        aoMudar={(v) => mudar('obra_bairro', v)}
      />
      <CampoFicha
        rotulo="CEP"
        inputMode="numeric"
        valor={ficha.obra_cep}
        aoMudar={(v) => mudar('obra_cep', v)}
      />
      <CampoFicha
        rotulo="Cidade/UF"
        placeholder="Itapetininga - SP"
        valor={ficha.obra_cidade_uf}
        aoMudar={(v) => mudar('obra_cidade_uf', v)}
      />
    </>
  )
}
