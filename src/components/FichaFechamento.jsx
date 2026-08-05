import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { enviarAnexo } from '../lib/anexos'
import { obterOuCriarObraPadrao } from '../lib/obraPadrao'
import {
  DESCRICAO_PADRAO_FECHAMENTO,
  montarInsertFicha,
  numeroInput,
  subPedido,
  subConsultores,
  subDadosCliente,
  subRt,
  subDadosObra,
  subVigencia,
} from '../lib/ficha'
import { resumir } from '../lib/novaDemanda'
import CardCampo from './CardCampo'
import NdCabecalho from './NdCabecalho'
import NdClienteObra from './NdClienteObra'
import FiPedido from './FiPedido'
import FiConsultores from './FiConsultores'
import FiDadosCliente from './FiDadosCliente'
import FiRt from './FiRt'
import FiDadosObra from './FiDadosObra'
import FiVigencia from './FiVigencia'
import Icone from './Icone'

// Tela da FICHA DE PEDIDO DE VENDAS (§issue #80). Abre quando o vendedor toca
// em "Preencher ficha" na Nova demanda com tipo de fechamento. Mesma linguagem
// do form: hero + cards fechados (um aberto por vez) + barra fixa no rodape.
//
// O estado do CLIENTE/OBRA e da FICHA vive na NovaDemanda (vem por props):
// assim, voltar para ajustar prazo/anexos e retornar NAO perde o que ja foi
// digitado aqui. Este componente desenha os cards e SALVA (demanda -> ficha ->
// anexos, nesta ordem — a ficha precisa do id da demanda).
export default function FichaFechamento({
  perfil,
  base, // { tipoId, prazo, infoAdicional, arquivos, proprietario, demandaPaiId, origemHerdada }
  cliente,
  aoEscolherCliente,
  obra,
  aoEscolherObra,
  ficha,
  aoMudarFicha,
  ehFilha,
  obraFixa,
  demandaPai,
  aoVoltar,
  aoCriar,
  naoLidas,
  aoAbrirNotif,
}) {
  const [aberto, setAberto] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [tentou, setTentou] = useState(false)

  // 1º consultor = o dono da demanda (o proprietario que o admin escolheu, ou
  // quem esta criando).
  const nomeVendedor =
    base.proprietario?.nome_completo ?? perfil.nome_completo ?? '—'

  function mudar(campo, valor) {
    aoMudarFicha({ ...ficha, [campo]: valor })
  }

  function alternar(id) {
    setAberto((atual) => (atual === id ? null : id))
  }

  // Mesmo guarda da Nova demanda: Enter em <input> nao pode submeter o form.
  function impedirEnvioPorEnter(e) {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') e.preventDefault()
  }

  const faltaCliente = !ehFilha && !cliente

  async function salvar(evento) {
    evento.preventDefault()
    setErro('')

    // Da ficha, so o CLIENTE e obrigatorio (e o que liga a demanda ao
    // historico); o resto e opcional como no papel — o staff completa depois.
    if (faltaCliente) {
      setTentou(true)
      document
        .getElementById('card-cliente')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    setSalvando(true)

    // Obra: a fixa (filha), a escolhida, ou "Obra de {cliente}" (achar-ou-criar).
    let obraId = obraFixa?.id ?? obra?.id
    if (!obraId) {
      obraId = await obterOuCriarObraPadrao(cliente)
      if (!obraId) {
        setErro('Não foi possível criar a obra padrão do cliente.')
        setSalvando(false)
        return
      }
    }

    // 1) A demanda. Origem: null no fechamento normal (o card nem aparece);
    //    herdada do pai quando e filha. RT sim/nao + % vem da FICHA e grava
    //    nos campos que a demanda ja tem (0045). Sem "Informacao adicional",
    //    entra o texto padrao (a descricao e obrigatoria no banco).
    const origem = base.origemHerdada ?? null
    const { data, error } = await supabase
      .from('demanda')
      .insert({
        obra_id: obraId,
        tipo_demanda_id: Number(base.tipoId),
        origem,
        descricao: base.infoAdicional.trim() || DESCRICAO_PADRAO_FECHAMENTO,
        prazo: base.prazo,
        demanda_pai_id: base.demandaPaiId ?? null,
        club_casa: origem === 'Club Casa',
        rt: ficha.rt,
        // numeroInput: a % vem de <input type="number"> (value com ponto).
        rt_percentual: ficha.rt ? numeroInput(ficha.rt_percentual) : null,
        // Na filha, o arquiteto herdado do pai e preservado (a ficha nao tem
        // campo p/ nome de arquiteto; no fechamento normal vai null mesmo).
        arquiteto_engenheiro: base.arquitetoHerdado ?? null,
        ...(base.proprietario ? { vendedor_id: base.proprietario.id } : {}),
      })
      .select('id')
      .single()

    if (error) {
      setErro('Não foi possível criar a demanda.')
      setSalvando(false)
      return
    }

    // 2) A ficha (precisa do id da demanda). Se falhar, a demanda ja existe —
    //    avisamos e seguimos (mesmo padrao dos anexos): melhor uma demanda sem
    //    ficha visivel para o staff do que o vendedor perder tudo digitado.
    const ins = await supabase
      .from('ficha_fechamento')
      .insert(montarInsertFicha(ficha, data.id))
    if (ins.error) {
      window.alert(
        'Demanda criada, mas a ficha não pôde ser salva. Avise o administrador para preenchê-la pelo sistema.',
      )
    }

    // 3) Anexos de entrada (ja comprimidos na escolha).
    let falhou = false
    for (const f of base.arquivos) {
      const r = await enviarAnexo(data.id, 'entrada', f)
      if (r.error) falhou = true
    }

    setSalvando(false)
    if (falhou) {
      window.alert(
        'Demanda criada, mas um ou mais anexos falharam. Você pode anexá-los abrindo o detalhe da demanda.',
      )
    }
    aoCriar(data.id)
  }

  return (
    <>
      <form
        id="form-ficha"
        className="nova-demanda"
        onSubmit={salvar}
        onKeyDown={impedirEnvioPorEnter}
      >
        <NdCabecalho
          comHero
          titulo="Ficha de pedido de vendas"
          aoCancelar={aoVoltar}
          naoLidas={naoLidas}
          aoAbrirNotif={aoAbrirNotif}
        />

        <div className="nd-cards">
          {ehFilha ? (
            /* Filha: cliente/obra herdados da demanda-pai — so mostramos. */
            <div className="nd-vinculada">
              <span className="nd-vinculada-icone">
                <Icone nome="seta-filha" size={20} />
              </span>
              <span className="nd-vinculada-texto">
                <span className="nd-vinculada-rot">Fechamento vinculado a</span>
                <strong className="nd-vinculada-dem">
                  {demandaPai?.codigo ? `#${demandaPai.codigo} — ` : ''}
                  {demandaPai?.cliente ?? obraFixa?.nome}
                </strong>
                <span className="nd-vinculada-obra">
                  {demandaPai?.obra ?? obraFixa?.nome}
                </span>
              </span>
            </div>
          ) : (
            /* "Nome do Cliente" da ficha = o seletor busca-primeiro de sempre
               (anti-duplicata, §6) — e o unico obrigatorio da ficha. */
            <NdClienteObra
              cliente={cliente}
              obra={obra}
              aoEscolherCliente={(c) => {
                aoEscolherCliente(c)
                setAberto('obra') // encadeia: escolheu o cliente, vai na obra
              }}
              aoEscolherObra={(o) => {
                aoEscolherObra(o)
                setAberto(null)
              }}
              aberto={aberto}
              aoAlternar={alternar}
              faltandoCliente={tentou && faltaCliente}
            />
          )}

          <CardCampo
            id="card-fi-pedido"
            icone="arquivo"
            titulo="Pedido"
            subtitulo={subPedido(ficha)}
            preenchido={Boolean(
              String(ficha.num_proposta).trim() || String(ficha.valor).trim(),
            )}
            aberto={aberto === 'fi-pedido'}
            aoClicar={() => alternar('fi-pedido')}
          >
            <FiPedido ficha={ficha} mudar={mudar} />
          </CardCampo>

          <CardCampo
            id="card-fi-consultores"
            icone="percentual"
            titulo="Consultores e comissão"
            subtitulo={subConsultores(ficha, nomeVendedor)}
            preenchido={String(ficha.comissao_pct).trim() !== ''}
            aberto={aberto === 'fi-consultores'}
            aoClicar={() => alternar('fi-consultores')}
          >
            <FiConsultores
              ficha={ficha}
              mudar={mudar}
              nomeVendedor={nomeVendedor}
            />
          </CardCampo>

          <CardCampo
            id="card-fi-cliente"
            icone="perfil"
            titulo="Dados do cliente"
            subtitulo={subDadosCliente(ficha)}
            preenchido={Boolean(
              String(ficha.cliente_cpf).trim() ||
                String(ficha.cliente_telefone1).trim(),
            )}
            aberto={aberto === 'fi-cliente'}
            aoClicar={() => alternar('fi-cliente')}
          >
            <FiDadosCliente ficha={ficha} mudar={mudar} />
          </CardCampo>

          <CardCampo
            id="card-fi-rt"
            icone="calculadora"
            titulo="Arquitetura e Engenharia"
            subtitulo={subRt(ficha)}
            preenchido={ficha.rt}
            aberto={aberto === 'fi-rt'}
            aoClicar={() => alternar('fi-rt')}
          >
            <FiRt ficha={ficha} mudar={mudar} />
          </CardCampo>

          <CardCampo
            id="card-fi-obra"
            icone="origem"
            titulo="Dados da obra"
            subtitulo={subDadosObra(ficha)}
            preenchido={Boolean(String(ficha.mestre_obra).trim())}
            aberto={aberto === 'fi-obra'}
            aoClicar={() => alternar('fi-obra')}
          >
            <FiDadosObra ficha={ficha} mudar={mudar} />
          </CardCampo>

          <CardCampo
            id="card-fi-medicao"
            icone="lista"
            titulo="Medição p/ contramarco"
            subtitulo={
              String(ficha.medicao_contramarco).trim()
                ? resumir(ficha.medicao_contramarco)
                : 'Condições e observações'
            }
            preenchido={Boolean(String(ficha.medicao_contramarco).trim())}
            aberto={aberto === 'fi-medicao'}
            aoClicar={() => alternar('fi-medicao')}
          >
            <textarea
              value={ficha.medicao_contramarco}
              onChange={(e) => mudar('medicao_contramarco', e.target.value)}
              rows={4}
              aria-label="Condição de medição para contramarco"
            />
          </CardCampo>

          <CardCampo
            id="card-fi-particularidades"
            icone="aviso"
            titulo="Particularidades da obra"
            subtitulo={
              String(ficha.fiscal_obra).trim() ||
              String(ficha.particularidades).trim()
                ? [
                    String(ficha.fiscal_obra).trim(),
                    resumir(ficha.particularidades, 24),
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : 'Fiscal de obra e atenção especial'
            }
            preenchido={Boolean(
              String(ficha.fiscal_obra).trim() ||
                String(ficha.particularidades).trim(),
            )}
            aberto={aberto === 'fi-particularidades'}
            aoClicar={() => alternar('fi-particularidades')}
          >
            <label className="campo-linha">
              <span className="campo-rot">Fiscal de obra</span>
              <input
                type="text"
                value={ficha.fiscal_obra}
                onChange={(e) => mudar('fiscal_obra', e.target.value)}
              />
            </label>
            <label className="campo-linha">
              <span className="campo-rot">
                O que necessita de atenção especial
              </span>
              <textarea
                value={ficha.particularidades}
                onChange={(e) => mudar('particularidades', e.target.value)}
                rows={4}
              />
            </label>
          </CardCampo>

          <CardCampo
            id="card-fi-vigencia"
            icone="relogio"
            titulo="Vigência do contrato"
            subtitulo={subVigencia(ficha)}
            preenchido={subVigencia(ficha).includes('preenchido')}
            aberto={aberto === 'fi-vigencia'}
            aoClicar={() => alternar('fi-vigencia')}
          >
            <FiVigencia ficha={ficha} mudar={mudar} />
          </CardCampo>
        </div>

        {tentou && faltaCliente && (
          <p className="nd-aviso" role="alert">
            <Icone nome="aviso" size={16} />
            Faltou escolher o cliente.
          </p>
        )}
        {erro && <p className="erro">{erro}</p>}
      </form>

      {/* Barra fixa no rodape, igual a da Nova demanda. */}
      <div className="det-barra-acao">
        <button
          type="submit"
          form="form-ficha"
          className="btn-alterar-status"
          disabled={salvando}
        >
          {salvando ? 'Salvando…' : 'Criar demanda'}
        </button>
      </div>
    </>
  )
}
