-- ───────────────────────────────────────────────────────────────
-- Migracao 0027 — atendente tambem efetiva/descarta cancelamento  [issue #36]
--
-- MUDANCA DE DECISAO (dono): ate aqui, EFETIVAR o cancelamento era
-- exclusivo do ADMIN (§5/§12 do CLAUDE.md). O dono decidiu INCLUIR o
-- ATENDENTE — agora todo o STAFF (admin OU atendente) pode efetivar o
-- cancelamento e descartar a solicitacao. O VENDEDOR continua apenas
-- SOLICITANDO (nada muda para ele; ele segue barrado de mover status).
--
-- Recria as duas funcoes de acao afetadas — IDENTICAS a 0025, trocando
-- somente a checagem de papel de "= 'admin'" para "in ('admin','atendente')".
-- NAO e destrutiva (so `create or replace`).
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e rode.
-- ───────────────────────────────────────────────────────────────

-- ── mover_status: cancelada agora aceita STAFF (admin OU atendente) ──
create or replace function public.mover_status(
  p_demanda_id    bigint,
  p_novo_status   status_demanda,
  p_comentario    text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid               uuid := auth.uid();
  v_papel             papel;
  v_status_atual      status_demanda;
  v_permitido         boolean := false;
  v_exige_comentario  boolean := false;
  v_comentario_id     bigint := null;
  v_texto             text := nullif(btrim(coalesce(p_comentario, '')), '');
begin
  -- 1) Quem sou eu? Precisa ter perfil, estar ATIVO e nao ser vendedor (§5).
  select papel into v_papel from perfil where id = v_uid;
  if v_papel is null then
    raise exception 'Usuário sem perfil.';
  end if;
  if not public.sou_ativo() then
    raise exception 'Usuário desativado não pode mover status.';
  end if;
  if v_papel = 'vendedor' then
    raise exception 'Vendedor não pode mover status.';
  end if;

  -- 2) Status atual (trava a linha contra concorrencia).
  select status into v_status_atual from demanda where id = p_demanda_id for update;
  if v_status_atual is null then
    raise exception 'Demanda não encontrada.';
  end if;

  -- 3) Cancelamento: efetivado pelo STAFF (admin ou atendente) — §12/§issue #36.
  --    (o vendedor ja foi barrado no passo 1; aqui so sobra staff.)
  if p_novo_status = 'cancelada' and v_papel not in ('admin', 'atendente') then
    raise exception 'Apenas o staff pode efetivar o cancelamento.';
  end if;

  -- 4) Transicoes permitidas — e SOMENTE estas (§7).
  v_permitido := case v_status_atual
    when 'nao_iniciado'     then p_novo_status in ('em_andamento', 'cancelada')
    when 'em_andamento'     then p_novo_status in ('em_revisao_custo', 'congelado', 'cancelada')
    when 'congelado'        then p_novo_status in ('em_andamento', 'cancelada')
    when 'em_revisao_custo' then p_novo_status in ('concluido', 'em_andamento', 'cancelada')
    when 'concluido'        then p_novo_status in ('enviado', 'em_andamento', 'cancelada')
    else false  -- enviado e cancelada sao terminais
  end;
  if not v_permitido then
    raise exception 'Transição de % para % não é permitida.', v_status_atual, p_novo_status;
  end if;

  -- 5) Comentario obrigatorio (§13): congelar, cancelar e toda "volta".
  v_exige_comentario :=
       (v_status_atual = 'em_andamento'     and p_novo_status = 'congelado')
    or (p_novo_status = 'cancelada')
    or (v_status_atual = 'em_revisao_custo' and p_novo_status = 'em_andamento')
    or (v_status_atual = 'concluido'        and p_novo_status = 'em_andamento');
  if v_exige_comentario and v_texto is null then
    raise exception 'Esta mudança de status exige um comentário.';
  end if;

  -- 6) Cria o comentario (se houver texto), marcado como mudanca_status.
  if v_texto is not null then
    insert into comentario (demanda_id, autor_id, texto, contexto)
    values (p_demanda_id, v_uid, v_texto, 'mudanca_status')
    returning id into v_comentario_id;
  end if;

  -- 7) Move o status (e limpa a flag de cancelamento solicitado).
  update demanda
    set status = p_novo_status,
        cancelamento_solicitado = false
  where id = p_demanda_id;

  -- 8) Registra no historico (vinculando o comentario, quando houver).
  insert into historico_status (demanda_id, de_status, para_status, autor_id, comentario_id)
  values (p_demanda_id, v_status_atual, p_novo_status, v_uid, v_comentario_id);
end;
$$;

-- ── descartar_solicitacao_cancelamento: STAFF (admin OU atendente) ──
create or replace function public.descartar_solicitacao_cancelamento(
  p_demanda_id bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_papel papel;
begin
  if not public.sou_ativo() then
    raise exception 'Usuário desativado não pode agir.';
  end if;
  select papel into v_papel from perfil where id = auth.uid();
  if v_papel not in ('admin', 'atendente') then
    raise exception 'Apenas o staff pode descartar a solicitação.';
  end if;
  update demanda set cancelamento_solicitado = false where id = p_demanda_id;
end;
$$;
