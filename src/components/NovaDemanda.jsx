import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { validarArquivo, enviarAnexo, formatarTamanho } from '../lib/anexos'
import SeletorCliente from './SeletorCliente'
import SeletorObra from './SeletorObra'
import Icone from './Icone'

// Formulario de nova demanda. Todos os campos aparecem de uma vez (sem travar
// tipo/descricao/prazo ate escolher a obra). A obra ainda depende do cliente
// para listar as obras dele.
//
// Modo DEMANDA-FILHA (§11): se vier obraFixa + demandaPaiId, a obra ja vem
// travada (herdada da pai) e o vinculo demanda_pai_id e gravado.
//
// O vendedor_id NAO e enviado: o banco preenche com auth.uid() (autor
// inforjavel, §5).
export default function NovaDemanda({
  aoCriar,
  aoCancelar,
  obraFixa,
  demandaPaiId,
  naoLidas,
  aoAbrirNotif,
}) {
  const ehFilha = Boolean(obraFixa)
  // Hero (titulo + voltar + sino) so no modo TELA CHEIA (via "+"); na filha
  // inline (dentro do detalhe) mantemos so um titulo simples.
  const comHero = Boolean(aoAbrirNotif)
  const [cliente, setCliente] = useState(null)
  const [obra, setObra] = useState(obraFixa ?? null)
  const [tipos, setTipos] = useState([])
  const [tipoId, setTipoId] = useState('')
  const [descricao, setDescricao] = useState('')
  const [prazo, setPrazo] = useState('')
  const [clubCasa, setClubCasa] = useState(false)
  const [rt, setRt] = useState(false)
  const [rtPercentual, setRtPercentual] = useState('')
  const [arquiteto, setArquiteto] = useState('')
  const [arquivos, setArquivos] = useState([]) // anexos de entrada (ainda nao enviados)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

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

  function selecionarCliente(c) {
    setCliente(c)
    setObra(null)
  }

  function adicionarArquivos(fileList) {
    setErro('')
    const novos = []
    for (const f of fileList) {
      const problema = validarArquivo('entrada', f)
      if (problema) setErro(`${f.name}: ${problema}`)
      else novos.push(f)
    }
    if (novos.length) setArquivos((prev) => [...prev, ...novos])
  }

  function removerArquivo(idx) {
    setArquivos((prev) => prev.filter((_, i) => i !== idx))
  }

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
    setSalvando(true)

    // Obra: a escolhida, ou "Obra de {cliente}" (acha-ou-cria) se ficou em branco.
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
        descricao: descricao.trim(),
        prazo,
        demanda_pai_id: demandaPaiId ?? null,
        club_casa: clubCasa,
        rt,
        rt_percentual: rt && rtPercentual !== '' ? Number(rtPercentual) : null,
        arquiteto_engenheiro: arquiteto.trim() || null,
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

  const pronto =
    (ehFilha ? obra : cliente) &&
    tipoId &&
    descricao.trim() &&
    prazo &&
    (!rt || String(rtPercentual).trim() !== '')

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
      <form id="form-nova-demanda" className="nova-demanda" onSubmit={salvar}>
        {comHero ? (
          <header className="hero-demandas">
            <h1 className="hero-titulo">Nova demanda</h1>
            <div className="hero-acoes">
              <button
                type="button"
                className="btn-circular"
                onClick={aoCancelar}
                aria-label="Voltar"
                title="Voltar"
              >
                <Icone nome="voltar" size={20} />
              </button>
              <button
                type="button"
                className="btn-circular"
                onClick={aoAbrirNotif}
                aria-label="Notificações"
                title="Notificações"
              >
                <Icone nome="sino" size={20} />
                {naoLidas > 0 && <span className="sino-badge">{naoLidas}</span>}
              </button>
            </div>
          </header>
        ) : (
          <h2 className="titulo-filha">
            {ehFilha ? 'Nova demanda vinculada' : 'Nova demanda'}
          </h2>
        )}

        {/* Card 1 — Cliente e obra (ou obra herdada, no modo filha) */}
        <section className="det-card">
          <h3 className="det-card-titulo">Cliente e obra</h3>
          {ehFilha ? (
            <p className="campo-obra-fixa">
              Obra: <strong>{obraFixa.nome}</strong>{' '}
              <em>(herdada da demanda-pai)</em>
            </p>
          ) : (
            <>
              <SeletorCliente
                selecionado={cliente}
                aoSelecionar={selecionarCliente}
              />
              {cliente && (
                <>
                  <SeletorObra
                    cliente={cliente}
                    selecionado={obra}
                    aoSelecionar={setObra}
                  />
                  {!obra && (
                    <p className="dica-obra">
                      Sem obra específica? Pode deixar em branco — usaremos{' '}
                      <strong>Obra de {cliente.nome}</strong>.
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </section>

        {/* Card 2 — Detalhes da demanda */}
        <section className="det-card nd-card">
          <h3 className="det-card-titulo">Detalhes da demanda</h3>

          <label className="campo-linha">
            <span className="campo-rot">Tipo</span>
            <select
              value={tipoId}
              onChange={(e) => setTipoId(e.target.value)}
              required
            >
              <option value="">— escolha —</option>
              {tipos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="campo-linha campo-descricao">
            <span className="campo-rot">
              Descrição{' '}
              <span className="selo-imutavel">não editável depois</span>
            </span>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={4}
              required
            />
          </label>

          <label className="campo-linha">
            <span className="campo-rot">Prazo</span>
            <input
              type="date"
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
              required
            />
          </label>
        </section>

        {/* Card 3 — Condições comerciais */}
        <section className="det-card nd-card">
          <h3 className="det-card-titulo">Condições comerciais</h3>

          <label className="campo-linha campo-inline">
            <span className="campo-rot">CLUB CASA</span>
            <input
              type="checkbox"
              className="campo-check"
              checked={clubCasa}
              onChange={(e) => setClubCasa(e.target.checked)}
            />
          </label>

          <div className="campo-linha campo-inline">
            <span className="campo-rot">RT</span>
            <div className="campo-rt">
              <label className="pilula-radio">
                <input
                  type="radio"
                  name="rt"
                  checked={!rt}
                  onChange={() => setRt(false)}
                />{' '}
                Não
              </label>
              <label className="pilula-radio">
                <input
                  type="radio"
                  name="rt"
                  checked={rt}
                  onChange={() => setRt(true)}
                />{' '}
                Sim
              </label>
              {rt && (
                <span className="campo-pct">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    className="input-pct"
                    value={rtPercentual}
                    onChange={(e) => setRtPercentual(e.target.value)}
                    aria-label="Porcentagem da RT"
                    required
                  />
                  <span>%</span>
                </span>
              )}
            </div>
          </div>

          <label className="campo-linha">
            <span className="campo-rot">
              Arquiteto/engenheiro <em>(se houver)</em>
            </span>
            <input
              type="text"
              value={arquiteto}
              onChange={(e) => setArquiteto(e.target.value)}
            />
          </label>
        </section>

        {/* Card 4 — Anexos de entrada */}
        <section className="det-card">
          <h3 className="det-card-titulo">
            Anexos de entrada <span className="titulo-opc">opcional</span>
          </h3>
          {arquivos.length > 0 && (
            <ul className="arquivos-escolhidos">
              {arquivos.map((f, i) => (
                <li key={i}>
                  <span>
                    {f.name} ({formatarTamanho(f.size)})
                  </span>
                  <button
                    type="button"
                    className="remover"
                    onClick={() => removerArquivo(i)}
                  >
                    <Icone nome="fechar" size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <label className="enviar-arquivo">
            <Icone nome="mais" size={16} /> Escolher arquivos (JPG/PNG/PDF, ≤ 2 MB)
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,application/pdf"
              onChange={(e) => {
                adicionarArquivos(e.target.files)
                e.target.value = ''
              }}
            />
          </label>
        </section>

        {erro && <p className="erro">{erro}</p>}
      </form>

      {/* Barra "Criar demanda". Modo principal: barra FIXA navy no rodape
          (reusa .det-barra-acao; z-46 cobre o bottom-nav z-45). Modo filha:
          botao inline no fluxo (nao cobre o nav da tela de detalhe). */}
      {comHero ? (
        <div className="det-barra-acao">
          <button
            type="submit"
            form="form-nova-demanda"
            className="btn-alterar-status"
            disabled={!pronto || salvando}
          >
            {textoBotao}
          </button>
        </div>
      ) : (
        <div className="acoes-filha">
          <button type="submit" form="form-nova-demanda" disabled={!pronto || salvando}>
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
