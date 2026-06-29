-- ───────────────────────────────────────────────────────────────
-- Migracao 0005 — Fase 3b: comentarios
--
-- Cria o enum de contexto, a tabela comentario e a RLS que amarra a
-- visibilidade do comentario a visibilidade da demanda-pai.
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e rode.
-- ───────────────────────────────────────────────────────────────

-- Contexto do comentario. NULL = comentario normal. Os outros valores
-- serao usados nas proximas sub-etapas (cancelamento e mudanca de status).
create type contexto_comentario as enum (
  'solicitacao_cancelamento',
  'mudanca_status'
);

create table comentario (
  id         bigint              generated always as identity primary key,
  demanda_id bigint              not null references demanda (id) on delete cascade,
  autor_id   uuid                not null references perfil (id)  on delete restrict default auth.uid(),
  texto      text                not null,
  contexto   contexto_comentario,            -- NULL = comentario normal
  created_at timestamptz         not null default now()
);

alter table comentario enable row level security;

-- Leitura: enxerga os comentarios quem enxerga a demanda-pai
-- (o vendedor dono, ou admin/atendente).
create policy "comentario_leitura" on comentario
  for select
  using (
    exists (
      select 1 from demanda d
      where d.id = comentario.demanda_id
        and (
          d.vendedor_id = auth.uid()
          or public.meu_papel() in ('admin', 'atendente')
        )
    )
  );

-- Comentar: o autor e sempre o usuario logado (inforjavel) E ele precisa
-- poder ver a demanda em questao.
create policy "comentario_criar" on comentario
  for insert
  with check (
    autor_id = auth.uid()
    and exists (
      select 1 from demanda d
      where d.id = demanda_id
        and (
          d.vendedor_id = auth.uid()
          or public.meu_papel() in ('admin', 'atendente')
        )
    )
  );

-- Sem policy de UPDATE/DELETE: comentarios sao imutaveis (historia honesta).
