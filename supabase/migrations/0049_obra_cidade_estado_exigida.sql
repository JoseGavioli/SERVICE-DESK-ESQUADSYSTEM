-- ───────────────────────────────────────────────────────────────
-- Migracao 0049 — "Cidade e estado" da obra: A EXIGENCIA (§#85 fase 3)
--
-- ⚠ RODE ESTA SO DEPOIS DE O FRONT DA FASE 3 ESTAR PUBLICADO E FUNCIONANDO.
--
-- Por que a espera: o CHECK vale para toda linha GRAVADA a partir dele. O app
-- ANTIGO grava obra em quatro lugares sem a coluna nova — lib/obraPadrao.js
-- (o fallback "Obra de {cliente}"), SeletorObra ("Criar obra") e o criar/
-- editar da tela de obras do cliente. Se este CHECK entrar antes do front
-- novo, esses quatro fluxos passam a dar erro para todo mundo. E como o app e
-- PWA (cacheia a versao antiga), nao basta o deploy: quem estiver com o app
-- aberto continua no codigo velho ate atualizar.
--
-- ORDEM CERTA: 0047 (coluna) -> 0048 (funcao que deixa o vendedor completar) ->
-- front publicado -> conferir no app -> 0049.
--
-- POR QUE `NOT VALID`:
-- exige o campo em toda obra NOVA ou EDITADA, sem tocar nas 35 antigas (o
-- Postgres so verifica as linhas que forem gravadas dali em diante). Assim a
-- regra vive no BANCO, e nao so no formulario (§3), sem precisar inventar um
-- valor para o historico.
--
-- EFEITO COLATERAL COMBINADO COM O DONO: editar uma obra antiga (ate so o
-- nome) passa a exigir preencher a cidade. E o mesmo "pedir na hora" que o app
-- faz ao usar a obra numa demanda nova — a tela de obras ja pede o campo.
--
-- O `btrim(...) <> ''` fecha a porta do "espaco em branco": sem ele, mandar
-- " " passaria e o campo continuaria vazio na pratica.
--
-- O QUE QUEBRA SE NAO RODAR: nada visivel — a obrigatoriedade fica valendo so
-- pelo formulario. Quem gravar por fora do app (SQL Editor, API) consegue
-- criar obra sem cidade.
--
-- NAO e destrutiva. Cole no SQL Editor e clique "Run".
-- ───────────────────────────────────────────────────────────────

alter table obra
  drop constraint if exists obra_cidade_estado_preenchida;

alter table obra
  add constraint obra_cidade_estado_preenchida
  check (cidade_estado is not null and btrim(cidade_estado) <> '')
  not valid;

-- ── Conferencia (opcional) ──────────────────────────────────────
-- Deve devolver a constraint com convalidated = false (é o esperado: `not
-- valid` significa "as linhas antigas nao foram verificadas"):
--
--   select conname, convalidated
--     from pg_constraint
--    where conrelid = 'obra'::regclass
--      and conname = 'obra_cidade_estado_preenchida';
--
-- Teste rapido de que a regra pegou. O `rollback` no fim e o que importa:
-- sem ele, um teste que PASSASSE deixaria uma obra lixo no cadastro de
-- producao. Com ele, o unico resultado e a mensagem de erro esperada
-- ("new row for relation obra violates check constraint ..."):
--
--   begin;
--     insert into obra (cliente_id, nome)
--     values ((select id from cliente limit 1), 'teste sem cidade');
--   rollback;
