-- ───────────────────────────────────────────────────────────────
-- Migracao 0026 — assinatura_push (Web Push, #14 — Fase 1)
--
-- Guarda a "assinatura" de Web Push de cada APARELHO (um usuario pode ter
-- varios: celular, desktop...). E preenchida pelo cliente quando o usuario
-- liga o toggle "Receber avisos neste aparelho". Nas fases seguintes, uma
-- Edge Function (service_role) le esta tabela para ENVIAR o push.
--
-- RLS: o dono gerencia SO as suas; a Edge Function usa service_role (que
-- ignora a RLS) para ler/apagar todas ao enviar.
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e rode.
-- ───────────────────────────────────────────────────────────────

create table assinatura_push (
  id         bigint      generated always as identity primary key,
  -- Dono da assinatura. default auth.uid() torna o autor inforjavel (como em
  -- demanda.vendedor_id); on delete cascade limpa junto se o perfil sair.
  perfil_id  uuid        not null references perfil (id) on delete cascade
                         default auth.uid(),
  -- Identidade do aparelho no push service + chaves de criptografia (RFC 8291).
  endpoint   text        not null unique,
  p256dh     text        not null,
  auth       text        not null,
  user_agent text,                 -- so para o dono reconhecer o aparelho
  created_at timestamptz not null default now()
);

create index assinatura_push_perfil on assinatura_push (perfil_id);

alter table assinatura_push enable row level security;

-- Ler: so as proprias.
create policy "assinatura_push_ler" on assinatura_push
  for select using ( perfil_id = auth.uid() );

-- Inserir: o dono grava a sua (perfil_id inforjavel = auth.uid()).
create policy "assinatura_push_inserir" on assinatura_push
  for insert with check ( perfil_id = auth.uid() );

-- Atualizar: necessario para o upsert por endpoint (re-subscribe do mesmo
-- aparelho). Continua preso ao dono.
create policy "assinatura_push_atualizar" on assinatura_push
  for update using ( perfil_id = auth.uid() )
  with check ( perfil_id = auth.uid() );

-- Apagar: o dono desliga o aviso neste aparelho.
create policy "assinatura_push_apagar" on assinatura_push
  for delete using ( perfil_id = auth.uid() );
