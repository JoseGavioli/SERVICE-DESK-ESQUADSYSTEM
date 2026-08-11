import { useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  copiarTexto,
  mensagemDoErro,
  senhaSugerida,
  SENHA_MINIMA,
} from '../lib/senha'
import Credenciais from './Credenciais'

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

// "Confira na lista" nao e frase de enfeite: a rede pode cair DEPOIS de a
// funcao ter criado o login. Mandar "tente de novo" seco levaria o admin a
// repetir e esbarrar em "ja existe um usuario com esse email", sem entender.
const FALHA =
  'Não foi possível criar o membro. Confira na lista se ele já apareceu antes de tentar de novo.'

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
      setErro(await mensagemDoErro(error, FALHA))
      setSalvando(false)
      return
    }

    setPronto({ nome: nome.trim(), email: email.trim(), senha, aviso: data?.aviso })
    setSalvando(false)
    aoCriar() // a Equipe recarrega a lista e o novo membro aparece acima
  }

  async function copiar() {
    const deu = await copiarTexto(
      `Acesso ao Service Desk\nEmail: ${pronto.email}\nSenha: ${pronto.senha}`,
    )
    setCopiado(deu)
    // o `setErro('')` no sucesso limpa uma falha ANTERIOR de copia: sem ele,
    // um primeiro clique que deu errado deixava o recado "copie a mao" na tela
    // mesmo depois de o segundo clique funcionar
    setErro(deu ? '' : 'Não foi possível copiar — selecione o texto e copie à mão.')
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

        <Credenciais
          itens={[
            { rotulo: 'Email', valor: pronto.email },
            { rotulo: 'Senha', valor: pronto.senha },
          ]}
        />

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
