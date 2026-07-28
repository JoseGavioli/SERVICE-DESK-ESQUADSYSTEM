-- ───────────────────────────────────────────────────────────────
-- Migracao 0044 — o DONO da demanda pode APAGAR os anexos de ENTRADA dela
--
-- Regressao da 0042/0043 (admin cria demanda PARA outro vendedor e sobe os
-- anexos por ele). Ai o autor_id do anexo (e o owner do objeto no Storage) fica
-- sendo o ADMIN, mas o DONO da demanda e o outro vendedor. As policies de DELETE
-- `anexo_excluir` (tabela) e `anexos_storage_delete` (Storage), das 0009/0025,
-- so olham AUTOR/owner ou admin — nunca o dono da demanda. Resultado: o vendedor
-- DONO ve o botao de lixeira (o frontend libera p/ o dono, enquanto nao_iniciado)
-- mas o DELETE bate na RLS e apaga 0 linhas SEM erro (no PostgREST, DELETE
-- barrado por USING nao levanta erro — so nao "enxerga" a linha). A imagem
-- simplesmente NAO some, sem aviso.
--
-- Aqui: alem de autor/admin, o DONO da demanda tambem apaga os anexos de
-- ENTRADA dela enquanto a demanda esta 'nao_iniciado' — a mesma janela em que
-- ele gerencia a entrada (§14). SAIDA fica de fora (dominio do staff); a trava
-- sou_ativo() e a regra do autor/admin seguem valendo.
--
-- No Storage a checagem nao pode ser pelo owner (que e o admin que subiu): vai
-- pela PASTA, como as policies de select/insert de 0009. Caminho e
-- {demanda_id}/{tipo}/{arquivo}: [1] = id da demanda, [2] = tipo. Sem abrir o
-- Storage junto, apagar a linha deixaria o arquivo orfao no bucket.
--
-- O QUE QUEBRA SE NAO RODAR: o vendedor dono continua sem conseguir remover os
-- anexos de entrada que o admin subiu por ele — o botao "funciona" mas a imagem
-- fica la, calada.
--
-- NAO e destrutiva (altera 2 policies). SQL Editor > Run.
-- ───────────────────────────────────────────────────────────────

-- Tabela anexo: autor OU admin OU (dono da demanda, so ENTRADA e so nao_iniciado).
alter policy "anexo_excluir" on anexo
  using (
    public.sou_ativo()
    and (
      autor_id = auth.uid()
      or public.meu_papel() = 'admin'
      or (
        tipo = 'entrada'
        and exists (
          select 1 from demanda d
          where d.id = anexo.demanda_id
            and d.vendedor_id = auth.uid()
            and d.status = 'nao_iniciado'
        )
      )
    )
  );

-- Storage (bucket 'anexos'): mesma abertura, mas pela PASTA (dono nao e o owner).
alter policy "anexos_storage_delete" on storage.objects
  using (
    bucket_id = 'anexos'
    and public.sou_ativo()
    and (
      owner = auth.uid()
      or public.meu_papel() = 'admin'
      or (
        (storage.foldername(name))[2] = 'entrada'
        and exists (
          select 1 from demanda d
          where d.id = ((storage.foldername(name))[1])::bigint
            and d.vendedor_id = auth.uid()
            and d.status = 'nao_iniciado'
        )
      )
    )
  );
