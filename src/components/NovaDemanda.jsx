import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { enviarAnexo } from '../lib/anexos'
import {
  ORIGENS,
  calcularFaltantes,
  listaPt,
  resumir,
} from '../lib/novaDemanda'
import CardCampo from './CardCampo'
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
  naoLidas,
  aoAbrirNotif,
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
  const [origem, setOrigem] = useState('')
  const [rt, setRt] = useState(false)
  const [rtPercentual, setRtPercentual] = useState('')
  const [arquiteto, setArquiteto] = useState('')
  const [arquivos, setArquivos] = useState([]) // anexos de entrada (ainda nao enviados)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [aberto, setAberto] = useState(null) // id do card aberto (so um por vez)
  const [tentou, setTentou] = useState(false) // ja tentou criar? (so ai marcamos)
  const [donos, setDonos] = useState([]) // possiveis donos (so o admin usa)
  const [proprietario, setProprietario] = useState(null) // dono escolhido; null = eu

  useEffect(() => {
    async function carregarTipos() {
      const { data } = await supabase
        .from('tipo_demanda')
        .select('id, nome')
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

  const faltantes = calcularFaltantes({
    ehFilha,
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

  // Acha (ou cria) a obra padrao "Obra de {cliente}" quando nenhuma foi
  // escolhida. Roda sob a RLS do vendedor (ele ja pode criar obras). Retorna o
  // id da obra, ou null em caso de erro (com a mensagem ja sinalizada).
  async function obterOuCriarObraPadrao() {
    const nome = `Obra de ${cliente.nome}`
    const { data: existente } = await supabase
      .from('obra')
      .select('id')
      .eq('cliente_id', cliente.id)
      .eq('nome', nome)
      .limit(1)
      .maybeSingle()
    if (existente) return existente.id

    const { data: nova, error } = await supabase
      .from('obra')
      .insert({ cliente_id: cliente.id, nome })
      .select('id')
      .single()
    if (error) {
      setErro('Não foi possível criar a obra padrão do cliente.')
      return null
    }
    return nova.id
  }

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

    setSalvando(true)

    // Obra: a escolhida, ou "Obra de {cliente}" (achar-ou-criar) se ficou em branco.
    let obraId = obra?.id
    if (!obraId) {
      obraId = await obterOuCriarObraPadrao()
      if (!obraId) {
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
    aoCriar(data.id) // devolve o id para quem chamou abrir a demanda nova
  }

  const nomeTipo = tipos.find((t) => String(t.id) === String(tipoId))?.nome

  function subCondicoes() {
    const partes = []
    if (rt) partes.push(rtPercentual !== '' ? `RT ${rtPercentual}%` : 'RT')
    if (arquiteto.trim()) partes.push(arquiteto.trim())
    return partes.length ? partes.join(' · ') : 'RT e arquiteto — se houver'
  }

  const textoBotao = salvando
    ? 'Salvando…'
    : ehFilha
      ? 'Criar demanda vinculada'
      : 'Criar demanda'

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
          aoCancelar={aoCancelar}
          naoLidas={naoLidas}
          aoAbrirNotif={aoAbrirNotif}
        />

        <div className="nd-cards">
          {ehFilha ? (
            <p className="campo-obra-fixa">
              Obra: <strong>{obraFixa.nome}</strong>{' '}
              <em>(herdada da demanda-pai)</em>
            </p>
          ) : (
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
              opcoes={tipos}
              valor={tipoId}
              aoEscolher={(id) => {
                setTipoId(String(id))
                setAberto(null)
              }}
            />
          </CardCampo>

          <CardCampo
            id="card-descricao"
            icone="arquivo"
            titulo="Descrição"
            selo="não editável depois"
            subtitulo={
              descricao.trim() ? resumir(descricao) : 'O que precisa ser feito?'
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
              aria-label="Descrição da demanda"
              autoFocus
            />
            {/* §9: a descricao congela na criacao. Avisamos ANTES de escrever —
                que e quando ainda da para caprichar. */}
            <p className="nd-dica">
              Este texto fica <strong>congelado</strong> na criação. Correções
              depois vão nos comentários da demanda.
            </p>
          </CardCampo>

          <NdPrazo
            prazo={prazo}
            aoMudar={setPrazo}
            faltando={marcado('prazo')}
            aberto={aberto === 'prazo'}
            aoAlternar={() => alternar('prazo')}
            aoFechar={() => setAberto(null)}
          />

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

          {/* Daqui para baixo da para nao mexer. Marcamos onde acaba o
              obrigatorio em vez de confiar que o vendedor repare, campo a
              campo, no subtitulo de cada um. */}
          <p className="nd-divisor">
            <span>Opcional daqui pra baixo</span>
          </p>

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
          <button type="button" className="link" onClick={aoCancelar}>
            Cancelar
          </button>
        </div>
      )}
    </>
  )
}
