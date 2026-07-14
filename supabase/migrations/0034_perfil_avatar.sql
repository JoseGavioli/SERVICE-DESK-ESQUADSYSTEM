-- ───────────────────────────────────────────────────────────────
-- Migracao 0034 — Foto de perfil (avatar) + tela "Meu perfil"
--
-- O usuario passa a ter uma FOTO de perfil. Ela mora num bucket PUBLICO de
-- Storage ('avatares') — foto de perfil nao e dado sensivel, entao abre direto
-- por URL, sem assinar (mais simples que os anexos de demanda). O UPLOAD e
-- restrito: cada um so grava na PROPRIA pasta (avatares/<id-do-usuario>/...).
--
-- Aqui:
--   1) coluna `avatar_path` na `perfil` (o caminho da foto no bucket).
--   2) bucket publico `avatares`, com limite de 2 MB e so JPG/PNG (defesa a
--      mais, alem da validacao no cliente).
--   3) policies de escrita no Storage: inserir/atualizar/apagar SO na propria
--      pasta. (Leitura e publica, pelo proprio bucket — nao precisa policy.)
--   4) funcao `definir_avatar(caminho)` — o usuario grava o caminho da PROPRIA
--      foto (so a coluna avatar_path). SECURITY DEFINER pelo mesmo motivo do
--      `registrar_presenca`: hoje so o admin edita a `perfil` via RLS; abrir
--      UPDATE ao proprio usuario deixaria ele mexer no proprio papel/ativo.
--
-- NAO e destrutiva. Cole no SQL Editor e clique "Run".
-- ───────────────────────────────────────────────────────────────

-- 1) Caminho da foto (nulo = sem foto -> a tela mostra as iniciais).
alter table perfil add column if not exists avatar_path text;

-- 2) Bucket publico das fotos (limite 2 MB, so JPG/PNG).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatares', 'avatares', true, 2097152, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- 3) Escrita no Storage: cada um so na PROPRIA pasta (avatares/<uid>/...).
--    storage.foldername(name)[1] = a 1a pasta do caminho = o id do dono.
create policy "avatar_insere_o_proprio" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatar_atualiza_o_proprio" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatar_apaga_o_proprio" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4) O usuario grava o caminho da PROPRIA foto (so a coluna avatar_path).
create or replace function public.definir_avatar(p_caminho text)
returns void
language sql
security definer
set search_path = public
as $$
  update perfil set avatar_path = p_caminho where id = auth.uid();
$$;

grant execute on function public.definir_avatar(text) to authenticated;
