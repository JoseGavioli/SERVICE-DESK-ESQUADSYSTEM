// Tela inicial (boas-vindas) do app logado.
export default function Inicio({ perfil }) {
  return (
    <div className="bloco">
      <h1>Bem-vindo 👋</h1>
      <p>
        Olá, <strong>{perfil.nome_completo}</strong>!
      </p>
    </div>
  )
}
