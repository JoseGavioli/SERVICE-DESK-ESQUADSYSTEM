-- ───────────────────────────────────────────────────────────────
-- Migracao 0001 — Schema base da Fase 0
--
-- Cria o tipo "papel" e a tabela "perfil" (ligada ao Supabase Auth),
-- com a RLS minima necessaria para o login funcionar.
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase
-- e clique em "Run". (Decisao do projeto: cada migracao fica guardada
-- como arquivo .sql aqui, para termos historico e poder explicar.)
-- ───────────────────────────────────────────────────────────────

-- 1) Tipo "papel": os tres papeis possiveis do sistema.
--    Usar um ENUM garante que SO esses tres valores entram na coluna —
--    o banco recusa qualquer outro texto (ex.: "venddor" digitado errado).
create type papel as enum ('admin', 'atendente', 'vendedor');

-- 2) Tabela "perfil": os dados do usuario que NAO moram no Auth.
--    O id e o MESMO id do usuario no Supabase Auth — relacao 1 para 1.
--    "on delete cascade": se o usuario for apagado no Auth, o perfil some junto.
create table perfil (
  id            uuid        primary key references auth.users (id) on delete cascade,
  nome_completo text        not null,
  celular       text,
  papel         papel       not null default 'vendedor',  -- default = papel de MENOR poder (mais seguro)
  ativo         boolean     not null default true,         -- desativar sem apagar historico
  created_at    timestamptz not null default now()
);

-- 3) Liga a RLS (Row Level Security) na tabela.
--    A partir daqui, por padrao NINGUEM le nem escreve nada nesta tabela:
--    so passa o que uma "policy" abaixo permitir explicitamente.
alter table perfil enable row level security;

-- 4) Policy de LEITURA: um usuario logado pode ler APENAS o proprio perfil.
--    auth.uid() = o id do usuario que esta fazendo a requisicao naquele momento.
--    Resultado: ninguem enxerga o perfil de outra pessoa.
--    (As regras completas por papel — admin ve todos, etc. — vem na Fase 1.)
create policy "perfil_leitura_propria"
  on perfil
  for select
  using ( id = auth.uid() );
