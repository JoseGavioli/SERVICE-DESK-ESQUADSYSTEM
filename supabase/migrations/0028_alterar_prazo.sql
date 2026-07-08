-- ───────────────────────────────────────────────────────────────
-- Migracao 0028 — alterar o prazo da demanda (com historico)  [issue #3]
--
-- O prazo e OPERACIONAL: pode mudar depois de criada (ao contrario da
-- descricao, que e imutavel §9). Quem altera e o STAFF (admin/atendente); o
-- vendedor nao mexe. Cada alteracao fica registrada nos COMENTARIOS, com um
-- contexto proprio ('mudanca_prazo') — assim aparece no historico da demanda,
-- com autor e data (a prova de forja, como o resto).
--
-- Duas partes:
--   1) novo valor no enum contexto_comentario;
--   2) funcao alterar_prazo() (security definer) que valida, atualiza e loga.
--
-- Nota sobre o enum: o ADD VALUE so e USADO em tempo de execucao (dentro da
-- funcao), nunca na propria migracao — entao roda sem problema mesmo que o
-- editor envolva tudo numa transacao. Se ainda assim reclamar de "unsafe use
-- of new value", rode a linha do ADD VALUE sozinha primeiro e depois o resto.
--
-- NAO e destrutiva. Como aplicar: cole no SQL Editor do Supabase e rode.
-- ───────────────────────────────────────────────────────────────

-- 1) Novo contexto de comentario para a mudanca de prazo.
alter type contexto_comentario add value if not exists 'mudanca_prazo';

-- 2) Funcao de acao: altera o prazo e registra a mudanca nos comentarios.
create or replace function public.alterar_prazo(
  p_demanda_id bigint,
  p_novo_prazo date,
  p_motivo     text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_papel  papel;
  v_status status_demanda;
  v_antigo date;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_texto  text;
begin
  -- 1) Precisa ser STAFF ATIVO (o vendedor nao altera prazo depois de criada).
  select papel into v_papel from perfil where id = v_uid;
  if v_papel is null then
    raise exception 'Usuário sem perfil.';
  end if;
  if not public.sou_ativo() then
    raise exception 'Usuário desativado não pode alterar o prazo.';
  end if;
  if v_papel not in ('admin', 'atendente') then
    raise exception 'Apenas o staff pode alterar o prazo.';
  end if;

  if p_novo_prazo is null then
    raise exception 'Informe o novo prazo.';
  end if;

  -- 2) Status e prazo atuais (trava a linha contra concorrencia).
  select status, prazo into v_status, v_antigo
    from demanda where id = p_demanda_id for update;
  if v_status is null then
    raise exception 'Demanda não encontrada.';
  end if;
  if v_status in ('enviado', 'cancelada') then
    raise exception 'Não é possível alterar o prazo de uma demanda encerrada.';
  end if;

  -- 3) Sem mudanca de verdade? nao faz nada (evita ruido no historico).
  if v_antigo is not distinct from p_novo_prazo then
    return;
  end if;

  -- 4) Atualiza o prazo e registra a mudanca como comentario (autor = logado).
  update demanda set prazo = p_novo_prazo where id = p_demanda_id;

  v_texto := 'Prazo alterado de '
    || to_char(v_antigo, 'DD/MM/YYYY') || ' para '
    || to_char(p_novo_prazo, 'DD/MM/YYYY')
    || case when v_motivo is not null then ' — ' || v_motivo else '' end;

  insert into comentario (demanda_id, autor_id, texto, contexto)
  values (p_demanda_id, v_uid, v_texto, 'mudanca_prazo');
end;
$$;

grant execute on function public.alterar_prazo(bigint, date, text) to authenticated;
