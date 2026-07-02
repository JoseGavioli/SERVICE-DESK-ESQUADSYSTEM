import Icone from './Icone'

// Estado vazio amigavel (icone + titulo + dica), reutilizavel (§issue #20).
// 'nome' e o nome do icone (ver Icone.jsx). Usado no lugar dos textos secos.
export default function EstadoVazio({ nome, titulo, dica }) {
  return (
    <div className="estado-vazio">
      {nome && <Icone nome={nome} size={34} className="estado-vazio-icone" />}
      <p className="estado-vazio-titulo">{titulo}</p>
      {dica && <p className="estado-vazio-dica">{dica}</p>}
    </div>
  )
}
