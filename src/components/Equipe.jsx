import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { textoPresenca, ultimoVistoMs, useTique } from '../lib/usePresenca'
import LinhaPerfil from './LinhaPerfil'
import NovoMembro from './NovoMembro'
import Avatar from './Avatar'
import Icone from './Icone'

const ROTULO_PAPEL = {
  admin: 'Admin',
  atendente: 'Atendente',
  gerente: 'Gerente',
  vendedor: 'Vendedor',
}

// Tela "Equipe" (so Admin): lista os perfis com busca, edicao in-place e o
// CADASTRO de um novo membro (§issue #16 — antes o login tinha de ser criado
// a mao no painel do Supabase).
export default function Equipe({
  perfil,
  online = new Map(),
  vistos = new Map(),
  naoLidas,
  aoAbrirNotif,
  aoVoltar,
}) {
  // Presença (§#46): a Equipe é do admin, então aqui é ele quem vê o online
  // (de todos). O gerente vê os vendedores online pelo Dashboard.
  const ehAdmin = perfil.papel === 'admin'
  const estaOnline = (p) => online.has(p.id) // online AO VIVO agora
  useTique() // atualiza o "online há X" enquanto a tela fica aberta
  const [perfis, setPerfis] = useState([])
  const [busca, setBusca] = useState('')
  const [editandoId, setEditandoId] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [mostrarNovo, setMostrarNovo] = useState(false)
  const [erro, setErro] = useState('')

  // NAO volta a ligar o `carregando`: ele so vale na PRIMEIRA carga. Recarregar
  // depois de salvar trocava a tela inteira pelo "Carregando equipe…" por um
  // instante — o que, no cadastro, desmontava o form junto com a caixa que
  // mostra a senha recem-criada. Ela nao aparece de novo em lugar nenhum.
  async function carregar() {
    const { data, error } = await supabase
      .from('perfil')
      .select('id, nome_completo, celular, papel, ativo, visto_em, avatar_path')
      .order('nome_completo')

    // O sucesso LIMPA o erro. Sem isso, uma primeira carga que falhasse por
    // oscilacao de rede deixava o recado vermelho preso na tela — agora
    // convivendo com a lista certa logo abaixo, ja que a tela nao volta mais
    // para o "Carregando equipe…" entre uma carga e outra.
    if (error) setErro('Não foi possível carregar a equipe.')
    else {
      setPerfis(data)
      setErro('')
    }
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
          {aoVoltar && (
            <button
              type="button"
              className="btn-circular"
              onClick={aoVoltar}
              aria-label="Voltar"
              title="Voltar"
            >
              <Icone nome="voltar" size={20} />
            </button>
          )}
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
                    <span className="cad-avatar-wrap">
                      <Avatar
                        nome={p.nome_completo}
                        caminho={p.avatar_path}
                        className={`cad-avatar ${p.ativo ? '' : 'cad-avatar-inativo'}`}
                      />
                      {ehAdmin && estaOnline(p) && (
                        <span className="cad-online" title="Online agora" />
                      )}
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
                        {ehAdmin && (
                          <span
                            className={`chip-online ${estaOnline(p) ? '' : 'chip-online-off'}`}
                          >
                            {textoPresenca(
                              estaOnline(p),
                              ultimoVistoMs(p.id, vistos, p.visto_em),
                            )}
                          </span>
                        )}
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

      {/* Cadastro de membro: mesmo par botao-tracejado ↔ formulario do "Novo
          cliente". O login em si e criado por uma Edge Function (a chave que
          faz isso nao pode viver no frontend) — ver NovoMembro. */}
      {mostrarNovo ? (
        <NovoMembro
          aoCriar={carregar}
          aoFechar={() => setMostrarNovo(false)}
        />
      ) : (
        <button
          type="button"
          className="botao-novo-cad"
          onClick={() => setMostrarNovo(true)}
        >
          <Icone nome="mais" size={18} /> Novo membro
        </button>
      )}
    </div>
  )
}
