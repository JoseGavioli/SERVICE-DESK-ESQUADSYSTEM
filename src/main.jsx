import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { ligarCapturaGlobal, registrarErro } from './lib/erros'

// Erros FORA da renderizacao (assincronos, handlers) — o boundary nao pega
// esses, entao escutamos no window e mandamos para o erro_log tambem.
ligarCapturaGlobal()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary
      onError={(erro, info) =>
        registrarErro('boundary-topo', erro, info?.componentStack)
      }
    >
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
