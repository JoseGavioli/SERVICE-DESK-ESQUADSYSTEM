-- ───────────────────────────────────────────────────────────────
-- Migracao 0045 — Ficha de pedido de vendas no Fechamento (issue #80, F1)
--
-- O tipo "Fechamento" ganha comportamento proprio (a ressalva do §10 do
-- CLAUDE.md previa exatamente isso): o vendedor preenche a FICHA DE PEDIDO
-- DE VENDAS no proprio app ao criar a demanda, e o fluxo de status pula a
-- revisao de custo. Esta migracao e SO o banco (F1):
--
--   ① `tipo_demanda.com_ficha` — flag data-driven que marca o tipo que tem
--      ficha (hoje, so o "Fechamento"). O app e o banco decidem pela FLAG,
--      nunca pelo nome — renomear o tipo nao quebra nada (mesmo espirito
--      do `oculto`/`oculto_relatorio`).
--   ② tabela `ficha_fechamento` — 1 ficha por demanda, espelhando o papel.
--   ③ RLS da ficha — posse auditada DE UMA VEZ (licao das 0043/0044:
--      dono != autor quando o admin cria para outro vendedor).
--   ④ `mover_status` — demanda de tipo com ficha: em_andamento vai DIRETO
--      a concluido; ENTRAR em revisao de custo e bloqueado. O resto igual.
--
-- O QUE QUEBRA SE NAO RODAR: nada do app atual — a migracao so ADICIONA.
-- As telas novas da ficha (F2–F4) e que dependem dela; sem rodar, elas nem
-- devem ser commitadas (combinado §10 do HANDOFF).
--
-- ⚠ JANELA DE DEPLOY (o sentido inverso): DEPOIS de rodar esta migracao e
-- ANTES de o front F2/F3 publicar, uma demanda de Fechamento em
-- "em andamento" fica sem avanco pela interface — o unico botao de avanco
-- do app atual e "revisao de custo", que o banco passa a recusar p/ tipos
-- com ficha (da erro na tela; congelar/cancelar seguem ok). Se houver
-- Fechamento em andamento que precise avancar, mova ANTES de rodar, ou
-- rode a migracao junto com a publicacao da F2.
--
-- NAO e destrutiva. Cole este arquivo inteiro no SQL Editor e rode.
-- ───────────────────────────────────────────────────────────────

-- ① A flag no tipo (data-driven).
alter table tipo_demanda
  add column com_ficha boolean not null default false;

-- Se o tipo nao existir com este nome exato, FALHA ALTO — um update de 0
-- linhas deixaria a flag false em silencio e a feature inteira morta.
do $$
begin
  update tipo_demanda set com_ficha = true where nome = 'Fechamento';
  if not found then
    raise exception 'Tipo "Fechamento" não encontrado — com_ficha ficou sem dono.';
  end if;
end $$;

-- ② A ficha: 1 por demanda (`unique`), morre junto com ela (cascade).
--    Quase tudo nullable DE PROPOSITO: no papel a ficha tambem circula com
--    campos em branco — o minimo obrigatorio e decisao da tela (F2).
--    O NOME do cliente nao e coluna: vem do cliente ja vinculado a demanda
--    (obra -> cliente), sem duplicar. RT sim/nao + % tambem nao: reusam os
--    campos `rt`/`rt_percentual` que a demanda ja tem (uma fonte so).
create table ficha_fechamento (
  id                 bigint      generated always as identity primary key,
  demanda_id         bigint      not null unique references demanda (id) on delete cascade,

  -- Pedido
  data_pedido        date,
  num_proposta       text,
  valor              numeric(12,2),
  forma_pagamento    text,
  envio_cobranca     text,          -- "favor especificar forma de envio de cobranca"
  com_nf             boolean     not null default false,
  com_meia_nf        boolean     not null default false,

  -- Consultores e comissao: o 1o e o VENDEDOR DONO da demanda (nao e
  -- coluna; so a % dele). Ate 2 extras, como no papel (3 pares nome+%).
  comissao_pct       numeric(5,2),
  consultor2_nome    text,
  consultor2_pct     numeric(5,2),
  consultor3_nome    text,
  consultor3_pct     numeric(5,2),

  -- Dados Cliente (alem do nome, que vem da relacao)
  cliente_data_nasc  date,
  cliente_endereco   text,
  cliente_telefone1  text,
  cliente_cep        text,
  cliente_cidade_uf  text,
  cliente_cpf        text,
  cliente_rg         text,
  cliente_telefone2  text,
  cliente_email      text,

  -- Arquitetura e Engenharia (o sim/nao + % da RT ficam na demanda)
  rt_dados_bancarios text,
  rt_beneficiario    text,

  -- Dados da Obra (a entidade `obra` do app so tem nome/endereco; a ficha
  -- pede mais — e o dado e da FICHA, um retrato do pedido)
  mestre_obra        text,
  obra_telefone      text,
  obra_email         text,
  obra_endereco      text,
  obra_bairro        text,
  obra_cep           text,
  obra_cidade_uf     text,

  -- Blocos de texto do papel
  medicao_contramarco text,        -- "Condicao de medicao para contramarco"
  fiscal_obra        text,
  particularidades   text,         -- "particularidades que necessitam atencao especial"

  -- Vigencia do contrato (texto livre: os formatos variam no papel)
  vig_contramarcos   text,
  vig_domus          text,
  vig_esquadrias     text,
  vig_brises         text,
  vig_guarda_corpo   text,

  created_at         timestamptz not null default now()
);

alter table ficha_fechamento enable row level security;

-- ③ RLS — posse auditada de uma vez (dono, staff E o caso admin-cria-p/-outro).

-- Ler: quem enxerga a demanda (dono / admin / atendente / gerente). A
-- subconsulta a `demanda` passa pela RLS dela, entao perfil oculto (0041)
-- e o resto sao herdados automaticamente — mesmo padrao de anexo/historico.
create policy "ficha_leitura" on ficha_fechamento
  for select using (
    exists (
      select 1 from demanda d
      where d.id = ficha_fechamento.demanda_id
        and (
          d.vendedor_id = auth.uid()
          or public.meu_papel() in ('admin', 'atendente', 'gerente')
        )
    )
  );

-- Criar: o DONO da demanda ou um ADMIN (que cria demanda para outro
-- vendedor desde a 0042 — sem o "ou admin" aqui, repetiriamos a regressao
-- da 0043, so que na ficha). Amarrada ao TRILHO e a JANELA (achado da
-- revisao adversarial): so demanda de tipo com_ficha, e inserir respeita a
-- mesma janela do editar — senao "criar tarde" viraria um editar por fora
-- (dono so em nao_iniciado; admin enquanto nao-terminal).
create policy "ficha_criar" on ficha_fechamento
  for insert with check (
    public.sou_ativo()
    and exists (
      select 1 from demanda d
      join tipo_demanda t on t.id = d.tipo_demanda_id
      where d.id = ficha_fechamento.demanda_id
        and t.com_ficha
        and (
          (d.vendedor_id = auth.uid() and d.status = 'nao_iniciado')
          or (public.meu_papel() = 'admin'
            and d.status not in ('enviado', 'cancelada'))
        )
    )
  );

-- Editar (decisao do dono, issue #80): admin/atendente enquanto a demanda
-- nao for terminal; o vendedor DONO so enquanto 'nao_iniciado' (a mesma
-- janela em que ele gerencia os anexos de entrada).
create policy "ficha_editar" on ficha_fechamento
  for update using (
    public.sou_ativo()
    and exists (
      select 1 from demanda d
      where d.id = ficha_fechamento.demanda_id
        and (
          (public.meu_papel() in ('admin', 'atendente')
            and d.status not in ('enviado', 'cancelada'))
          or (d.vendedor_id = auth.uid() and d.status = 'nao_iniciado')
        )
    )
  )
  with check (
    public.sou_ativo()
    and exists (
      select 1 from demanda d
      where d.id = ficha_fechamento.demanda_id
        and (
          (public.meu_papel() in ('admin', 'atendente')
            and d.status not in ('enviado', 'cancelada'))
          or (d.vendedor_id = auth.uid() and d.status = 'nao_iniciado')
        )
    )
  );

-- Apagar: NINGUEM apaga a ficha sozinha (sem policy de delete = negado).
-- Ela so morre junto com a demanda (o cascade do FK nao passa pela RLS).

-- A ficha nao troca de demanda (achado da revisao adversarial): a policy de
-- update nao enxerga o valor ANTIGO, entao um UPDATE poderia "repontar" a
-- ficha para outra demanda do mesmo dono. Gatilho barra.
create or replace function public.ficha_demanda_imutavel()
returns trigger
language plpgsql
as $$
begin
  if new.demanda_id <> old.demanda_id then
    raise exception 'A ficha não pode trocar de demanda.';
  end if;
  return new;
end;
$$;

create trigger trg_ficha_demanda_imutavel
  before update on ficha_fechamento
  for each row execute function public.ficha_demanda_imutavel();

-- ④ mover_status: recriada IDENTICA a 0031, com UMA mudanca — a tabela de
--    transicoes agora tem dois trilhos, escolhidos pela flag `com_ficha`
--    do tipo da demanda:
--      · normal:    em_andamento -> em_revisao_custo -> concluido -> enviado
--      · com ficha: em_andamento -> concluido -> enviado  (revisao PULADA;
--        entrar em revisao e bloqueado)
--    Demanda de fechamento ANTIGA que ja esteja em revisao nao fica presa:
--    as SAIDAS de em_revisao_custo continuam validas nos dois trilhos.
--    Comentario obrigatorio (§13) nao muda: congelar, cancelar e toda volta.
create or replace function public.mover_status(
  p_demanda_id    bigint,
  p_novo_status   status_demanda,
  p_comentario    text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid               uuid := auth.uid();
  v_papel             papel;
  v_status_atual      status_demanda;
  v_com_ficha         boolean := false;
  v_permitido         boolean := false;
  v_exige_comentario  boolean := false;
  v_comentario_id     bigint := null;
  v_texto             text := nullif(btrim(coalesce(p_comentario, '')), '');
begin
  -- 1) Quem sou eu? Precisa ter perfil, estar ATIVO e ser STAFF (§5/§issue #44).
  select papel into v_papel from perfil where id = v_uid;
  if v_papel is null then
    raise exception 'Usuário sem perfil.';
  end if;
  if not public.sou_ativo() then
    raise exception 'Usuário desativado não pode mover status.';
  end if;
  if v_papel not in ('admin', 'atendente') then
    raise exception 'Apenas o staff pode mover status.';
  end if;

  -- 2) Status atual + trilho do tipo (trava a linha da demanda contra
  --    concorrencia; o `of d` prende so a demanda, nao o tipo).
  select d.status, t.com_ficha
    into v_status_atual, v_com_ficha
    from demanda d
    join tipo_demanda t on t.id = d.tipo_demanda_id
   where d.id = p_demanda_id
     for update of d;
  if v_status_atual is null then
    raise exception 'Demanda não encontrada.';
  end if;

  -- 3) Cancelamento: efetivado pelo STAFF (§12/§issue #36).
  if p_novo_status = 'cancelada' and v_papel not in ('admin', 'atendente') then
    raise exception 'Apenas o staff pode efetivar o cancelamento.';
  end if;

  -- 4) Transicoes permitidas — e SOMENTE estas (§7; trilho da ficha: §#80).
  if v_com_ficha then
    v_permitido := case v_status_atual
      when 'nao_iniciado'     then p_novo_status in ('em_andamento', 'cancelada')
      when 'em_andamento'     then p_novo_status in ('concluido', 'congelado', 'cancelada')
      when 'congelado'        then p_novo_status in ('em_andamento', 'cancelada')
      when 'em_revisao_custo' then p_novo_status in ('concluido', 'em_andamento', 'cancelada')
      when 'concluido'        then p_novo_status in ('enviado', 'em_andamento', 'cancelada')
      else false  -- enviado e cancelada sao terminais
    end;
  else
    v_permitido := case v_status_atual
      when 'nao_iniciado'     then p_novo_status in ('em_andamento', 'cancelada')
      when 'em_andamento'     then p_novo_status in ('em_revisao_custo', 'congelado', 'cancelada')
      when 'congelado'        then p_novo_status in ('em_andamento', 'cancelada')
      when 'em_revisao_custo' then p_novo_status in ('concluido', 'em_andamento', 'cancelada')
      when 'concluido'        then p_novo_status in ('enviado', 'em_andamento', 'cancelada')
      else false  -- enviado e cancelada sao terminais
    end;
  end if;
  if not v_permitido then
    raise exception 'Transição de % para % não é permitida.', v_status_atual, p_novo_status;
  end if;

  -- 5) Comentario obrigatorio (§13): congelar, cancelar e toda "volta".
  v_exige_comentario :=
       (v_status_atual = 'em_andamento'     and p_novo_status = 'congelado')
    or (p_novo_status = 'cancelada')
    or (v_status_atual = 'em_revisao_custo' and p_novo_status = 'em_andamento')
    or (v_status_atual = 'concluido'        and p_novo_status = 'em_andamento');
  if v_exige_comentario and v_texto is null then
    raise exception 'Esta mudança de status exige um comentário.';
  end if;

  -- 6) Cria o comentario (se houver texto), marcado como mudanca_status.
  if v_texto is not null then
    insert into comentario (demanda_id, autor_id, texto, contexto)
    values (p_demanda_id, v_uid, v_texto, 'mudanca_status')
    returning id into v_comentario_id;
  end if;

  -- 7) Move o status (e limpa a flag de cancelamento solicitado).
  update demanda
    set status = p_novo_status,
        cancelamento_solicitado = false
  where id = p_demanda_id;

  -- 8) Registra no historico (vinculando o comentario, quando houver).
  insert into historico_status (demanda_id, de_status, para_status, autor_id, comentario_id)
  values (p_demanda_id, v_status_atual, p_novo_status, v_uid, v_comentario_id);
end;
$$;
