import { useState } from 'react'
import { supabase } from '../lib/supabase'

// Tela de login: email + senha -> supabase.auth.signInWithPassword().
// Quando o login da certo, NAO precisamos avisar o App manualmente:
// o Supabase dispara um evento de "mudanca de sessao" que o App escuta.
export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  async function entrar(evento) {
    evento.preventDefault() // impede o recarregamento padrao do formulario
    setErro('')
    setCarregando(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    })

    if (error) {
      setErro('Não foi possível entrar. Confira o email e a senha.')
    }
    setCarregando(false)
  }

  return (
    <main className="tela">
      <form className="cartao" onSubmit={entrar}>
        <img
          className="logo-login"
          src="/logo-esquadsystem-h.svg"
          alt="EsquadSystem"
        />
        <h1>Controle de Demandas</h1>

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>

        <label>
          Senha
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>

        {erro && <p className="erro">{erro}</p>}

        <button type="submit" disabled={carregando}>
          {carregando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  )
}
