-- ───────────────────────────────────────────────────────────────
-- Migracao 0021 — aviso "prazo se aproximando" (issue #12)
--
-- Alem de PRAZO VENCIDO (0020), o job diario passa a avisar quando o prazo
-- esta SE APROXIMANDO = vence HOJE ou no PROXIMO dia util (dias_uteis <= 1 e
-- ainda nao vencido — o nivel "Muito urgente"). Vai para os ADMINS ativos,
-- UMA vez por demanda. Novo tipo: 'prazo_proximo'.
--
-- Como aplicar: rode no SQL Editor. O cron ja agendado (notificar-pendencias)
-- passa a usar a nova versao da funcao automaticamente — nao precisa reagendar.
-- ───────────────────────────────────────────────────────────────

-- ① adiciona o tipo 'prazo_proximo' no CHECK
do $$
declare c text;
begin
  select conname into c from pg_constraint
  where conrelid = 'notificacao'::regclass and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%tipo%';
  if c is not null then
    execute 'alter table notificacao drop constraint ' || quote_ident(c);
  end if;
end $$;

alter table notificacao add constraint notificacao_tipo_check check (tipo in (
  'nova_demanda', 'mudanca_status', 'cancelamento_efetivado',
  'novo_comentario', 'solicitacao_cancelamento',
  'prazo_vencido', 'custo_atrasado', 'prazo_proximo'
));

-- ② recria notificar_pendencias com o bloco (C) do "prazo se aproximando"
create or replace function public.notificar_pendencias()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  -- (A) PRAZO VENCIDO -> ADMINS ativos.
  insert into notificacao (destinatario_id, autor_id, demanda_id, tipo)
  select p.id, null, d.id, 'prazo_vencido'
  from demanda d
  join perfil p on p.papel = 'admin' and p.ativo
  where d.status not in ('enviado', 'cancelada')
    and d.prazo < v_hoje
    and not exists (
      select 1 from notificacao n
      where n.demanda_id = d.id and n.tipo = 'prazo_vencido' and n.destinatario_id = p.id
    );

  -- (B) CUSTO ATRASADO (>= 5 dias uteis em revisao) -> DONO + ADMINS ativos.
  insert into notificacao (destinatario_id, autor_id, demanda_id, tipo)
  select p.id, null, d.id, 'custo_atrasado'
  from demanda d
  join lateral (
    select min(h.created_at) as primeira
    from historico_status h
    where h.demanda_id = d.id and h.para_status = 'em_revisao_custo'
  ) rev on true
  join perfil p on p.ativo and (p.id = d.vendedor_id or p.papel = 'admin')
  where d.status not in ('enviado', 'cancelada')
    and rev.primeira is not null
    and public.dias_uteis((rev.primeira at time zone 'America/Sao_Paulo')::date, v_hoje) >= 5
    and not exists (
      select 1 from notificacao n
      where n.demanda_id = d.id and n.tipo = 'custo_atrasado' and n.destinatario_id = p.id
    );

  -- (C) PRAZO SE APROXIMANDO (vence hoje ou no proximo dia util, ainda nao
  --     vencido) -> ADMINS ativos.
  insert into notificacao (destinatario_id, autor_id, demanda_id, tipo)
  select p.id, null, d.id, 'prazo_proximo'
  from demanda d
  join perfil p on p.papel = 'admin' and p.ativo
  where d.status not in ('enviado', 'cancelada')
    and d.prazo >= v_hoje
    and public.dias_uteis(v_hoje, d.prazo) <= 1
    and not exists (
      select 1 from notificacao n
      where n.demanda_id = d.id and n.tipo = 'prazo_proximo' and n.destinatario_id = p.id
    );
end;
$$;
