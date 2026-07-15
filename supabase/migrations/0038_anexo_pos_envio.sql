-- ───────────────────────────────────────────────────────────────
-- Migracao 0038 — anexar a SAIDA depois de "enviado" (com registro)
--
-- Problema: se faltou um arquivo depois que a demanda foi ENVIADA, hoje o
-- vendedor teria que abrir outra demanda (ou o arquivo ia por WhatsApp, que e
-- exatamente o que este app existe para matar §1). Agora o staff pode anexar
-- na MESMA demanda.
--
-- Aqui:
--   1) a policy `anexo_saida_criar` passa a EXIGIR status em (concluido,
--      enviado). ATENCAO: hoje a policy NAO olha o status — a regra "so no
--      concluido" vivia SO no frontend, o que contraria o §3 ("nenhuma regra
--      de permissao pode viver so no frontend"). Entao isto AO MESMO TEMPO
--      libera o 'enviado' e FECHA essa brecha: o banco vira a fonte da verdade.
--   2) novo contexto de comentario 'anexo_pos_envio';
--   3) gatilho: anexo de SAIDA numa demanda JA enviada -> cria sozinho um
--      comentario "Anexo adicionado apos o envio: <arquivo>".
--
-- Por que GATILHO e nao o frontend criar o comentario: (a) e inforjavel — o
-- registro nao depende de o app lembrar de fazer; (b) BONUS: o comentario
-- dispara a notificacao que ja existe, entao o VENDEDOR e avisado na hora que
-- chegou arquivo novo (de novo: matando o WhatsApp).
--
-- Nota tecnica: da p/ adicionar o valor do enum e criar a funcao na MESMA
-- migracao porque o corpo de uma funcao plpgsql e um texto — o valor novo so e
-- USADO quando o gatilho roda (outra transacao). Isso NAO valeria para uma
-- policy, que resolve o literal na hora da criacao (foi o caso da 0030/0031).
--
-- NAO e destrutiva. Cole no SQL Editor e clique "Run".
-- ───────────────────────────────────────────────────────────────

-- 1) A regra REAL da saida: staff ativo + status concluido/enviado.
alter policy "anexo_saida_criar" on anexo
  with check (
    public.sou_ativo()
    and autor_id = auth.uid()
    and tipo = 'saida'
    and public.meu_papel() in ('admin', 'atendente')
    and exists (
      select 1 from demanda d
      where d.id = anexo.demanda_id
        and d.status in ('concluido', 'enviado')
    )
  );

-- 2) Contexto proprio (a linha aparece rotulada no historico de comentarios).
alter type contexto_comentario add value if not exists 'anexo_pos_envio';

-- 3) Anexo de saida numa demanda JA enviada -> registra no historico sozinho.
create or replace function public.registrar_anexo_pos_envio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status status_demanda;
begin
  if new.tipo <> 'saida' then
    return new;  -- entrada nao interessa aqui
  end if;

  select status into v_status from demanda where id = new.demanda_id;
  -- SO registra se a demanda ja estava ENVIADA (no 'concluido' anexar e o
  -- fluxo normal — registrar ali seria ruido).
  if v_status is distinct from 'enviado' then
    return new;
  end if;

  insert into comentario (demanda_id, autor_id, texto, contexto)
  values (
    new.demanda_id,
    new.autor_id,
    'Anexo adicionado após o envio: ' || new.nome_original,
    'anexo_pos_envio'
  );
  return new;
end;
$$;

drop trigger if exists anexo_pos_envio_loga on anexo;
create trigger anexo_pos_envio_loga
  after insert on anexo
  for each row
  execute function public.registrar_anexo_pos_envio();
