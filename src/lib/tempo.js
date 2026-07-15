// "ha X" curto e humano, para marcar quando algo aconteceu por ultimo.
// Ex.: 'agora' | 'ha 8 min' | 'ha 3h' | 'ha 2d'.
export function haQuantoTempo(iso) {
  if (!iso) return null
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  return `há ${d}d`
}
