-- ───────────────────────────────────────────────────────────────
-- Migracao 0037 — "ultima atividade" por demanda
--
-- Para o atendente, o que importa no dia a dia e o que MEXEU por ultimo — nao
-- o que foi criado por ultimo. Mas a `demanda` so tem `created_at`: a atividade
-- real vive em outras tabelas.
--
-- ultima atividade = a MAIS RECENTE entre:
--   - a criacao da demanda (demanda.created_at);
--   - a ultima mudanca de status (historico_status);
--   - o ultimo comentario (comentario) — que tambem cobre alteracao de prazo e
--     pedido/recusa de cancelamento, pois esses viram comentario.
--
-- Calculamos na hora (mesmo padrao do `datas_primeira_revisao`, migracao 0019)
-- em vez de manter uma coluna por gatilho: e sempre correto por construcao, e
-- nao ha risco de "desencontrar" se amanhã entrar um tipo de atividade novo.
--
-- SECURITY INVOKER (padrao) => respeita a RLS: o vendedor so recebe as linhas
-- das PROPRIAS demandas; o staff recebe todas.
--
-- NAO e destrutiva. Cole no SQL Editor e clique "Run".
-- ───────────────────────────────────────────────────────────────

create or replace function public.ultima_atividade()
returns table (demanda_id bigint, em timestamptz)
language sql
stable
as $$
  select d.id,
         greatest(
           d.created_at,
           coalesce(
             (select max(h.created_at) from historico_status h
               where h.demanda_id = d.id),
             d.created_at
           ),
           coalesce(
             (select max(c.created_at) from comentario c
               where c.demanda_id = d.id),
             d.created_at
           )
         )
  from demanda d
$$;

grant execute on function public.ultima_atividade() to authenticated;
