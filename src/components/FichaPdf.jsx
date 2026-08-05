import { useEffect } from 'react'
import Icone from './Icone'

// PRE-VISUALIZACAO DE IMPRESSAO da ficha de pedido de vendas (§#80, F4).
// Replica fiel do papel, preenchida com os dados; "Imprimir / Salvar PDF"
// chama window.print() — o navegador salva como PDF (mesmo caminho, sem
// dependencia, do Relatorio mensal §18). No print, o CSS esconde tudo e
// deixa so a folha (.fp-folha), em 1 pagina A4.
//
// Campo vazio fica EM BRANCO, como no papel — a ficha tambem circula
// incompleta. As assinaturas ficam em branco de proposito (assina-se no
// papel impresso).

// "2026-08-05" -> "05/08/2026" (sem new Date: ISO e lido como UTC).
function dataBr(iso) {
  return iso ? iso.split('-').reverse().join('/') : ''
}

// Caixinhas Nao/Sim do papel, marcadas conforme o booleano.
function NaoSim({ valor }) {
  return (
    <span className="fp-naosim">
      <span>{valor ? '☐' : '☒'} Não</span>
      <span>{valor ? '☒' : '☐'} Sim</span>
    </span>
  )
}

export default function FichaPdf({
  ficha,
  demanda,
  nomeVendedor,
  aoVoltar,
}) {
  // Marca o <body> enquanto a folha esta na tela: o @media print usa esta
  // classe para ESCOPAR o "esconde tudo, mostra so a folha" — sem ela, o
  // print do RELATORIO mensal (que tem CSS proprio) sairia em branco.
  useEffect(() => {
    document.body.classList.add('body-imprime-ficha')
    return () => document.body.classList.remove('body-imprime-ficha')
  }, [])

  const pct = (v) => (String(v ?? '').trim() ? `${String(v).trim()}%` : '')

  // iPhone com o PWA INSTALADO (standalone): o WebKit IGNORA window.print()
  // — o botao seria mudo (achado da revisao; mesma limitacao ja existia no
  // Relatorio). Mostramos a saida que funciona em vez de um botao morto.
  const semPrint =
    typeof navigator !== 'undefined' && navigator.standalone === true

  return (
    <div className="fp-tela">
      {/* Barra da TELA (nao sai na impressao). */}
      <div className="fp-acoes nao-imprimir">
        <button type="button" className="btn-circular" onClick={aoVoltar} aria-label="Voltar" title="Voltar">
          <Icone nome="voltar" size={20} />
        </button>
        {semPrint ? (
          <p className="fp-dica-ios">
            No iPhone, abra o app pelo <strong>Safari</strong> para imprimir /
            salvar o PDF (o app instalado não imprime).
          </p>
        ) : (
          <button type="button" className="fp-imprimir" onClick={() => window.print()}>
            <Icone nome="arquivo" size={16} /> Imprimir / Salvar PDF
          </button>
        )}
      </div>

      <div className="fp-folha">
        {/* Cabecalho: logo + titulo */}
        <div className="fp-cabecalho">
          <img src="/logo-esquadsystem-h.svg" alt="EsquadSystem" className="fp-logo" />
          <h1 className="fp-titulo">FICHA DE PEDIDO DE VENDAS</h1>
        </div>

        <div className="fp-grade">
          {/* Consultores e comissao (3 pares nome+%, como no papel) */}
          <div className="fp-linha">
            <span className="fp-cel fp-faixa-meia">Consultor de Vendas e Comissão</span>
            <span className="fp-cel fp-cresce"><b>Nome:</b> {nomeVendedor}</span>
            <span className="fp-cel fp-pctcel">{pct(ficha.comissao_pct)}</span>
          </div>
          <div className="fp-linha">
            <span className="fp-cel fp-cresce"><b>Nome:</b> {ficha.consultor2_nome}</span>
            <span className="fp-cel fp-pctcel">{pct(ficha.consultor2_pct)}</span>
            <span className="fp-cel fp-cresce"><b>Nome:</b> {ficha.consultor3_nome}</span>
            <span className="fp-cel fp-pctcel">{pct(ficha.consultor3_pct)}</span>
          </div>

          <div className="fp-linha">
            <span className="fp-cel fp-cresce"><b>Data:</b> {dataBr(ficha.data_pedido)}</span>
            <span className="fp-cel fp-cresce"><b>Nº Proposta:</b> {ficha.num_proposta}</span>
            <span className="fp-cel fp-cresce"><b>Valor:</b> {String(ficha.valor).trim() ? `R$ ${ficha.valor}` : ''}</span>
          </div>

          <div className="fp-linha">
            <span className="fp-cel fp-cresce fp-alto">
              <b>Forma de pagamento:</b> {ficha.forma_pagamento}
              <br />
              <em>* favor especificar forma de envio de cobrança:</em>{' '}
              {ficha.envio_cobranca}
            </span>
          </div>
          <div className="fp-linha">
            <span className="fp-cel fp-cresce fp-centro">
              <b>Com NF :</b> <NaoSim valor={ficha.com_nf} />
              <span className="fp-espaco" />
              <b>Com 1/2 NF :</b> <NaoSim valor={ficha.com_meia_nf} />
            </span>
          </div>

          {/* Dados Cliente */}
          <div className="fp-linha"><span className="fp-cel fp-faixa">Dados Cliente:</span></div>
          <div className="fp-linha">
            <span className="fp-cel fp-cresce3"><b>Nome do Cliente:</b> {demanda.obra?.cliente?.nome}</span>
            <span className="fp-cel fp-cresce"><b>Data Nasc:</b> {dataBr(ficha.cliente_data_nasc)}</span>
          </div>
          <div className="fp-linha">
            <span className="fp-cel fp-cresce"><b>Endereço:</b> {ficha.cliente_endereco}</span>
          </div>
          <div className="fp-linha">
            <span className="fp-cel fp-cresce"><b>Telefone:</b> {ficha.cliente_telefone1}</span>
            <span className="fp-cel fp-cresce"><b>CEP:</b> {ficha.cliente_cep}</span>
            <span className="fp-cel fp-cresce"><b>Cidade/UF:</b> {ficha.cliente_cidade_uf}</span>
          </div>
          <div className="fp-linha">
            <span className="fp-cel fp-cresce"><b>CPF:</b> {ficha.cliente_cpf}</span>
            <span className="fp-cel fp-cresce"><b>RG:</b> {ficha.cliente_rg}</span>
          </div>
          <div className="fp-linha">
            <span className="fp-cel fp-cresce"><b>Telefone:</b> {ficha.cliente_telefone2}</span>
            <span className="fp-cel fp-cresce"><b>E-mail:</b> {ficha.cliente_email}</span>
          </div>

          {/* Arquitetura e Engenharia */}
          <div className="fp-linha"><span className="fp-cel fp-faixa">Arquitetura e Engenharia</span></div>
          <div className="fp-linha">
            <span className="fp-cel fp-cresce fp-centro">
              <b>RT:</b> <NaoSim valor={Boolean(demanda.rt)} />
              {demanda.rt && demanda.rt_percentual != null && (
                <span className="fp-espaco-p">{demanda.rt_percentual}%</span>
              )}
            </span>
          </div>
          <div className="fp-linha">
            <span className="fp-cel fp-cresce"><b>Dados Bancários:</b> {ficha.rt_dados_bancarios}</span>
          </div>
          <div className="fp-linha">
            <span className="fp-cel fp-cresce"><b>Nome do Beneficiário:</b> {ficha.rt_beneficiario}</span>
          </div>

          {/* Dados da Obra */}
          <div className="fp-linha"><span className="fp-cel fp-faixa">Dados da Obra</span></div>
          <div className="fp-linha">
            <span className="fp-cel fp-cresce"><b>Mestre de Obra:</b> {ficha.mestre_obra}</span>
          </div>
          <div className="fp-linha">
            <span className="fp-cel fp-cresce"><b>Telefone:</b> {ficha.obra_telefone}</span>
            <span className="fp-cel fp-cresce"><b>E-mail:</b> {ficha.obra_email}</span>
          </div>
          <div className="fp-linha">
            <span className="fp-cel fp-cresce3"><b>Endereço:</b> {ficha.obra_endereco}</span>
            <span className="fp-cel fp-cresce"><b>Bairro:</b> {ficha.obra_bairro}</span>
          </div>
          <div className="fp-linha">
            <span className="fp-cel fp-cresce"><b>CEP:</b> {ficha.obra_cep}</span>
            <span className="fp-cel fp-cresce"><b>Cidade/UF:</b> {ficha.obra_cidade_uf}</span>
          </div>

          {/* Medicao p/ contramarco */}
          <div className="fp-linha"><span className="fp-cel fp-faixa">CONDIÇÃO DE MEDIÇÃO PARA CONTRAMARCO</span></div>
          <div className="fp-linha">
            <span className="fp-cel fp-cresce fp-alto"><b>Observações:</b> {ficha.medicao_contramarco}</span>
          </div>

          {/* Particularidades */}
          <div className="fp-linha">
            <span className="fp-cel fp-faixa">INFORMAR PARTICULARIDADES DA OBRA QUE NECESSITAM DE ATENÇÃO ESPECIAL</span>
          </div>
          <div className="fp-linha">
            <span className="fp-cel fp-cresce"><b>Fiscal de Obra:</b> {ficha.fiscal_obra}</span>
            <span className="fp-cel fp-cresce3 fp-alto"><b>Obs:</b> {ficha.particularidades}</span>
          </div>

          {/* Vigencia */}
          <div className="fp-linha"><span className="fp-cel fp-faixa">VIGÊNCIA DO CONTRATO</span></div>
          <div className="fp-linha">
            <span className="fp-cel fp-cresce"><b>Contramarcos:</b> {ficha.vig_contramarcos}</span>
            <span className="fp-cel fp-cresce"><b>Domus:</b> {ficha.vig_domus}</span>
          </div>
          <div className="fp-linha">
            <span className="fp-cel fp-cresce"><b>Esquadrias:</b> {ficha.vig_esquadrias}</span>
            <span className="fp-cel fp-cresce"><b>Brises:</b> {ficha.vig_brises}</span>
          </div>
          <div className="fp-linha">
            <span className="fp-cel fp-cresce"><b>Guarda Corpo:</b> {ficha.vig_guarda_corpo}</span>
            <span className="fp-cel fp-cresce" />
          </div>

          {/* Assinaturas (em branco: assina-se no papel) */}
          <div className="fp-linha">
            <span className="fp-cel fp-faixa">CIENTES E DE ACORDO ASSINAM ABAIXO AS PARTES RESPONSÁVEIS</span>
          </div>
          <div className="fp-linha">
            <span className="fp-cel fp-cresce fp-assinatura"><b>Gerente:</b></span>
            <span className="fp-cel fp-cresce fp-assinatura"><b>Consultores:</b></span>
          </div>
        </div>

        <div className="fp-rodape">
          <div>ESQUAD SYSTEM PVC E ALUMINIO LTDA</div>
          <div>Avenida Doutor José Ozi, 143 Vila Nova Itapetininga, Itapetininga - SP CEP 18203-265</div>
        </div>
      </div>
    </div>
  )
}
