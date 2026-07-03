-- ───────────────────────────────────────────────────────────────
-- Migracao 0022 — "concluido" de volta ao fluxo
--
-- Reverte a unica mudanca da 0013: 'em_revisao_custo' volta a ir para
-- 'concluido' (nao mais direto para 'enviado'). O fluxo feliz volta a ser:
--   nao_iniciado -> em_andamento -> em_revisao_custo -> concluido -> enviado
--
-- Motivo: o 'concluido' passa a ser o estado onde o atendente ANEXA o
-- orcamento (anexo de SAIDA) antes de marcar como 'enviado' ao vendedor.
--
-- NAO e destrutivo: nenhum dado muda; so recria a funcao mover_status.
-- Demandas que ja estao em 'enviado' (que passaram direto sob a 0013)
-- continuam validas (enviado e terminal). Demandas que estao AGORA em
-- 'em_revisao_custo' passam a ter, como proximo passo, o 'concluido'.
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e rode.
-- ───────────────────────────────────────────────────────────────

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
  -- 1) Quem sou eu? Vendedor nunca move status (§5).
  select papel into v_papel from perfil where id = v_uid;
  if v_papel is null then
    raise exception 'Usuário sem perfil.';
  end if;
  if v_papel = 'vendedor' then
    raise exception 'Vendedor não pode mover status.';
  end if;

  -- 2) Status atual (trava a linha contra concorrencia).
  select status into v_status_atual from demanda where id = p_demanda_id for update;
  if v_status_atual is null then
    raise exception 'Demanda não encontrada.';
  end if;

  -- 3) Cancelamento so o admin efetiva (§12).
  if p_novo_status = 'cancelada' and v_papel <> 'admin' then
    raise exception 'Apenas o admin pode efetivar o cancelamento.';
  end if;

  -- 4) Transicoes permitidas — e SOMENTE estas (§7). MUDANCA (0022):
  --    em_revisao_custo volta a ir para 'concluido'.
  v_permitido := case v_status_atual
    when 'nao_iniciado'     then p_novo_status in ('em_andamento', 'cancelada')
    when 'em_andamento'     then p_novo_status in ('em_revisao_custo', 'congelado', 'cancelada')
    when 'congelado'        then p_novo_status in ('em_andamento', 'cancelada')
    when 'em_revisao_custo' then p_novo_status in ('concluido', 'em_andamento', 'cancelada')
    when 'concluido'        then p_novo_status in ('enviado', 'em_revisao_custo', 'em_andamento', 'cancelada')
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
    or (v_status_atual = 'concluido'        and p_novo_status = 'em_andamento')
    or (v_status_atual = 'concluido'        and p_novo_status = 'em_revisao_custo');
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
