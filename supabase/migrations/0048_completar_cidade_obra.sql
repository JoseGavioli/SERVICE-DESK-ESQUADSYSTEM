-- ───────────────────────────────────────────────────────────────
-- Migracao 0048 — o vendedor pode COMPLETAR a cidade de uma obra (§#85 fase 3)
--
-- O PROBLEMA (achado da revisao adversarial da 0047, antes de qualquer codigo):
-- a fase 3 pede a cidade quando a obra escolhida ainda nao tem (35 das 36) e
-- grava na obra. Gravar em obra existente e um UPDATE — e a policy
-- `obra_editar` (0002, endurecida na 0025) so libera UPDATE para
-- **admin/atendente**. Vendedor e gerente ficam de fora.
--
-- E o modo como isso falha e o pior possivel: UPDATE barrado pelo `using` da
-- RLS **nao levanta erro** — a linha e simplesmente filtrada, voltam 0 linhas
-- e `error` vem nulo. O app diria "salvo", a obra continuaria sem cidade, e a
-- proxima demanda pediria de novo. Para sempre, em silencio. E como o dono e
-- ADMIN, o fluxo passaria 100% dos testes dele e so quebraria na mao do
-- vendedor — que e justamente quem mais cria demanda.
-- (Mesma familia do bug da 0044: DELETE barrado por RLS tambem volta 0 linhas
-- sem erro.)
--
-- A SOLUCAO, no padrao que o projeto ja usa para acoes (mover_status,
-- alterar_prazo, definir_urgencia): uma funcao SECURITY DEFINER estreita, que
-- faz UMA coisa so. Ela nao "abre a obra para edicao" — ela deixa
-- **completar** um campo que esta vazio:
--   • exige usuario ATIVO (§0025);
--   • recusa texto em branco;
--   • so grava quando `cidade_estado is null` — ninguem sobrescreve a cidade
--     que outra pessoa ja preencheu, e o nome da obra fica intocado.
--
-- Assim a permissao vive no BANCO (§3), nao num `if` do formulario.
--
-- O QUE QUEBRA SE NAO RODAR: o vendedor escolhe uma obra antiga, digita a
-- cidade, e ela NAO e salva (sem mensagem de erro). O front da fase 3 nao vai
-- ao ar antes desta migracao.
--
-- NAO e destrutiva. Cole no SQL Editor e clique "Run".
-- ───────────────────────────────────────────────────────────────

create or replace function public.completar_cidade_obra(
  p_obra_id bigint,
  p_cidade  text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cidade text := btrim(coalesce(p_cidade, ''));
  v_atual  text;
begin
  if not public.sou_ativo() then
    raise exception 'Conta inativa nao pode alterar obras.';
  end if;

  if v_cidade = '' then
    raise exception 'Cidade e estado nao pode ficar em branco.';
  end if;

  -- Obra inexistente e ERRO; obra que ja tem cidade e "nada a fazer" (pode ser
  -- duas pessoas preenchendo a mesma obra ao mesmo tempo). Separar os dois
  -- casos evita transformar uma corrida inofensiva em erro na cara do usuario.
  select cidade_estado into v_atual from obra where id = p_obra_id;
  if not found then
    raise exception 'Obra % nao encontrada.', p_obra_id;
  end if;
  if v_atual is not null and btrim(v_atual) <> '' then
    return;
  end if;

  update obra set cidade_estado = v_cidade where id = p_obra_id;
end;
$$;

grant execute on function public.completar_cidade_obra(bigint, text) to authenticated;

-- ── Conferencia (opcional) ──────────────────────────────────────
-- Pegue o id de uma obra sem cidade e rode:
--
--   select id, nome, cidade_estado from obra where cidade_estado is null limit 1;
--   select public.completar_cidade_obra(<id>, 'Tatuí - SP');
--   select id, nome, cidade_estado from obra where id = <id>;
--
-- Rodar de novo na MESMA obra nao deve dar erro nem trocar o valor.
