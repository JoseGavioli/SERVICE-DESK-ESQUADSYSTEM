import { Component } from 'react'
import Icone from './Icone'

// Amortecedor de erros de render (§melhoria "rede de seguranca").
// Se uma tela quebra, em vez da TELA BRANCA mostramos uma mensagem amigavel +
// "Recarregar". Error boundary SO existe como CLASSE (o React nao oferece via
// hook). O `onError` (opcional) sera usado no passo 2 para gravar o erro no
// banco — aqui ele so e chamado, se existir.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { erro: null }
  }

  // Ao pegar um erro na renderizacao dos filhos, guarda no estado -> troca
  // para o fallback na proxima renderizacao.
  static getDerivedStateFromError(erro) {
    return { erro }
  }

  // Efeito colateral do erro (logar). Blindado: o proprio log NUNCA pode
  // derrubar o app (senao viraria um loop de erro).
  componentDidCatch(erro, info) {
    try {
      console.error('ErrorBoundary pegou:', erro, info)
      if (this.props.onError) this.props.onError(erro, info)
    } catch {
      /* ignora: log nao pode quebrar */
    }
  }

  render() {
    if (this.state.erro) {
      return (
        <div className="erro-boundary" role="alert">
          <Icone nome="aviso" size={34} />
          <h2 className="erro-boundary-titulo">Algo deu errado</h2>
          <p className="erro-boundary-texto">
            Esta tela travou. Você pode tentar outra tela pelo menu ou
            recarregar o app.
          </p>
          <button
            type="button"
            className="erro-boundary-btn"
            onClick={() => window.location.reload()}
          >
            Recarregar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
