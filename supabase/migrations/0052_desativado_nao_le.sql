-- ───────────────────────────────────────────────────────────────
-- Migracao 0052 — conta desativada para de LER  [issue #91]
--
-- A 0025 pos o `sou_ativo()` em todas as policies de ESCRITA, e o cabecalho
-- dela avisa o que ficou de fora: "um desativado ainda loga e VE, mas nao FAZ
-- mais nada". Quem barra na entrada e o frontend (Painel.jsx), e isso so roda
-- quando a tela monta — com o token na mao, a leitura pela API continua. E o
-- token do Supabase se renova sozinho enquanto e usado.
--
-- Consequencia pratica: desativar um ex-funcionario NAO o impedia de seguir
-- lendo as demandas dele. Era uma distancia entre o que "desativar" parece
-- fazer e o que fazia.
--
-- ── POR QUE POLICY *RESTRICTIVE*, e nao um `alter policy` em cada uma ──
--
-- `alter policy ... using (...)` SUBSTITUI a expressao inteira. Para somar o
-- `sou_ativo()` a estas oito, eu teria de reescrever a condicao atual de cada
-- uma — e varias ja foram trocadas depois de criadas (a 0031 refez as leituras
-- de demanda/comentario/historico/anexo para o gerente; a 0041 acrescentou o
-- `perfil_oculto()` na demanda_leitura). Copiar oito expressoes a mao, cada
-- uma na versao mais recente, e exatamente como um pedaco de condicao some sem
-- ninguem notar — e pedaco que some numa policy de LEITURA quer dizer alguem
-- vendo o que nao devia.
--
-- Policy RESTRICTIVE nao substitui nada: o Postgres a une com E (AND) a tudo
-- que ja existe. A regra fica: (qualquer permissiva) E (todas as restritivas).
-- Nenhuma expressao antiga e tocada, e desfazer e um `drop policy`.
--
-- ── ESCOPO (decisao do dono) ──
--
-- SO as tabelas de CONTEUDO — as mesmas nove que o backup (§17) leva, menos a
-- `perfil`. As operacionais (notificacao, erro_log, assinatura_push,
-- visualizacao) ficam de fora: nao sao conteudo, e travar a leitura delas so
-- criaria erro de tela sem proteger nada.
--
-- A `perfil` fica FORA de proposito. Se o desativado deixar de ler o proprio
-- perfil, o Painel.jsx recebe erro em vez de `ativo: false`, e o aviso claro
-- "Sua conta esta desativada. Fale com o administrador" vira "Seu usuario
-- ainda nao tem um perfil cadastrado". Para quem foi desativado por engano, a
-- mensagem certa e a diferenca entre ligar para o admin e achar que o cadastro
-- sumiu. Ele nao ve dado de ninguem por ai: as demais linhas de `perfil` sao
-- nome/papel da equipe, que ele ja conhecia.
--
-- NAO mexe na ESCRITA: a 0025 ja resolveu e esta certa.
-- NAO e destrutiva e nao toca em dado nenhum. Cole no SQL Editor e rode.
-- ───────────────────────────────────────────────────────────────

create policy "cliente_le_so_ativo" on cliente
  as restrictive for select using ( public.sou_ativo() );

create policy "obra_le_so_ativo" on obra
  as restrictive for select using ( public.sou_ativo() );

create policy "tipo_demanda_le_so_ativo" on tipo_demanda
  as restrictive for select using ( public.sou_ativo() );

create policy "demanda_le_so_ativo" on demanda
  as restrictive for select using ( public.sou_ativo() );

create policy "ficha_fechamento_le_so_ativo" on ficha_fechamento
  as restrictive for select using ( public.sou_ativo() );

create policy "comentario_le_so_ativo" on comentario
  as restrictive for select using ( public.sou_ativo() );

create policy "historico_status_le_so_ativo" on historico_status
  as restrictive for select using ( public.sou_ativo() );

create policy "anexo_le_so_ativo" on anexo
  as restrictive for select using ( public.sou_ativo() );
