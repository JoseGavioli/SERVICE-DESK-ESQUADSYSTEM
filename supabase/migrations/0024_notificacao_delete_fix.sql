-- ───────────────────────────────────────────────────────────────
-- Migracao 0024 — garante a policy de DELETE das notificacoes (fix #25)
--
-- BUG #25: o botao "limpar" nao apaga as notificacoes do banco — elas somem
-- da tela (estado local zerado) mas VOLTAM no proximo login/reload.
--
-- CAUSA: com RLS ligada, um DELETE sem policy de DELETE que o permita afeta
-- 0 linhas e retorna SUCESSO (200) sem erro — ou seja, o delete e bloqueado
-- SILENCIOSAMENTE. A policy de DELETE foi criada na 0017, mas o sintoma indica
-- que ela NAO esta ativa em producao (a 0017 provavelmente nao foi rodada).
--
-- Esta migracao e IDEMPOTENTE: dropa a policy se existir e recria. E' seguro
-- rodar mesmo que a 0017 ja tenha rodado (fica igual).
--
-- Como aplicar: cole no SQL Editor do Supabase e rode.
-- ───────────────────────────────────────────────────────────────

drop policy if exists "notificacao_apagar" on notificacao;

create policy "notificacao_apagar" on notificacao
  for delete using ( destinatario_id = auth.uid() );
