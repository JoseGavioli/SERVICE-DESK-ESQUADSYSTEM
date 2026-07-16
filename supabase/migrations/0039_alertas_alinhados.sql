-- ───────────────────────────────────────────────────────────────
-- Migracao 0039 — alinha as notificacoes por tempo com as regras do app
--
-- As regras de "prazo vencido" e "custo atrasado" vivem em DOIS lugares: no
-- app (lib/urgencia.js, o que aparece na tela) e aqui (notificar_pendencias(),
-- o aviso diario do cron). Eles estavam DESENCONTRADOS — esta migracao junta
-- os dois. Recria a funcao da 0020, mudando so os filtros:
--
--   1) CUSTO ATRASADO: 5 -> 3 dias uteis (pedido do dono).
--
--   2) CUSTO ATRASADO so DENTRO da revisao (d.status = 'em_revisao_custo').
--      BUG: o app ja fazia isso desde a issue #42 (o alerta some quando a
--      demanda sai da revisao), mas o banco so checava "nao terminal" — entao
--      uma demanda que VOLTOU para em_andamento continuava disparando a
--      notificacao de custo atrasado, sem o app mostrar nada. A #42 nunca
--      tinha sido aplicada aqui.
--
--   3) PRAZO VENCIDO so em nao_iniciado/em_andamento (regra nova do dono).
--      Antes disparava em qualquer status nao-terminal — o app deixaria de
--      mostrar "Atrasado" na revisao de custo, mas o admin continuaria
--      recebendo o aviso de prazo vencido daquela demanda. Agora, a partir da
--      revisao, o unico alerta de atraso e o custo atrasado.
--
-- Nada mais muda (destinatarios, dedupe e o cron continuam iguais).
-- NAO e destrutiva. Cole no SQL Editor e clique "Run".
-- ───────────────────────────────────────────────────────────────

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
  --     SO antes da revisao de custo: dali em diante quem avisa e o (B).
  insert into notificacao (destinatario_id, autor_id, demanda_id, tipo)
  select p.id, null, d.id, 'prazo_vencido'
  from demanda d
  join perfil p on p.papel = 'admin' and p.ativo
  where d.status in ('nao_iniciado', 'em_andamento')
    and d.prazo < v_hoje
    and not exists (
      select 1 from notificacao n
      where n.demanda_id = d.id
        and n.tipo = 'prazo_vencido'
        and n.destinatario_id = p.id
    );

  -- (B) CUSTO ATRASADO (>= 3 dias uteis em revisao) -> DONO + ADMINS ativos.
  --     So conta ENQUANTO a demanda ESTA em revisao de custo (§issue #42).
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
  where d.status = 'em_revisao_custo'
    and rev.primeira is not null
    and public.dias_uteis((rev.primeira at time zone 'America/Sao_Paulo')::date, v_hoje) >= 3
    and not exists (
      select 1 from notificacao n
      where n.demanda_id = d.id
        and n.tipo = 'custo_atrasado'
        and n.destinatario_id = p.id
    );
end;
$$;
