-- ───────────────────────────────────────────────────────────────
-- Migracao 0020 — notificacoes por TEMPO (prazo vencido / custo atrasado)
--
-- "Passou o prazo" e "5 dias uteis em revisao de custo" sao eventos de TEMPO —
-- nao disparam gatilho no banco. Entao uma funcao (notificar_pendencias) roda
-- 1x/dia (pg_cron) e cria as notificacoes que faltam:
--   - PRAZO VENCIDO  -> notifica os ADMINS ativos
--   - CUSTO ATRASADO -> notifica o VENDEDOR dono + os ADMINS ativos
--   - UMA vez por demanda por evento (nao repete todo dia)
-- Reaproveita o sino / tempo-real ja existentes (§15).
--
-- Como aplicar:
--   1. Rode este arquivo inteiro no SQL Editor do Supabase.
--   2. Habilite a extensao pg_cron: Database > Extensions > pg_cron > Enable.
--   3. Rode o bloco de AGENDAMENTO (⑥) no fim deste arquivo.
--   (Para testar na hora, rode:  select public.notificar_pendencias();)
-- ───────────────────────────────────────────────────────────────

-- ① Libera os 2 tipos novos no CHECK do 'tipo' (dropa o antigo pelo nome real).
do $$
declare c text;
begin
  select conname into c
  from pg_constraint
  where conrelid = 'notificacao'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%tipo%';
  if c is not null then
    execute 'alter table notificacao drop constraint ' || quote_ident(c);
  end if;
end $$;

alter table notificacao add constraint notificacao_tipo_check check (tipo in (
  'nova_demanda', 'mudanca_status', 'cancelamento_efetivado',
  'novo_comentario', 'solicitacao_cancelamento',
  'prazo_vencido', 'custo_atrasado'
));

-- ② autor_id vira NULLABLE: notificacao do sistema nao tem autor humano.
alter table notificacao alter column autor_id drop not null;

-- ③ dias uteis (seg-sex) APOS 'de' ate 'ate' — mesma regra do front (urgencia.js).
create or replace function public.dias_uteis(de date, ate date)
returns int language sql immutable as $$
  select count(*)::int
  from generate_series(de + 1, ate, interval '1 day') d
  where extract(dow from d) not in (0, 6)
$$;

-- ④ O JOB: cria as notificacoes de prazo vencido / custo atrasado que faltam.
--    security definer => ignora a RLS para inserir (como os gatilhos, §15).
create or replace function public.notificar_pendencias()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  -- "hoje" no fuso de Brasilia (o servidor do Postgres roda em UTC).
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  -- (A) PRAZO VENCIDO -> ADMINS ativos que ainda nao foram avisados.
  insert into notificacao (destinatario_id, autor_id, demanda_id, tipo)
  select p.id, null, d.id, 'prazo_vencido'
  from demanda d
  join perfil p on p.papel = 'admin' and p.ativo
  where d.status not in ('enviado', 'cancelada')
    and d.prazo < v_hoje
    and not exists (
      select 1 from notificacao n
      where n.demanda_id = d.id
        and n.tipo = 'prazo_vencido'
        and n.destinatario_id = p.id
    );

  -- (B) CUSTO ATRASADO (>= 5 dias uteis em revisao) -> DONO + ADMINS ativos.
  insert into notificacao (destinatario_id, autor_id, demanda_id, tipo)
  select p.id, null, d.id, 'custo_atrasado'
  from demanda d
  join lateral (
    select min(h.created_at) as primeira
    from historico_status h
    where h.demanda_id = d.id
      and h.para_status = 'em_revisao_custo'
  ) rev on true
  join perfil p on p.ativo and (p.id = d.vendedor_id or p.papel = 'admin')
  where d.status not in ('enviado', 'cancelada')
    and rev.primeira is not null
    and public.dias_uteis((rev.primeira at time zone 'America/Sao_Paulo')::date, v_hoje) >= 5
    and not exists (
      select 1 from notificacao n
      where n.demanda_id = d.id
        and n.tipo = 'custo_atrasado'
        and n.destinatario_id = p.id
    );
end;
$$;

-- ⑤ (opcional) Testar agora, sem esperar o job:
--    select public.notificar_pendencias();

-- ───────────────────────────────────────────────────────────────
-- ⑥ AGENDAMENTO — rode SO depois de habilitar a extensao pg_cron.
--    pg_cron usa UTC; 11:00 UTC = 08:00 no horario de Brasilia.
--
--    select cron.schedule(
--      'notificar-pendencias',
--      '0 11 * * *',
--      $$ select public.notificar_pendencias(); $$
--    );
--
--    (para remover depois:  select cron.unschedule('notificar-pendencias'); )
-- ───────────────────────────────────────────────────────────────
