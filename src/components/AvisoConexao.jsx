import { useEffect, useState } from 'react'
import Icone from './Icone'

// Faixa "sem conexao" (§melhoria #2, parte A). O vendedor usa no celular e o
// sinal cai — sem este aviso ele toca em salvar, nada acontece, e ele nao faz
// ideia do porque. Usa navigator.onLine + os eventos online/offline.
//
// RESSALVA: navigator.onLine diz se o APARELHO tem rede, nao se o Supabase
// esta alcancavel. Ou seja: pega o caso comum (wi-fi/dados caindo), mas pode
// dizer "online" com a internet ruim/servidor fora. Nao e um monitor de rede.
export default function AvisoConexao() {
  const [offline, setOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const caiu = () => setOffline(true)
    const voltou = () => setOffline(false)
    window.addEventListener('offline', caiu)
    window.addEventListener('online', voltou)
    return () => {
      window.removeEventListener('offline', caiu)
      window.removeEventListener('online', voltou)
    }
  }, [])

  if (!offline) return null

  return (
    <div className="aviso-conexao" role="status">
      <Icone nome="aviso" size={15} />
      Sem conexão — suas ações não vão salvar
    </div>
  )
}
