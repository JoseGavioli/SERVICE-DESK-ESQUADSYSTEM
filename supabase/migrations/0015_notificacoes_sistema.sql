-- ───────────────────────────────────────────────────────────────
-- Migracao 0015 — Sistema de notificacoes (Fase A: in-app + tempo real)
--
-- Tabela notificacao (por destinatario) preenchida por GATILHOS (a prova de
-- forja) quando algo acontece numa demanda. Regra de quem recebe ("outra ponta"):
--   - acao de VENDEDOR  -> notifica todo o STAFF (admin/atendente) ativo
--   - acao de STAFF     -> notifica so o VENDEDOR DONO da demanda
--   - nunca o proprio autor; um vendedor nunca recebe de outro vendedor
--
-- No fim, liga a tabela no Realtime (tempo real no app).
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e rode.
-- ───────────────────────────────────────────────────────────────

-- ① Tabela ───────────────────────────────────────────────────────
create table notificacao (
  id              bigint      generated always as identity primary key,
  destinatario_id uuid        not null references perfil (id)  on delete cascade,
  autor_id        uuid        not null references perfil (id)  on delete restrict,
  demanda_id      bigint      not null references demanda (id) on delete cascade,
  tipo            text        not null check (tipo in (
                    'nova_demanda', 'mudanca_status', 'cancelamento_efetivado',
                    'novo_comentario', 'solicitacao_cancelamento')),
  lida            boolean     not null default false,
  created_at      timestamptz not null default now()
);

create index notificacao_dest_lida on notificacao (destinatario_id, lida);

alter table notificacao enable row level security;

-- Cada um le e marca como lida SO as proprias. Ninguem insere direto:
-- os gatilhos (security definer) criam.
create policy "notificacao_leitura" on notificacao
  for select using ( destinatario_id = auth.uid() );
create policy "notificacao_marcar_lida" on notificacao
  for update using ( destinatario_id = auth.uid() )
  with check ( destinatario_id = auth.uid() );

-- ② criar_notificacoes(): a regra de quem recebe ("outra ponta") ──
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
declare
  v_papel_autor papel;
  v_dono        uuid;
begin
  select papel into v_papel_autor from perfil where id = p_autor_id;
  select vendedor_id into v_dono from demanda where id = p_demanda_id;

  if v_papel_autor = 'vendedor' then
    -- Acao de vendedor -> todo o STAFF ativo (menos o proprio autor).
    insert into notificacao (destinatario_id, autor_id, demanda_id, tipo)
    select p.id, p_autor_id, p_demanda_id, p_tipo
    from perfil p
    where p.papel in ('admin', 'atendente')
      and p.ativo
      and p.id <> p_autor_id;
  else
    -- Acao de staff -> so o VENDEDOR DONO (se ativo e nao for o proprio autor).
    insert into notificacao (destinatario_id, autor_id, demanda_id, tipo)
    select p.id, p_autor_id, p_demanda_id, p_tipo
    from perfil p
    where p.id = v_dono
      and p.ativo
      and p.id <> p_autor_id;
  end if;
end;
$$;

-- ③ Gatilhos ─────────────────────────────────────────────────────

-- Nova demanda criada.
create or replace function public.trg_notif_nova_demanda()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.criar_notificacoes(new.id, new.vendedor_id, 'nova_demanda');
  return new;
end;
$$;
create trigger notif_nova_demanda
  after insert on demanda
  for each row execute function public.trg_notif_nova_demanda();

-- Mudanca de status (cancelamento efetivado tem tipo proprio).
create or replace function public.trg_notif_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.criar_notificacoes(
    new.demanda_id, new.autor_id,
    case when new.para_status = 'cancelada'
         then 'cancelamento_efetivado' else 'mudanca_status' end
  );
  return new;
end;
$$;
create trigger notif_status
  after insert on historico_status
  for each row execute function public.trg_notif_status();

-- Novo comentario / solicitacao de cancelamento. Comentarios que sao apenas
-- o registro de uma mudanca de status ja foram notificados acima -> nao duplica.
create or replace function public.trg_notif_comentario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.contexto = 'mudanca_status' then
    return new;
  end if;
  perform public.criar_notificacoes(
    new.demanda_id, new.autor_id,
    case when new.contexto = 'solicitacao_cancelamento'
         then 'solicitacao_cancelamento' else 'novo_comentario' end
  );
  return new;
end;
$$;
create trigger notif_comentario
  after insert on comentario
  for each row execute function public.trg_notif_comentario();

-- ④ Realtime: o app "escuta" esta tabela e o sino atualiza sozinho.
alter publication supabase_realtime add table notificacao;
