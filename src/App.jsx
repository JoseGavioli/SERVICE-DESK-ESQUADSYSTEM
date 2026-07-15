import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import BoasVindas from './components/BoasVindas'
import Login from './components/Login'
import Painel from './components/Painel'
import AvisoAtualizacao from './components/AvisoAtualizacao'
import AvisoConexao from './components/AvisoConexao'
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

  // Escolhe a tela: carregando -> sessao (casca do app) -> boas-vindas (uma
  // passagem por abertura) -> Login.
  let conteudo
  if (carregando) {
    conteudo = (
      <main className="tela">
        <div className="cartao">Carregando…</div>
      </main>
    )
  } else if (sessao) {
    conteudo = <Painel sessao={sessao} />
  } else if (mostrarBoasVindas) {
    conteudo = <BoasVindas aoContinuar={() => setMostrarBoasVindas(false)} />
  } else {
    conteudo = <Login />
  }

  // Os avisos ficam SEMPRE montados (fora do if): valem em qualquer tela —
  // inclusive no login — e podem aparecer a qualquer momento.
  return (
    <>
      <AvisoConexao />
      <AvisoAtualizacao />
      {conteudo}
    </>
  )
}
