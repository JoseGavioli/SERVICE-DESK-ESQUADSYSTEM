-- ───────────────────────────────────────────────────────────────
-- Migracao 0019 — data da 1a entrada em "em revisao de custo"
--
-- Para o alerta de ATRASADO: por demanda, a data da PRIMEIRA vez que ela
-- entrou em 'em_revisao_custo' (o relogio do atraso comeca ai e nao reseta).
-- O front usa isso para calcular >= 5 dias uteis.
--
-- SECURITY INVOKER (padrao) => respeita a RLS do historico (vendedor ve as
-- proprias; staff ve todas).
--
-- Como aplicar: cole no SQL Editor do Supabase e rode.
-- ───────────────────────────────────────────────────────────────

create or replace function public.datas_primeira_revisao()
returns table (demanda_id bigint, data timestamptz)
language sql
stable
as $$
  select h.demanda_id, min(h.created_at)
  from historico_status h
  where h.para_status = 'em_revisao_custo'
  group by h.demanda_id
$$;

grant execute on function public.datas_primeira_revisao() to authenticated;
