import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import LinhaPerfil from './LinhaPerfil'

// Tela "Equipe" (so Admin). Lista todos os perfis e deixa editar cada um.
// A criacao do LOGIN e feita no painel do Supabase; o gatilho cria o
// perfil automaticamente, e ele aparece aqui.
export default function Equipe({ perfil }) {
  const [perfis, setPerfis] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  async function carregar() {
    setCarregando(true)
    const { data, error } = await supabase
      .from('perfil')
      .select('id, nome_completo, celular, papel, ativo')
      .order('nome_completo')

    if (error) setErro('Não foi possível carregar a equipe.')
    else setPerfis(data)
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  if (carregando) return <p>Carregando equipe…</p>

  return (
    <div className="secao-equipe">
      <p className="dica">
        Para adicionar um membro, crie o login no painel do Supabase
        (Authentication → Add user). O perfil aparece aqui automaticamente —
        depois você ajusta o nome e o papel.
      </p>

      {erro && <p className="erro">{erro}</p>}

      <ul className="lista-equipe">
        {perfis.map((p) => (
          <LinhaPerfil
            key={p.id}
            perfilDaLinha={p}
            euId={perfil.id}
            aoSalvar={carregar}
          />
        ))}
      </ul>
    </div>
  )
}
