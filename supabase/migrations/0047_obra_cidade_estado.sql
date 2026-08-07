-- ───────────────────────────────────────────────────────────────
-- Migracao 0047 — "Cidade e estado" da obra: A COLUNA (§#85 fase 3)
--
-- A obra passa a ser OBRIGATORIA na criacao de qualquer demanda, e junto com
-- ela a cidade/estado. Hoje isso e `obra.endereco`, opcional: de 36 obras, 35
-- estao com ele NULO — e a unica preenchida tem "Itapetininga", ou seja, o
-- dono ja usava a coluna como CIDADE. Esta migracao alinha o nome ao uso real.
--
-- ESTA MIGRACAO E SO A COLUNA. A EXIGENCIA (o CHECK) FICA NA 0048.
-- Por que separadas: o CHECK vale para toda linha GRAVADA a partir dele, e o
-- app que esta no ar grava obra em quatro lugares sem a coluna nova —
-- lib/obraPadrao.js (o fallback "Obra de {cliente}", que roda quando ninguem
-- escolhe obra), SeletorObra ("Criar obra"), e o criar/editar da tela de
-- obras do cliente. Rodar o CHECK antes do front novo quebraria esses quatro
-- fluxos para todo mundo. A ordem segura e: coluna (0047) -> front publicado
-- -> exigencia (0048).
--
-- POR QUE ADITIVA E NAO UM RENAME:
-- um `rename` quebraria o app NO AR na hora — o detalhe da demanda pede
-- `obra(nome, endereco)` e o select falharia. E a janela nao seria o minuto do
-- deploy: o app e PWA e CACHEIA a versao antiga, entao cada aparelho ficaria
-- quebrado ate atualizar. Com coluna nova, o app velho segue lendo `endereco`
-- e o novo le `cidade_estado` — os dois convivem.
--
-- A COLUNA `endereco` FICA COMO LEGADO, e sai numa migracao futura, depois
-- que o front novo estiver publicado e assentado. Nao apague agora.
--
-- O QUE QUEBRA SE NAO RODAR: nada hoje. O front da fase 3 nao e publicado
-- enquanto ela nao rodar (combinado do projeto). Se rodar e o front nao subir,
-- tambem nao muda nada para quem usa: a coluna fica ali, vazia e sem leitor.
--
-- NAO e destrutiva: nada e apagado, nada e exigido ainda.
-- Cole no SQL Editor e clique "Run".
-- ───────────────────────────────────────────────────────────────

-- 1) A coluna. Nullable: as 35 obras antigas nascem sem ela e vao sendo
--    completadas conforme forem usadas (decisao do dono — "pedir na hora").
alter table obra add column if not exists cidade_estado text;

comment on column obra.cidade_estado is
  'Cidade e estado da obra (§#85 fase 3). A exigencia de preenchimento vem na 0048 (constraint obra_cidade_estado_preenchida). Substitui obra.endereco, que ficou como legado.';

-- 2) Leva o que ja existe. So a "COND OURO VILLE" tem valor hoje, mas a copia
--    e escrita para nao depender disso: se alguem preencher mais alguma pela
--    tela antiga antes do deploy, o dado vem junto.
update obra
   set cidade_estado = btrim(endereco)
 where endereco is not null
   and btrim(endereco) <> ''
   and cidade_estado is null;

-- ── Conferencia (opcional) ──────────────────────────────────────
--   select count(*) filter (where cidade_estado is not null) as preenchidas,
--          count(*) filter (where cidade_estado is null)     as a_completar,
--          count(*)                                          as total
--     from obra;
--
-- Esperado hoje: preenchidas = 1 (COND OURO VILLE), a_completar = 35.
