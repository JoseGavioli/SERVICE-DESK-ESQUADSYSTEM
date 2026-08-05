import { CampoFicha } from './FiCampo'

// Secao "Dados do cliente" (§#80): o que a ficha pede ALEM do nome (o nome
// vem do cliente escolhido no card acima — nao se digita duas vezes).
export default function FiDadosCliente({ ficha, mudar }) {
  return (
    <>
      <CampoFicha
        rotulo="CPF"
        inputMode="numeric"
        valor={ficha.cliente_cpf}
        aoMudar={(v) => mudar('cliente_cpf', v)}
      />
      <CampoFicha
        rotulo="RG"
        inputMode="numeric"
        valor={ficha.cliente_rg}
        aoMudar={(v) => mudar('cliente_rg', v)}
      />
      <CampoFicha
        rotulo="Data de nascimento"
        tipo="date"
        valor={ficha.cliente_data_nasc}
        aoMudar={(v) => mudar('cliente_data_nasc', v)}
      />
      <CampoFicha
        rotulo="Telefone"
        tipo="tel"
        valor={ficha.cliente_telefone1}
        aoMudar={(v) => mudar('cliente_telefone1', v)}
      />
      <CampoFicha
        rotulo="Telefone 2 (se houver)"
        tipo="tel"
        valor={ficha.cliente_telefone2}
        aoMudar={(v) => mudar('cliente_telefone2', v)}
      />
      <CampoFicha
        rotulo="E-mail"
        tipo="email"
        valor={ficha.cliente_email}
        aoMudar={(v) => mudar('cliente_email', v)}
      />
      <CampoFicha
        rotulo="Endereço"
        valor={ficha.cliente_endereco}
        aoMudar={(v) => mudar('cliente_endereco', v)}
      />
      <CampoFicha
        rotulo="CEP"
        inputMode="numeric"
        valor={ficha.cliente_cep}
        aoMudar={(v) => mudar('cliente_cep', v)}
      />
      <CampoFicha
        rotulo="Cidade/UF"
        placeholder="Itapetininga - SP"
        valor={ficha.cliente_cidade_uf}
        aoMudar={(v) => mudar('cliente_cidade_uf', v)}
      />
    </>
  )
}
