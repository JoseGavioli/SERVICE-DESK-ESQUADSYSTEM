import { useEffect, useState } from 'react'
import { estadoPush, ativarPush, desativarPush } from '../lib/webpush'
import Icone from './Icone'

// Toggle "Receber avisos neste aparelho" (Web Push), na tela de Notificacoes.
// Cuida sozinho dos estados: carregando / nao suportado / iOS sem instalar /
// permissao negada / ligado / desligado. O ENVIO do push e do servidor.
export default function TogglePush() {
  const [estado, setEstado] = useState(null) // null = carregando
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')

  async function atualizar() {
    try {
      setEstado(await estadoPush())
    } catch {
      setEstado('nao_suportado')
    }
  }

  useEffect(() => {
    atualizar()
  }, [])

  if (estado === null) return null // carregando (rapido) — evita "piscar"

  if (estado === 'nao_suportado') {
    return (
      <p className="push-aviso">
        Este navegador não suporta avisos no aparelho.
      </p>
    )
  }
  if (estado === 'ios_instalar') {
    return (
      <p className="push-aviso">
        Para receber avisos no iPhone, instale o app na tela inicial
        (Compartilhar → Adicionar à Tela de Início) e abra por lá.
      </p>
    )
  }
  if (estado === 'negado') {
    return (
      <p className="push-aviso">
        Avisos bloqueados neste aparelho. Reative nas permissões do site (no
        navegador) para voltar a receber.
      </p>
    )
  }

  const ligado = estado === 'ligado'

  async function alternar() {
    setOcupado(true)
    setErro('')
    try {
      if (ligado) await desativarPush()
      else await ativarPush()
    } catch (e) {
      if (e.message === 'permissao_negada') setErro('Permissão negada.')
      else if (e.message === 'sem_chave_vapid')
        setErro('Avisos ainda não configurados neste ambiente.')
      else setErro('Não foi possível alterar agora.')
    }
    await atualizar()
    setOcupado(false)
  }

  return (
    <div className="push-toggle">
      <span className="push-toggle-texto">
        <Icone nome="sino" size={16} /> Receber avisos neste aparelho
      </span>
      <button
        type="button"
        className={`switch ${ligado ? 'ligado' : ''}`}
        onClick={alternar}
        disabled={ocupado}
        role="switch"
        aria-checked={ligado}
        aria-label="Receber avisos neste aparelho"
      >
        <span className="switch-bolinha" />
      </button>
      {erro && <p className="push-aviso push-erro">{erro}</p>}
    </div>
  )
}
