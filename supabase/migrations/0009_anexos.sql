-- ───────────────────────────────────────────────────────────────
-- Migracao 0009 — Fase 4a: anexos (Storage + tabela + RLS)
--
--   - bucket privado 'anexos' (teto de 10 MB por arquivo)
--   - tabela anexo (metadados) + checagem de tamanho por tipo
--   - RLS da tabela (papel) e do Storage (acesso amarrado a demanda)
--
-- Caminho dos arquivos no bucket: {demanda_id}/{tipo}/{arquivo}
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e rode.
-- ───────────────────────────────────────────────────────────────

-- ① Bucket privado, com limite de 10 MB por arquivo (= limite da saida).
--    O limite menor da ENTRADA (2 MB) e garantido pela checagem da tabela.
insert into storage.buckets (id, name, public, file_size_limit)
values ('anexos', 'anexos', false, 10485760)
on conflict (id) do nothing;

-- ② Tabela de metadados dos anexos.
create type tipo_anexo as enum ('entrada', 'saida');

create table anexo (
  id              bigint      generated always as identity primary key,
  demanda_id      bigint      not null references demanda (id) on delete cascade,
  autor_id        uuid        not null references perfil (id)  on delete restrict default auth.uid(),
  tipo            tipo_anexo  not null,
  caminho_storage text        not null,
  nome_original   text        not null,
  tamanho_bytes   bigint      not null,
  created_at      timestamptz not null default now(),
  -- Limite por tipo: entrada <= 2 MB; saida <= 10 MB.
  constraint anexo_tamanho_ok check (
    (tipo = 'entrada' and tamanho_bytes <= 2097152)
    or (tipo = 'saida' and tamanho_bytes <= 10485760)
  )
);

alter table anexo enable row level security;

-- Leitura: quem enxerga a demanda enxerga os anexos.
create policy "anexo_leitura" on anexo
  for select using (
    exists (
      select 1 from demanda d
      where d.id = anexo.demanda_id
        and (d.vendedor_id = auth.uid() or public.meu_papel() in ('admin', 'atendente'))
    )
  );

-- Inserir ENTRADA: somente o vendedor dono da demanda.
create policy "anexo_entrada_criar" on anexo
  for insert with check (
    autor_id = auth.uid()
    and tipo = 'entrada'
    and exists (select 1 from demanda d where d.id = demanda_id and d.vendedor_id = auth.uid())
  );

-- Inserir SAIDA: somente admin/atendente.
create policy "anexo_saida_criar" on anexo
  for insert with check (
    autor_id = auth.uid()
    and tipo = 'saida'
    and public.meu_papel() in ('admin', 'atendente')
  );

-- Excluir: o autor do anexo ou um admin.
create policy "anexo_excluir" on anexo
  for delete using (
    autor_id = auth.uid() or public.meu_papel() = 'admin'
  );

-- ③ RLS do Storage (tabela storage.objects), so para o bucket 'anexos'.
--    O 1o trecho do caminho e o id da demanda: (storage.foldername(name))[1].

-- Baixar/visualizar (gerar link assinado): quem enxerga a demanda.
create policy "anexos_storage_select" on storage.objects
  for select using (
    bucket_id = 'anexos'
    and exists (
      select 1 from demanda d
      where d.id = ((storage.foldername(name))[1])::bigint
        and (d.vendedor_id = auth.uid() or public.meu_papel() in ('admin', 'atendente'))
    )
  );

-- Enviar arquivo: quem enxerga a demanda pode subir na pasta dela.
-- (a regra entrada/saida por papel fica na tabela anexo.)
create policy "anexos_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'anexos'
    and exists (
      select 1 from demanda d
      where d.id = ((storage.foldername(name))[1])::bigint
        and (d.vendedor_id = auth.uid() or public.meu_papel() in ('admin', 'atendente'))
    )
  );

-- Excluir arquivo: quem enviou (owner) ou um admin.
create policy "anexos_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'anexos'
    and (owner = auth.uid() or public.meu_papel() = 'admin')
  );
