-- ───────────────────────────────────────────────────────────────
-- Migracao 0032 — gerente lê todos os perfis  [issue #46 + fix do #44]
--
-- A policy `perfil_leitura_equipe` (0003) deixava só admin/atendente lerem
-- TODOS os perfis. O gerente precisa disso para:
--   - VER OS VENDEDORES ONLINE na Equipe (§issue #46);
--   - e (fix do #44) ver o NOME do vendedor nas demandas — o join
--     vendedor:perfil vinha vazio para o gerente sem esta leitura.
--
-- So amplia a LEITURA (o gerente continua SEM editar perfis — isso e do admin).
-- NAO e destrutiva (altera a expressao da policy). Cole no SQL Editor e rode.
-- ───────────────────────────────────────────────────────────────

alter policy "perfil_leitura_equipe" on perfil
  using ( public.meu_papel() in ('admin', 'atendente', 'gerente') );
