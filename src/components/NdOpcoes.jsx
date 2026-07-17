import Icone from './Icone'

// Lista de opcoes de escolha unica, usada dentro de um <CardCampo> pelo Tipo e
// pela Origem (§issue #64). E o que substituiu os <select> nativos: no celular
// o <select> abre uma roleta do sistema que esconde a tela, enquanto aqui as
// opcoes ficam a um toque, visiveis, com a escolhida marcada.
//
// `opcoes` = [{ id, nome }]. Comparamos os ids como TEXTO porque o tipo vem do
// banco como numero e a origem e uma string — assim os dois usam o mesmo componente.
export default function NdOpcoes({ opcoes, valor, aoEscolher }) {
  return (
    <ul className="escolher-lista">
      {opcoes.map((o) => {
        const escolhida = String(o.id) === String(valor)
        return (
          <li key={o.id}>
            <button
              type="button"
              className={escolhida ? 'sel' : ''}
              onClick={() => aoEscolher(o.id)}
            >
              {o.nome}
              {escolhida && <Icone nome="check" size={16} />}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
