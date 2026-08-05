import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fichaParaEstado, fichaVazia, hojeIsoLocal, montarInsertFicha } from '../lib/ficha'
import NdCabecalho from './NdCabecalho'
import FichaCards from './FichaCards'
import EstadoVazio from './EstadoVazio'
import Icone from './Icone'

// VER/EDITAR a ficha de uma demanda de fechamento JA criada (§F3 da #80).
// Tela cheia (hero + voltar + sino), mesmos cards da criacao (FichaCards).
//
// Permissoes — espelho da RLS da 0045 (o banco e quem garante; §3):
//   editar: admin/atendente enquanto a demanda nao for terminal; o DONO so
//           enquanto 'nao_iniciado'. Os demais (gerente, dono fora da janela)
//           so LEEM (fieldset desabilitado).
//   criar (fechamento que ficou SEM ficha, ex.: falha de rede na criacao):
//           dono em 'nao_iniciado' ou admin nao-terminal.
// O salvar usa .select() para detectar RLS barrando em silencio (licao 0044).
export default function FichaDemanda({
  demanda,
  codigo,
  perfil,
  aoVoltar,
  naoLidas,
  aoAbrirNotif,
}) {
  const [ficha, setFicha] = useState(null) // null = carregando
  const [semFicha, setSemFicha] = useState(false)
  const [aberto, setAberto] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [salvo, setSalvo] = useState(false) // feedback "Ficha salva"

  const terminal = demanda.status === 'enviado' || demanda.status === 'cancelada'
  const ehStaff = perfil.papel === 'admin' || perfil.papel === 'atendente'
  const donoNaJanela =
    perfil.id === demanda.vendedor_id && demanda.status === 'nao_iniciado'
  const podeEditar = (ehStaff && !terminal) || donoNaJanela
  // Criar ficha atrasada: a RLS so aceita dono (nao_iniciado) ou ADMIN
  // (nao-terminal) — atendente edita mas nao cria (0045).
  const podeCriar =
    donoNaJanela || (perfil.papel === 'admin' && !terminal)

  const nomeVendedor = demanda.vendedor?.nome_completo ?? '—'

  useEffect(() => {
    async function carregar() {
      const { data, error } = await supabase
        .from('ficha_fechamento')
        .select('*')
        .eq('demanda_id', demanda.id)
        .maybeSingle()
      // Erro de rede NAO e "sem ficha": abrir o form de criacao em cima de
      // uma ficha existente faria o usuario digitar tudo a toa (o unique
      // barraria no fim) — achado da revisao.
      if (error) {
        setErro('Não foi possível carregar a ficha. Volte e tente de novo.')
        return
      }
      if (data) {
        setFicha(fichaParaEstado(data, demanda))
      } else {
        setSemFicha(true)
        // Form em branco para o "preencher atrasado" (se puder criar).
        setFicha({
          ...fichaVazia(hojeIsoLocal()),
          rt: Boolean(demanda.rt),
          rt_percentual:
            demanda.rt_percentual != null ? String(demanda.rt_percentual) : '',
        })
      }
    }
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demanda.id])

  function mudar(campo, valor) {
    setSalvo(false)
    setErro('') // erro antigo nao pode ficar gritando enquanto se corrige
    setFicha((f) => ({ ...f, [campo]: valor }))
  }

  function alternar(id) {
    setAberto((atual) => (atual === id ? null : id))
  }

  function impedirEnvioPorEnter(e) {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') e.preventDefault()
  }

  async function salvar(evento) {
    evento.preventDefault()
    setErro('')
    setSalvando(true)

    if (semFicha) {
      // Preencher atrasado: INSERT (a RLS barra quem nao pode, com erro).
      const { error } = await supabase
        .from('ficha_fechamento')
        .insert(montarInsertFicha(ficha, demanda.id))
      setSalvando(false)
      if (error) {
        setErro('Não foi possível salvar a ficha.')
        return
      }
      setSemFicha(false)
      setSalvo(true)
      return
    }

    // UPDATE com .select(): barrado pela RLS = 0 linhas SEM erro — sem isto a
    // falha seria silenciosa (mesma armadilha do DELETE, licao da 0044).
    // demanda_id vai junto com o MESMO valor (o gatilho so barra troca).
    const { data, error } = await supabase
      .from('ficha_fechamento')
      .update(montarInsertFicha(ficha, demanda.id))
      .eq('demanda_id', demanda.id)
      .select('id')
    setSalvando(false)
    if (error || !data?.length) {
      setErro('Não foi possível salvar a ficha.')
      return
    }
    setSalvo(true)
  }

  // Carregando ou erro de carga: com hero mesmo assim — num celular offline,
  // um <p> solto deixaria o usuario preso sem botao de voltar.
  if (!ficha) {
    return (
      <>
        <NdCabecalho
          comHero
          titulo="Ficha de pedido de vendas"
          aoCancelar={aoVoltar}
          naoLidas={naoLidas}
          aoAbrirNotif={aoAbrirNotif}
        />
        {erro ? <p className="erro">{erro}</p> : <p>Carregando…</p>}
      </>
    )
  }

  // Sem ficha e sem poder criar: nada a mostrar alem do aviso.
  if (semFicha && !podeCriar) {
    return (
      <>
        <NdCabecalho
          comHero
          titulo="Ficha de pedido de vendas"
          aoCancelar={aoVoltar}
          naoLidas={naoLidas}
          aoAbrirNotif={aoAbrirNotif}
        />
        <EstadoVazio
          nome="arquivo"
          titulo="Esta demanda está sem ficha"
          dica={
            terminal
              ? 'A demanda já foi finalizada sem ficha.'
              : 'Um admin pode preenchê-la abrindo esta tela.'
          }
        />
      </>
    )
  }

  const podeMexer = semFicha ? podeCriar : podeEditar

  return (
    <>
      <form
        id="form-ficha-demanda"
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

        {/* De quem e a ficha (contexto rapido, como o card da filha). */}
        <div className="nd-cards">
          <div className="nd-vinculada">
            <span className="nd-vinculada-icone">
              <Icone nome="arquivo" size={20} />
            </span>
            <span className="nd-vinculada-texto">
              <span className="nd-vinculada-rot">
                {semFicha ? 'Preencher a ficha de' : 'Ficha da demanda'}
              </span>
              <strong className="nd-vinculada-dem">
                #{codigo ?? demanda.id} — {demanda.obra?.cliente?.nome}
              </strong>
              <span className="nd-vinculada-obra">{demanda.obra?.nome}</span>
            </span>
          </div>

          {/* `desabilitado` = modo leitura: os campos travam mas os cards
              continuam ABRINDO (o fieldset fica no miolo de cada card).
              rtTravada SEMPRE: a RT e da demanda e esta tela nunca a grava —
              nem no preencher-atrasado (o insert da ficha nao toca a demanda;
              deixar editavel seria descarte silencioso — achado da revisao). */}
          <FichaCards
            ficha={ficha}
            mudar={mudar}
            nomeVendedor={nomeVendedor}
            aberto={aberto}
            alternar={alternar}
            rtTravada
            desabilitado={!podeMexer}
          />
        </div>

        {!podeMexer && (
          <p className="nd-dica fi-somente-leitura">
            <Icone nome="aviso" size={14} /> Ficha somente leitura
            {terminal
              ? ' — a demanda já foi finalizada.'
              : ' — edição é do atendente/admin (ou sua, enquanto "Não iniciado").'}
          </p>
        )}
        {salvo && (
          <p className="nd-dica fi-salvo" role="status">
            <Icone nome="check" size={14} /> Ficha salva.
          </p>
        )}
        {erro && <p className="erro">{erro}</p>}
      </form>

      {podeMexer && (
        <div className="det-barra-acao">
          <button
            type="submit"
            form="form-ficha-demanda"
            className="btn-alterar-status"
            disabled={salvando}
          >
            {salvando
              ? 'Salvando…'
              : semFicha
                ? 'Salvar ficha'
                : 'Salvar alterações'}
          </button>
        </div>
      )}
    </>
  )
}
