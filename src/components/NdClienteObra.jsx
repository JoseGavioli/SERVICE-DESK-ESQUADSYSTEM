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
}) {
  // Sem obra a demanda NAO trava: cai na obra padrao do cliente (achar-ou-criar
  // na NovaDemanda). Dizemos isso aqui para o vendedor saber, ANTES de criar, o
  // que vai acontecer se ele nao mexer.
  function subtituloObra() {
    if (obra) return obra.nome
    if (!cliente) return 'Escolha o cliente primeiro'
    return `Obra de ${cliente.nome} (padrão)`
  }

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
        aoClicar={() => aoAlternar('cliente')}
      >
        <SeletorCliente aoSelecionar={aoEscolherCliente} />
      </CardCampo>

      <CardCampo
        id="card-obra"
        icone="predio"
        titulo="Obra"
        subtitulo={subtituloObra()}
        preenchido={Boolean(obra)}
        desabilitado={!cliente}
        aberto={aberto === 'obra'}
        aoClicar={() => aoAlternar('obra')}
      >
        {/* So monta o seletor com um cliente em maos: ele busca as obras DELE. */}
        {cliente && (
          <SeletorObra cliente={cliente} aoSelecionar={aoEscolherObra} />
        )}
      </CardCampo>
    </>
  )
}
