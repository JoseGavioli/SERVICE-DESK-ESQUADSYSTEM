import { iniciais, urlAvatar } from '../lib/avatar'

// Avatar de usuario: mostra a FOTO (se houver avatar_path) ou cai nas INICIAIS.
// `className` = a classe de tamanho/formato do container que cada tela ja usa
// (ex.: 'cad-avatar', 'avatar-mini', 'det-avatar'...). A foto preenche o
// circulo via .avatar-foto (width/height 100% + object-fit cover).
export default function Avatar({ nome, caminho, className = '' }) {
  const url = urlAvatar(caminho)
  return (
    <span className={className}>
      {url ? (
        <img className="avatar-foto" src={url} alt="" />
      ) : (
        iniciais(nome)
      )}
    </span>
  )
}
