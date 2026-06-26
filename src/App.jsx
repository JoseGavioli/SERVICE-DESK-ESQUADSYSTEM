import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Login from './components/Login'
import Painel from './components/Painel'
import './App.css'

// Componente raiz. Sua unica tarefa nesta fase: saber se ha alguem
// logado (a "sessao") e mostrar a tela certa — Login ou Painel.
export default function App() {
  const [sessao, setSessao] = useState(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    // 1) Ao abrir o app, pergunta ao Supabase se ja existe uma sessao
    //    salva (ex.: o usuario fechou e reabriu sem deslogar).
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session)
      setCarregando(false)
    })

    // 2) Fica "ouvindo" mudancas de sessao: tanto o login quanto o
    //    logout disparam aqui, e a tela se atualiza sozinha.
    const { data: assinatura } = supabase.auth.onAuthStateChange(
      (_evento, novaSessao) => {
        setSessao(novaSessao)
      },
    )

    // 3) Limpeza: quando o App sai de tela, cancelamos a "escuta".
    return () => assinatura.subscription.unsubscribe()
  }, [])

  if (carregando) {
    return (
      <main className="tela">
        <div className="cartao">Carregando…</div>
      </main>
    )
  }

  // Sem sessao -> tela de login. Com sessao -> painel.
  return (
    <main className="tela">
      {sessao ? <Painel sessao={sessao} /> : <Login />}
    </main>
  )
}
