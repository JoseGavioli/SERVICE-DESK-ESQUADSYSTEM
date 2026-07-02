-- ───────────────────────────────────────────────────────────────
-- Migracao 0018 — campos extras na demanda (formulario de nova demanda)
--
--   - club_casa            boolean  (checkbox "CLUB CASA")
--   - rt                   boolean  (RT sim/nao)
--   - rt_percentual        numeric  (so quando rt = true)
--   - arquiteto_engenheiro text     (opcional)
--
-- Definidos na criacao (como o resto da demanda). RLS nao muda (o insert ja e
-- do proprio vendedor). NAO-DESTRUTIVA: so ADD COLUMN com defaults.
--
-- Como aplicar: cole no SQL Editor do Supabase e rode.
-- ───────────────────────────────────────────────────────────────

alter table demanda
  add column club_casa            boolean not null default false,
  add column rt                   boolean not null default false,
  add column rt_percentual        numeric,
  add column arquiteto_engenheiro text;
