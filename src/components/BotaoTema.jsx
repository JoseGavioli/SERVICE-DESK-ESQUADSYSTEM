import { useState } from 'react'

// Botao de alternar tema claro/escuro. O tema inicial e definido por um
// script inline no index.html (le localStorage / preferencia do sistema)
// antes da pagina pintar, entao aqui so lemos o atual e alternamos.
export default function BotaoTema() {
  const [tema, setTema] = useState(
    () => document.documentElement.dataset.theme || 'light',
  )

  function alternar() {
    const novo = tema === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = novo
    localStorage.setItem('tema', novo)
    setTema(novo)
  }

  return (
    <button
      type="button"
      className="botao-tema"
      onClick={alternar}
      aria-label="Alternar tema claro/escuro"
      title="Alternar tema claro/escuro"
    >
      {tema === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}
