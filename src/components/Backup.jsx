import { useState } from 'react'
import {
  gerarBackup,
  gerarZipAnexos,
  nomeDoArquivo,
  nomeDoZipAnexos,
  TABELAS,
  TIPOS_ANEXO,
} from '../lib/backup'
import { useDesktop } from '../lib/useDesktop'
import { baixarBlob } from '../lib/zip'
import { registrarErro } from '../lib/erros'
import Icone from './Icone'

// Tela "Backup" (SO admin, §17). Um botao que baixa TODOS os dados do app num
// .zip, para o dono guardar fora do Supabase.
//
// Manual de proposito: um backup agendado precisaria de Edge Function + cron +
// um lugar para guardar o arquivo — outro projeto. O valor esta em poder
// levar os dados embora quando quiser.
export default function Backup({ naoLidas, aoAbrirNotif, aoVoltar }) {
  const [gerando, setGerando] = useState(false)
  const [progresso, setProgresso] = useState(null) // { feitas, total, nome }
  const [erro, setErro] = useState('')
  const [pronto, setPronto] = useState(null) // { arquivo, resumo, quando }
  // Anexos: estado proprio, para o download dos dados e o dos arquivos nao
  // pisarem um no outro.
  const [tipoBaixando, setTipoBaixando] = useState(null) // 'saida' | 'entrada'
  const [progAnexos, setProgAnexos] = useState(null)
  const [prontoAnexos, setProntoAnexos] = useState(null)
  // Os anexos passam dos 100 MB somados e o zip e montado NA MEMORIA: num
  // celular isso trava a aba. O corte de largura nao mede memoria, mas separa
  // bem o caso de uso — backup de 100 MB se faz no computador.
  const desktop = useDesktop()

  async function baixar() {
    setGerando(true)
    setErro('')
    setPronto(null)
    try {
      const { blob, resumo, quando } = await gerarBackup({
        aoProgredir: (feitas, total, nome) =>
          setProgresso({ feitas, total, nome }),
      })

      const arquivo = nomeDoArquivo(quando)
      baixarBlob(blob, arquivo)

      setPronto({ arquivo, resumo, quando })
    } catch (e) {
      setErro(e.message || 'Não foi possível gerar o backup.')
      registrarErro('backup', e, 'Backup')
    } finally {
      setGerando(false)
      setProgresso(null)
    }
  }

  async function baixarAnexos(tipo) {
    setTipoBaixando(tipo)
    setErro('')
    setProntoAnexos(null)
    try {
      const { blob, incluidos, falhas, quando } = await gerarZipAnexos({
        tipo,
        aoProgredir: (feitas, total, nome) =>
          setProgAnexos({ feitas, total, nome }),
      })
      const arquivo = nomeDoZipAnexos(tipo, quando)
      baixarBlob(blob, arquivo)
      setProntoAnexos({ arquivo, tipo, incluidos: incluidos.length, falhas })
    } catch (e) {
      setErro(e.message || 'Não foi possível baixar os anexos.')
      registrarErro('backup-anexos', e, 'Backup')
    } finally {
      setTipoBaixando(null)
      setProgAnexos(null)
    }
  }

  const totalLinhas = pronto?.resumo.reduce((s, r) => s + r.linhas, 0) ?? 0

  return (
    <div className="secao-backup">
      {/* Mesmo arranjo das outras sub-telas (Erros/Equipe): titulo primeiro,
          acoes juntas a direita. O `.hero-demandas` e um flex com
          space-between — um terceiro filho solto jogaria o titulo para o meio
          da tela, so nesta tela. */}
      <header className="hero-demandas">
        <h1 className="hero-titulo">Backup</h1>
        <div className="hero-acoes">
          <button
            type="button"
            className="btn-circular"
            onClick={aoVoltar}
            aria-label="Voltar"
            title="Voltar"
          >
            <Icone nome="voltar" size={20} />
          </button>
          <button
            type="button"
            className="btn-circular"
            onClick={aoAbrirNotif}
            aria-label="Notificações"
            title="Notificações"
          >
            <Icone nome="sino" size={20} />
            {naoLidas > 0 && <span className="sino-badge">{naoLidas}</span>}
          </button>
        </div>
      </header>

      <p className="bk-intro">
        Baixa uma cópia de todos os dados do app num arquivo <code>.zip</code>,
        para você guardar onde quiser. Cada tabela vem em <strong>CSV</strong>{' '}
        (abre no Excel) e em <strong>JSON</strong> (fiel ao banco).
      </p>

      <button
        type="button"
        className="bk-botao"
        onClick={baixar}
        disabled={gerando || Boolean(tipoBaixando)}
      >
        <Icone nome="arquivo" size={18} />
        {gerando ? 'Gerando…' : 'Baixar backup agora'}
      </button>

      {progresso && (
        <p className="bk-progresso" role="status">
          Lendo {progresso.nome ?? 'o último arquivo'}… ({progresso.feitas} de{' '}
          {progresso.total})
        </p>
      )}

      {erro && <p className="erro">{erro}</p>}

      {pronto && (
        <div className="bk-pronto" role="status">
          <strong>{pronto.arquivo}</strong> baixado —{' '}
          {totalLinhas.toLocaleString('pt-BR')} linhas em{' '}
          {pronto.resumo.length} tabelas.
          <ul className="bk-resumo">
            {pronto.resumo.map((r) => (
              <li key={r.nome}>
                <span>{r.nome}</span>
                <span className="bk-num">{r.linhas}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Os ARQUIVOS dos anexos, em zips separados por tipo. Separados porque
          somam 105 MB: dois arquivos de 60 e 45 MB são bem mais fáceis de
          montar (e de guardar) do que um de 105. */}
      <div className="bk-anexos">
        <h2>Arquivos dos anexos</h2>
        <p className="bk-nota">
          Os PDFs e fotos em si, organizados numa pasta por demanda. O número
          da pasta é o <code>id</code> da demanda — é por ele que este zip se
          liga ao backup de dados.
        </p>

        {!desktop && (
          <p className="bk-aviso-celular" role="status">
            <Icone nome="aviso" size={16} />
            São mais de 100 MB somados, montados na memória do aparelho. Faça
            este download <strong>pelo computador</strong>.
          </p>
        )}

        <div className="bk-anexos-botoes">
          {Object.entries(TIPOS_ANEXO).map(([tipo, info]) => (
            <button
              key={tipo}
              type="button"
              className="bk-botao bk-botao-secundario"
              onClick={() => baixarAnexos(tipo)}
              disabled={!desktop || Boolean(tipoBaixando) || gerando}
              title={!desktop ? 'Disponível no computador' : info.ajuda}
            >
              <Icone nome="arquivo" size={18} />
              {tipoBaixando === tipo ? 'Baixando…' : info.rotulo}
            </button>
          ))}
        </div>

        {progAnexos && (
          <p className="bk-progresso" role="status">
            Baixando {progAnexos.feitas} de {progAnexos.total}
            {progAnexos.nome ? ` — ${progAnexos.nome}` : ''}
          </p>
        )}

        {prontoAnexos && (
          <div className="bk-pronto" role="status">
            <strong>{prontoAnexos.arquivo}</strong> baixado —{' '}
            {prontoAnexos.incluidos} arquivo(s).
            {prontoAnexos.falhas.length > 0 && (
              <p className="bk-nota">
                {prontoAnexos.falhas.length} não puderam ser baixados e estão
                listados no LEIA-ME dentro do zip.
              </p>
            )}
          </div>
        )}
      </div>

      {/* O que o backup NÃO leva. Dito aqui, e não só dentro do zip: quem
          confia num backup precisa saber o tamanho da rede antes de precisar
          dela. */}
      <div className="bk-ressalvas">
        <h2>O que este backup não inclui</h2>
        <ul>
          <li>
            <strong>Os arquivos dos anexos</strong> (PDFs e fotos) — aqui vão
            só os dados sobre eles. Os arquivos têm botão próprio, abaixo.
          </li>
          <li>
            <strong>Senhas</strong> — ficam no Auth do Supabase, fora do
            alcance do app.
          </li>
          <li>
            Notificações e log de erros: são operacionais, não conteúdo.
          </li>
        </ul>
        <p className="bk-nota">
          São {TABELAS.length} tabelas. O backup traz o que a sua conta pode
          ver — como admin, é tudo, menos as demandas da conta de teste (que é
          oculta).
        </p>
      </div>
    </div>
  )
}
