import { useState } from 'react'
import {
  comprimirImagemSePreciso,
  validarArquivo,
  formatarTamanho,
} from '../lib/anexos'
import Icone from './Icone'

// Miolo do card "Anexos" da Nova demanda (§issue #64). Os arquivos ficam
// SEGURADOS aqui ate a demanda existir — so depois do INSERT eles sobem (a
// demanda_id e obrigatoria no Storage). Quem guarda a lista e o pai, que
// precisa dela na hora de salvar; este componente so escolhe e valida.
export default function NdAnexos({ arquivos, aoAdicionar, aoRemover }) {
  const [erro, setErro] = useState('')

  async function escolher(fileList) {
    setErro('')
    // Copia a lista ANTES de qualquer await: o onChange limpa o input em
    // seguida, e o FileList original ficaria vazio no meio do laco.
    const escolhidos = Array.from(fileList)
    const novos = []
    for (const f of escolhidos) {
      const arquivo = await comprimirImagemSePreciso(f) // #41
      const problema = validarArquivo('entrada', arquivo)
      if (problema) setErro(`${arquivo.name}: ${problema}`)
      else novos.push(arquivo)
    }
    if (novos.length) aoAdicionar(novos)
  }

  return (
    <>
      {arquivos.length > 0 && (
        <ul className="arquivos-escolhidos">
          {arquivos.map((f, i) => (
            <li key={i}>
              <span>
                {f.name} ({formatarTamanho(f.size)})
              </span>
              <button
                type="button"
                className="remover"
                onClick={() => aoRemover(i)}
                aria-label={`Remover ${f.name}`}
              >
                <Icone nome="fechar" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="anexo-acoes">
        <label className="enviar-arquivo">
          <Icone nome="mais" size={16} /> Escolher arquivo
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,application/pdf"
            onChange={(e) => {
              escolher(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
        {/* No celular, abre a camera direto (foto da medicao/croqui). */}
        <label className="enviar-arquivo">
          <Icone nome="camera" size={16} /> Tirar foto
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              escolher(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
      </div>

      <span className="anexo-fmt">JPG, PNG ou PDF · até 2 MB</span>
      {erro && <p className="erro">{erro}</p>}
    </>
  )
}
