import { useState } from 'react'
import { gerarBackup, nomeDoArquivo, TABELAS } from '../lib/backup'
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
        disabled={gerando}
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

      {/* O que o backup NÃO leva. Dito aqui, e não só dentro do zip: quem
          confia num backup precisa saber o tamanho da rede antes de precisar
          dela. */}
      <div className="bk-ressalvas">
        <h2>O que este backup não inclui</h2>
        <ul>
          <li>
            <strong>Os arquivos dos anexos</strong> (PDFs e fotos) — só os
            dados sobre eles. Os arquivos ficam no Storage do Supabase.
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
