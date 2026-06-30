-- ───────────────────────────────────────────────────────────────
-- Migracao 0010 — Fase 5: validacao da demanda-filha (§11)
--
-- Ao inserir uma demanda COM demanda_pai_id, exige que a pai:
--   - exista (e seja visivel para quem cria — o trigger respeita a RLS),
--   - esteja no status 'enviado' (cancelada NUNCA gera filha),
--   - seja da MESMA obra.
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e rode.
-- ───────────────────────────────────────────────────────────────

create or replace function public.validar_demanda_filha()
returns trigger
language plpgsql
as $$
declare
  v_pai demanda;
begin
  if new.demanda_pai_id is not null then
    -- O select respeita a RLS: so acha a pai se quem insere pode ve-la.
    select * into v_pai from demanda where id = new.demanda_pai_id;

    if v_pai.id is null then
      raise exception 'Demanda-pai não encontrada (ou sem permissão).';
    end if;

    if v_pai.status <> 'enviado' then
      raise exception 'Só é possível criar demanda-filha de uma demanda ENVIADA.';
    end if;

    if v_pai.obra_id <> new.obra_id then
      raise exception 'A demanda-filha deve ser da mesma obra da demanda-pai.';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_validar_demanda_filha
  before insert on demanda
  for each row
  execute function public.validar_demanda_filha();
