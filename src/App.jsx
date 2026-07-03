import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import BoasVindas from './components/BoasVindas'
import Login from './components/Login'
import Painel from './components/Painel'
import './App.css'

// Componente raiz. Sua unica tarefa: saber se ha alguem logado (a
// "sessao") e mostrar a tela certa — Login ou a casca do app (Painel).
export default function App() {
  const [sessao, setSessao] = useState(null)
  const [carregando, setCarregando] = useState(true)
  // Boas-vindas: aparece antes do login a cada abertura do app sem sessao.
  // Estado em memoria (reseta a cada carregamento da pagina); "Continuar" fecha.
  const [mostrarBoasVindas, setMostrarBoasVindas] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session)
      setCarregando(false)
    })

    const { data: assinatura } = supabase.auth.onAuthStateChange(
      (_evento, novaSessao) => {
        setSessao(novaSessao)
      },
    )

    return () => assinatura.subscription.unsubscribe()
  }, [])

  if (carregando) {
    return (
      <main className="tela">
        <div className="cartao">Carregando…</div>
      </main>
    )
  }

  // Com sessao -> casca do app. Sem sessao -> boas-vindas (uma passagem por
  // abertura) e, ao "Continuar", o Login.
  if (sessao) return <Painel sessao={sessao} />
  return mostrarBoasVindas ? (
    <BoasVindas aoContinuar={() => setMostrarBoasVindas(false)} />
  ) : (
    <Login />
  )
}
