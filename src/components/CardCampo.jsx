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
//
// E um TERCEIRO modo, do desktop (§#83 B3): `sempreAberto`. O miolo ja vem
// renderizado, sem chevron, e o cabecalho deixa de ser botao — nao ha o que
// abrir/fechar. A sanfona existe para caber numa tela de CELULAR; no PC
// esconder atras de clique so adiciona cliques. Como todos os formularios
// (Nova demanda, ficha do fechamento, ver/editar ficha) sao feitos deste
// mesmo tijolo, uma prop expoe os campos nos tres.
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
  sempreAberto = false,
  aoClicar,
  children,
}) {
  const ehSanfona = Boolean(children) && !sempreAberto
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
    // No modo exposto nada fecha — nao ha foco a devolver. O ref e atualizado
    // ANTES do early-return de proposito: sem isso ele congelaria num valor
    // mentiroso ao trocar de modo com a janela (celular -> PC -> celular), e
    // na volta o card "fecharia" sozinho e roubaria o foco (achado da revisao).
    const fechouAgora = !sempreAberto && estavaAberto.current && !aberto
    estavaAberto.current = aberto && !sempreAberto
    if (!fechouAgora) return
    const foco = document.activeElement
    if (!foco || foco === document.body) topoRef.current?.focus()
  }, [aberto, sempreAberto])

  const classes = [
    'card-campo',
    // `aberto` marca QUAL card esta aberto (o icone acende). No modo exposto
    // todos estao — acender os 9 viraria uma parede de circulos coloridos.
    aberto && !sempreAberto && 'aberto',
    sempreAberto && 'exposto',
    faltando && 'falta',
    desabilitado && 'desabilitado',
  ]
    .filter(Boolean)
    .join(' ')

  // Miolo do cabecalho: o mesmo nos dois modos (icone + titulo + subtitulo).
  const cabecalho = (
    <>
      <span className="card-campo-icone">
        <Icone nome={icone} size={20} />
      </span>
      <span className="card-campo-texto">
        {/* No modo exposto o titulo vira HEADING: com tudo aberto a pagina
            fica longa, e quem usa leitor de tela perdeu os botoes que serviam
            de sumario — o heading devolve os pontos de salto (achado da
            revisao). Na sanfona o proprio <button> ja cumpre esse papel. */}
        <strong
          className="card-campo-titulo"
          role={sempreAberto ? 'heading' : undefined}
          aria-level={sempreAberto ? 3 : undefined}
        >
          {titulo}
          {selo && <span className="selo-imutavel">{selo}</span>}
        </strong>
        <span className={`card-campo-sub${preenchido ? ' ok' : ''}`}>
          {subtitulo}
        </span>
      </span>
    </>
  )

  return (
    <section className={classes} id={id}>
      {sempreAberto ? (
        // Exposto: cabecalho e so um TITULO. Botao aqui seria um controle que
        // nao controla nada — e o leitor de tela anunciaria um clicavel falso.
        <div className="card-campo-topo">{cabecalho}</div>
      ) : (
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
          {cabecalho}
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
      )}

      {/* Boolean(): sem ele, um children que fosse 0 ou '' seria IMPRESSO
          solto dentro do card em vez de sumir (armadilha do && em JSX). */}
      {Boolean(children) && (sempreAberto || (ehSanfona && aberto)) && (
        <div className="card-campo-corpo">{children}</div>
      )}
    </section>
  )
}
