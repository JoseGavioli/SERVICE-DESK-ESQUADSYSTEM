-- ───────────────────────────────────────────────────────────────
-- Migracao 0012 — Fase visual/UX: notificacoes na Inicio + comentario novo
--
--   - notificacoes(): mudancas de status nao vistas, mais recentes primeiro
--   - demandas_com_comentario_novo(): ids de demandas com comentario novo
--     (de outra pessoa) desde a ultima visualizacao do usuario
--
-- Ambas SECURITY INVOKER (padrao) => respeitam a RLS (so o que voce ve).
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e rode.
-- ───────────────────────────────────────────────────────────────

create or replace function public.notificacoes()
returns table (
  historico_id bigint,
  demanda_id   bigint,
  de_status    status_demanda,
  para_status  status_demanda,
  autor_nome   text,
  quando       timestamptz
)
language sql
stable
as $$
  select h.id, h.demanda_id, h.de_status, h.para_status,
         p.nome_completo, h.created_at
  from historico_status h
  join demanda d on d.id = h.demanda_id
  left join visualizacao v
    on v.demanda_id = h.demanda_id and v.user_id = auth.uid()
  left join perfil p on p.id = h.autor_id
  where h.created_at > coalesce(v.visto_em, d.created_at)
    and h.autor_id <> auth.uid()   -- nao notifico as minhas proprias acoes
  order by h.created_at desc
  limit 20
$$;

grant execute on function public.notificacoes() to authenticated;

create or replace function public.demandas_com_comentario_novo()
returns table (demanda_id bigint)
language sql
stable
as $$
  select d.id
  from demanda d
  left join visualizacao v
    on v.demanda_id = d.id and v.user_id = auth.uid()
  where exists (
    select 1 from comentario c
    where c.demanda_id = d.id
      and c.autor_id <> auth.uid()                       -- comentario de outra pessoa
      and c.created_at > coalesce(v.visto_em, d.created_at)
  )
$$;

grant execute on function public.demandas_com_comentario_novo() to authenticated;
