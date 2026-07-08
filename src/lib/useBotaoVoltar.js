import { useEffect, useRef } from 'react'

// useBotaoVoltar — faz o botao/gesto "voltar" do celular navegar DENTRO do app
// (fecha o que esta aberto / volta de tela) em vez de sair de cara (§issue #40).
// Foco Android: no iPhone o PWA em tela cheia nao tem gesto/botao de voltar
// nativo, entao la nao muda nada.
//
// Modelo "armadilha": mantemos SEMPRE uma entrada extra no historico do
// navegador. Cada "voltar" consome essa entrada e dispara `popstate`; nos
// re-armamos (empurramos outra) e decidimos o que fazer com base no estado
// ATUAL do app:
//   - ha algo aberto (overlay/detalhe/form/outra secao) -> fecha 1 nivel;
//   - na raiz (Inicio, nada aberto) -> 1o toque pede confirmacao (aoPedirSair),
//     e um 2o toque em ~2s deixa o "voltar" seguir e sair do app.
//
// Recebe funcoes que leem o estado atual; guardamos em ref para o handler de
// popstate sempre enxergar os valores mais recentes (sem closure velha).
export function useBotaoVoltar({ podeVoltar, voltar, aoPedirSair }) {
  const fns = useRef({ podeVoltar, voltar, aoPedirSair })
  fns.current = { podeVoltar, voltar, aoPedirSair }
  const querendoSair = useRef(false)
  const timer = useRef(null)

  useEffect(() => {
    // Arma a armadilha (a 1a entrada extra que o "voltar" vai consumir).
    window.history.pushState({ armadilha: true }, '')

    function aoPopstate() {
      const { podeVoltar, voltar, aoPedirSair } = fns.current

      // 2o toque na Inicio (dentro da janela de ~2s): deixa sair de verdade.
      if (querendoSair.current) {
        querendoSair.current = false
        clearTimeout(timer.current)
        window.history.back()
        return
      }

      // Re-arma para continuar capturando o proximo "voltar".
      window.history.pushState({ armadilha: true }, '')

      if (podeVoltar()) {
        voltar() // fecha 1 nivel dentro do app
      } else {
        // Raiz (Inicio, nada aberto): avisa e arma a janela de saida.
        querendoSair.current = true
        aoPedirSair()
        clearTimeout(timer.current)
        timer.current = setTimeout(() => {
          querendoSair.current = false
        }, 2000)
      }
    }

    window.addEventListener('popstate', aoPopstate)
    return () => {
      window.removeEventListener('popstate', aoPopstate)
      clearTimeout(timer.current)
    }
  }, [])
}
