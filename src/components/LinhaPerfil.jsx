import { useState } from 'react'
import { supabase } from '../lib/supabase'
import ResetarSenha from './ResetarSenha'

const PAPEIS = [
  { valor: 'admin', rotulo: 'Admin' },
  { valor: 'atendente', rotulo: 'Atendente' },
  { valor: 'gerente', rotulo: 'Gerente' },
  { valor: 'vendedor', rotulo: 'Vendedor' },
]

// Form de EDICAO de um membro da Equipe (aberto in-place pela lista).
// Cada form cuida do proprio rascunho e salva com um update no banco.
// Trava de seguranca: voce NAO muda o proprio papel nem se desativa (evita
// se trancar para fora por engano) — reforcada pela RLS no banco.
export default function LinhaPerfil({
  perfilDaLinha,
  euId,
  aoSalvar,
  aoCancelar,
  // Estado do reset de senha: mora na EQUIPE, não aqui. Ver ResetarSenha.
  senhaNova,
  aoSenhaNova,
  aoEnviandoSenha,
  travado,
}) {
  const [nome, setNome] = useState(perfilDaLinha.nome_completo || '')
  const [celular, setCelular] = useState(perfilDaLinha.celular || '')
  const [papel, setPapel] = useState(perfilDaLinha.papel)
  const [ativo, setAtivo] = useState(perfilDaLinha.ativo)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const souEu = perfilDaLinha.id === euId

  async function salvar(evento) {
    evento.preventDefault()
    setSalvando(true)
    setErro('')

    const { error } = await supabase
      .from('perfil')
      .update({
        nome_completo: nome.trim(),
        celular: celular.trim() || null,
        papel,
        ativo,
      })
      .eq('id', perfilDaLinha.id)

    if (error) {
      setErro('Não foi possível salvar.')
      setSalvando(false)
    } else {
      aoSalvar() // a Equipe fecha o form e recarrega a lista
    }
  }

  return (
    <form className="form-novo form-cad" onSubmit={salvar}>
      <h4>Editar membro</h4>

      <input
        type="text"
        placeholder="Nome completo"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        required
        autoFocus
      />
      <input
        type="text"
        placeholder="Celular (opcional)"
        value={celular}
        onChange={(e) => setCelular(e.target.value)}
      />

      <label className="campo-papel">
        <span>Papel</span>
        <select
          value={papel}
          onChange={(e) => setPapel(e.target.value)}
          disabled={souEu}
          title={souEu ? 'Você não pode mudar o próprio papel' : ''}
        >
          {PAPEIS.map((p) => (
            <option key={p.valor} value={p.valor}>
              {p.rotulo}
            </option>
          ))}
        </select>
      </label>

      <label className="ativo-check">
        <input
          type="checkbox"
          checked={ativo}
          onChange={(e) => setAtivo(e.target.checked)}
          disabled={souEu}
        />
        Ativo{souEu && ' — você não pode se desativar'}
      </label>

      {/* Bloco proprio, com botao e resultado proprios. Trocar a senha passa
          por uma Edge Function (service_role), enquanto o resto do formulario
          e um update comum pela RLS — juntar os dois no mesmo "Salvar" deixaria
          metade aplicada quando um dos lados falhasse. */}
      <ResetarSenha
        perfilDaLinha={perfilDaLinha}
        souEu={souEu}
        senhaNova={senhaNova}
        aoSenhaNova={aoSenhaNova}
        aoEnviando={aoEnviandoSenha}
      />

      {erro && <p className="erro">{erro}</p>}

      {/* `travado` cobre DOIS momentos, e os dois pelo mesmo motivo: fechar
          este formulario destroi a senha nova. Enquanto o pedido esta EM VOO
          (nao da para abortar — a troca acontece de qualquer jeito) e enquanto
          a senha esta A VISTA. Sair daqui no meio deixaria a conta com uma
          senha que ninguem conhece. */}
      <div className="form-cad-acoes">
        <button
          type="submit"
          disabled={salvando || !nome.trim() || travado}
          title={travado ? 'Termine o reset de senha antes de sair' : ''}
        >
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
        <button
          type="button"
          className="link"
          onClick={aoCancelar}
          disabled={travado}
          title={travado ? 'Termine o reset de senha antes de sair' : ''}
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
