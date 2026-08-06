import { useEffect, useRef } from 'react'
import Icone from './Icone'

// Menu do botao "Nova demanda" (§issue #85, fase 1).
//
// Antes o botao ia direto ao formulario. Agora ele pergunta o CAMINHO:
// "Orcamento" (o formulario de sempre) ou um item por tipo COM FICHA (hoje so
// o Fechamento), que cai no formulario ja com o tipo escolhido.
//
// O mesmo componente serve os dois botoes — o FAB do celular e o vermelho do
// menu lateral. Quem muda e so a posicao, por CSS (`lugar`): no celular ele
// sobe do rodape; no desktop ele encosta no botao da barra.
export default function MenuNovaDemanda({ tiposComFicha, aoEscolher, aoFechar, lugar }) {
  const caixaRef = useRef(null)

  // Fecha ao clicar FORA e no Esc — as duas saidas que todo mundo tenta por
  // reflexo. `pointerdown` e nao `click`: fechar so no click deixaria o menu
  // vivo por cima do alvo enquanto o dedo ja escolheu outra coisa.
  useEffect(() => {
    function foraDaqui(e) {
      // O proprio botao que abre NAO conta como "fora". Sem esta linha ele
      // ficaria impossivel de fechar por si: o pointerdown fecharia e o click
      // logo em seguida reabriria, e o menu s'o piscaria.
      if (e.target.closest?.('[data-abre-menu-nova]')) return
      if (!caixaRef.current?.contains(e.target)) aoFechar()
    }
    function noEsc(e) {
      if (e.key !== 'Escape') return
      // Fecha SO a camada de cima. O Esc do painel de detalhe escuta no
      // `window` e este aqui no `document` (que roda antes): sem o
      // stopPropagation, um Esc fecharia o menu E a demanda aberta atras.
      e.stopPropagation()
      aoFechar()
    }
    document.addEventListener('pointerdown', foraDaqui)
    document.addEventListener('keydown', noEsc)
    return () => {
      document.removeEventListener('pointerdown', foraDaqui)
      document.removeEventListener('keydown', noEsc)
    }
  }, [aoFechar])

  return (
    <div className={`menu-nova menu-nova-${lugar}`} ref={caixaRef} role="menu">
      {/* Orcamento = o formulario de sempre. `null` porque nao ha tipo
          pre-escolhido: quem escolhe entre os tipos SEM ficha (orcamento novo,
          revisao, adendos...) continua sendo o card "Tipo" la dentro. */}
      <button
        type="button"
        role="menuitem"
        className="menu-nova-item"
        onClick={() => aoEscolher(null)}
      >
        <Icone nome="lista" size={18} />
        <span>
          <strong>Orçamento</strong>
          <small>Orçamento novo, revisão, adendo…</small>
        </span>
      </button>

      {tiposComFicha.map((t) => (
        <button
          key={t.id}
          type="button"
          role="menuitem"
          className="menu-nova-item"
          onClick={() => aoEscolher(t.id)}
        >
          <Icone nome="arquivo" size={18} />
          <span>
            <strong>{t.nome}</strong>
            <small>Com ficha de pedido de vendas</small>
          </span>
        </button>
      ))}
    </div>
  )
}
