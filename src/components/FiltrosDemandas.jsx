import { useState } from 'react'
import Icone from './Icone'
import { URGENCIA_NIVEIS } from '../lib/urgencia'

// Rotulos de ordenacao (valor -> texto exibido / na tag).
const ORDENACAO = {
  padrao: 'Padrão',
  urgencia: 'Urgência',
  recentes: 'Mais recentes',
  antigas: 'Mais antigas',
}
const URG_ROTULO = Object.fromEntries(URGENCIA_NIVEIS.map((u) => [u.nivel, u.rotulo]))
const RASCUNHO_VAZIO = { urgencia: '', vendedor: '', ordenacao: 'padrao' }

// Filtro AVANCADO (urgencia + vendedor + ordenacao). O status vive nos chips do
// cabecalho e a busca na lupa; aqui fica so o "Filtrar" que abre uma box e, ao
// aplicar, vira TAGS removiveis (× em cada) + "limpar tudo". O filtro por
// vendedor (§issue #37) so aparece quando ha vendedores (isto e, para o staff).
export default function FiltrosDemandas({
  f,
  vendedores = [],
  aoAplicar,
  aoRemover,
  aoLimpar,
}) {
  const [aberto, setAberto] = useState(false)
  const [rascunho, setRascunho] = useState(RASCUNHO_VAZIO)

  // Ao abrir, o rascunho parte do que ja esta aplicado.
  function abrir() {
    setRascunho({
      urgencia: f.urgencia,
      vendedor: f.vendedor,
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

  // Tags do que esta APLICADO (urgencia, vendedor, ordem).
  const tags = []
  if (f.urgencia) tags.push({ campo: 'urgencia', texto: URG_ROTULO[f.urgencia] })
  if (f.vendedor) {
    const nome = vendedores.find((v) => v.id === f.vendedor)?.nome || '—'
    tags.push({ campo: 'vendedor', texto: `Vendedor: ${nome}` })
  }
  if (f.ordenacao !== 'padrao')
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
