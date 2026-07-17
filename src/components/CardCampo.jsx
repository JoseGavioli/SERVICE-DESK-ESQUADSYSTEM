import { useEffect, useRef } from 'react'
import Icone from './Icone'

// Card de um campo do formulario (§issue #64). Mesma linguagem visual dos cards
// da tela "Administracao" (icone redondo + titulo + subtitulo), a pedido do
// dono.
//
// A ideia central esta no SUBTITULO: fechado, ele mostra o que JA foi
// escolhido. Assim o formulario inteiro cabe numa tela e da para conferir tudo
// sem abrir nada — antes eram ~24 controles abertos ao mesmo tempo.
//
// Dois modos, decididos pela presenca de `children`:
//  - SANFONA (tem children): o toque abre/fecha o card. E o que TODOS os cards
//    usam hoje (tipo, origem, cliente, obra, prazo com calendario inline...).
//  - ATALHO (sem children): o toque so chama `aoClicar`, sem expandir nada.
//    Capacidade mantida para um futuro card que apenas dispare uma acao; no
//    momento nenhum card usa esse modo.
export default function CardCampo({
  id,
  icone,
  titulo,
  subtitulo,
  selo,
  preenchido = false,
  faltando = false,
  desabilitado = false,
  aberto = false,
  aoClicar,
  children,
}) {
  const ehSanfona = Boolean(children)
  const topoRef = useRef(null)
  // Guarda o valor anterior de `aberto` para reconhecer a TRANSICAO aberto->fechado
  // (nao basta olhar `aberto`, senao o efeito dispararia ja na montagem).
  const estavaAberto = useRef(false)

  // Devolver o foco ao fechar (§#64, achado da revisao de acessibilidade). Ao
  // escolher uma opcao/dia, o corpo do card e desmontado junto com o elemento
  // que estava focado — o navegador joga o foco para o <body> e o usuario de
  // teclado perde o lugar. Se isso aconteceu, trazemos o foco de volta para o
  // topo deste card. Se o foco foi para outro lugar de proposito (abrir outro
  // card, ou o autoFocus do card encadeado), activeElement NAO e o body e nao
  // mexemos — nada de roubar foco.
  useEffect(() => {
    const fechouAgora = estavaAberto.current && !aberto
    estavaAberto.current = aberto
    if (!fechouAgora) return
    const foco = document.activeElement
    if (!foco || foco === document.body) topoRef.current?.focus()
  }, [aberto])

  const classes = [
    'card-campo',
    aberto && 'aberto',
    faltando && 'falta',
    desabilitado && 'desabilitado',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <section className={classes} id={id}>
      <button
        ref={topoRef}
        type="button"
        className="card-campo-topo"
        onClick={aoClicar}
        disabled={desabilitado}
        // Só anuncia "expandido/recolhido" quando o card REALMENTE expande;
        // no modo atalho isso seria mentira para quem usa leitor de tela.
        aria-expanded={ehSanfona ? aberto : undefined}
      >
        <span className="card-campo-icone">
          <Icone nome={icone} size={20} />
        </span>
        <span className="card-campo-texto">
          <strong className="card-campo-titulo">
            {titulo}
            {selo && <span className="selo-imutavel">{selo}</span>}
          </strong>
          <span className={`card-campo-sub${preenchido ? ' ok' : ''}`}>
            {subtitulo}
          </span>
        </span>
        <Icone
          nome={
            ehSanfona
              ? aberto
                ? 'chevron-cima'
                : 'chevron-baixo'
              : 'chevron-direita'
          }
          size={18}
        />
      </button>

      {ehSanfona && aberto && <div className="card-campo-corpo">{children}</div>}
    </section>
  )
}
