import CardCampo from './CardCampo'
import SeletorCliente from './SeletorCliente'
import SeletorObra from './SeletorObra'

// Os cards de Cliente e Obra da Nova demanda (§issue #64). Ficam juntos porque
// sao acoplados: a obra e sempre DE um cliente, trocar o cliente zera a obra, e
// escolher o cliente encadeia direto para a obra.
//
// No modo DEMANDA-FILHA (§11) estes cards nem aparecem — a obra vem travada da
// demanda-pai, e quem mostra isso e a NovaDemanda.
export default function NdClienteObra({
  cliente,
  obra,
  aoEscolherCliente,
  aoEscolherObra,
  aberto,
  aoAlternar,
  faltandoCliente,
  faltandoObra,
  // Obra ANTIGA sem cidade (§#85 fase 3): o campo aparece aqui para ser
  // completado na hora, e a Nova demanda grava na obra ao criar.
  cidadeObra,
  aoMudarCidadeObra,
  faltandoCidade,
  sempreAberto, // desktop: campos expostos (§#83 B3)
}) {
  // A obra e OBRIGATORIA (§#85 fase 3) — nao existe mais a "obra padrao"
  // criada em silencio quando ninguem escolhia.
  // A cidade que VALE: a que a obra ja tem, ou a que o vendedor acabou de
  // digitar. Sem juntar as duas, o card fechado continuaria anunciando "falta
  // a cidade" depois de ela ter sido preenchida — e no celular esse subtitulo
  // e o unico resumo do que foi respondido.
  const cidadeEfetiva = obra?.cidade_estado || String(cidadeObra ?? '').trim()

  function subtituloObra() {
    if (obra) {
      return cidadeEfetiva
        ? `${obra.nome} · ${cidadeEfetiva}`
        : `${obra.nome} · falta a cidade`
    }
    if (!cliente) return 'Escolha o cliente primeiro'
    return 'Escolher a obra'
  }

  // Quem decide se o INPUT aparece e so o que esta GRAVADO na obra (35 das 36
  // no banco nao tem): o campo nao pode sumir enquanto a pessoa digita nele.
  const faltaCidadeNaObra = Boolean(obra) && !obra.cidade_estado

  return (
    <>
      <CardCampo
        id="card-cliente"
        icone="cliente"
        titulo="Cliente"
        subtitulo={cliente ? cliente.nome : 'Escolher o cliente'}
        preenchido={Boolean(cliente)}
        faltando={faltandoCliente}
        aberto={aberto === 'cliente'}
        sempreAberto={sempreAberto}
        aoClicar={() => aoAlternar('cliente')}
      >
        <SeletorCliente aoSelecionar={aoEscolherCliente} />
      </CardCampo>


      <CardCampo
        id="card-obra"
        icone="predio"
        titulo="Obra"
        subtitulo={subtituloObra()}
        preenchido={Boolean(obra) && Boolean(cidadeEfetiva)}
        faltando={faltandoObra || faltandoCidade}
        desabilitado={!cliente}
        aberto={aberto === 'obra'}
        sempreAberto={sempreAberto}
        aoClicar={() => aoAlternar('obra')}
      >
        {/* So monta o seletor com um cliente em maos: ele busca as obras DELE.
            No modo EXPOSTO (desktop) o card fica lado a lado com o de cliente:
            sem corpo nenhum ele viraria um toco de 60px ao lado de um card
            alto (achado da revisao) — entao explicamos a espera.
            `autoFoco` desligado no exposto: os dois seletores montam juntos e
            o ultimo ganharia o foco, pulando o campo de cliente. */}
        {cliente ? (
          <>
            <SeletorObra
              cliente={cliente}
              aoSelecionar={aoEscolherObra}
              autoFoco={!sempreAberto}
            />
            {/* Obra antiga sem cidade: completa aqui e a demanda grava na obra
                (o cadastro se completa conforme as obras voltam a ser usadas). */}
            {faltaCidadeNaObra && (
              <div className="nd-cidade-obra">
                <label htmlFor="campo-cidade-obra">
                  Cidade e estado de “{obra.nome}”
                </label>
                <input
                  id="campo-cidade-obra"
                  type="text"
                  placeholder="ex.: Tatuí - SP"
                  value={cidadeObra}
                  onChange={(e) => aoMudarCidadeObra(e.target.value)}
                  className={faltandoCidade ? 'falta' : undefined}
                />
                <p className="nd-cidade-dica">
                  Esta obra foi cadastrada antes deste campo existir. O que você
                  escrever aqui fica salvo nela.
                </p>
              </div>
            )}
          </>
        ) : (
          sempreAberto && (
            <p className="card-campo-espera">
              Escolha o cliente ao lado para ver as obras dele.
            </p>
          )
        )}
      </CardCampo>
    </>
  )
}
