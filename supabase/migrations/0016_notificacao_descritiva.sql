-- ───────────────────────────────────────────────────────────────
-- Migracao 0016 — notificacao descritiva + Inicio em tempo real
--
--   - notificacao ganha de_status/para_status (para descrever a acao real:
--     "iniciou", "congelou", "enviou"... em vez de "mudanca de status")
--   - a regra de "quem recebe" vira uma funcao auxiliar (destinatarios_notif)
--     reutilizada pelos gatilhos, para o de status inserir COM de/para
--   - liga a tabela DEMANDA no Realtime (a Inicio re-conta em tempo real)
--
-- NAO-DESTRUTIVA: so ADD COLUMN + CREATE OR REPLACE + ALTER PUBLICATION.
-- Sem DROP (nao mexe em dados; nao remove nada com conteudo).
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e rode.
-- ───────────────────────────────────────────────────────────────

-- ① Colunas novas (nulas para notificacoes que nao sao de status).
alter table notificacao
  add column de_status   status_demanda,
  add column para_status status_demanda;

-- ② Fan-out num lugar so: quem recebe ("outra ponta").
--    acao de vendedor -> staff ativo; acao de staff -> vendedor dono.
create or replace function public.destinatarios_notif(
  p_demanda_id bigint,
  p_autor_id   uuid
)
returns setof uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_papel_autor papel;
  v_dono        uuid;
begin
  select papel into v_papel_autor from perfil where id = p_autor_id;
  select vendedor_id into v_dono from demanda where id = p_demanda_id;

  if v_papel_autor = 'vendedor' then
    return query
      select p.id from perfil p
      where p.papel in ('admin', 'atendente') and p.ativo and p.id <> p_autor_id;
  else
    return query
      select p.id from perfil p
      where p.id = v_dono and p.ativo and p.id <> p_autor_id;
  end if;
end;
$$;

-- ③ criar_notificacoes: MESMA assinatura de antes (3 args) — so passa a
--    usar o helper por dentro. create or replace, sem drop.
create or replace function public.criar_notificacoes(
  p_demanda_id bigint,
  p_autor_id   uuid,
  p_tipo       text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notificacao (destinatario_id, autor_id, demanda_id, tipo)
  select d, p_autor_id, p_demanda_id, p_tipo
  from public.destinatarios_notif(p_demanda_id, p_autor_id) as d;
end;
$$;

-- ④ Gatilho de status: insere DIRETO, com de_status/para_status.
create or replace function public.trg_notif_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into notificacao
    (destinatario_id, autor_id, demanda_id, tipo, de_status, para_status)
  select d, new.autor_id, new.demanda_id,
    case when new.para_status = 'cancelada'
         then 'cancelamento_efetivado' else 'mudanca_status' end,
    new.de_status, new.para_status
  from public.destinatarios_notif(new.demanda_id, new.autor_id) as d;
  return new;
end;
$$;

-- ⑤ Inicio em tempo real: escuta mudancas na tabela demanda.
alter publication supabase_realtime add table demanda;
