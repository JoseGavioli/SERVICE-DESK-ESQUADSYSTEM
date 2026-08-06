import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { enviarAnexo } from '../lib/anexos'
import { obterOuCriarObraPadrao } from '../lib/obraPadrao'
import {
  ORIGENS,
  calcularFaltantes,
  listaPt,
  resumir,
} from '../lib/novaDemanda'
import { fichaVazia, hojeIsoLocal } from '../lib/ficha'
import {
  carregarRascunho,
  limparRascunho,
  salvarRascunho,
} from '../lib/rascunho'
import { haQuantoTempo } from '../lib/tempo'
import CardCampo from './CardCampo'
import FichaFechamento from './FichaFechamento'
import NdCabecalho from './NdCabecalho'
import NdClienteObra from './NdClienteObra'
import NdOpcoes from './NdOpcoes'
import NdPrazo from './NdPrazo'
import NdCondicoes from './NdCondicoes'
import NdAnexos from './NdAnexos'
import Icone from './Icone'

// Formulario de nova demanda (§issue #64). Cada campo e um CARD FECHADO que
// mostra no subtitulo o que ja foi escolhido — o formulario inteiro cabe numa
// tela e da p/ conferir tudo sem abrir nada. Um card aberto por vez.
//
// Este arquivo so ORQUESTRA: guarda o estado, decide o que abre, e salva. O
// desenho de cada card vive nos Nd* e a regra do que e obrigatorio vive em
// lib/novaDemanda.js.
//
// Modo DEMANDA-FILHA (§11): se vier obraFixa + demandaPaiId, a obra ja vem
// travada (herdada da pai) e o vinculo demanda_pai_id e gravado.
//
// O vendedor_id NAO e enviado: o banco preenche com auth.uid() (autor
// inforjavel, §5).
export default function NovaDemanda({
  perfil,
  aoCriar,
  aoCancelar,
  obraFixa,
  demandaPaiId,
  demandaPai,
  naoLidas,
  aoAbrirNotif,
  pedidoVoltarForm, // voltar do Android repassado pelo Demandas (§#82)
}) {
  const ehFilha = Boolean(obraFixa)
  // Só o admin pode escolher OUTRO dono para a demanda (§#29). A RLS (0042) é
  // quem garante isso de fato — aqui é só a interface.
  const ehAdmin = perfil?.papel === 'admin'
  // Hero completo so no modo TELA CHEIA (via "+"); na filha e inline.
  const comHero = Boolean(aoAbrirNotif)
  const [cliente, setCliente] = useState(null)
  const [obra, setObra] = useState(obraFixa ?? null)
  const [tipos, setTipos] = useState([])
  const [tipoId, setTipoId] = useState('')
  const [descricao, setDescricao] = useState('')
  const [prazo, setPrazo] = useState('')
  // Na FILHA, origem e condições comerciais herdam do pai (a origem fica
  // escondida — a filha veio do mesmo lead; §11). No modo normal, tudo vazio.
  const [origem, setOrigem] = useState(ehFilha ? (demandaPai?.origem ?? '') : '')
  const [rt, setRt] = useState(ehFilha ? Boolean(demandaPai?.rt) : false)
  const [rtPercentual, setRtPercentual] = useState(
    ehFilha && demandaPai?.rt_percentual != null
      ? String(demandaPai.rt_percentual)
      : '',
  )
  const [arquiteto, setArquiteto] = useState(
    ehFilha ? (demandaPai?.arquiteto ?? '') : '',
  )
  const [arquivos, setArquivos] = useState([]) // anexos de entrada (ainda nao enviados)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [aberto, setAberto] = useState(null) // id do card aberto (so um por vez)
  const [tentou, setTentou] = useState(false) // ja tentou criar? (so ai marcamos)
  const [donos, setDonos] = useState([]) // possiveis donos (so o admin usa)
  const [proprietario, setProprietario] = useState(null) // dono escolhido; null = eu
  // FECHAMENTO (§#80): a ficha e sua tela. O estado vive AQUI para o vendedor
  // poder voltar (ajustar prazo/anexos) sem perder o que ja digitou na ficha.
  // Na FILHA, a RT herdada do pai ja vem SEMEADA na ficha (como as condicoes
  // herdadas do fluxo normal, §11) — o vendedor pode ajustar na secao de RT.
  const [preenchendoFicha, setPreenchendoFicha] = useState(false)
  const [ficha, setFicha] = useState(() => ({
    ...fichaVazia(hojeIsoLocal()),
    ...(ehFilha && demandaPai?.rt
      ? {
          rt: true,
          rt_percentual:
            demandaPai.rt_percentual != null
              ? String(demandaPai.rt_percentual)
              : '',
        }
      : {}),
  }))
  // Rascunho (§#82): so no form PRINCIPAL — a filha herda da pai e fica fora.
  // fichaTocada marca que o vendedor mexeu na ficha (p/ sujo e restauracao).
  const [rascunhoPendente, setRascunhoPendente] = useState(() =>
    ehFilha ? null : carregarRascunho(perfil.id),
  )
  const [fichaTocada, setFichaTocada] = useState(false)

  useEffect(() => {
    async function carregarTipos() {
      const { data } = await supabase
        .from('tipo_demanda')
        .select('id, nome, com_ficha')
        .eq('ativo', true)
        .order('id')
      if (data) setTipos(data)
    }
    carregarTipos()
  }, [])

  // Lista de donos possiveis (vendedores + gerentes ativos, exceto o oculto).
  // So o admin precisa — os outros nem veem o card "Proprietario".
  useEffect(() => {
    if (!ehAdmin) return
    async function carregarDonos() {
      const { data } = await supabase
        .from('perfil')
        .select('id, nome_completo')
        .in('papel', ['vendedor', 'gerente'])
        .eq('ativo', true)
        .eq('oculto', false)
        .order('nome_completo')
      if (data) setDonos(data)
    }
    carregarDonos()
  }, [ehAdmin])

  // O formulario esta "SUJO"? (algo digitado alem do estado inicial/herdado).
  // Decide a trava de saida e se o rascunho e salvo. Na filha, origem e
  // condicoes ja nascem preenchidas (heranca) — nao contam como sujeira.
  const sujo = Boolean(
    tipoId ||
      descricao.trim() ||
      prazo ||
      arquivos.length ||
      fichaTocada ||
      (!ehFilha &&
        (origem || rt || arquiteto.trim() || cliente || obra || proprietario)),
  )

  // Trava de saida (§#82): sair com o form sujo PERGUNTA antes. Confirmou o
  // descarte -> o rascunho morre junto (senao ele ressuscitaria na proxima
  // abertura exatamente o que o vendedor acabou de jogar fora).
  function cancelarComGuarda() {
    if (sujo && !window.confirm('Descartar o que você preencheu?')) return
    if (!ehFilha) limparRascunho(perfil.id)
    aoCancelar()
  }

  // Voltar do ANDROID (§#40): o Demandas repassa o sinal em vez de fechar o
  // form direto — a mesma trava vale para os dois caminhos. Se a tela da
  // FICHA estiver aberta, o voltar desce UM nivel (ficha -> form), sem perder.
  //
  // O ref guarda o valor do MOUNT: o contador so cresce la no pai, entao um
  // form reaberto MONTA com o valor antigo (truthy) — sem o ref, o effect
  // (que roda no mount) fecharia o form recem-aberto sozinho E apagaria o
  // rascunho (achado bloqueante da revisao). So agimos quando MUDA.
  const voltarVisto = useRef(pedidoVoltarForm)
  useEffect(() => {
    if (pedidoVoltarForm === voltarVisto.current) return
    voltarVisto.current = pedidoVoltarForm
    if (preenchendoFicha) setPreenchendoFicha(false)
    else cancelarComGuarda()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoVoltarForm])

  // Rascunho restaurado pode trazer tipoId de tipo DESATIVADO nesse meio
  // tempo (a lista so traz ativos): sem isto o card parecia vazio mas
  // validava, e a demanda nasceria com tipo inativo — e com o FLUXO errado
  // se o tipo era o com_ficha (achado da revisao). Tipo sumiu -> campo zera.
  useEffect(() => {
    if (!tipos.length || !tipoId) return
    if (!tipos.some((t) => String(t.id) === String(tipoId))) setTipoId('')
  }, [tipos, tipoId])

  // Salva o rascunho ~1s depois da ultima mudanca (debounce): nada de uma
  // escrita por tecla, e fechar o app no meio preserva o grosso. Anexos NAO
  // entram (File nao serializa) — o banner de restauracao avisa. Com o
  // banner PENDENTE nao salva: sobrescreveria no disco o rascunho antigo
  // antes de o vendedor decidir continuar ou nao (achado da revisao).
  useEffect(() => {
    if (ehFilha || !sujo || rascunhoPendente) return
    const timer = setTimeout(() => {
      salvarRascunho(perfil.id, {
        tipoId,
        descricao,
        prazo,
        origem,
        rt,
        rtPercentual,
        arquiteto,
        cliente,
        obra,
        proprietario,
        ficha,
        fichaTocada,
      })
    }, 1000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tipoId,
    descricao,
    prazo,
    origem,
    rt,
    rtPercentual,
    arquiteto,
    cliente,
    obra,
    proprietario,
    ficha,
    fichaTocada,
    rascunhoPendente,
  ])

  // "Continuar de onde parou": despeja o rascunho de volta nos estados. A
  // ficha e MESCLADA sobre a vazia (campo novo no codigo nao some do estado).
  function restaurar() {
    const d = rascunhoPendente?.dados ?? {}
    setTipoId(d.tipoId ?? '')
    setDescricao(d.descricao ?? '')
    setPrazo(d.prazo ?? '')
    setOrigem(d.origem ?? '')
    setRt(Boolean(d.rt))
    setRtPercentual(d.rtPercentual ?? '')
    setArquiteto(d.arquiteto ?? '')
    setCliente(d.cliente ?? null)
    setObra(d.obra ?? null)
    setProprietario(d.proprietario ?? null)
    if (d.ficha) setFicha({ ...fichaVazia(hojeIsoLocal()), ...d.ficha })
    setFichaTocada(Boolean(d.fichaTocada))
    setRascunhoPendente(null)
  }

  function alternar(id) {
    setAberto((atual) => (atual === id ? null : id))
  }

  // Enter num campo de busca/numero/texto NAO pode criar a demanda: o envio so
  // acontece pelo botao "Criar demanda" (fixo no rodape). Como esse botao nao
  // fica mais desabilitado (era ele que, disabled, barrava o Enter), um Enter
  // num <input> dispararia o envio IMPLICITO do <form> — o vendedor apertaria
  // Enter para BUSCAR um cliente e a demanda seria submetida (§#64, achado da
  // revisao). A textarea fica de fora: la Enter e quebra de linha, como deve ser.
  function impedirEnvioPorEnter(e) {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') e.preventDefault()
  }

  function escolherCliente(c) {
    setCliente(c)
    setObra(null) // a obra que estava escolhida era de OUTRO cliente
    setAberto('obra') // encadeia: quem acabou de escolher o cliente vai na obra
  }

  // Tipo com FICHA (Fechamento, §#80): o form encolhe para tipo + prazo +
  // "Informacao adicional" (opcional) + anexos, e o botao vira "Preencher
  // ficha" — cliente, origem e condicoes passam para a tela da ficha.
  const tipoEscolhido = tipos.find((t) => String(t.id) === String(tipoId))
  const ehFechamento = Boolean(tipoEscolhido?.com_ficha)

  const faltantes = calcularFaltantes({
    ehFilha,
    ehFechamento,
    cliente,
    tipoId,
    descricao,
    prazo,
    origem,
    rt,
    rtPercentual,
  })

  // Marcamos so DEPOIS da 1a tentativa: o formulario nao nasce vermelho — punir
  // alguem por nao ter preenchido o que ele ainda nem viu e hostil. E, como isto
  // e DERIVADO (nao e estado), o vermelho some sozinho quando o campo e preenchido.
  const marcado = (id) => tentou && faltantes.some((f) => f.id === id)

  async function salvar(evento) {
    evento.preventDefault()
    setErro('')

    if (faltantes.length) {
      setTentou(true)
      // Leva o vendedor ate o primeiro pendente: num celular o card que falta
      // pode estar fora da vista, e a mensagem sozinha nao diria onde ele esta.
      document
        .getElementById(`card-${faltantes[0].id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    // Fechamento (§#80): este form nao salva nada — ele encaminha para a tela
    // da FICHA, que e quem cria demanda + ficha + anexos.
    if (ehFechamento) {
      setPreenchendoFicha(true)
      return
    }

    setSalvando(true)

    // Obra: a escolhida, ou "Obra de {cliente}" (achar-ou-criar) se ficou em branco.
    let obraId = obra?.id
    if (!obraId) {
      obraId = await obterOuCriarObraPadrao(cliente)
      if (!obraId) {
        setErro('Não foi possível criar a obra padrão do cliente.')
        setSalvando(false)
        return
      }
    }

    const { data, error } = await supabase
      .from('demanda')
      .insert({
        obra_id: obraId,
        tipo_demanda_id: Number(tipoId),
        origem,
        descricao: descricao.trim(),
        prazo,
        demanda_pai_id: demandaPaiId ?? null,
        // DERIVADO da origem (§#64): se o lead veio do Club Casa, a demanda E
        // Club Casa. Era uma pergunta a parte nas condicoes comerciais, e duas
        // respostas para o mesmo fato so podiam divergir.
        club_casa: origem === 'Club Casa',
        rt,
        rt_percentual: rt && rtPercentual !== '' ? Number(rtPercentual) : null,
        arquiteto_engenheiro: arquiteto.trim() || null,
        // Dono escolhido pelo admin (§#29). Sem isto, o banco usa o default
        // auth.uid() (o proprio criador). A RLS (0042) so aceita dono != eu
        // quando sou admin — para os outros, este campo nem existe na tela.
        ...(proprietario ? { vendedor_id: proprietario.id } : {}),
      })
      .select('id')
      .single()

    if (error) {
      setErro('Não foi possível criar a demanda.')
      setSalvando(false)
      return
    }

    let falhou = false
    for (const f of arquivos) {
      const r = await enviarAnexo(data.id, 'entrada', f)
      if (r.error) falhou = true
    }

    setSalvando(false)
    if (falhou) {
      window.alert(
        'Demanda criada, mas um ou mais anexos falharam. Você pode anexá-los abrindo o detalhe da demanda.',
      )
    }
    // Criada com sucesso: o rascunho cumpriu o papel. So no form principal —
    // a filha nunca salvou rascunho (limpar aqui apagaria um alheio).
    if (!ehFilha) limparRascunho(perfil.id)
    aoCriar(data.id) // devolve o id para quem chamou abrir a demanda nova
  }

  const nomeTipo = tipos.find((t) => String(t.id) === String(tipoId))?.nome
  // Na filha, "Orçamento novo" não faz sentido — a filha é continuação de uma
  // demanda JÁ enviada (revisão, fechamento, adendo...). §11.
  const tiposDisponiveis = ehFilha
    ? tipos.filter((t) => t.nome !== 'Orçamento novo')
    : tipos

  function subCondicoes() {
    const partes = []
    if (rt) partes.push(rtPercentual !== '' ? `RT ${rtPercentual}%` : 'RT')
    if (arquiteto.trim()) partes.push(arquiteto.trim())
    return partes.length ? partes.join(' · ') : 'RT e arquiteto — se houver'
  }

  const textoBotao = salvando
    ? 'Salvando…'
    : ehFechamento
      ? 'Preencher ficha'
      : ehFilha
        ? 'Criar demanda vinculada'
        : 'Criar demanda'

  // Card da descricao — vira "Informacao adicional" (OPCIONAL) no fechamento
  // (§#80). Extraido p/ variavel porque a POSICAO muda: no fechamento ele
  // desce para baixo do divisor "Opcional daqui pra baixo".
  const cardDescricao = (
    <CardCampo
      id="card-descricao"
      icone="arquivo"
      titulo={ehFechamento ? 'Informação adicional' : 'Descrição'}
      selo="não editável depois"
      subtitulo={
        descricao.trim()
          ? resumir(descricao)
          : ehFechamento
            ? 'Algo a acrescentar? (opcional)'
            : 'O que precisa ser feito?'
      }
      preenchido={Boolean(descricao.trim())}
      faltando={marcado('descricao')}
      aberto={aberto === 'descricao'}
      aoClicar={() => alternar('descricao')}
    >
      <textarea
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        rows={5}
        aria-label={ehFechamento ? 'Informação adicional' : 'Descrição da demanda'}
        autoFocus
      />
      {/* §9: a descricao congela na criacao. Avisamos ANTES de escrever —
          que e quando ainda da para caprichar. */}
      <p className="nd-dica">
        Este texto fica <strong>congelado</strong> na criação. Correções
        depois vão nos comentários da demanda.
      </p>
    </CardCampo>
  )

  // Preenchendo a FICHA (§#80): a tela dela substitui o form inteiro. O estado
  // (cliente/obra/ficha) mora AQUI, entao voltar e retornar nao perde nada.
  if (preenchendoFicha) {
    return (
      <FichaFechamento
        perfil={perfil}
        base={{
          tipoId,
          prazo,
          infoAdicional: descricao,
          arquivos,
          proprietario,
          demandaPaiId,
          origemHerdada: ehFilha ? origem || null : null,
          // Filha: o arquiteto do pai (ja carregado no estado) e preservado.
          arquitetoHerdado: ehFilha ? arquiteto.trim() || null : null,
        }}
        cliente={cliente}
        aoEscolherCliente={(c) => {
          setCliente(c)
          setObra(null) // a obra que estava escolhida era de OUTRO cliente
        }}
        obra={obra}
        aoEscolherObra={setObra}
        ficha={ficha}
        aoMudarFicha={(f) => {
          setFichaTocada(true) // mexeu na ficha: conta como form sujo (§#82)
          setFicha(f)
        }}
        ehFilha={ehFilha}
        obraFixa={obraFixa}
        demandaPai={demandaPai}
        aoVoltar={() => setPreenchendoFicha(false)}
        aoCriar={(id) => {
          // Criada com sucesso pela ficha: o rascunho cumpriu o papel (§#82).
          // So no form principal — a filha nunca salvou rascunho, e limpar
          // aqui apagaria um rascunho ALHEIO do form principal.
          if (!ehFilha) limparRascunho(perfil.id)
          aoCriar(id)
        }}
        naoLidas={naoLidas}
        aoAbrirNotif={aoAbrirNotif}
      />
    )
  }

  // O form e a barra "Criar demanda" sao IRMAOS: assim a barra pode ficar fixa
  // no rodape (modo principal) cobrindo o bottom-nav. O botao submete o form
  // pelo atributo nativo form="form-nova-demanda", sem precisar de estado extra.
  return (
    <>
      <form
        id="form-nova-demanda"
        className="nova-demanda"
        onSubmit={salvar}
        onKeyDown={impedirEnvioPorEnter}
      >
        <NdCabecalho
          comHero={comHero}
          ehFilha={ehFilha}
          aoCancelar={cancelarComGuarda}
          naoLidas={naoLidas}
          aoAbrirNotif={aoAbrirNotif}
        />

        <div className="nd-cards">
          {/* Rascunho encontrado (§#82): oferece continuar de onde parou. */}
          {rascunhoPendente && (
            <div className="nd-rascunho" role="status">
              <Icone nome="relogio" size={18} />
              <span className="nd-rascunho-texto">
                Você tem um rascunho de{' '}
                <strong>{haQuantoTempo(rascunhoPendente.salvoEm)}</strong>.
                Anexos precisam ser escolhidos de novo.
              </span>
              <span className="nd-rascunho-acoes">
                <button type="button" onClick={restaurar}>
                  Continuar
                </button>
                <button
                  type="button"
                  className="link"
                  onClick={() => {
                    limparRascunho(perfil.id)
                    setRascunhoPendente(null)
                  }}
                >
                  Descartar
                </button>
              </span>
            </div>
          )}
          {ehFilha ? (
            /* Card no TOPO: qual demanda está sendo vinculada (§11). */
            <div className="nd-vinculada">
              <span className="nd-vinculada-icone">
                <Icone nome="seta-filha" size={20} />
              </span>
              <span className="nd-vinculada-texto">
                <span className="nd-vinculada-rot">Revisão vinculada a</span>
                <strong className="nd-vinculada-dem">
                  {demandaPai?.codigo ? `#${demandaPai.codigo} — ` : ''}
                  {demandaPai?.cliente ?? obraFixa.nome}
                </strong>
                <span className="nd-vinculada-obra">
                  {demandaPai?.obra ?? obraFixa.nome}
                </span>
              </span>
            </div>
          ) : (
            /* Fechamento: o cliente e escolhido DENTRO da ficha (§#80). */
            !ehFechamento && (
              <NdClienteObra
                cliente={cliente}
                obra={obra}
                aoEscolherCliente={escolherCliente}
                aoEscolherObra={(o) => {
                  setObra(o)
                  setAberto(null)
                }}
                aberto={aberto}
                aoAlternar={alternar}
                faltandoCliente={marcado('cliente')}
              />
            )
          )}

          <CardCampo
            id="card-tipo"
            icone="lista"
            titulo="Tipo"
            subtitulo={nomeTipo ?? 'O que você está pedindo?'}
            preenchido={Boolean(nomeTipo)}
            faltando={marcado('tipo')}
            aberto={aberto === 'tipo'}
            aoClicar={() => alternar('tipo')}
          >
            <NdOpcoes
              opcoes={tiposDisponiveis}
              valor={tipoId}
              aoEscolher={(id) => {
                setTipoId(String(id))
                setAberto(null)
              }}
            />
          </CardCampo>

          {!ehFechamento && cardDescricao}

          <NdPrazo
            prazo={prazo}
            aoMudar={setPrazo}
            faltando={marcado('prazo')}
            aberto={aberto === 'prazo'}
            aoAlternar={() => alternar('prazo')}
            aoFechar={() => setAberto(null)}
          />

          {/* Origem: só na demanda normal. Na filha ela é herdada do pai
              (escondida — a revisão veio do mesmo lead, §11); no fechamento
              nem existe (§#80). */}
          {!ehFilha && !ehFechamento && (
            <CardCampo
              id="card-origem"
              icone="origem"
              titulo="Origem"
              subtitulo={origem || 'De onde veio este cliente?'}
              preenchido={Boolean(origem)}
              faltando={marcado('origem')}
              aberto={aberto === 'origem'}
              aoClicar={() => alternar('origem')}
            >
              <NdOpcoes
                opcoes={ORIGENS.map((o) => ({ id: o, nome: o }))}
                valor={origem}
                aoEscolher={(o) => {
                  setOrigem(o)
                  setAberto(null)
                }}
              />
            </CardCampo>
          )}

          {/* Daqui para baixo da para nao mexer. Marcamos onde acaba o
              obrigatorio em vez de confiar que o vendedor repare, campo a
              campo, no subtitulo de cada um. */}
          <p className="nd-divisor">
            <span>Opcional daqui pra baixo</span>
          </p>

          {/* No fechamento a "Informacao adicional" e opcional — desce p/ ca. */}
          {ehFechamento && cardDescricao}

          {/* Condicoes: no fechamento, RT e afins moram na FICHA (§#80). */}
          {!ehFechamento && (
            <CardCampo
              id="card-condicoes"
              icone="percentual"
              titulo="Condições comerciais"
              subtitulo={subCondicoes()}
              preenchido={rt || Boolean(arquiteto.trim())}
              faltando={marcado('condicoes')}
              aberto={aberto === 'condicoes'}
              aoClicar={() => alternar('condicoes')}
            >
              <NdCondicoes
                rt={rt}
                aoMudarRt={setRt}
                rtPercentual={rtPercentual}
                aoMudarPercentual={setRtPercentual}
                arquiteto={arquiteto}
                aoMudarArquiteto={setArquiteto}
              />
            </CardCampo>
          )}

          <CardCampo
            id="card-anexos"
            icone="clipe"
            titulo="Anexos"
            subtitulo={
              arquivos.length
                ? `${arquivos.length} ${arquivos.length === 1 ? 'arquivo' : 'arquivos'}`
                : 'Fotos da medição, croqui ou PDF'
            }
            preenchido={arquivos.length > 0}
            aberto={aberto === 'anexos'}
            aoClicar={() => alternar('anexos')}
          >
            <NdAnexos
              arquivos={arquivos}
              aoAdicionar={(novos) => setArquivos((prev) => [...prev, ...novos])}
              aoRemover={(idx) =>
                setArquivos((prev) => prev.filter((_, i) => i !== idx))
              }
            />
          </CardCampo>

          {/* Proprietário — SÓ admin (§#29). No fim do form; opcional (o padrão
              é o próprio admin). Escolher outro dono só é aceito pela RLS (0042)
              quando quem cria é admin. */}
          {ehAdmin && (
            <CardCampo
              id="card-proprietario"
              icone="perfil"
              titulo="Proprietário"
              subtitulo={
                proprietario ? proprietario.nome_completo : 'Você (padrão)'
              }
              preenchido={Boolean(proprietario)}
              aberto={aberto === 'proprietario'}
              aoClicar={() => alternar('proprietario')}
            >
              <NdOpcoes
                opcoes={[
                  { id: '', nome: 'Você (fica em seu nome)' },
                  ...donos.map((d) => ({ id: d.id, nome: d.nome_completo })),
                ]}
                valor={proprietario?.id ?? ''}
                aoEscolher={(id) => {
                  setProprietario(id ? donos.find((d) => d.id === id) : null)
                  setAberto(null)
                }}
              />
            </CardCampo>
          )}
        </div>

        {tentou && faltantes.length > 0 && (
          <p className="nd-aviso" role="alert">
            <Icone nome="aviso" size={16} />
            Faltou preencher: {listaPt(faltantes.map((f) => f.nome))}.
          </p>
        )}
        {erro && <p className="erro">{erro}</p>}
      </form>

      {/* Barra "Criar demanda". Modo principal: barra FIXA navy no rodape
          (reusa .det-barra-acao; z-46 cobre o bottom-nav z-45). Modo filha:
          botao inline no fluxo (nao cobre o nav da tela de detalhe).
          O botao NAO fica mais desabilitado: um botao apagado nao conta o que
          falta — so deixa o vendedor travado sem saber por que. */}
      {comHero ? (
        <div className="det-barra-acao">
          <button
            type="submit"
            form="form-nova-demanda"
            className="btn-alterar-status"
            disabled={salvando}
          >
            {textoBotao}
          </button>
        </div>
      ) : (
        <div className="acoes-filha">
          <button type="submit" form="form-nova-demanda" disabled={salvando}>
            {textoBotao}
          </button>
          <button type="button" className="link" onClick={cancelarComGuarda}>
            Cancelar
          </button>
        </div>
      )}
    </>
  )
}
