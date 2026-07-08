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

// ── Compressao de imagem no cliente (#41) ──────────────────────────
// Fotos de celular passam fácil dos 2 MB. Em vez de barrar, comprimimos:
// re-encoda como JPEG, reduz o maior lado p/ no maximo MAX_LADO e baixa a
// qualidade ate caber no limite. PDFs e imagens ja pequenas passam intactos;
// se nao der p/ comprimir, devolve o original (o validador decide). Tudo com
// Canvas nativo, sem dependencia extra.
const MAX_LADO_IMAGEM = 1920

function carregarImagem(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('falha ao ler imagem'))
    }
    img.src = url
  })
}

export async function comprimirImagemSePreciso(file, limiteBytes = 2 * MB) {
  // So imagens, e so quando passam do limite.
  if (!file || !file.type.startsWith('image/') || file.size <= limiteBytes) {
    return file
  }

  let img
  try {
    img = await carregarImagem(file)
  } catch {
    return file // nao decodificou -> deixa o validador barrar
  }

  const escala = Math.min(1, MAX_LADO_IMAGEM / Math.max(img.width, img.height))
  const largura = Math.round(img.width * escala)
  const altura = Math.round(img.height * escala)

  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff' // fundo branco p/ PNG com transparencia (JPEG nao tem alfa)
  ctx.fillRect(0, 0, largura, altura)
  ctx.drawImage(img, 0, 0, largura, altura)

  // Tenta qualidades decrescentes ate caber no limite.
  let blob = null
  for (const q of [0.82, 0.7, 0.6, 0.5, 0.4]) {
    blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', q))
    if (blob && blob.size <= limiteBytes) break
  }
  if (!blob) return file // toBlob falhou -> deixa o validador barrar

  // Re-encodado como JPEG: nome ganha extensao .jpg (para ficar honesto).
  const nomeBase = file.name.replace(/\.[^.]+$/, '')
  return new File([blob], `${nomeBase}.jpg`, { type: 'image/jpeg' })
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
