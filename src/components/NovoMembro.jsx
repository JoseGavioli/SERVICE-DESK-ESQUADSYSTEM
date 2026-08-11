import { useState } from 'react'
import { supabase } from '../lib/supabase'

// Form de CADASTRO de um membro (§issue #16), aberto pela tela Equipe.
//
// Criar um login exige a service_role, que nao pode viver no frontend — por
// isso quem cria e a Edge Function `criar-usuario`, e aqui so montamos o
// pedido. Ela confere de novo tudo o que este form confere: o que vale e o
// que o servidor diz, nao o que a tela deixou passar.

const PAPEIS = [
  { valor: 'vendedor', rotulo: 'Vendedor' },
  { valor: 'atendente', rotulo: 'Atendente' },
  { valor: 'gerente', rotulo: 'Gerente' },
  { valor: 'admin', rotulo: 'Admin' },
]

// Repetido de proposito na funcao (SENHA_MINIMA la tambem) e igual ao do
// "Meu perfil". Aqui e so para nao gastar uma ida ao servidor com uma senha
// curta; quem REALMENTE barra e a funcao.
const SENHA_MINIMA = 6

const TAMANHO_SUGERIDO = 8
// Sem os caracteres que se confundem quando alguem LE a senha em voz alta ou
// copia dela de um print: l/I/1 e O/0 ficaram de fora.
const ALFABETO = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function senhaSugerida() {
  const sorteio = new Uint32Array(TAMANHO_SUGERIDO)
  crypto.getRandomValues(sorteio)
  return Array.from(sorteio, (n) => ALFABETO[n % ALFABETO.length]).join('')
}

// O `invoke` NAO entrega o corpo da resposta quando ela nao e 2xx: o
// `error.message` vem sempre a MESMA frase em ingles ("Edge Function returned
// a non-2xx status code"). O texto que a funcao escreveu — "Ja existe um
// usuario com esse email", "Apenas admin ativo pode cadastrar" — esta no
// `error.context`, que e um Response ainda por ler. Sem isto, a funcao fica
// bem-educada por dentro e muda para o ingles na hora de falar com o usuario.
async function mensagemDoErro(erro) {
  try {
    const corpo = await erro?.context?.json?.()
    if (corpo?.error) return corpo.error
  } catch {
    // resposta sem corpo JSON (falha de rede, timeout): cai no texto abaixo
  }
  // "Confira na lista" nao e frase de enfeite: a rede pode cair DEPOIS de a
  // funcao ter criado o login. Mandar "tente de novo" seco levaria o admin a
  // repetir e esbarrar em "ja existe um usuario com esse email", sem entender.
  return 'Não foi possível criar o membro. Confira na lista se ele já apareceu antes de tentar de novo.'
}

export default function NovoMembro({ aoCriar, aoFechar }) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [celular, setCelular] = useState('')
  const [papel, setPapel] = useState('vendedor')
  const [senha, setSenha] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  // Depois de criado o form some e da lugar a esta caixa: e o unico momento em
  // que a senha existe em algum lugar legivel (no banco ela vira hash).
  const [pronto, setPronto] = useState(null)
  const [copiado, setCopiado] = useState(false)

  async function criar(evento) {
    evento.preventDefault()
    setSalvando(true)
    setErro('')

    const { data, error } = await supabase.functions.invoke('criar-usuario', {
      body: {
        email: email.trim(),
        senha,
        nome_completo: nome.trim(),
        papel,
        celular: celular.trim(),
      },
    })

    if (error) {
      setErro(await mensagemDoErro(error))
      setSalvando(false)
      return
    }

    setPronto({ nome: nome.trim(), email: email.trim(), senha, aviso: data?.aviso })
    setSalvando(false)
    aoCriar() // a Equipe recarrega a lista e o novo membro aparece acima
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(
        `Acesso ao Service Desk\nEmail: ${pronto.email}\nSenha: ${pronto.senha}`,
      )
      setCopiado(true)
      // limpa uma falha ANTERIOR de copia: sem isto, um primeiro clique que
      // deu errado deixava o recado "copie a mao" na tela mesmo depois de o
      // segundo clique funcionar
      setErro('')
    } catch {
      setErro('Não foi possível copiar — selecione o texto e copie à mão.')
    }
  }

  if (pronto) {
    return (
      <div className="form-novo form-cad">
        <h3>Membro criado</h3>
        <p className="nm-nota">
          <strong>{pronto.nome}</strong> já consegue entrar. Passe estes dados
          para a pessoa — <strong>a senha não aparece de novo</strong> depois
          que você fechar.
        </p>

        <dl className="nm-credenciais">
          <div>
            <dt>Email</dt>
            <dd>
              <code>{pronto.email}</code>
            </dd>
          </div>
          <div>
            <dt>Senha</dt>
            <dd>
              <code>{pronto.senha}</code>
            </dd>
          </div>
        </dl>

        {pronto.aviso && <p className="aviso">{pronto.aviso}</p>}
        {erro && <p className="erro">{erro}</p>}

        <div className="form-cad-acoes nm-acoes">
          <button type="button" onClick={copiar}>
            {copiado ? 'Copiado!' : 'Copiar dados'}
          </button>
          <button type="button" className="link" onClick={aoFechar}>
            Fechar
          </button>
        </div>
      </div>
    )
  }

  return (
    <form className="form-novo form-cad" onSubmit={criar}>
      <h3>Novo membro</h3>

      <input
        type="text"
        placeholder="Nome completo"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        required
        autoFocus
      />
      <input
        type="email"
        placeholder="Email (é com ele que a pessoa entra)"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="off"
      />
      <input
        type="text"
        placeholder="Celular (opcional)"
        value={celular}
        onChange={(e) => setCelular(e.target.value)}
      />

      <label className="campo-papel">
        <span>Papel</span>
        <select value={papel} onChange={(e) => setPapel(e.target.value)}>
          {PAPEIS.map((p) => (
            <option key={p.valor} value={p.valor}>
              {p.rotulo}
            </option>
          ))}
        </select>
      </label>

      {/* A senha fica A VISTA: voce precisa LE-LA para passar adiante, e
          esconde-la so criaria erro de digitacao (e um segundo campo de
          confirmacao). Ela ainda nao e segredo de ninguem. */}
      <div className="nm-senha">
        <input
          type="text"
          placeholder={`Senha (mínimo ${SENHA_MINIMA} caracteres)`}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
          minLength={SENHA_MINIMA}
          autoComplete="off"
        />
        <button type="button" onClick={() => setSenha(senhaSugerida())}>
          Sugerir
        </button>
      </div>
      <p className="nm-nota">
        A pessoa pode trocar a senha depois, em <strong>Meu perfil</strong>.
      </p>

      {erro && <p className="erro">{erro}</p>}

      <div className="form-cad-acoes nm-acoes">
        <button
          type="submit"
          disabled={
            salvando ||
            !nome.trim() ||
            !email.trim() ||
            senha.length < SENHA_MINIMA
          }
        >
          {salvando ? 'Criando…' : 'Criar membro'}
        </button>
        {/* O Cancelar TAMBEM trava durante o envio. O pedido nao e abortavel:
            fechar no meio derruba este componente, mas a funcao segue e cria o
            login — e a senha, que so existe aqui no estado, some com ele. A
            pessoa apareceria na lista sem ninguem saber a senha dela. */}
        <button
          type="button"
          className="link"
          onClick={aoFechar}
          disabled={salvando}
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
