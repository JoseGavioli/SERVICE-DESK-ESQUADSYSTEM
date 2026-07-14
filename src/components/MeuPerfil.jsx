import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { comprimirImagemSePreciso, MB } from '../lib/anexos'
import Icone from './Icone'

// Iniciais (ate 2 letras) para o avatar quando ainda nao ha foto.
function iniciais(nome) {
  if (!nome) return '?'
  const p = nome.trim().split(/\s+/)
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase()
}

// URL publica de uma foto do bucket 'avatares' (bucket publico -> URL direta).
function urlAvatar(caminho) {
  if (!caminho) return null
  return supabase.storage.from('avatares').getPublicUrl(caminho).data.publicUrl
}

// Tela "Meu perfil": o usuario ve os proprios dados. So a FOTO e a SENHA ele
// altera aqui; nome/telefone/email sao so leitura (mudanca via admin, §pedido).
export default function MeuPerfil({ perfil, email, naoLidas, aoAbrirNotif }) {
  const [editando, setEditando] = useState(false)
  // celular e avatar_path sao buscados AQUI (nao no Painel) para o boot do app
  // nao depender da coluna avatar_path (migracao 0034): sem ela, so ESTA tela
  // degrada, o resto do app continua de pe.
  const [celular, setCelular] = useState('')
  const [avatarPath, setAvatarPath] = useState(null)
  const [arquivo, setArquivo] = useState(null) // nova foto escolhida (antes de salvar)
  const [removerFoto, setRemoverFoto] = useState(false) // marcou p/ tirar a foto
  const [novaSenha, setNovaSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')

  // Busca os dados que nao vem do Painel (telefone e caminho da foto).
  useEffect(() => {
    let vivo = true
    async function buscar() {
      const { data } = await supabase
        .from('perfil')
        .select('celular, avatar_path')
        .eq('id', perfil.id)
        .single()
      if (!vivo || !data) return
      setCelular(data.celular || '')
      setAvatarPath(data.avatar_path || null)
    }
    buscar()
    return () => {
      vivo = false
    }
  }, [perfil.id])

  // Previa: foto nova escolhida > (marcou remover -> iniciais) > foto salva.
  const previa = arquivo
    ? URL.createObjectURL(arquivo)
    : removerFoto
      ? null
      : urlAvatar(avatarPath)

  function cancelar() {
    setEditando(false)
    setArquivo(null)
    setRemoverFoto(false)
    setNovaSenha('')
    setConfirma('')
    setErro('')
  }

  async function salvar() {
    setErro('')
    setOk('')
    setSalvando(true)
    try {
      // 1) Foto (se escolheu uma nova) — mesma regra do anexo de entrada:
      //    so JPG/PNG, comprime se passar de 2 MB.
      if (arquivo) {
        const foto = await comprimirImagemSePreciso(arquivo, 2 * MB)
        if (!['image/jpeg', 'image/png'].includes(foto.type)) {
          throw new Error('A foto precisa ser JPG ou PNG.')
        }
        if (foto.size > 2 * MB) {
          throw new Error('Foto grande demais (máximo 2 MB).')
        }
        const ext = foto.type === 'image/png' ? 'png' : 'jpg'
        const caminho = `${perfil.id}/${Date.now()}.${ext}`
        const up = await supabase.storage.from('avatares').upload(caminho, foto)
        if (up.error) throw new Error('Falha ao enviar a foto.')
        // Apaga a foto antiga (se havia) para nao acumular lixo no Storage.
        if (avatarPath) {
          await supabase.storage.from('avatares').remove([avatarPath])
        }
        const { error } = await supabase.rpc('definir_avatar', { p_caminho: caminho })
        if (error) throw new Error('Não foi possível salvar a foto.')
        setAvatarPath(caminho)
      } else if (removerFoto && avatarPath) {
        // Remover a foto: apaga o arquivo do Storage e zera o avatar_path
        // (definir_avatar com null) — a tela volta a mostrar as iniciais.
        await supabase.storage.from('avatares').remove([avatarPath])
        const { error } = await supabase.rpc('definir_avatar', { p_caminho: null })
        if (error) throw new Error('Não foi possível remover a foto.')
        setAvatarPath(null)
      }

      // 2) Senha (se preencheu) — precisa das duas iguais e min. 6 caracteres.
      if (novaSenha || confirma) {
        if (novaSenha.length < 6) {
          throw new Error('A senha precisa ter ao menos 6 caracteres.')
        }
        if (novaSenha !== confirma) {
          throw new Error('As senhas não conferem — digite a mesma nas duas.')
        }
        const { error } = await supabase.auth.updateUser({ password: novaSenha })
        if (error) throw new Error('Não foi possível alterar a senha.')
      }

      setOk('Alterações salvas.')
      setEditando(false)
      setArquivo(null)
      setRemoverFoto(false)
      setNovaSenha('')
      setConfirma('')
    } catch (e) {
      setErro(e.message || 'Não foi possível salvar.')
    }
    setSalvando(false)
  }

  return (
    <div className="secao-perfil">
      <header className="hero-demandas">
        <h1 className="hero-titulo">Meu perfil</h1>
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

      {/* Avatar */}
      <div className="perfil-topo">
        <div className="perfil-avatar">
          {previa ? (
            <img src={previa} alt="Foto de perfil" />
          ) : (
            <span className="perfil-avatar-iniciais">
              {iniciais(perfil.nome_completo)}
            </span>
          )}
        </div>
        {editando && (
          <div className="perfil-foto-acoes">
            <label className="perfil-trocar-foto">
              <Icone nome="camera" size={15} /> Trocar foto
              <input
                type="file"
                accept="image/jpeg,image/png"
                onChange={(e) => {
                  setArquivo(e.target.files[0] || null)
                  setRemoverFoto(false) // escolher foto nova desfaz a remocao
                  e.target.value = ''
                }}
              />
            </label>
            {avatarPath && !arquivo && !removerFoto && (
              <button
                type="button"
                className="perfil-remover-foto"
                onClick={() => setRemoverFoto(true)}
              >
                <Icone nome="lixeira" size={14} /> Remover foto
              </button>
            )}
            {removerFoto && (
              <span className="perfil-remover-nota">
                A foto será removida ao salvar.
              </span>
            )}
          </div>
        )}
      </div>

      {/* Dados so-leitura (nome, telefone, email) */}
      <div className="det-card">
        <div className="info-linha">
          <span className="info-rot">Nome</span>
          <span className="info-val">{perfil.nome_completo || '—'}</span>
        </div>
        <div className="info-linha">
          <span className="info-rot">Telefone</span>
          <span className="info-val">{celular || '—'}</span>
        </div>
        <div className="info-linha">
          <span className="info-rot">Email</span>
          <span className="info-val">{email || '—'}</span>
        </div>
        <p className="perfil-aviso-admin">
          <Icone nome="aviso" size={14} /> Nome, telefone e email são alterados
          pelo administrador.
        </p>
      </div>

      {/* Senha */}
      <div className="det-card">
        {!editando ? (
          <div className="info-linha">
            <span className="info-rot">Senha</span>
            <span className="info-val">••••••••</span>
          </div>
        ) : (
          <>
            <label className="perfil-campo">
              <span className="info-rot">Nova senha</span>
              <input
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Ao menos 6 caracteres"
                autoComplete="new-password"
              />
            </label>
            <label className="perfil-campo">
              <span className="info-rot">Confirmar nova senha</span>
              <input
                type="password"
                value={confirma}
                onChange={(e) => setConfirma(e.target.value)}
                placeholder="Digite a senha de novo"
                autoComplete="new-password"
              />
            </label>
            <p className="perfil-dica">
              Deixe em branco para não trocar a senha.
            </p>
          </>
        )}
      </div>

      {erro && <p className="erro">{erro}</p>}
      {ok && <p className="perfil-ok">{ok}</p>}

      {/* Acoes */}
      {!editando ? (
        <button
          type="button"
          className="btn-perfil-editar"
          onClick={() => {
            setOk('')
            setEditando(true)
          }}
        >
          <Icone nome="editar" size={16} /> Editar
        </button>
      ) : (
        <div className="perfil-acoes">
          <button
            type="button"
            className="btn-perfil-cancelar"
            onClick={cancelar}
            disabled={salvando}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn-perfil-salvar"
            onClick={salvar}
            disabled={salvando}
          >
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      )}
    </div>
  )
}
