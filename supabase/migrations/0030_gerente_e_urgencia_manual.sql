-- ───────────────────────────────────────────────────────────────
-- Migracao 0030 — parte estrutural do "gerente de vendas"  [issue #44]
--
-- Duas adicoes que precisam existir ANTES da 0031 (que usa o novo papel):
--   1) novo papel `gerente` no enum `papel`;
--   2) coluna `urgencia_manual` na demanda (o gerente sobrepoe a urgencia).
--
-- IMPORTANTE: rode a 0030 e a 0031 SEPARADAS. O Postgres NAO deixa USAR um
-- valor de enum recem-adicionado na MESMA transacao — por isso a 0031 (que
-- referencia 'gerente' em policies/funcoes) fica num arquivo/rodada a parte.
--
-- NAO e destrutiva. Cole no SQL Editor e rode (depois rode a 0031).
-- ───────────────────────────────────────────────────────────────

-- 1) Novo papel: gerente de vendas.
alter type papel add value if not exists 'gerente';

-- 2) Urgencia manual (sobrepoe o calculo pelo prazo, §8). NULL = automatico.
--    Os 5 niveis espelham lib/urgencia.js (URGENCIA_NIVEIS).
alter table demanda add column urgencia_manual text;

alter table demanda
  add constraint demanda_urgencia_manual_valida
  check (
    urgencia_manual is null
    or urgencia_manual in (
      'atrasado', 'muito_urgente', 'urgente', 'pouco_urgente', 'sem_urgencia'
    )
  );
