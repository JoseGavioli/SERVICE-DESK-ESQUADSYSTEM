-- ───────────────────────────────────────────────────────────────
-- Migracao 0042 — Admin pode criar demanda PARA outro dono
--
-- Os reps (vendedores/gerentes) nem sempre usam o app; para registrar as
-- demandas deles sem logar na conta de cada um, o ADMIN passa a poder definir o
-- proprietario ao CRIAR a demanda. Todos os outros papeis continuam forcados a
-- si mesmos — o autor segue INFORJAVEL (§5).
--
-- 1) demanda_criar: mantem o sou_ativo() (0025) e abre excecao SO para admin.
-- 2) trg_notif_nova_demanda: passa o AUTOR real (auth.uid()) em vez de
--    new.vendedor_id. Assim, quando o admin cria para um vendedor, o
--    criar_notificacoes entende "acao de staff -> notifica o vendedor DONO"
--    (ele ve no feed da Inicio). Vendedor criando a propria continua
--    notificando o staff. (Conserta a suposicao latente autor==dono.)
--
-- O QUE QUEBRA SE NAO RODAR: o card "Proprietario" no app nao vai gravar (a RLS
-- barra vendedor_id != auth.uid()), e o insert falha para o admin ao atribuir.
--
-- NAO e destrutiva (altera 1 policy + 1 funcao). SQL Editor > Run.
-- ───────────────────────────────────────────────────────────────

-- 1) Criar: ativo E (a demanda e minha OU eu sou admin).
alter policy "demanda_criar" on demanda
  with check (
    public.sou_ativo()
    and (
      vendedor_id = auth.uid()
      or public.meu_papel() = 'admin'
    )
  );

-- 2) Notificacao de nova demanda pelo AUTOR real (nao pelo dono).
create or replace function public.trg_notif_nova_demanda()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() = quem criou (o proprio vendedor, ou o admin criando para outro).
  -- criar_notificacoes decide a "outra ponta" pelo PAPEL do autor:
  --   vendedor -> avisa o staff;  staff/admin -> avisa o vendedor DONO.
  perform public.criar_notificacoes(new.id, auth.uid(), 'nova_demanda');
  return new;
end;
$$;
