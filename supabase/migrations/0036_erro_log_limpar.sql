-- ───────────────────────────────────────────────────────────────
-- Migracao 0036 — Admin pode LIMPAR o log de erros (§rede de seguranca)
--
-- A 0035 deu ao admin so a LEITURA do erro_log. Com a telinha "Erros" dentro
-- do app, ele precisa tambem APAGAR os erros ja resolvidos — senao a lista
-- cresce para sempre e vira ruido (nunca da p/ ver "o que quebrou HOJE").
--
-- So o admin apaga. Ninguem mais (o vendedor so INSERE o proprio erro).
--
-- NAO e destrutiva (so adiciona uma policy). Cole no SQL Editor e "Run".
-- ───────────────────────────────────────────────────────────────

create policy "erro_log_admin_apaga" on erro_log
  for delete to authenticated
  using ( public.meu_papel() = 'admin' );
