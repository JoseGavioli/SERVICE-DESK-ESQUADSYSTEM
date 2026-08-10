import { supabase } from './supabase'
import { todasAsLinhas } from './paginacao'
import { montarZip, nomeUnicoNoZip } from './zip'

// EXPORT / BACKUP dos dados (§17). Rede de segurança para um app em uso real:
// leva os dados para FORA do Supabase, num arquivo que o dono guarda onde
// quiser e consegue abrir sem depender de conta nenhuma.
//
// Não substitui o backup automático do Supabase (que restaura o banco inteiro
// em caso de acidente); resolve outra coisa — ter os dados na mão, legíveis.
//
// Roda no NAVEGADOR e não adiciona dependência (§5): o zip vem do lib/zip.js,
// escrito na #72 para baixar PDFs.

// As tabelas do CONTEÚDO do app. Ficam de fora `notificacao` e `erro_log`:
// são operacionais (avisos já lidos, log de quebra), não o que o app guarda.
//
// A ordem é a de leitura E a do LEIA-ME — as "donas" primeiro, para quem abrir
// o zip daqui a dois anos entender o desenho pelo próprio índice.
export const TABELAS = [
  { nome: 'cliente', descricao: 'Clientes.' },
  { nome: 'obra', descricao: 'Obras (cada uma pertence a um cliente).' },
  { nome: 'tipo_demanda', descricao: 'Tipos de demanda.' },
  { nome: 'perfil', descricao: 'Pessoas: nome, celular, papel. Sem senha.' },
  { nome: 'demanda', descricao: 'As demandas. O coração do app.' },
  { nome: 'ficha_fechamento', descricao: 'Ficha de pedido de vendas (1 por fechamento).' },
  { nome: 'comentario', descricao: 'Comentários das demandas.' },
  { nome: 'historico_status', descricao: 'Cada mudança de status, com autor e data.' },
  {
    nome: 'anexo',
    descricao:
      'Metadados dos anexos (nome, tamanho, quem enviou). Os ARQUIVOS em si não entram neste backup.',
  },
]

// ── CSV ────────────────────────────────────────────────────────────
// Uma célula segura pelo RFC 4180: envolve em aspas e DOBRA as aspas de
// dentro. Sem isso, uma descrição com vírgula, aspas ou quebra de linha —
// coisa comum aqui — desalinharia a planilha inteira dali para baixo.
function celula(valor) {
  if (valor == null) return ''
  let txt = typeof valor === 'object' ? JSON.stringify(valor) : String(valor)
  // A aspa protege a ESTRUTURA, nao o conteudo: o Excel tira as aspas ao ler e
  // AVALIA o que sobrou, entao uma celula comecando com = + - @ vira formula.
  // Nao e hipotese remota aqui — descricao de esquadria comeca com "- 2 janelas
  // de correr" o tempo todo, e o Excel mostraria #NOME? no lugar do texto.
  // O apostrofo e o marcador de "isto e texto": o Excel e o Google Planilhas o
  // consomem, e ele nao aparece na celula.
  //
  // Isto distorce o CSV DE PROPOSITO — e por isso que o `json/*.json` existe e
  // continua sendo a copia fiel do banco.
  if (/^[=+\-@\t\r]/.test(txt)) txt = `'${txt}`
  return `"${txt.replace(/"/g, '""')}"`
}

// PONTO E VIRGULA, e nao virgula: o Excel usa o "separador de lista" do
// Windows para abrir .csv com duplo-clique, e no Windows em portugues esse
// separador e `;`. Com virgula o arquivo ate abre — mas as 16 colunas caem
// todas dentro da coluna A, com as aspas a mostra, e so sai disso quem souber
// ir em Dados > De Texto/CSV. Como a razao de existir do CSV e justamente
// "abrir no Excel", ele segue o Excel de quem vai abrir.
// (Quem for ler noutro programa: o LEIA-ME avisa qual e o separador.)
const SEPARADOR = ';'

export function paraCsv(linhas) {
  if (!linhas.length) return ''
  // As colunas saem da UNIÃO das chaves, não da primeira linha: o PostgREST
  // omite nada, mas se um dia omitir, a planilha perderia a coluna em silêncio.
  const colunas = [...new Set(linhas.flatMap((l) => Object.keys(l)))]
  const cabecalho = colunas.map(celula).join(SEPARADOR)
  const corpo = linhas.map((l) =>
    colunas.map((c) => celula(l[c])).join(SEPARADOR),
  )
  // CRLF é o que o RFC pede e o que o Excel espera.
  return [cabecalho, ...corpo].join('\r\n')
}

// O Excel no Windows assume a codificação do sistema quando abre .csv: sem o
// BOM, "José" vira "JosÃ©". Três bytes que decidem se o arquivo presta para
// quem vai conferir.
const BOM = [0xef, 0xbb, 0xbf]

function bytesDeTexto(texto, comBom = false) {
  const corpo = new TextEncoder().encode(texto)
  if (!comBom) return corpo
  const saida = new Uint8Array(BOM.length + corpo.length)
  saida.set(BOM, 0)
  saida.set(corpo, BOM.length)
  return saida
}

// ── O bilhete dentro do zip ────────────────────────────────────────
function leiaMe(resumo, quando) {
  const linhas = [
    'BACKUP — Service Desk / EsquadSystem',
    `Gerado em ${quando.toLocaleString('pt-BR')}`,
    '',
    'O QUE É ISTO',
    'Uma cópia dos dados do app, para guardar fora do Supabase. Cada tabela',
    'aparece duas vezes:',
    '',
    '  dados/*.csv  — abre no Excel (ou Google Planilhas). Para LER e conferir.',
    '                  Separador: ponto e vírgula (;), que é o do Excel em',
    '                  português. Noutro programa, escolha ";" ao importar.',
    '  json/*.json  — fiel ao banco, com os tipos preservados. Para REIMPORTAR.',
    '',
    'São os mesmos dados nos dois formatos.',
    '',
    'O QUE TEM DENTRO',
    ...resumo.map((r) => `  ${r.nome} — ${r.linhas} linha(s). ${r.descricao}`),
    '',
    'O QUE **NÃO** TEM',
    '  • Os ARQUIVOS dos anexos (PDFs e fotos). Só os metadados deles, na',
    '    tabela anexo. Os arquivos vivem no Storage do Supabase.',
    '  • Senhas (ficam no Auth do Supabase, fora do alcance do app).',
    '  • Notificações e log de erros (são operacionais, não conteúdo).',
    '',
    'COMO OS ARQUIVOS SE LIGAM',
    '  obra.cliente_id       -> cliente.id',
    '  demanda.obra_id       -> obra.id',
    '  demanda.vendedor_id   -> perfil.id',
    '  demanda.demanda_pai_id-> demanda.id  (demanda-filha)',
    '  comentario.demanda_id -> demanda.id',
    '  anexo.demanda_id      -> demanda.id',
    '',
    'OBSERVAÇÃO',
    'O backup traz o que a SUA conta pode ver. Como admin, é tudo — menos as',
    'demandas de contas marcadas como ocultas (a conta de teste).',
  ]
  return linhas.join('\r\n')
}

// ── O backup em si ─────────────────────────────────────────────────
// `aoProgredir(feitas, total, nome)` é chamado a cada tabela lida — a leitura
// é em série de propósito: nove consultas paralelas só disputariam a mesma
// conexão, e em série dá para dizer onde está.
export async function gerarBackup({ aoProgredir } = {}) {
  const arquivos = []
  const resumo = []

  for (let i = 0; i < TABELAS.length; i++) {
    const t = TABELAS[i]
    aoProgredir?.(i, TABELAS.length, t.nome)

    // Paginado: hoje a maior tabela tem ~180 linhas, mas o corte de ~1000 do
    // PostgREST chegaria sem avisar — e um backup que perde linhas caladamente
    // é pior que não ter backup.
    const { data, error } = await todasAsLinhas((de, ate) =>
      supabase.from(t.nome).select('*').order('id').range(de, ate),
    )
    if (error) {
      // A causa vai JUNTO: este backup e a rede de seguranca do app, e quando
      // ele para o dono precisa distinguir "o wi-fi piscou" de "a permissao
      // mudou". Sem isso, a tela de Erros gravaria so a frase amigavel.
      throw new Error(
        `Não foi possível ler a tabela "${t.nome}": ${error.message}`,
        { cause: error },
      )
    }

    const linhas = data ?? []
    resumo.push({ nome: t.nome, linhas: linhas.length, descricao: t.descricao })
    arquivos.push({
      nome: `dados/${t.nome}.csv`,
      dados: bytesDeTexto(paraCsv(linhas), true),
    })
    arquivos.push({
      nome: `json/${t.nome}.json`,
      dados: bytesDeTexto(JSON.stringify(linhas, null, 2)),
    })
  }

  const quando = new Date()
  arquivos.push({
    nome: 'LEIA-ME.txt',
    dados: bytesDeTexto(leiaMe(resumo, quando), true),
  })
  aoProgredir?.(TABELAS.length, TABELAS.length, null)

  return { blob: montarZip(arquivos), resumo, quando }
}

// Nome do arquivo: data em AAAA-MM-DD para os backups se ordenarem sozinhos
// na pasta. Montado pelos NÚMEROS locais — `toISOString()` é UTC e, no nosso
// fuso, um backup feito à noite sairia com a data do dia seguinte.
export function nomeDoArquivo(quando = new Date()) {
  const d = String(quando.getDate()).padStart(2, '0')
  const m = String(quando.getMonth() + 1).padStart(2, '0')
  return `service-desk-backup-${quando.getFullYear()}-${m}-${d}.zip`
}

// ── ANEXOS: os ARQUIVOS, não os metadados ──────────────────────────
// O backup de dados leva a tabela `anexo` (quem enviou, quando, tamanho); os
// PDFs e fotos em si ficam no Storage. Estas funções trazem os arquivos.
//
// Vêm SEPARADOS por tipo (§decisão do dono) por dois motivos: cada zip fica
// gerenciável (60 MB / 45 MB em vez de 105 de uma vez, montados na memória do
// navegador) e dá para levar só o que interessa — os de SAÍDA são os
// orçamentos entregues, permanentes por §14; os de ENTRADA são fotos de
// referência, e já estão marcados para limpeza futura.
export const TIPOS_ANEXO = {
  saida: {
    rotulo: 'Anexos de saída',
    ajuda: 'Os orçamentos entregues. São permanentes (§14).',
  },
  entrada: {
    rotulo: 'Anexos de entrada',
    ajuda: 'Fotos e PDFs que o vendedor mandou junto do pedido.',
  },
}

function leiaMeAnexos(tipo, incluidos, falhas, quando) {
  const linhas = [
    `ANEXOS DE ${tipo.toUpperCase()} — Service Desk / EsquadSystem`,
    `Gerado em ${quando.toLocaleString('pt-BR')}`,
    '',
    `${incluidos.length} arquivo(s), organizados em uma pasta por demanda:`,
    '',
    '  demanda-12/orcamento.pdf',
    '',
    'O NÚMERO DA PASTA é o id da demanda — o mesmo `id` do arquivo',
    'dados/demanda.csv no backup de dados. É por ele que se liga um ao outro.',
    '',
    'Nomes repetidos ganham "(2)", "(3)"... dentro da mesma pasta: no banco há',
    'vários anexos chamados "image.jpg", e sem isso um sobrescreveria o outro.',
  ]
  if (falhas.length) {
    linhas.push(
      '',
      'NÃO ENTRARAM (falha ao baixar):',
      // Pelo ID, e nao pelo caminho: o nome CRU do que falhou pode ser igual
      // ao de um arquivo que ENTROU (a demanda-17 tem cinco "image.jpg"), e a
      // linha apontaria para um arquivo presente no zip. O id casa com a
      // coluna `id` de dados/anexo.csv, no backup de dados.
      ...falhas.map(
        (f) => `  anexo #${f.id} — demanda ${f.demanda_id} — "${f.nome_original}"`,
      ),
      '',
      `Cada um foi tentado ${TENTATIVAS} vezes. Tente o download de novo — se`,
      'persistir, o arquivo pode ter sido removido do Storage.',
    )
  }
  return linhas.join('\r\n')
}

// Quantos downloads ao mesmo tempo. Em série, medido: 63 arquivos levaram 122
// segundos (~2s cada) — e os 123 de entrada levariam quatro minutos com o app
// parado. O tempo é de rede, não de processamento, então esperar em paralelo
// resolve. Quatro é conservador de propósito: acelera ~4x sem abrir uma
// enxurrada de conexões nem segurar dezenas de arquivos em memória de uma vez.
const CONCORRENTES = 4

// Quantas vezes tentar cada arquivo, e quanto esperar antes de desistir de uma
// tentativa. Isto NAO e zelo teorico: na primeira execucao real, 1 dos 123
// arquivos falhou — e numa segunda passada, os mesmos 123 baixaram inteiros.
// Ou seja, foi oscilacao de rede sob concorrencia. Sem repetir, um backup
// perderia um arquivo por causa de um soluco de conexao; e o arquivo travado
// segurou o processo por ~60s, deixando a tela parada em "122 de 123".
const TENTATIVAS = 3
const ESPERA_MS = 30000

const dorme = (ms) => new Promise((r) => setTimeout(r, ms))

// Baixa um arquivo do Storage, insistindo. Devolve o Blob ou null.
//
// O `race` com o relogio nao CANCELA o download que ficou pendurado (o fetch
// segue em segundo plano), mas libera o trabalhador para pegar o proximo — que
// e o que importa: um arquivo lento nao pode parar a fila inteira.
async function baixarArquivo(caminho) {
  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    // O try/catch NAO e precaucao generica — e o caso mais provavel de falhar.
    // O `download()` do storage-js so converte em `{ data, error }` o que da
    // errado ATE os cabecalhos; a leitura do CORPO (`await result.blob()`)
    // acontece depois e, se a conexao cair no meio da transferencia, ele
    // RELANCA um TypeError cru. Sem este catch a rejeicao pularia as
    // tentativas, derrubaria os quatro trabalhadores e mataria o backup
    // inteiro — justamente na oscilacao de rede que motivou o retry.
    let resposta
    try {
      resposta = await Promise.race([
        supabase.storage.from('anexos').download(caminho),
        dorme(ESPERA_MS).then(() => ({
          data: null,
          error: { message: 'tempo esgotado' },
        })),
      ])
    } catch (e) {
      resposta = { data: null, error: e }
    }
    if (resposta?.data && !resposta.error) return resposta.data
    // Espera crescente entre as tentativas: se o Storage engasgou, insistir no
    // mesmo instante so repete o engasgo.
    if (tentativa < TENTATIVAS) await dorme(400 * tentativa)
  }
  return null
}

// Baixa os arquivos de um tipo e devolve o zip.
// Um arquivo que falha NÃO impede os outros — ele é listado no LEIA-ME.
export async function gerarZipAnexos({ tipo, aoProgredir } = {}) {
  const { data: anexos, error } = await todasAsLinhas((de, ate) =>
    supabase
      .from('anexo')
      .select('id, demanda_id, tipo, nome_original, caminho_storage')
      .eq('tipo', tipo)
      .order('id')
      .range(de, ate),
  )
  if (error) {
    throw new Error(
      `Não foi possível listar os anexos de ${tipo}: ${error.message}`,
      { cause: error },
    )
  }
  if (!anexos?.length) {
    throw new Error(`Não há anexos de ${tipo} para baixar.`)
  }

  // Os bytes vão para um vetor NA POSIÇÃO ORIGINAL, não na ordem em que
  // chegam: em paralelo a ordem de chegada é imprevisível, e o zip ficaria
  // embaralhado diferente a cada backup.
  const baixados = new Array(anexos.length).fill(null)
  const falhas = []
  let proximo = 0
  let feitas = 0

  async function trabalhador() {
    while (true) {
      const i = proximo++
      if (i >= anexos.length) return
      const a = anexos[i]
      // Rede de seguranca do trabalhador: qualquer coisa que escape aqui
      // rejeitaria o Promise.all e mataria a corrida inteira, deixando os
      // outros tres baixando orfaos. Um anexo problematico vira UMA linha de
      // falha no LEIA-ME — que e o contrato desta funcao.
      try {
        const dados = await baixarArquivo(a.caminho_storage)
        if (!dados) falhas.push(a)
        else baixados[i] = new Uint8Array(await dados.arrayBuffer())
      } catch {
        falhas.push(a)
      }
      feitas += 1
      aoProgredir?.(feitas, anexos.length, a.nome_original)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCORRENTES, anexos.length) }, trabalhador),
  )

  const arquivos = []
  const incluidos = []
  // Um Set de nomes POR DEMANDA: o desempate só precisa valer dentro da pasta.
  // Feito AQUI, na ordem original, para o "(2)" cair sempre no mesmo arquivo.
  const usadosPorDemanda = new Map()
  for (let i = 0; i < anexos.length; i++) {
    if (!baixados[i]) continue
    const a = anexos[i]
    if (!usadosPorDemanda.has(a.demanda_id)) {
      usadosPorDemanda.set(a.demanda_id, new Set())
    }
    const nome = nomeUnicoNoZip(
      a.nome_original,
      usadosPorDemanda.get(a.demanda_id),
    )
    arquivos.push({
      nome: `demanda-${a.demanda_id}/${nome}`,
      dados: baixados[i],
    })
    incluidos.push(a)
  }

  if (!arquivos.length) {
    throw new Error('Nenhum arquivo pôde ser baixado.')
  }

  const quando = new Date()
  arquivos.push({
    nome: 'LEIA-ME.txt',
    dados: bytesDeTexto(leiaMeAnexos(tipo, incluidos, falhas, quando), true),
  })
  aoProgredir?.(anexos.length, anexos.length, null)

  return { blob: montarZip(arquivos), incluidos, falhas, quando }
}

export function nomeDoZipAnexos(tipo, quando = new Date()) {
  const d = String(quando.getDate()).padStart(2, '0')
  const m = String(quando.getMonth() + 1).padStart(2, '0')
  return `service-desk-anexos-${tipo}-${quando.getFullYear()}-${m}-${d}.zip`
}
