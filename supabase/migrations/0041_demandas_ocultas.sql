-- ───────────────────────────────────────────────────────────────
-- Migracao 0041 — perfil "oculto": as demandas dele so aparecem para ele
--
-- A conta de teste cria demandas EM PRODUCAO. A 0040 ja a tirou do relatorio,
-- mas as demandas dela ainda aparecem nas LISTAS e na DASHBOARD do staff,
-- poluindo a fila real. Aqui elas somem para todo mundo — MENOS para o proprio
-- dono da conta, que continua vendo e testando normalmente.
--
-- Mesmo padrao data-driven da 0040: uma flag no perfil, marcada por nome (nao
-- id magico), idempotente. `oculto` nomeia o EFEITO (o perfil e suas demandas
-- ficam ocultos dos outros), nao o motivo — amanha pode ser outra conta.
--
-- IMPORTANTE — isto e RLS (o banco e a fonte da verdade, §3): esconder so no
-- front deixaria os numeros do staff (dashboard/listas/relatorio) contando o
-- teste, e um request cru ainda traria as linhas. A regra vive aqui.
--
-- O QUE QUEBRA SE NAO RODAR: nada quebra, mas as demandas da conta de teste
-- continuam aparecendo para o staff (o efeito desejado nao acontece).
--
-- NAO e destrutiva (adiciona coluna + funcao, altera 1 policy). SQL Editor > Run.
-- ───────────────────────────────────────────────────────────────

-- 1) A flag. Default false: ninguem fica oculto sem ser marcado de proposito.
alter table perfil
  add column if not exists oculto boolean not null default false;

-- 2) Helper: este vendedor esta oculto? SECURITY DEFINER de proposito — le o
--    perfil por baixo da RLS (sem isso, a policy de demanda entraria em recursao
--    ao consultar perfil). STABLE: o Postgres cacheia por argumento na consulta.
--    Mesmo espirito do public.meu_papel() ja usado nas policies.
create or replace function public.perfil_oculto(p_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select oculto from perfil where id = p_id), false);
$$;

grant execute on function public.perfil_oculto(uuid) to authenticated;

-- 3) Leitura de demanda: o DONO sempre ve as proprias (1o ramo, intacto). O
--    staff/gerente ve todas, MENOS as de um perfil oculto. Uma linha a mais.
alter policy "demanda_leitura" on demanda
  using (
    vendedor_id = auth.uid()
    or (
      public.meu_papel() in ('admin', 'atendente', 'gerente')
      and not public.perfil_oculto(vendedor_id)
    )
  );

-- As leituras de comentario/historico/anexo HERDAM isto automaticamente: elas
-- checam a visibilidade via `exists (select 1 from demanda ...)`, e essa
-- subconsulta ja passa pela RLS de demanda acima. Nao precisam mudar.

-- 4) Marca a conta de teste de hoje (mesmo nome usado na 0040). Idempotente.
--    Para ocultar/reexibir outra conta no futuro, basta um update igual a este.
update perfil
  set oculto = true
  where nome_completo = 'USUARIO DE TESTE';
