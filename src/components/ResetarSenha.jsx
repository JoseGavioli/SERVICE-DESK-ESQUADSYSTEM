import { useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  copiarTexto,
  mensagemDoErro,
  senhaSugerida,
  SENHA_MINIMA,
} from '../lib/senha'
import Credenciais from './Credenciais'

// Bloco "Senha" dentro do "Editar membro" (tela Equipe).
//
// Para quem esqueceu a senha: sem entrar, a pessoa não alcança o "Meu perfil"
// para trocá-la sozinha. O admin define uma nova e passa adiante.
//
// NÃO É UM <form>: ele é renderizado DENTRO do formulário do LinhaPerfil, e
// form dentro de form é HTML inválido. Por isso todo botão aqui leva
// `type="button"` — sem isso o botão vira submit e salva o perfil ao clicar.
//
// A SENHA NOVA MORA NA TELA EQUIPE, não aqui — e nem no LinhaPerfil.
//
// Ela só existe legível em memória (no banco vira hash), e este componente é
// dos mais frágeis do app: some quando o formulário fecha, quando o lápis de
// OUTRA linha é clicado, e quando a busca filtra esta linha para fora. Guardar
// a senha aqui dentro era deixá-la num lugar que qualquer um desses três
// gestos apaga em silêncio. Guardada na Equipe, ela sobrevive a todos — e é a
// Equipe quem tranca os gestos enquanto a senha estiver à vista.
export default function ResetarSenha({
  perfilDaLinha,
  souEu,
  senhaNova, // { id, nome, senha } | null — de quem é a senha na tela
  aoSenhaNova,
  aoEnviando,
}) {
  const [aberto, setAberto] = useState(false)
  const [senha, setSenha] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [copiado, setCopiado] = useState(false)

  // Conferir o id não é zelo excessivo: mostrar a senha de uma pessoa na linha
  // de outra seria o pior erro possível desta tela.
  const minhaSenha = senhaNova?.id === perfilDaLinha.id ? senhaNova : null

  const nome = perfilDaLinha.nome_completo || 'este membro'

  // A regra é a mesma da Edge Function, que é quem manda: o admin troca a
  // PRÓPRIA senha no Meu perfil, onde ela é digitada duas vezes. Aqui não há
  // confirmação, e um erro de digitação trancaria para fora justamente quem
  // conserta as coisas.
  if (souEu) {
    return (
      <p className="rs-nota">
        Para trocar a <strong>sua</strong> senha, use o <strong>Meu perfil</strong>.
      </p>
    )
  }

  async function resetar() {
    if (salvando) return // duplo clique não manda dois pedidos
    setSalvando(true)
    setErro('')
    // Avisa a Equipe ANTES de sair: o pedido não é abortável, e a partir daqui
    // fechar o formulário deixaria a senha trocada no servidor sem ninguém
    // saber qual é. Ela tranca a tela durante o voo.
    aoEnviando(true)

    const { error } = await supabase.functions.invoke('resetar-senha', {
      body: { id: perfilDaLinha.id, senha },
    })

    setSalvando(false)
    aoEnviando(false)

    if (error) {
      // NÃO afirma que a senha continua a mesma: se a conexão caiu depois de o
      // servidor responder, ela PODE ter sido trocada — e aí a pessoa não
      // entraria mais com a antiga. Prometer o que não se sabe é pior que
      // admitir a dúvida.
      setErro(
        await mensagemDoErro(
          error,
          'Não deu para confirmar a troca. Se a pessoa não entrar com a senha antiga, resete de novo.',
        ),
      )
      return
    }

    aoSenhaNova({ id: perfilDaLinha.id, nome, senha })
  }

  async function copiar() {
    const deu = await copiarTexto(
      `Acesso ao Service Desk\nSenha nova: ${minhaSenha.senha}`,
    )
    setCopiado(deu)
    setErro(deu ? '' : 'Não foi possível copiar — selecione o texto e copie à mão.')
  }

  function fechar() {
    aoSenhaNova(null)
    setAberto(false)
    setSenha('')
    setErro('')
    setCopiado(false)
  }

  if (minhaSenha) {
    return (
      <div className="rs-bloco">
        <h5>Senha trocada</h5>
        <p className="rs-nota">
          {minhaSenha.nome} já entra com esta senha —{' '}
          <strong>ela não aparece de novo</strong> depois que você fechar. A
          pessoa pode trocá-la em Meu perfil.
        </p>

        <Credenciais itens={[{ rotulo: 'Senha', valor: minhaSenha.senha }]} />

        {erro && <p className="erro">{erro}</p>}

        <div className="form-cad-acoes nm-acoes">
          <button type="button" onClick={copiar}>
            {copiado ? 'Copiado!' : 'Copiar senha'}
          </button>
          <button type="button" className="link" onClick={fechar}>
            Fechar
          </button>
        </div>
      </div>
    )
  }

  if (!aberto) {
    return (
      <div className="rs-bloco">
        <button
          type="button"
          className="rs-abrir"
          onClick={() => setAberto(true)}
        >
          Resetar senha
        </button>
        <p className="rs-nota">
          Para quem esqueceu a senha e não consegue entrar.
        </p>
      </div>
    )
  }

  return (
    <div className="rs-bloco">
      <h5>Resetar senha</h5>
      <p className="rs-nota">
        A senha atual de <strong>{nome}</strong> deixa de valer na hora. Anote a
        nova antes de fechar — ela não aparece duas vezes.
      </p>

      <div className="nm-senha">
        <input
          type="text"
          placeholder={`Senha nova (mínimo ${SENHA_MINIMA} caracteres)`}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          autoComplete="off"
          onKeyDown={(e) => {
            // Este campo mora DENTRO do formulário de editar membro, que tem
            // um botão de submit habilitado. Sem o preventDefault, o Enter
            // dispara o ENVIO IMPLÍCITO do form: salvava o perfil, fechava o
            // editor e a senha sumia sem o reset ter acontecido — parecendo
            // que tinha dado certo. Aqui Enter faz o que o dedo quis: troca a
            // senha. (Mesmo remédio do SeletorObra; §#64 conta a 1ª vez que
            // este projeto levou essa rasteira.)
            if (e.key !== 'Enter') return
            e.preventDefault()
            if (!salvando && senha.length >= SENHA_MINIMA) resetar()
          }}
        />
        <button type="button" onClick={() => setSenha(senhaSugerida())}>
          Sugerir
        </button>
      </div>

      {erro && <p className="erro">{erro}</p>}

      <div className="form-cad-acoes nm-acoes">
        {/* O botão diz o NOME de quem vai perder a senha: aqui não há tela de
            confirmação, e o preço de errar a pessoa é trancar alguém para
            fora do app. */}
        <button
          type="button"
          className="rs-confirmar"
          onClick={resetar}
          disabled={salvando || senha.length < SENHA_MINIMA}
        >
          {salvando ? 'Trocando…' : `Trocar a senha de ${nome}`}
        </button>
        <button
          type="button"
          className="link"
          onClick={() => {
            setAberto(false)
            setSenha('')
            setErro('')
          }}
          disabled={salvando}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
