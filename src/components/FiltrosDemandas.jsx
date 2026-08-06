import { useEffect, useState } from 'react'
import Icone from './Icone'
import { URGENCIA_NIVEIS } from '../lib/urgencia'
import { STATUS_ROTULO } from '../lib/status'

// Rotulos de ordenacao (valor -> texto exibido / na tag).
const ORDENACAO = {
  padrao: 'Padrão',
  atividade: 'Atividade recente',
  urgencia: 'Urgência',
  recentes: 'Mais recentes',
  antigas: 'Mais antigas',
}
const URG_ROTULO = Object.fromEntries(URGENCIA_NIVEIS.map((u) => [u.nivel, u.rotulo]))
const RASCUNHO_VAZIO = { status: '', urgencia: '', vendedor: '', ordenacao: 'padrao' }

// Filtro AVANCADO (status + urgencia + vendedor + ordenacao). Os chips do
// cabecalho dao os recortes GROSSOS de status (Em aberto/Enviados/Cancelados);
// aqui da p/ escolher UM status exato (ex.: "Congelado"), que os chips nao
// cobrem. A busca vive na lupa. Ao aplicar, tudo vira TAGS removiveis (× em
// cada) + "limpar tudo". O filtro por vendedor (§issue #37) so aparece quando
// ha vendedores (isto e, para o staff).
export default function FiltrosDemandas({
  f,
  vendedores = [],
  aoAplicar,
  aoRemover,
  aoLimpar,
  // Desktop (§#83): so a ORDENACAO sai da box e fica a vista, ao lado do
  // botao "Filtrar". O resto (status/vendedor/urgencia) continua dentro dele,
  // como no celular — sao filtros que ESCONDEM demandas, e ficam anunciados
  // pelas tags; a ordenacao so muda a ordem, entao vive melhor a vista.
  desktop,
}) {
  const [aberto, setAberto] = useState(false)
  const [rascunho, setRascunho] = useState(RASCUNHO_VAZIO)

  // O filtro APLICADO mudou por fora com a box aberta (recorte do menu
  // lateral desktop, chips)? Re-fotografa o rascunho — aplicar um rascunho
  // velho por cima do recorte recem-escolhido seria silencioso (§#83 B2).
  //
  // A ordenacao so e vigiada NO CELULAR, e a diferenca importa nos dois lados:
  //
  // - Desktop: o select dela esta a vista e continua clicavel com a box
  //   aberta. Se ele disparasse este efeito, o rascunho seria refeito e
  //   apagaria o status que o usuario escolheu e ainda nao aplicou.
  // - Celular: ela vive DENTRO da box, e tem a tag "Ordem: X" do lado de
  //   fora. Tocar no × dessa tag muda SO a `f.ordenacao` — sem vigia-la, a
  //   box continuaria exibindo a ordem que o usuario acabou de remover e o
  //   proximo "Filtrar" a ressuscitaria.
  const ordemVigiada = desktop ? null : f.ordenacao
  useEffect(() => {
    if (!aberto) return
    setRascunho({
      status: f.status,
      urgencia: f.urgencia,
      vendedor: f.vendedor,
      ordenacao: f.ordenacao,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.status, f.urgencia, f.vendedor, ordemVigiada])

  // Ao abrir, o rascunho parte do que ja esta aplicado.
  function abrir() {
    setRascunho({
      status: f.status,
      urgencia: f.urgencia,
      vendedor: f.vendedor,
      ordenacao: f.ordenacao,
    })
    setAberto(true)
  }

  function aplicar() {
    // No desktop a ordenacao NAO esta na box (ela ficou a vista, ao lado do
    // botao). Mandar o valor fotografado no rascunho poderia desfazer, sem o
    // usuario ver, a escolha que ele acabou de fazer no select de fora.
    if (desktop) {
      const { ordenacao: _fora, ...semOrdem } = rascunho
      aoAplicar(semOrdem)
    } else {
      aoAplicar(rascunho)
    }
    setAberto(false)
  }

  // "Limpar" da box zera o que ESTA nela. No desktop a ordenacao esta fora,
  // entao ela sobrevive (quem a reseta e o proprio select, a vista).
  function limparRascunho() {
    setRascunho((prev) =>
      desktop ? { ...RASCUNHO_VAZIO, ordenacao: prev.ordenacao } : RASCUNHO_VAZIO
    )
  }

  function setR(campo, valor) {
    setRascunho((prev) => ({ ...prev, [campo]: valor }))
  }

  // Tags do que esta APLICADO (status, urgencia, vendedor, ordem).
  const tags = []
  if (f.status)
    tags.push({ campo: 'status', texto: `Status: ${STATUS_ROTULO[f.status]}` })
  if (f.urgencia) tags.push({ campo: 'urgencia', texto: URG_ROTULO[f.urgencia] })
  if (f.vendedor) {
    const nome = vendedores.find((v) => v.id === f.vendedor)?.nome || '—'
    tags.push({ campo: 'vendedor', texto: `Vendedor: ${nome}` })
  }
  // A tag de ordem so faz sentido quando a ordenacao esta ESCONDIDA. No
  // desktop o select dela esta a vista mostrando o valor — a tag seria a
  // mesma informacao duas vezes, ocupando a linha.
  if (f.ordenacao !== 'padrao' && !desktop)
    tags.push({ campo: 'ordenacao', texto: `Ordem: ${ORDENACAO[f.ordenacao]}` })

  return (
    <div className="filtros">
      <div className="filtro-barra">
        <button
          type="button"
          className={`botao-filtrar ${aberto ? 'aberto' : ''}`}
          onClick={() => (aberto ? setAberto(false) : abrir())}
          aria-expanded={aberto}
        >
          Filtrar {aberto ? <Icone nome="chevron-cima" size={16} /> : <Icone nome="chevron-baixo" size={16} />}
        </button>

        {/* Desktop: a ordenacao fica AO LADO do botao, e vale na hora (nao
            precisa de "Aplicar" — nada e escondido, so reordenado). */}
        {desktop && (
          <label className="filtro-ordenar">
            <span>Ordenar por</span>
            <select
              value={f.ordenacao}
              onChange={(e) => aoAplicar({ ordenacao: e.target.value })}
            >
              {Object.entries(ORDENACAO).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </select>
          </label>
        )}

        {tags.map((t) => (
          <span key={t.campo} className="tag-filtro">
            {t.texto}
            <button
              type="button"
              className="tag-x"
              onClick={() => aoRemover(t.campo)}
              aria-label={`Remover filtro ${t.texto}`}
            >
              <Icone nome="fechar" size={14} />
            </button>
          </span>
        ))}

        {tags.length > 0 && (
          <button type="button" className="link" onClick={aoLimpar}>
            limpar tudo
          </button>
        )}
      </div>

      {aberto && (
        <div className="filtro-box">
          <label>
            Status
            <select
              value={rascunho.status}
              onChange={(e) => setR('status', e.target.value)}
            >
              <option value="">Todos os status</option>
              {Object.entries(STATUS_ROTULO).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </select>
          </label>

          {vendedores.length > 0 && (
            <label>
              Vendedor
              <select
                value={rascunho.vendedor}
                onChange={(e) => setR('vendedor', e.target.value)}
              >
                <option value="">Todos os vendedores</option>
                {vendedores.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nome}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label>
            Urgência
            <select
              value={rascunho.urgencia}
              onChange={(e) => setR('urgencia', e.target.value)}
            >
              <option value="">Todas as urgências</option>
              {URGENCIA_NIVEIS.map((u) => (
                <option key={u.nivel} value={u.nivel}>
                  {u.rotulo}
                </option>
              ))}
            </select>
          </label>

          {!desktop && (
            <label>
              Ordenar por
              <select
                value={rascunho.ordenacao}
                onChange={(e) => setR('ordenacao', e.target.value)}
              >
                {Object.entries(ORDENACAO).map(([valor, rotulo]) => (
                  <option key={valor} value={valor}>
                    {rotulo}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="filtro-acoes">
            <button type="button" className="botao-aplicar" onClick={aplicar}>
              Filtrar
            </button>
            <button
              type="button"
              className="link"
              onClick={limparRascunho}
            >
              Limpar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
