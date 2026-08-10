import { supabase } from './supabase'
import { todasAsLinhas } from './paginacao'
import { montarZip } from './zip'

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
