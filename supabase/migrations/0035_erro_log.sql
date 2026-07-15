-- ───────────────────────────────────────────────────────────────
-- Migracao 0035 — Log de erros do front (§rede de seguranca, passo 2)
--
-- O passo 1 (ErrorBoundary) impede a TELA BRANCA. Mas se o app quebra no
-- celular de um vendedor, o dono nunca fica sabendo. Esta tabela guarda o que
-- quebrou, em quem e quando — para o admin ver no painel do Supabase.
--
-- Campos uteis:
--   origem     -> onde foi pego: 'boundary-topo' | 'boundary-tela' |
--                 'window' (erro solto) | 'promise' (async sem catch)
--   componente -> a "pilha de componentes" do React: diz QUAL TELA quebrou
--                 (o app nao tem rotas, entao a url sozinha nao diz nada)
--
-- Seguranca: `perfil_id` tem DEFAULT auth.uid() e a policy exige que ele seja
-- o proprio usuario — ninguem forja erro no nome de outro (mesmo padrao de
-- "autor inforjavel" do resto do projeto). SO o admin LE.
--
-- NAO e destrutiva. Cole no SQL Editor e clique "Run".
-- ───────────────────────────────────────────────────────────────

create table if not exists erro_log (
  id         bigint generated always as identity primary key,
  perfil_id  uuid        default auth.uid() references perfil (id) on delete set null,
  origem     text,
  mensagem   text        not null,
  stack      text,
  componente text,
  url        text,
  user_agent text,
  created_at timestamptz not null default now()
);

-- Consulta tipica: "os erros mais recentes".
create index if not exists erro_log_recentes on erro_log (created_at desc);

alter table erro_log enable row level security;

-- ESCRITA: qualquer usuario logado registra o PROPRIO erro.
-- (Erro ANTES do login nao e gravado — precisaria abrir a tabela para anonimo,
--  o que viraria porta de spam. O caso real e o usuario logado.)
create policy "erro_log_registra_o_proprio" on erro_log
  for insert to authenticated
  with check ( perfil_id = auth.uid() );

-- LEITURA: so o admin ve os erros.
create policy "erro_log_admin_le" on erro_log
  for select to authenticated
  using ( public.meu_papel() = 'admin' );
