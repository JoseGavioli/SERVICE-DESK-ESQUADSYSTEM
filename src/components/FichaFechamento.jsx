import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { enviarAnexo } from '../lib/anexos'
import {
  DESCRICAO_PADRAO_FECHAMENTO,
  montarInsertFicha,
  numeroInput,
} from '../lib/ficha'
import { useDesktop } from '../lib/useDesktop'
import NdCabecalho from './NdCabecalho'
import FichaCards from './FichaCards'
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
  obra,
  cidadeObra,
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
  const desktop = useDesktop() // §#83 B3: secoes expostas
  const [aberto, setAberto] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

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

  // Rede de seguranca, nao validacao de tela: desde a §#85 fase 2 o cliente e
  // exigido no FORMULARIO, e sem ele o botao "Preencher ficha" nem abre esta
  // tela. Se um caminho novo furar isso, e melhor avisar do que gravar uma
  // demanda sem dono (o insert quebraria mais adiante, em `obra_id`).
  const faltaCliente = !ehFilha && !cliente

  async function salvar(evento) {
    evento.preventDefault()
    setErro('')

    if (faltaCliente) {
      setErro('Escolha o cliente no formulário antes de salvar a ficha.')
      return
    }

    setSalvando(true)

    // Obra: a fixa (filha) ou a escolhida no formulario. Desde a §#85 fase 3
    // ela e obrigatoria la — nao ha mais "obra padrao" criada em silencio.
    const obraId = obraFixa?.id ?? obra?.id
    if (!obraId) {
      setErro('Escolha a obra no formulário antes de salvar a ficha.')
      setSalvando(false)
      return
    }

    // Obra antiga sem cidade: completa antes (mesma funcao do formulario —
    // update direto barraria o vendedor em silencio, §0048).
    if (!obraFixa && obra && !obra.cidade_estado) {
      const { error: erroCidade } = await supabase.rpc('completar_cidade_obra', {
        p_obra_id: obraId,
        p_cidade: String(cidadeObra ?? '').trim(),
      })
      if (erroCidade) {
        setErro('Não foi possível salvar a cidade da obra.')
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
          {/* Cliente e obra so aparecem — quem os ESCOLHE e o formulario
              (§#85 fase 2). Eles ja foram editaveis aqui (§#80); ter os
              mesmos dados em dois lugares e o caminho curto para um deles
              discordar do outro. A filha usa este mesmo bloco ha mais tempo,
              com os dados herdados do pai: um desenho so para os dois casos. */}
          <div className="nd-vinculada">
            <span className="nd-vinculada-icone">
              <Icone nome={ehFilha ? 'seta-filha' : 'cliente'} size={20} />
            </span>
            <span className="nd-vinculada-texto">
              <span className="nd-vinculada-rot">
                {ehFilha ? 'Fechamento vinculado a' : 'Fechamento para'}
              </span>
              <strong className="nd-vinculada-dem">
                {ehFilha
                  ? `${demandaPai?.codigo ? `#${demandaPai.codigo} — ` : ''}${
                      demandaPai?.cliente ?? obraFixa?.nome
                    }`
                  : (cliente?.nome ?? '—')}
              </strong>
              <span className="nd-vinculada-obra">
                {ehFilha
                  ? (demandaPai?.obra ?? obraFixa?.nome)
                  : (obra?.nome ??
                    (cliente ? `Obra de ${cliente.nome} (padrão)` : '—'))}
              </span>
            </span>
          </div>

          <FichaCards
            ficha={ficha}
            mudar={mudar}
            nomeVendedor={nomeVendedor}
            aberto={aberto}
            alternar={alternar}
            sempreAberto={desktop}
          />
        </div>

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
