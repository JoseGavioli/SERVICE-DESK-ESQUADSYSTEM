import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { validarArquivo, enviarAnexo, formatarTamanho } from '../lib/anexos'
import SeletorCliente from './SeletorCliente'
import SeletorObra from './SeletorObra'

// Formulario de nova demanda. Todos os campos aparecem de uma vez (sem travar
// tipo/descricao/prazo ate escolher a obra). A obra ainda depende do cliente
// para listar as obras dele.
//
// Modo DEMANDA-FILHA (§11): se vier obraFixa + demandaPaiId, a obra ja vem
// travada (herdada da pai) e o vinculo demanda_pai_id e gravado.
//
// O vendedor_id NAO e enviado: o banco preenche com auth.uid() (autor
// inforjavel, §5).
export default function NovaDemanda({ aoCriar, aoCancelar, obraFixa, demandaPaiId }) {
  const ehFilha = Boolean(obraFixa)
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

  async function salvar(evento) {
    evento.preventDefault()
    setErro('')
    setSalvando(true)

    const { data, error } = await supabase
      .from('demanda')
      .insert({
        obra_id: obra.id,
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
    obra &&
    tipoId &&
    descricao.trim() &&
    prazo &&
    (!rt || String(rtPercentual).trim() !== '')

  return (
    <form className="nova-demanda" onSubmit={salvar}>
      <h2>{ehFilha ? 'Nova demanda vinculada' : 'Nova demanda'}</h2>

      {ehFilha ? (
        <div className="seletor selecionado">
          <span>
            Obra: <strong>{obraFixa.nome}</strong> <em>(herdada da demanda-pai)</em>
          </span>
        </div>
      ) : (
        <>
          <SeletorCliente selecionado={cliente} aoSelecionar={selecionarCliente} />
          {cliente && (
            <SeletorObra
              cliente={cliente}
              selecionado={obra}
              aoSelecionar={setObra}
            />
          )}
        </>
      )}

      <label>
        Tipo
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

      <label>
        Descrição <em>(não poderá ser editada depois)</em>
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={4}
          required
        />
      </label>

      <label>
        Prazo
        <input
          type="date"
          value={prazo}
          onChange={(e) => setPrazo(e.target.value)}
          required
        />
      </label>

      <div className="linha-opcoes">
        <label className="opcao-check">
          <input
            type="checkbox"
            checked={clubCasa}
            onChange={(e) => setClubCasa(e.target.checked)}
          />
          <span>CLUB CASA</span>
        </label>

        <div className="opcao-radio">
          <span className="opcao-titulo">RT</span>
          <label>
            <input
              type="radio"
              name="rt"
              checked={!rt}
              onChange={() => setRt(false)}
            />{' '}
            Não
          </label>
          <label>
            <input
              type="radio"
              name="rt"
              checked={rt}
              onChange={() => setRt(true)}
            />{' '}
            Sim
          </label>
        </div>

        {rt && (
          <label className="opcao-pct">
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
          </label>
        )}
      </div>

      <label>
        Arquiteto/engenheiro <em>(se houver)</em>
        <input
          type="text"
          value={arquiteto}
          onChange={(e) => setArquiteto(e.target.value)}
        />
      </label>

      <div className="anexos-novos">
        <span className="rotulo-anexos">Anexos de entrada (opcional)</span>
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
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <label className="enviar-arquivo">
          ➕ Escolher arquivos (JPG/PNG/PDF, ≤ 2 MB)
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
      </div>

      {erro && <p className="erro">{erro}</p>}

      <div className="acoes">
        <button type="submit" disabled={!pronto || salvando}>
          {salvando
            ? 'Salvando…'
            : ehFilha
              ? 'Criar demanda vinculada'
              : 'Criar demanda'}
        </button>
        <button type="button" className="link" onClick={aoCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
