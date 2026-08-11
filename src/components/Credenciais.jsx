// Caixa que mostra dados de acesso recém-criados (email/senha no cadastro,
// só a senha no reset). É o ÚNICO lugar onde a senha aparece legível — no
// banco ela vira hash —, então quem monta esta caixa tem de avisar que ela
// não volta.
//
// Só o desenho: quem copia é o pai, com o botão dele, no lugar onde ele já
// está. Trazer o botão para cá arrumaria o layout das duas telas de um jeito
// que ninguém pediu.
export default function Credenciais({ itens }) {
  return (
    <dl className="nm-credenciais">
      {itens.map((i) => (
        <div key={i.rotulo}>
          <dt>{i.rotulo}</dt>
          <dd>
            <code>{i.valor}</code>
          </dd>
        </div>
      ))}
    </dl>
  )
}
