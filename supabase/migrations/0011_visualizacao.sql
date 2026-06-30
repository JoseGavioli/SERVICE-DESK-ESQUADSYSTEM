-- ───────────────────────────────────────────────────────────────
-- Migracao 0011 — Fase 6b: notificacoes "por demanda" (§15)
--
--   - tabela visualizacao (usuario x demanda x visto_em)
--   - funcao demandas_com_novidade(): ids das demandas visiveis com
--     mudanca de status depois da ultima visualizacao do usuario
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e rode.
-- ───────────────────────────────────────────────────────────────

create table visualizacao (
  user_id    uuid        not null references perfil (id)  on delete cascade,
  demanda_id bigint      not null references demanda (id) on delete cascade,
  visto_em   timestamptz not null default now(),
  primary key (user_id, demanda_id)
);

alter table visualizacao enable row level security;

-- Cada um le/grava apenas as PROPRIAS visualizacoes.
create policy "visualizacao_leitura" on visualizacao
  for select using ( user_id = auth.uid() );
create policy "visualizacao_inserir" on visualizacao
  for insert with check ( user_id = auth.uid() );
create policy "visualizacao_atualizar" on visualizacao
  for update using ( user_id = auth.uid() ) with check ( user_id = auth.uid() );

-- Demandas com novidade para o usuario logado: existe uma mudanca de
-- status mais recente que a ultima visualizacao (ou que a criacao, se
-- nunca abriu). SECURITY INVOKER (padrao) => respeita a RLS.
create or replace function public.demandas_com_novidade()
returns table (demanda_id bigint)
language sql
stable
as $$
  select d.id
  from demanda d
  left join visualizacao v
    on v.demanda_id = d.id and v.user_id = auth.uid()
  where exists (
    select 1 from historico_status h
    where h.demanda_id = d.id
      and h.created_at > coalesce(v.visto_em, d.created_at)
  )
$$;

grant execute on function public.demandas_com_novidade() to authenticated;
