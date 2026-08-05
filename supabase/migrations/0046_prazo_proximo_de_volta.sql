-- ───────────────────────────────────────────────────────────────
-- Migracao 0046 — devolve o aviso "prazo se aproximando" (regressao da 0039)
--
-- A 0039 recriou notificar_pendencias() dizendo "nada mais muda", mas o corpo
-- dela so tinha os blocos (A) prazo vencido e (B) custo atrasado — o bloco (C)
-- "prazo se aproximando" (0021, issue #12) sumiu na recriacao. Desde entao os
-- admins deixaram de receber o aviso de "vence hoje/amanha". Achado pela
-- revisao adversarial da 0045; o dono confirmou que quer o aviso DE VOLTA.
--
-- Esta migracao recria a funcao = corpo da 0039 (A e B intactos, com as
-- regras atuais: prazo vencido so em nao_iniciado/em_andamento; custo >= 3
-- dias uteis so DENTRO da revisao) + o bloco (C) restaurado da 0021, com UM
-- alinhamento: o (C) agora tambem vale so em nao_iniciado/em_andamento — os
-- MESMOS status do "Atrasado" (§8): da revisao em diante, o alerta que
-- importa e o custo, nao o prazo.
--
-- O tipo 'prazo_proximo' ja e aceito pelo CHECK da notificacao (0021) e o
-- app ja sabe exibi-lo ("vence em breve") — nada muda fora desta funcao.
-- O cron diario (8h BRT) passa a usar a versao nova sozinho.
--
-- O QUE QUEBRA SE NAO RODAR: nada — so continua faltando o aviso de
-- "vence hoje/amanha" que a 0039 derrubou sem querer.
--
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

  -- (C) PRAZO SE APROXIMANDO (vence hoje ou no proximo dia util, ainda nao
  --     vencido) -> ADMINS ativos. Restaurado da 0021; agora nos MESMOS
  --     status do "Atrasado" (nao_iniciado/em_andamento, §8).
  insert into notificacao (destinatario_id, autor_id, demanda_id, tipo)
  select p.id, null, d.id, 'prazo_proximo'
  from demanda d
  join perfil p on p.papel = 'admin' and p.ativo
  where d.status in ('nao_iniciado', 'em_andamento')
    and d.prazo >= v_hoje
    and public.dias_uteis(v_hoje, d.prazo) <= 1
    and not exists (
      select 1 from notificacao n
      where n.demanda_id = d.id
        and n.tipo = 'prazo_proximo'
        and n.destinatario_id = p.id
    );
end;
$$;
