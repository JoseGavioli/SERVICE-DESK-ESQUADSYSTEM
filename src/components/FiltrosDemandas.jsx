import { useState } from 'react'
import { STATUS_ROTULO } from '../lib/status'
import { URGENCIA_NIVEIS } from '../lib/urgencia'

// Rotulos de ordenacao (valor -> texto exibido / na tag).
const ORDENACAO = {
  padrao: 'Padrão',
  urgencia: 'Urgência',
  recentes: 'Mais recentes',
  antigas: 'Mais antigas',
}
const URG_ROTULO = Object.fromEntries(URGENCIA_NIVEIS.map((u) => [u.nivel, u.rotulo]))
const RASCUNHO_VAZIO = { status: '', urgencia: '', soAtivas: false, ordenacao: 'padrao' }

// Filtros da lista. A BUSCA e ao vivo (barra sempre visivel). Os filtros
// ESTRUTURADOS (status/urgencia/so-ativas/ordenacao) ficam numa box que abre ao
// tocar "Filtrar" e so valem quando se aplica; depois a box recolhe e o que
// esta ativo vira TAGS removiveis (× em cada) + "limpar tudo".
export default function FiltrosDemandas({
  f,
  aoBuscar,
  aoAplicar,
  aoRemover,
  aoLimpar,
}) {
  const [aberto, setAberto] = useState(false)
  const [rascunho, setRascunho] = useState(RASCUNHO_VAZIO)

  // Ao abrir, o rascunho parte do que ja esta aplicado.
  function abrir() {
    setRascunho({
      status: f.status,
      urgencia: f.urgencia,
      soAtivas: f.soAtivas,
      ordenacao: f.ordenacao,
    })
    setAberto(true)
  }

  function aplicar() {
    aoAplicar(rascunho)
    setAberto(false)
  }

  function setR(campo, valor) {
    setRascunho((prev) => ({ ...prev, [campo]: valor }))
  }

  // Tags do que esta APLICADO (status, urgencia, so-ativas, ordem).
  const tags = []
  if (f.status) tags.push({ campo: 'status', texto: STATUS_ROTULO[f.status] })
  if (f.urgencia) tags.push({ campo: 'urgencia', texto: URG_ROTULO[f.urgencia] })
  if (f.soAtivas) tags.push({ campo: 'soAtivas', texto: 'Só ativas' })
  if (f.ordenacao !== 'padrao')
    tags.push({ campo: 'ordenacao', texto: `Ordem: ${ORDENACAO[f.ordenacao]}` })

  return (
    <div className="filtros">
      <input
        type="search"
        className="busca"
        placeholder="Buscar (cliente, obra, descrição)…"
        value={f.busca}
        onChange={(e) => aoBuscar(e.target.value)}
      />

      <div className="filtro-barra">
        <button
          type="button"
          className={`botao-filtrar ${aberto ? 'aberto' : ''}`}
          onClick={() => (aberto ? setAberto(false) : abrir())}
          aria-expanded={aberto}
        >
          Filtrar {aberto ? '▴' : '▾'}
        </button>

        {tags.map((t) => (
          <span key={t.campo} className="tag-filtro">
            {t.texto}
            <button
              type="button"
              className="tag-x"
              onClick={() => aoRemover(t.campo)}
              aria-label={`Remover filtro ${t.texto}`}
            >
              ×
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

          <label>
            Ordenar por
            <select
              value={rascunho.ordenacao}
              onChange={(e) => setR('ordenacao', e.target.value)}
            >
              <option value="padrao">Padrão</option>
              <option value="urgencia">Urgência</option>
              <option value="recentes">Mais recentes</option>
              <option value="antigas">Mais antigas</option>
            </select>
          </label>

          <label className="check">
            <input
              type="checkbox"
              checked={rascunho.soAtivas}
              onChange={(e) => setR('soAtivas', e.target.checked)}
            />
            Só ativas (esconde enviadas e canceladas)
          </label>

          <div className="filtro-acoes">
            <button type="button" className="botao-aplicar" onClick={aplicar}>
              Filtrar
            </button>
            <button
              type="button"
              className="link"
              onClick={() => setRascunho(RASCUNHO_VAZIO)}
            >
              Limpar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
