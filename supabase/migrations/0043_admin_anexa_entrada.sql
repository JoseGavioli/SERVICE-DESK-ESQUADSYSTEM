-- ───────────────────────────────────────────────────────────────
-- Migracao 0043 — admin pode anexar ENTRADA em demanda de outro dono
--
-- Depois da 0042 (admin cria demanda PARA outro vendedor), ao anexar os PDFs
-- de entrada dava erro e a demanda nascia sem eles. Causa: a policy
-- `anexo_entrada_criar` (0009, + sou_ativo na 0025) exige que quem anexa seja o
-- VENDEDOR DONO da demanda (d.vendedor_id = auth.uid()). O admin, criando para
-- outro, nao e o dono -> o insert na tabela anexo era barrado (o upload no
-- Storage ja passava, entao o anexo subia e era desfeito).
--
-- Aqui: alem do dono, o ADMIN tambem pode inserir anexo de entrada. Tudo o mais
-- fica igual — autor_id continua sendo auth.uid() (quem subiu), sou_ativo() e o
-- tipo='entrada' seguem exigidos. (O Storage ja liberava admin/atendente, 0009.)
--
-- O QUE QUEBRA SE NAO RODAR: ao atribuir a demanda a outro dono, os anexos de
-- entrada continuam falhando e a demanda e criada sem eles.
--
-- NAO e destrutiva (altera 1 policy). SQL Editor > Run.
-- ───────────────────────────────────────────────────────────────

alter policy "anexo_entrada_criar" on anexo
  with check (
    public.sou_ativo()
    and autor_id = auth.uid()
    and tipo = 'entrada'
    and exists (
      select 1 from demanda d
      where d.id = demanda_id
        and (d.vendedor_id = auth.uid() or public.meu_papel() = 'admin')
    )
  );
