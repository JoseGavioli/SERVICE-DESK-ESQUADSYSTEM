-- ───────────────────────────────────────────────────────────────
-- Migracao 0029 — origem da demanda (de onde veio a solicitacao)  [issue #45]
--
-- Nova coluna `origem` na demanda: de onde o vendedor recebeu a solicitacao.
-- Obrigatoria na CRIACAO (garantido no formulario). No banco fica NULLABLE para
-- nao quebrar as demandas antigas (que nao tem origem). Um CHECK limita aos
-- valores validos (ou null). Definida na criacao, como o resto (RLS nao muda).
--
-- OBS: "Club Casa" aqui e a ORIGEM do lead — diferente do checkbox `club_casa`
-- (migracao 0018), que diz se a OBRA e Club Casa. Sao coisas distintas.
--
-- NAO-DESTRUTIVA (ADD COLUMN nullable + CHECK). Cole no SQL Editor e rode.
-- ───────────────────────────────────────────────────────────────

alter table demanda add column origem text;

alter table demanda
  add constraint demanda_origem_valida
  check (
    origem is null
    or origem in ('Marketing', 'Club Casa', 'Indicação', 'Balcão', 'Instagram')
  );
