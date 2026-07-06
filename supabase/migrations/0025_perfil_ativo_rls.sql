-- ───────────────────────────────────────────────────────────────
-- Migracao 0025 — perfil.ativo nas ACOES (RLS + funcoes)  [issue #21]
--
-- PROBLEMA: um usuario DESATIVADO (perfil.ativo = false) ainda conseguia
-- AGIR — criar demanda/cliente/obra, comentar, anexar, mover status e
-- solicitar/descartar cancelamento. A RLS so checava PAPEL (meu_papel())
-- ou DONO (vendedor_id = auth.uid()), nunca o "ativo".
--
-- CORRECAO: uma funcao auxiliar sou_ativo() e a exigencia dela em TODAS as
-- policies de ESCRITA (insert/update/delete) e nas 3 funcoes de acao
-- (security definer). LEITURA nao muda: um desativado ainda loga e VE, mas
-- nao FAZ mais nada.
--
-- Observacao: se o UNICO admin se desativar, tera de se reativar pelo painel
-- do Supabase (a app deixa de permitir) — improvavel na pratica.
--
-- NAO e destrutiva: so troca expressoes de policy e recria funcoes.
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e rode.
-- ───────────────────────────────────────────────────────────────

-- ── Funcao auxiliar: o usuario logado esta ATIVO? ────────────────
-- Espelha meu_papel(): security definer (le perfil sem esbarrar na RLS,
-- sem recursao), stable, search_path fixo. false se nao houver perfil.
create or replace function public.sou_ativo()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select ativo from public.perfil where id = auth.uid()), false);
$$;
grant execute on function public.sou_ativo() to authenticated;

-- ── cliente: criar (qualquer logado ATIVO); editar/excluir (staff ATIVO) ──
alter policy "cliente_criar" on cliente
  with check ( public.sou_ativo() );
alter policy "cliente_editar" on cliente
  using ( public.sou_ativo() and public.meu_papel() in ('admin', 'atendente') )
  with check ( public.sou_ativo() and public.meu_papel() in ('admin', 'atendente') );
alter policy "cliente_excluir" on cliente
  using ( public.sou_ativo() and public.meu_papel() in ('admin', 'atendente') );

-- ── obra: idem cliente ───────────────────────────────────────────
alter policy "obra_criar" on obra
  with check ( public.sou_ativo() );
alter policy "obra_editar" on obra
  using ( public.sou_ativo() and public.meu_papel() in ('admin', 'atendente') )
  with check ( public.sou_ativo() and public.meu_papel() in ('admin', 'atendente') );
alter policy "obra_excluir" on obra
  using ( public.sou_ativo() and public.meu_papel() in ('admin', 'atendente') );

-- ── tipo_demanda: so admin ATIVO gerencia ────────────────────────
alter policy "tipo_admin_gerencia" on tipo_demanda
  using ( public.sou_ativo() and public.meu_papel() = 'admin' )
  with check ( public.sou_ativo() and public.meu_papel() = 'admin' );

-- ── demanda: criar (autor inforjavel E ativo) ────────────────────
alter policy "demanda_criar" on demanda
  with check ( vendedor_id = auth.uid() and public.sou_ativo() );

-- ── comentario: criar (autor inforjavel, ve a demanda E ativo) ───
alter policy "comentario_criar" on comentario
  with check (
    public.sou_ativo()
    and autor_id = auth.uid()
    and exists (
      select 1 from demanda d
      where d.id = demanda_id
        and (
          d.vendedor_id = auth.uid()
          or public.meu_papel() in ('admin', 'atendente')
        )
    )
  );

-- ── anexo: entrada (vendedor dono ATIVO), saida (staff ATIVO), excluir ──
alter policy "anexo_entrada_criar" on anexo
  with check (
    public.sou_ativo()
    and autor_id = auth.uid()
    and tipo = 'entrada'
    and exists (select 1 from demanda d where d.id = demanda_id and d.vendedor_id = auth.uid())
  );
alter policy "anexo_saida_criar" on anexo
  with check (
    public.sou_ativo()
    and autor_id = auth.uid()
    and tipo = 'saida'
    and public.meu_papel() in ('admin', 'atendente')
  );
alter policy "anexo_excluir" on anexo
  using (
    public.sou_ativo()
    and (autor_id = auth.uid() or public.meu_papel() = 'admin')
  );

-- ── storage.objects (bucket 'anexos'): enviar/excluir arquivo ────
alter policy "anexos_storage_insert" on storage.objects
  with check (
    bucket_id = 'anexos'
    and public.sou_ativo()
    and exists (
      select 1 from demanda d
      where d.id = ((storage.foldername(name))[1])::bigint
        and (d.vendedor_id = auth.uid() or public.meu_papel() in ('admin', 'atendente'))
    )
  );
alter policy "anexos_storage_delete" on storage.objects
  using (
    bucket_id = 'anexos'
    and public.sou_ativo()
    and (owner = auth.uid() or public.meu_papel() = 'admin')
  );

-- ── perfil: so admin ATIVO edita perfis (nome/celular/papel/ativo) ──
alter policy "perfil_admin_edita" on perfil
  using ( public.sou_ativo() and public.meu_papel() = 'admin' )
  with check ( public.sou_ativo() and public.meu_papel() = 'admin' );

-- ══════════════════════════════════════════════════════════════════
-- Funcoes de ACAO (security definer, ignoram RLS): rejeitar desativado.
-- ══════════════════════════════════════════════════════════════════

-- mover_status: recriada (identica a 0023) + checagem de ATIVO.
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

  -- 3) Cancelamento so o admin efetiva (§12).
  if p_novo_status = 'cancelada' and v_papel <> 'admin' then
    raise exception 'Apenas o admin pode efetivar o cancelamento.';
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

-- solicitar_cancelamento: recriada (identica a 0008) + checagem de ATIVO.
create or replace function public.solicitar_cancelamento(
  p_demanda_id bigint,
  p_motivo     text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_demanda demanda;
  v_texto   text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  if not public.sou_ativo() then
    raise exception 'Usuário desativado não pode solicitar cancelamento.';
  end if;

  if v_texto is null then
    raise exception 'O motivo do cancelamento é obrigatório.';
  end if;

  select * into v_demanda from demanda where id = p_demanda_id for update;
  if v_demanda.id is null then
    raise exception 'Demanda não encontrada.';
  end if;

  if v_demanda.vendedor_id <> v_uid then
    raise exception 'Apenas o vendedor dono pode solicitar o cancelamento.';
  end if;

  if v_demanda.status in ('enviado', 'cancelada') then
    raise exception 'Esta demanda não pode mais ser cancelada.';
  end if;

  insert into comentario (demanda_id, autor_id, texto, contexto)
  values (p_demanda_id, v_uid, v_texto, 'solicitacao_cancelamento');

  update demanda set cancelamento_solicitado = true where id = p_demanda_id;
end;
$$;

-- descartar_solicitacao_cancelamento: recriada (identica a 0008) + ATIVO.
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
  if v_papel <> 'admin' then
    raise exception 'Apenas o admin pode descartar a solicitação.';
  end if;
  update demanda set cancelamento_solicitado = false where id = p_demanda_id;
end;
$$;
