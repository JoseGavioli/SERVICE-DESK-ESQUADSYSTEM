-- ───────────────────────────────────────────────────────────────
-- Migracao 0033 — "Visto por ultimo" (last seen)  [issue #46]
--
-- A presenca em tempo real (Supabase Realtime Presence) so sabe quem esta
-- online AGORA — quando a pessoa sai, o horario dela some junto. Para mostrar
-- "online ha X" de quem JA esta offline (ex.: "a Adriana esteve online ha 5
-- min"), precisamos GUARDAR esse ultimo momento no banco.
--
-- Aqui:
--   1) coluna `visto_em` na `perfil` — o ultimo instante em que a pessoa
--      esteve online (atualizado por um "heartbeat" do app enquanto aberto).
--   2) funcao `registrar_presenca()` — cada usuario marca a PROPRIA presenca.
--
-- Por que uma FUNCAO e nao uma policy de UPDATE: hoje so o ADMIN edita a
-- `perfil` (policy "perfil_admin_edita"). Abrir UPDATE ao proprio usuario via
-- RLS deixaria ele mexer tambem no proprio `papel`/`ativo` (virar admin). A
-- funcao SECURITY DEFINER toca SO a coluna `visto_em` — mesmo padrao seguro
-- de `mover_status`/`alterar_prazo`/`definir_urgencia`.
--
-- Leitura ja esta coberta: admin/atendente/gerente leem toda a `perfil`
-- (migracao 0032), entao enxergam o `visto_em`. Nenhuma policy de leitura nova.
--
-- NAO e destrutiva. Cole este arquivo inteiro no SQL Editor e clique "Run".
-- ───────────────────────────────────────────────────────────────

-- 1) Coluna do "visto por ultimo" (nula = a pessoa nunca marcou presenca).
alter table perfil add column if not exists visto_em timestamptz;

-- 2) Cada usuario logado marca a PROPRIA presenca (so a coluna visto_em).
--    Chamada pelo app na entrada e a cada ~60s enquanto estiver aberto.
create or replace function public.registrar_presenca()
returns void
language sql
security definer
set search_path = public
as $$
  update perfil set visto_em = now() where id = auth.uid();
$$;

grant execute on function public.registrar_presenca() to authenticated;
