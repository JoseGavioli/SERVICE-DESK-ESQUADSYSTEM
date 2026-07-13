import { useRegisterSW } from 'virtual:pwa-register/react'

// Aviso "Nova versao disponivel". Antes o app atualizava SOZINHO e em silencio
// (registerType 'autoUpdate'), o que fazia a versao velha ficar em cache ate
// reabrir e parecer que o deploy nao pegou. Agora, quando o service worker
// baixa uma versao nova, mostramos este aviso; tocar em "Atualizar" ativa a
// nova versao (skip waiting) e recarrega a pagina.
const UMA_HORA = 60 * 60 * 1000

export default function AvisoAtualizacao() {
  const {
    needRefresh: [precisaAtualizar, setPrecisaAtualizar],
    updateServiceWorker,
  } = useRegisterSW({
    // Enquanto o app fica aberto (ex.: vendedor com o PWA o dia todo), checa
    // por versao nova de tempos em tempos — senao so notaria ao reabrir.
    onRegisteredSW(_url, registro) {
      if (registro) setInterval(() => registro.update(), UMA_HORA)
    },
  })

  if (!precisaAtualizar) return null

  return (
    <div className="aviso-atualizar" role="status">
      <span className="aviso-atualizar-texto">Nova versão disponível</span>
      <button
        type="button"
        className="aviso-atualizar-btn"
        onClick={() => updateServiceWorker(true)}
      >
        Atualizar
      </button>
      <button
        type="button"
        className="aviso-atualizar-x"
        aria-label="Agora não"
        onClick={() => setPrecisaAtualizar(false)}
      >
        ×
      </button>
    </div>
  )
}
