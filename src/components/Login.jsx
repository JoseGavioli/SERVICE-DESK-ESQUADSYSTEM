import { useState } from 'react'
import { supabase } from '../lib/supabase'
import Icone from './Icone'

// Tela de login: email + senha -> supabase.auth.signInWithPassword().
// Quando o login da certo, NAO precisamos avisar o App manualmente:
// o Supabase dispara um evento de "mudanca de sessao" que o App escuta.
export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [verSenha, setVerSenha] = useState(false) // olho: mostra/oculta a senha
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
      <form className="cartao cartao-login" onSubmit={entrar}>
        <img className="logo-login" src="/logo-icone.svg" alt="EsquadSystem" />

        <div className="login-cabecalho">
          <h1>Bem-vindo de volta</h1>
          <p className="subtitulo">
            Acesse o Service Desk da EsquadSystem com seu email e senha.
          </p>
        </div>

        {/* Campo de email: icone dentro, à esquerda (estilo referencia). */}
        <div className="campo-login">
          <span className="campo-icone-esq">
            <Icone nome="email" size={18} />
          </span>
          <input
            type="email"
            className="input-icone"
            placeholder="Email"
            aria-label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        {/* Campo de senha: cadeado à esquerda + olho à direita (mostrar/ocultar). */}
        <div className="campo-login">
          <span className="campo-icone-esq">
            <Icone nome="cadeado" size={18} />
          </span>
          <input
            type={verSenha ? 'text' : 'password'}
            className="input-icone com-olho"
            placeholder="Senha"
            aria-label="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            autoComplete="current-password"
          />
          <button
            type="button"
            className="campo-olho"
            onClick={() => setVerSenha((v) => !v)}
            aria-label={verSenha ? 'Ocultar senha' : 'Mostrar senha'}
            title={verSenha ? 'Ocultar senha' : 'Mostrar senha'}
          >
            <Icone nome={verSenha ? 'olho-fechado' : 'olho'} size={18} />
          </button>
        </div>

        {erro && <p className="erro">{erro}</p>}

        <button type="submit" disabled={carregando}>
          {carregando ? 'Entrando…' : 'Entrar'}
        </button>

        {/* Reset de senha e' feito pelo admin (§5) — nao ha auto-atendimento. */}
        <p className="login-ajuda">Esqueceu a senha? Fale com o administrador.</p>
      </form>
    </main>
  )
}
