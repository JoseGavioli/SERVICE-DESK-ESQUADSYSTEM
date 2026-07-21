// Monta um arquivo .zip no proprio navegador, SEM dependencia (§5).
//
// Metodo "stored" (sem compressao): PDF ja e um formato comprimido, entao
// re-comprimir renderia ~0. O objetivo aqui e juntar varios num arquivo so.
// E o formato ZIP classico (o mesmo que o Windows/Mac/Linux abrem nativo).
//
// Limite: usa campos de 32 bits (sem ZIP64) — cobre ate ~4 GB por arquivo e
// 65.535 arquivos, folgado para PDFs de orcamento.

// CRC-32 (polinomio padrao do ZIP), com a tabela montada uma unica vez.
let TABELA_CRC = null
function tabelaCrc() {
  if (TABELA_CRC) return TABELA_CRC
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    t[n] = c >>> 0
  }
  TABELA_CRC = t
  return t
}

function crc32(bytes) {
  const t = tabelaCrc()
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    c = t[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

// arquivos: [{ nome: string, dados: Uint8Array }] -> Blob (application/zip)
export function montarZip(arquivos) {
  const enc = new TextEncoder()
  const partesLocais = [] // cabecalho local + dados, na ordem dos arquivos
  const partesCentrais = [] // as entradas do "diretorio central"
  let offset = 0 // deslocamento (em bytes) do proximo cabecalho local

  // Data/hora FIXA de proposito: nao lemos o relogio (mantem o zip
  // deterministico e sem confusao de fuso). 1 jan 2021, 00:00, formato DOS.
  const dosHora = 0
  const dosData = ((2021 - 1980) << 9) | (1 << 5) | 1

  for (const arq of arquivos) {
    const nome = enc.encode(arq.nome) // nome em UTF-8 (acentos ok)
    const dados = arq.dados
    const crc = crc32(dados)
    const tam = dados.length

    // ── Cabecalho local do arquivo (30 bytes + nome) ──
    const lh = new Uint8Array(30 + nome.length)
    const dvl = new DataView(lh.buffer)
    dvl.setUint32(0, 0x04034b50, true) // assinatura "PK\3\4"
    dvl.setUint16(4, 20, true) // versao necessaria (2.0)
    dvl.setUint16(6, 0x0800, true) // flag bit 11 = nome em UTF-8
    dvl.setUint16(8, 0, true) // metodo 0 = stored (sem compressao)
    dvl.setUint16(10, dosHora, true)
    dvl.setUint16(12, dosData, true)
    dvl.setUint32(14, crc, true)
    dvl.setUint32(18, tam, true) // tamanho comprimido = tamanho (stored)
    dvl.setUint32(22, tam, true) // tamanho original
    dvl.setUint16(26, nome.length, true)
    dvl.setUint16(28, 0, true) // tamanho do campo "extra"
    lh.set(nome, 30)
    partesLocais.push(lh, dados)

    // ── Entrada no diretorio central (46 bytes + nome) ──
    const cd = new Uint8Array(46 + nome.length)
    const dvc = new DataView(cd.buffer)
    dvc.setUint32(0, 0x02014b50, true) // assinatura "PK\1\2"
    dvc.setUint16(4, 20, true) // versao "made by"
    dvc.setUint16(6, 20, true) // versao necessaria
    dvc.setUint16(8, 0x0800, true) // flag UTF-8
    dvc.setUint16(10, 0, true) // metodo stored
    dvc.setUint16(12, dosHora, true)
    dvc.setUint16(14, dosData, true)
    dvc.setUint32(16, crc, true)
    dvc.setUint32(20, tam, true)
    dvc.setUint32(24, tam, true)
    dvc.setUint16(28, nome.length, true)
    dvc.setUint16(30, 0, true) // extra
    dvc.setUint16(32, 0, true) // comentario
    dvc.setUint16(34, 0, true) // numero do disco
    dvc.setUint16(36, 0, true) // atributos internos
    dvc.setUint32(38, 0, true) // atributos externos
    dvc.setUint32(42, offset, true) // offset do cabecalho local
    cd.set(nome, 46)
    partesCentrais.push(cd)

    offset += lh.length + dados.length
  }

  const tamCentral = partesCentrais.reduce((n, p) => n + p.length, 0)
  const inicioCentral = offset

  // ── Fim do diretorio central (22 bytes) ──
  const eocd = new Uint8Array(22)
  const dve = new DataView(eocd.buffer)
  dve.setUint32(0, 0x06054b50, true) // assinatura "PK\5\6"
  dve.setUint16(4, 0, true) // numero do disco
  dve.setUint16(6, 0, true) // disco onde comeca o diretorio central
  dve.setUint16(8, arquivos.length, true) // entradas neste disco
  dve.setUint16(10, arquivos.length, true) // total de entradas
  dve.setUint32(12, tamCentral, true) // tamanho do diretorio central
  dve.setUint32(16, inicioCentral, true) // offset do diretorio central
  dve.setUint16(20, 0, true) // tamanho do comentario do zip

  return new Blob([...partesLocais, ...partesCentrais, eocd], {
    type: 'application/zip',
  })
}
