import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import LinhaPerfil from './LinhaPerfil'
import Icone from './Icone'

// Iniciais (ate 2 letras) para o avatar do membro.
function iniciais(nome) {
  if (!nome) return '?'
  const p = nome.trim().split(/\s+/)
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase()
}

const ROTULO_PAPEL = {
  admin: 'Admin',
  atendente: 'Atendente',
  gerente: 'Gerente',
  vendedor: 'Vendedor',
}

// Tela "Equipe" (so Admin): lista os perfis com busca + edicao in-place.
// A criacao do LOGIN e feita no painel do Supabase; o gatilho cria o perfil
// automaticamente, e ele aparece aqui para ajuste de nome/papel/ativo.
export default function Equipe({ perfil, naoLidas, aoAbrirNotif }) {
  const [perfis, setPerfis] = useState([])
  const [busca, setBusca] = useState('')
  const [editandoId, setEditandoId] = useState(null)
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

  const termo = busca.trim().toLowerCase()
  const filtrados = termo
    ? perfis.filter((p) => (p.nome_completo || '').toLowerCase().includes(termo))
    : perfis

  if (carregando) return <p>Carregando equipe…</p>

  return (
    <div className="secao-equipe">
      <header className="hero-demandas">
        <h1 className="hero-titulo">Equipe</h1>
        <div className="hero-acoes">
          <button
            type="button"
            className="btn-circular"
            onClick={aoAbrirNotif}
            aria-label="Notificações"
            title="Notificações"
          >
            <Icone nome="sino" size={20} />
            {naoLidas > 0 && <span className="sino-badge">{naoLidas}</span>}
          </button>
        </div>
      </header>

      <div className="campo-busca">
        <span className="campo-busca-icone">
          <Icone nome="lupa" size={18} />
        </span>
        <input
          type="search"
          className="input-busca"
          placeholder="Buscar por nome…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {erro && <p className="erro">{erro}</p>}

      {filtrados.length === 0 ? (
        <p className="vazio">Ninguém encontrado.</p>
      ) : (
        <ul className="lista-cad">
          {filtrados.map((p) => (
            <li key={p.id} className="cad-bloco">
              {editandoId === p.id ? (
                <LinhaPerfil
                  perfilDaLinha={p}
                  euId={perfil.id}
                  aoSalvar={() => {
                    setEditandoId(null)
                    carregar()
                  }}
                  aoCancelar={() => setEditandoId(null)}
                />
              ) : (
                <div className="cad-linha">
                  <div className="cad-item cad-item-estatico">
                    <span
                      className={`cad-avatar ${p.ativo ? '' : 'cad-avatar-inativo'}`}
                    >
                      {iniciais(p.nome_completo)}
                    </span>
                    <span className="cad-texto">
                      <strong className="cad-nome">
                        {p.nome_completo || '(sem nome)'}
                        {p.id === perfil.id && <span className="tag-voce">você</span>}
                      </strong>
                      <span className="cad-sub-chips">
                        <span className={`chip-papel papel-${p.papel}`}>
                          {ROTULO_PAPEL[p.papel] ?? p.papel}
                        </span>
                        {!p.ativo && <span className="chip-inativo">desativado</span>}
                        {p.celular && (
                          <span className="cad-celular">{p.celular}</span>
                        )}
                      </span>
                    </span>
                  </div>
                  <button
                    type="button"
                    className="cad-editar"
                    title="Editar membro"
                    aria-label="Editar membro"
                    onClick={() => setEditandoId(p.id)}
                  >
                    <Icone nome="editar" size={16} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Como adicionar alguem: a criacao do login e no painel do Supabase. */}
      <div className="equipe-dica">
        <Icone nome="aviso" size={16} />
        <p>
          Para adicionar um membro, crie o login no painel do Supabase
          (Authentication → Add user). O perfil aparece aqui automaticamente —
          depois é só editar o nome e o papel.
        </p>
      </div>
    </div>
  )
}
