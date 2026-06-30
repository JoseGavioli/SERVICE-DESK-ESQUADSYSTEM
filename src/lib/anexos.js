import { supabase } from './supabase'

// Helpers de anexo compartilhados entre o formulario de criacao
// (NovaDemanda) e a aba de anexos do detalhe (Anexos).

export const MB = 1024 * 1024
export const FORMATOS_ENTRADA = ['image/jpeg', 'image/png', 'application/pdf']

// Deixa o nome seguro para usar como caminho no Storage.
export function nomeSeguro(nome) {
  return nome.normalize('NFD').replace(/[^a-zA-Z0-9.\-_]/g, '_')
}

export function formatarTamanho(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < MB) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / MB).toFixed(1)} MB`
}

// Detecta imagem pela extensao do nome (para mostrar miniatura).
export function ehImagem(nome) {
  return /\.(jpe?g|png|gif|webp|bmp)$/i.test(nome)
}

// Valida o arquivo conforme o tipo. Retorna a mensagem de erro ou null.
export function validarArquivo(tipo, file) {
  const limite = tipo === 'entrada' ? 2 * MB : 10 * MB
  if (file.size > limite) return `Arquivo grande demais (máximo ${limite / MB} MB).`
  if (tipo === 'entrada' && !FORMATOS_ENTRADA.includes(file.type)) {
    return 'Entrada aceita apenas JPG, PNG ou PDF.'
  }
  return null
}

// Sobe o arquivo para o Storage e registra o metadado na tabela anexo.
// Se o registro falhar, desfaz o upload (sem arquivos orfaos).
// Retorna { error } (string) em caso de falha, ou {} em sucesso.
export async function enviarAnexo(demandaId, tipo, file) {
  const caminho = `${demandaId}/${tipo}/${crypto.randomUUID()}-${nomeSeguro(file.name)}`

  const up = await supabase.storage.from('anexos').upload(caminho, file)
  if (up.error) return { error: 'Falha no envio do arquivo.' }

  const ins = await supabase.from('anexo').insert({
    demanda_id: demandaId,
    tipo,
    caminho_storage: caminho,
    nome_original: file.name,
    tamanho_bytes: file.size,
  })
  if (ins.error) {
    await supabase.storage.from('anexos').remove([caminho])
    return { error: 'Não foi possível registrar o anexo.' }
  }
  return {}
}
