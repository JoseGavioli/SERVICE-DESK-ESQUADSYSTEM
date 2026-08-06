import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Quais tipos de demanda tem FICHA (§#80/#85)?
//
// O menu do botao "Nova demanda" precisa saber isso ANTES do formulario
// existir — hoje os tipos so eram lidos dentro da NovaDemanda, que so monta
// depois do clique. Por isso o hook.
//
// Reparar: a pergunta e pela FLAG `com_ficha`, nunca pelo nome "Fechamento".
// E o mesmo motivo do §10 do CLAUDE.md — renomear o tipo no banco nao pode
// quebrar nada, e um tipo novo com ficha entra no menu sozinho.
export function useTiposComFicha() {
  const [tipos, setTipos] = useState([])

  useEffect(() => {
    let vivo = true
    async function carregar() {
      const { data } = await supabase
        .from('tipo_demanda')
        .select('id, nome')
        .eq('ativo', true)
        .eq('com_ficha', true)
        .order('id')
      // `vivo`: a resposta pode chegar depois de o componente sair da tela.
      if (vivo && data) setTipos(data)
    }
    carregar()
    return () => {
      vivo = false
    }
  }, [])

  return tipos
}
