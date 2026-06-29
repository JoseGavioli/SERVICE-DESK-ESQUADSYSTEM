-- ───────────────────────────────────────────────────────────────
-- Migracao 0007 — Fase 3: perfis de admin/atendente visiveis a todos
--
-- Problema: o vendedor so lia o PROPRIO perfil, entao o nome do
-- admin/atendente que comentava/movia status nao aparecia para ele.
--
-- Solucao: qualquer usuario logado pode LER os perfis de admin/atendente
-- (a equipe de atendimento). Os vendedores continuam SEM ver uns aos
-- outros — esta policy so libera linhas cujo papel e admin ou atendente.
-- (Policies de leitura sao permissivas e se SOMAM as ja existentes.)
-- ───────────────────────────────────────────────────────────────

create policy "perfil_staff_visivel" on perfil
  for select
  using ( papel in ('admin', 'atendente') );
