import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Inicio from './Inicio'
import Demandas from './Demandas'
import Clientes from './Clientes'
import Equipe from './Equipe'

// Casca do app logado: carrega o perfil do usuario, mostra a barra do
// topo (nome/papel/Sair), um menu (com contador de novidades nas
// Demandas) e renderiza a "secao" ativa.
export default function Painel({ sessao }) {
  const [perfil, setPerfil] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [secao, setSecao] = useState('inicio') // 'inicio' | 'demandas' | 'clientes' | 'equipe'
  const [novidades, setNovidades] = useState([]) // ids de demandas com mudanca de status nao vista

  useEffect(() => {
    async function buscarPerfil() {
      const { data, error } = await supabase
        .from('perfil')
        .select('id, nome_completo, papel')
        .eq('id', sessao.user.id)
        .single()

      if (error) {
        setErro('Seu usuário ainda não tem um perfil cadastrado.')
      } else {
        setPerfil(data)
      }
      setCarregando(false)
    }
    buscarPerfil()
  }, [sessao])

  async function recarregarNovidades() {
    const { data } = await supabase.rpc('demandas_com_novidade')
    if (data) setNovidades(data.map((r) => r.demanda_id))
  }

  useEffect(() => {
    recarregarNovidades()
  }, [])

  async function sair() {
    await supabase.auth.signOut()
  }

  if (carregando) {
    return (
      <main className="tela">
        <div className="cartao">Carregando…</div>
      </main>
    )
  }

  if (erro) {
    return (
      <main className="tela">
        <div className="cartao">
          <p className="erro">{erro}</p>
          <button type="button" onClick={sair}>
            Sair
          </button>
        </div>
      </main>
    )
  }

  return (
    <div className="app">
      <header className="topo">
        <div>
          <strong>Controle de Demandas</strong>
          <span className="quem">
            {' '}
            — {perfil.nome_completo} ({perfil.papel})
          </span>
        </div>
        <button type="button" className="link" onClick={sair}>
          Sair
        </button>
      </header>

      <nav className="menu">
        <button
          type="button"
          className={secao === 'inicio' ? 'ativo' : ''}
          onClick={() => setSecao('inicio')}
        >
          Início
        </button>
        <button
          type="button"
          className={secao === 'demandas' ? 'ativo' : ''}
          onClick={() => setSecao('demandas')}
        >
          Demandas
          {novidades.length > 0 && (
            <span className="badge-menu">{novidades.length}</span>
          )}
        </button>
        <button
          type="button"
          className={secao === 'clientes' ? 'ativo' : ''}
          onClick={() => setSecao('clientes')}
        >
          Clientes
        </button>
        {perfil.papel === 'admin' && (
          <button
            type="button"
            className={secao === 'equipe' ? 'ativo' : ''}
            onClick={() => setSecao('equipe')}
          >
            Equipe
          </button>
        )}
      </nav>

      <section className="conteudo">
        {secao === 'inicio' && <Inicio perfil={perfil} sessao={sessao} />}
        {secao === 'demandas' && (
          <Demandas
            perfil={perfil}
            novidades={new Set(novidades)}
            recarregarNovidades={recarregarNovidades}
          />
        )}
        {secao === 'clientes' && <Clientes perfil={perfil} />}
        {secao === 'equipe' && <Equipe perfil={perfil} />}
      </section>
    </div>
  )
}
