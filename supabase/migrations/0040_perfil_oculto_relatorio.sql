-- ───────────────────────────────────────────────────────────────
-- Migracao 0040 — perfil fora do relatorio (conta de teste)
--
-- A conta de teste cria demandas em producao e elas apareciam no relatorio
-- mensal do gerente, poluindo os numeros. Em vez de filtrar pelo NOME no
-- codigo (quebra se renomear) ou cravar o id no fonte (numero magico), damos
-- ao perfil uma flag — data-driven, como o resto do projeto (§10).
--
-- `oculto_relatorio` nomeia o EFEITO (nao aparece no relatorio), nao o motivo:
-- amanha pode ser outra conta que nao seja de "teste".
--
-- Nao mexe em RLS: a coluna e lida junto do perfil, e quem le o relatorio
-- (admin/atendente/gerente) ja pode ler os perfis (migracao 0032).
--
-- NAO e destrutiva. Cole no SQL Editor e clique "Run".
-- ───────────────────────────────────────────────────────────────

alter table perfil
  add column if not exists oculto_relatorio boolean not null default false;

-- Marca a conta de teste de hoje. Idempotente (roda de novo sem efeito).
-- Se um dia houver outra conta a esconder, basta um update igual a este.
update perfil
  set oculto_relatorio = true
  where nome_completo = 'USUARIO DE TESTE';
