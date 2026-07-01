-- ───────────────────────────────────────────────────────────────
-- Migracao 0017 — permitir LIMPAR (apagar) as proprias notificacoes
--
-- Policy de DELETE em notificacao: cada um so pode apagar as SUAS
-- (destinatario_id = auth.uid()). Garante, no banco, que "limpar" nunca
-- afeta as notificacoes de outro usuario.
--
-- NAO-DESTRUTIVA: so cria uma policy.
--
-- Como aplicar: cole no SQL Editor do Supabase e rode.
-- ───────────────────────────────────────────────────────────────

create policy "notificacao_apagar" on notificacao
  for delete using ( destinatario_id = auth.uid() );
