-- ───────────────────────────────────────────────────────────────
-- Migracao 0031 — RLS e acoes do "gerente de vendas"  [issue #44]
--
-- Rode DEPOIS da 0030 (que cria o papel `gerente` e a coluna urgencia_manual).
--
-- O gerente: acesso de vendedor + VE TODAS as demandas (leitura) + define
-- prazo e urgencia. Ele NAO move status nem efetiva cancelamento (isso e do
-- staff). Aqui:
--   1) leitura: gerente entra no ramo "ve tudo" (demanda/comentario/historico/
--      anexo). cliente/obra ja sao abertos a qualquer logado — nao mudam.
--   2) mover_status: passa a exigir admin/atendente (antes so barrava vendedor,
--      o que deixaria o gerente mover status). Recriada, resto identico a 0027.
--   3) alterar_prazo: liberado tambem para o gerente (antes so admin/atendente).
--   4) definir_urgencia: nova funcao (gerente/admin) que grava urgencia_manual.
--
-- NAO e destrutiva (altera policies e recria funcoes). Cole no SQL Editor.
-- ───────────────────────────────────────────────────────────────

-- ── 1) Leitura: gerente ve TODAS as demandas (e o que as acompanha) ──
alter policy "demanda_leitura" on demanda
  using (
    vendedor_id = auth.uid()
    or public.meu_papel() in ('admin', 'atendente', 'gerente')
  );

alter policy "comentario_leitura" on comentario
  using (
    exists (
      select 1 from demanda d
      where d.id = comentario.demanda_id
        and (
          d.vendedor_id = auth.uid()
          or public.meu_papel() in ('admin', 'atendente', 'gerente')
        )
    )
  );

alter policy "historico_leitura" on historico_status
  using (
    exists (
      select 1 from demanda d
      where d.id = historico_status.demanda_id
        and (
          d.vendedor_id = auth.uid()
          or public.meu_papel() in ('admin', 'atendente', 'gerente')
        )
    )
  );

alter policy "anexo_leitura" on anexo
  using (
    exists (
      select 1 from demanda d
      where d.id = anexo.demanda_id
        and (
          d.vendedor_id = auth.uid()
          or public.meu_papel() in ('admin', 'atendente', 'gerente')
        )
    )
  );

-- ── 2) mover_status: agora exige STAFF (admin/atendente). Bloqueia gerente ──
--    e vendedor. Recriada IDENTICA a 0027, so trocando o guardiao do topo.
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
  -- 1) Quem sou eu? Precisa ter perfil, estar ATIVO e ser STAFF (§5/§issue #44).
  select papel into v_papel from perfil where id = v_uid;
  if v_papel is null then
    raise exception 'Usuário sem perfil.';
  end if;
  if not public.sou_ativo() then
    raise exception 'Usuário desativado não pode mover status.';
  end if;
  if v_papel not in ('admin', 'atendente') then
    raise exception 'Apenas o staff pode mover status.';
  end if;

  -- 2) Status atual (trava a linha contra concorrencia).
  select status into v_status_atual from demanda where id = p_demanda_id for update;
  if v_status_atual is null then
    raise exception 'Demanda não encontrada.';
  end if;

  -- 3) Cancelamento: efetivado pelo STAFF (§12/§issue #36).
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

-- ── 3) alterar_prazo: liberado para o gerente tambem (antes so staff) ──
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
  select papel into v_papel from perfil where id = v_uid;
  if v_papel is null then
    raise exception 'Usuário sem perfil.';
  end if;
  if not public.sou_ativo() then
    raise exception 'Usuário desativado não pode alterar o prazo.';
  end if;
  -- Staff OU gerente ajustam o prazo (§issue #44).
  if v_papel not in ('admin', 'atendente', 'gerente') then
    raise exception 'Você não pode alterar o prazo.';
  end if;

  if p_novo_prazo is null then
    raise exception 'Informe o novo prazo.';
  end if;

  select status, prazo into v_status, v_antigo
    from demanda where id = p_demanda_id for update;
  if v_status is null then
    raise exception 'Demanda não encontrada.';
  end if;
  if v_status in ('enviado', 'cancelada') then
    raise exception 'Não é possível alterar o prazo de uma demanda encerrada.';
  end if;

  if v_antigo is not distinct from p_novo_prazo then
    return;
  end if;

  update demanda set prazo = p_novo_prazo where id = p_demanda_id;

  v_texto := 'Prazo alterado de '
    || to_char(v_antigo, 'DD/MM/YYYY') || ' para '
    || to_char(p_novo_prazo, 'DD/MM/YYYY')
    || case when v_motivo is not null then ' — ' || v_motivo else '' end;

  insert into comentario (demanda_id, autor_id, texto, contexto)
  values (p_demanda_id, v_uid, v_texto, 'mudanca_prazo');
end;
$$;

-- ── 4) definir_urgencia: gerente/admin sobrepoe a urgencia (§issue #44) ──
--    p_nivel = um dos 5 niveis, ou NULL = volta ao calculo automatico (prazo).
create or replace function public.definir_urgencia(
  p_demanda_id bigint,
  p_nivel      text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_papel papel;
begin
  select papel into v_papel from perfil where id = auth.uid();
  if v_papel is null then
    raise exception 'Usuário sem perfil.';
  end if;
  if not public.sou_ativo() then
    raise exception 'Usuário desativado não pode definir a urgência.';
  end if;
  if v_papel not in ('admin', 'gerente') then
    raise exception 'Apenas gerente ou admin pode definir a urgência.';
  end if;
  if p_nivel is not null and p_nivel not in
     ('atrasado', 'muito_urgente', 'urgente', 'pouco_urgente', 'sem_urgencia') then
    raise exception 'Nível de urgência inválido.';
  end if;
  if not exists (select 1 from demanda where id = p_demanda_id) then
    raise exception 'Demanda não encontrada.';
  end if;

  update demanda set urgencia_manual = p_nivel where id = p_demanda_id;
end;
$$;

grant execute on function public.definir_urgencia(bigint, text) to authenticated;
