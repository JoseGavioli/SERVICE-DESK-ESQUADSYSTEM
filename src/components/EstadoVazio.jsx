// Estado vazio amigavel (icone + titulo + dica), reutilizavel (§issue #20).
// Usado no lugar dos textos secos de "nada aqui".
export default function EstadoVazio({ icone, titulo, dica }) {
  return (
    <div className="estado-vazio">
      <span className="estado-vazio-icone" aria-hidden="true">
        {icone}
      </span>
      <p className="estado-vazio-titulo">{titulo}</p>
      {dica && <p className="estado-vazio-dica">{dica}</p>}
    </div>
  )
}
