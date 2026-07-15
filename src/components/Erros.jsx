import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import EstadoVazio from './EstadoVazio'
import Icone from './Icone'

// De onde o erro veio (o rotulo curto que aparece no chip).
const ROTULO_ORIGEM = {
  'boundary-topo': 'app',
  'boundary-tela': 'tela',
  window: 'solto',
  promise: 'async',
}

// Tela "Erros" (SO admin, §rede de seguranca passo 3): mostra o que quebrou no
// aparelho dos usuarios (tabela erro_log, migracao 0035). A RLS ja garante que
// so o admin le — aqui o menu tambem so mostra p/ ele.
export default function Erros({ naoLidas, aoAbrirNotif, aoVoltar }) {
  const [erros, setErros] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [aberto, setAberto] = useState(null) // id do erro expandido
  const [aviso, setAviso] = useState('')

  async function carregar() {
    setCarregando(true)
    const { data, error } = await supabase
      .from('erro_log')
      .select(
        'id, origem, mensagem, stack, componente, url, user_agent, created_at, quem:perfil(nome_completo)',
      )
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) setAviso('Não foi possível carregar os erros.')
    else setErros(data ?? [])
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  async function limpar() {
    if (!window.confirm('Apagar TODOS os erros registrados? Não dá para desfazer.'))
      return
    const { error } = await supabase.from('erro_log').delete().gt('id', 0)
    if (error) setAviso('Não foi possível limpar.')
    else carregar()
  }

  return (
    <div className="secao-erros">
      <header className="hero-demandas">
        <h1 className="hero-titulo">Erros</h1>
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
          {erros.length > 0 && (
            <button type="button" className="btn-limpar-erros" onClick={limpar}>
              Limpar
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

      {aviso && <p className="erro">{aviso}</p>}

      {carregando ? (
        <p>Carregando erros…</p>
      ) : erros.length === 0 ? (
        <EstadoVazio
          nome="check"
          titulo="Nenhum erro registrado"
          dica="Quando o app quebrar no aparelho de alguém, aparece aqui."
        />
      ) : (
        <ul className="lista-erros">
          {erros.map((e) => (
            <li key={e.id} className="erro-item">
              <button
                type="button"
                className="erro-cab"
                onClick={() => setAberto(aberto === e.id ? null : e.id)}
              >
                <span className="erro-msg">{e.mensagem}</span>
                <span className="erro-meta">
                  <span className="chip-origem">
                    {ROTULO_ORIGEM[e.origem] ?? e.origem}
                  </span>
                  {e.quem?.nome_completo && <span>{e.quem.nome_completo}</span>}
                  <span>{new Date(e.created_at).toLocaleString('pt-BR')}</span>
                </span>
                <Icone
                  nome={aberto === e.id ? 'chevron-cima' : 'chevron-baixo'}
                  size={16}
                />
              </button>

              {aberto === e.id && (
                <div className="erro-detalhe">
                  {/* O componentStack e o mais util: diz QUAL tela quebrou. */}
                  {e.componente && (
                    <>
                      <span className="erro-rot">Onde (componentes)</span>
                      <pre className="erro-pre">{e.componente.trim()}</pre>
                    </>
                  )}
                  {e.stack && (
                    <>
                      <span className="erro-rot">Pilha</span>
                      <pre className="erro-pre">{e.stack.trim()}</pre>
                    </>
                  )}
                  <span className="erro-rot">Aparelho</span>
                  <p className="erro-ua">{e.user_agent || '—'}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
