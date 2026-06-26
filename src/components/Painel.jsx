import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Painel mostrado APOS o login. Ele busca, no banco, o perfil do
// usuario logado (nome e papel) e oferece o botao de sair.
// Recebe a "sessao" do App como propriedade (prop).
export default function Painel({ sessao }) {
  const [perfil, setPerfil] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  // useEffect roda depois que o componente aparece na tela.
  // Aqui ele busca UMA vez o perfil do usuario logado.
  useEffect(() => {
    async function buscarPerfil() {
      const { data, error } = await supabase
        .from('perfil')
        .select('nome_completo, papel')
        .eq('id', sessao.user.id) // so o proprio perfil (a RLS tambem garante isso)
        .single() // esperamos exatamente 1 linha

      if (error) {
        setErro('Seu usuário ainda não tem um perfil cadastrado na tabela "perfil".')
      } else {
        setPerfil(data)
      }
      setCarregando(false)
    }
    buscarPerfil()
  }, [sessao])

  async function sair() {
    await supabase.auth.signOut()
  }

  if (carregando) {
    return <div className="cartao">Carregando seu perfil…</div>
  }

  return (
    <div className="cartao">
      <h1>Você está logado ✅</h1>

      {erro ? (
        <p className="erro">{erro}</p>
      ) : (
        <>
          <p>
            Olá, <strong>{perfil.nome_completo}</strong>!
          </p>
          <p>
            Seu papel: <strong>{perfil.papel}</strong>
          </p>
        </>
      )}

      <p className="email">{sessao.user.email}</p>
      <button type="button" onClick={sair}>
        Sair
      </button>
    </div>
  )
}
