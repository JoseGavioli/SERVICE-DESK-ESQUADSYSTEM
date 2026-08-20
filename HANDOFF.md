# 📋 Handoff — Service Desk - EsquadSystem

**Data:** 11/08/2026 · **Branch:** `main` · **último HEAD publicado:** `4210fac`

> Documento de continuidade. Para retomar: leia a **§7** (pendências) e a **§9** (armadilhas).
> A fundação é o **`CLAUDE.md`** — leia-o por completo antes de mexer em qualquer coisa.

---

## 1. ✅ Migrações: todas aplicadas (`0001` → `0053`)

Todas rodadas e confirmadas pelo dono no SQL Editor. As mais recentes:
- **`0053`** — publica `comentario` no Realtime, para a **lista da Início se atualizar sozinha**. A `demanda` já estava publicada desde a `0016` (o comentário dela dizia "Início em tempo real" — a intenção estava lá, faltava o consumidor). O comentário entrou porque a `ultima_atividade()` (`0037`) calcula o "movida há X" com o GREATEST entre `historico_status` e **comentário**. Não bastou aproveitar a notificação, que já chega em tempo real: os gatilhos da `0015` mandam vendedor→staff e staff→dono, e o **gerente não recebe nenhuma** — a tela dele nunca atualizaria.
- **`0052`** — conta desativada para de **LER** (issue #91). A `0025` só cobria a escrita, e o barrar na entrada era do frontend — pela API, com o token na mão, um desativado seguia lendo tudo. Fecha com policies **`restrictive`** nas 8 tabelas de conteúdo: restritiva o Postgres soma com **E** ao que já existe, então **nenhuma condição antiga precisou ser reescrita**. Foi de propósito — `alter policy ... using` SUBSTITUI a expressão, e várias dessas policies já tinham sido refeitas depois (a `0031` por causa do gerente, a `0041` pelo `perfil_oculto()`); copiar oito à mão é como um pedaço de condição some sem ninguém ver, e numa policy de LEITURA isso quer dizer alguém enxergando o que não devia. A `perfil` ficou **fora** para o aviso *"Sua conta está desativada"* não virar *"Seu usuário ainda não tem um perfil cadastrado"*.
- **`0050`/`0051`** — as duas na `perfil`, e a segunda **nasceu de conferir a primeira**. A `0050` põe o `gerente` na `perfil_staff_visivel`, que era de quando existiam três papéis: sem ele, o vendedor via o comentário de mudança de prazo assinado por **"Alguém"** (o embed `autor:perfil(...)` é to-one sem `!inner` — linha barrada volta **nula**, não dá erro). Ao verificar se pegou, a consulta mostrou que ela respondia **sem sessão nenhuma**: a policy fora criada sem cláusula `to`, que em Postgres é `TO PUBLIC` e no Supabase inclui o `anon`. Como a condição olhava só a linha (`papel in (...)`), qualquer um com o endereço do app listava nome, celular e papel da equipe — no ar desde julho. A `0051` fecha com `to authenticated` (muda **quem pergunta**, não **quais linhas**).
- **`0042`/`0043`/`0044`** — admin define o **dono** da demanda + os dois fixes de posse que isso exigiu (anexar entrada; dono apaga entrada — ver §6).
- **`0045`** — **Ficha de pedido de vendas** (F1 da #80): `tipo_demanda.com_ficha` (flag data-driven), tabela `ficha_fechamento` (1:1 com demanda, RLS: ler=quem vê a demanda; criar=dono em `nao_iniciado` OU admin não-terminal, só tipo com ficha; editar=staff não-terminal OU dono em `nao_iniciado`; delete=negado; gatilho impede trocar de demanda) e **`mover_status` com DOIS trilhos**: tipo com ficha pula a revisão de custo (`em_andamento → concluido` direto; entrar em revisão é bloqueado, sair continua podendo).
- **`0046`** — devolve o aviso **"prazo se aproximando"** que a 0039 tinha derrubado sem querer (achado de revisão adversarial); agora só em `nao_iniciado`/`em_andamento`, alinhado ao "Atrasado" (§8).
- **`0047`/`0048`/`0049`** — **cidade e estado da obra** (#85 fase 3), em três porque a ordem importava: `0047` só ADICIONA `obra.cidade_estado` e copia de `endereco` (um `rename` quebraria o app no ar — e como é PWA, cada aparelho ficaria quebrado até atualizar; `endereco` fica como legado); `0048` a função `completar_cidade_obra` (SECURITY DEFINER, só preenche quando está vazio) — sem ela o vendedor **não consegue** gravar a cidade, porque `obra_editar` é só admin/atendente e update barrado por RLS volta 0 linhas SEM erro; `0049` o `check NOT VALID`, que só pôde rodar **depois** do deploy do front.

> **Lição que se manteve.** O dono roda as migrações; **peça confirmação explícita** de que rodou (não presuma pelo silêncio), sempre diga **o que quebra se não rodar**, e prefira que a ausência degrade **só a tela nova**. Nesta rodada, a `0043` foi um bug que a `0042` criou (ver §6).

---

## 2. O que é o projeto

App web interno da **EsquadSystem** (esquadrias de alumínio) para gerir **demandas de orçamento**, substituindo WhatsApp + Kanban local. Regido pelo `CLAUDE.md` (§0): **uma fase por vez, explicar antes e depois, trade-offs na mesa, perguntar em vez de assumir, identificadores em português, RLS no banco, componentes pequenos (~200 linhas), evitar dependências.** O dono está **aprendendo React** e quer entender cada parte.

## 3. Stack e infraestrutura

- **Front:** React 19 + Vite (JavaScript puro, sem TS). Navegação por **estado** (sem react-router — por isso a URL não identifica a tela). **PWA** (vite-plugin-pwa, modo **`prompt`**).
- **Back:** **Supabase** (Auth e-mail/senha + Postgres + RLS + Storage + Realtime + Edge Functions). Ref `lvjqrtjytysejbcqoqmf`.
- **Deploy:** **Vercel**, CD ativo — push na `main` publica sozinho.
- **Git:** origin = `github.com/JoseGavioli/SERVICE-DESK-ESQUADSYSTEM`.
- **Buckets:** `anexos` (privado, URL assinada) e `avatares` (**público**, foto de perfil).

## 4. Estado atual

- **Fases 0–6 completas** e no ar. Migrações **`0001` → `0053`**, todas aplicadas (§1).
- **Web Push (#14): CONCLUÍDO** — validado nas 3 plataformas (desktop, Android, iOS com PWA).
- **Dashboard: reforma COMPLETA** (A+B+C, #77) e **TODAS as listagens ilimitadas paginadas** (#78/#79 — helper `lib/paginacao.js`, `todasAsLinhas`): lista, RPCs, Relatório, SeletorCliente, Clientes. A classe de bug "corte silencioso de ~1000 do PostgREST" está **encerrada** no app.
- **Anexos de entrada:** comprimidos para **≤ 1 MB** (`ALVO_ENTRADA` em `lib/anexos.js`) nos DOIS caminhos (criação e detalhe) — #75.
- **Ficha de pedido de vendas (#80): COMPLETA (F1–F4)** — o vendedor preenche a ficha no app ao criar demanda de Fechamento; o fluxo de status pula a revisão (dois trilhos na `mover_status`); o detalhe tem a box da ficha (ver/**editar** com permissões espelhando a RLS; RT travada — é da demanda); e o **PDF** sai como réplica fiel do papel via `window.print()`. Spec registrada no **CLAUDE.md §19** (+ exceções em §7/§10). ⚠ iPhone com PWA instalado não imprime (`window.print()` é ignorado em standalone — o app mostra a dica de abrir pelo Safari; mesma limitação do Relatório). Demandas de teste #36/#37 criadas pela conta oculta na validação.
- **Modo desktop (#83): COMPLETO (B1–B4)** — o app tem duas caras na mesma base: **≥900px** vira site (menu lateral, campos expostos, filtros à vista) e **≥1200px** ganha **lista + detalhe lado a lado**. Spec no **CLAUDE.md §20**. O **celular não mudou em nada** — foi o critério de aceite de cada bloco.
- **Backup dos dados (§17): FEITO** — Administração → Backup baixa as 9 tabelas em CSV+JSON, e os ARQUIVOS dos anexos em zips por tipo. Era a pendência que protegia contra perda; a lista do §17 do CLAUDE.md ficou sem itens de risco.
- **Cadastro de membro in-app (#16): FEITO** — a Equipe tem "Novo membro"; quem cria o login é a Edge Function **`criar-usuario`**, agora **deployada** (v3, `verify_jwt=true`). Ver a seção própria abaixo.
- **Conta de teste** (`teste@gmail.com` = 'USUARIO DE TESTE'): **oculta** (0041) — não aparece nas listas/dashboard/relatório dos outros; e fora do relatório (0040).
- **Reset de senha in-app: FEITO** — bloco "Senha" dentro do "Editar membro". Ver a seção própria abaixo.
- **Edge Functions no ar:** `enviar-push` (v11, `verify_jwt=**false**` — o webhook do banco chama sem token), `criar-usuario` (v3) e `resetar-senha` (v1), as duas últimas com `verify_jwt=**true**` e compartilhando o portão em `functions/_shared/admin.ts`. Todas versionadas, e o `supabase/config.toml` é quem preserva essa diferença a cada deploy. ⚠ **Mexer no `_shared` obriga a redeployar as DUAS** que o usam.
- **Fora do versionamento de propósito:** `deno.lock` e `supabase/.temp/` — estado da máquina (qual projeto está "linkado" no CLI), não do projeto.

## 5. O que foi feito

### Sessão de 11/08/2026 (issues #16, #89, #90 e #91 · migrações `0050`–`0052`)

**#16 — cadastro de membro dentro do app.** Era a pendência mais antiga com valor prático: adicionar alguém exigia abrir o painel do Supabase, criar o login na mão e voltar para acertar nome e papel.

- **A Edge Function envelheceu fora do repositório.** Ela estava escrita desde a Fase 1, nunca commitada nem deployada, e tinha **três defeitos** acumulados pelo tempo: faltava o papel **`gerente`** (foi escrita antes da `0030` criar o papel — cadastrar um gerente devolvia "Dados inválidos"); **não conferia se o admin está `ativo`** (ela roda com `service_role`, ou seja **por fora da RLS**, então um admin desativado seguiria criando logins — o oposto de desativar alguém); e não gravava `celular`, campo que a Equipe mostra.
- **Deploy:** `npx supabase functions deploy criar-usuario --project-ref …` (sem `link`, para não mexer em config global). O `config.toml` fixa `verify_jwt = true` **com o porquê escrito**, já que a vizinha precisa dele desligado. Verificado por curl: sem token → 401 no gateway; só com a chave pública → a própria função responde "Não autenticado."; **OPTIONS → 200**, que era o risco real de ligar o `verify_jwt` (preflight vai sem `Authorization`; se fosse barrado, o navegador tomaria erro de CORS sem nunca chegar na função).
- **Front:** `NovoMembro.jsx` na Equipe, no par botão-tracejado ↔ formulário do "Novo cliente". Senha definida pelo admin, **à vista** (ele precisa lê-la para passar adiante; esconder só criaria erro de digitação e um campo de confirmação) com botão "Sugerir" (8 caracteres, sem `l/I/1/O/0`). Criado o membro, caixa com email + senha e botão de copiar — **único momento em que a senha existe legível**.
- **Mudança que parece detalhe e não é:** o `carregar()` da Equipe deixou de religar o `carregando`. Ele trocava a tela inteira pelo "Carregando equipe…" a cada recarga — e recarregar é exatamente o que acontece depois de criar o membro, o que desmontaria o componente **junto com a senha**.

**O que a revisão adversarial pegou (4 confirmados, corrigidos antes do commit):** o **"Cancelar" ficava clicável durante o envio** — o pedido não é abortável, então fechar no meio derrubava o componente mas a função seguia e criava o login: a pessoa apareceria na lista e **ninguém saberia a senha dela**; a mensagem genérica de falha mandava "tente de novo", mas se a rede cai *depois* da criação isso leva a "já existe esse email" sem explicação; o `erro` da Equipe nunca era limpo (alcançável só a partir daqui — antes, lista vazia não tinha botão que recarregasse); e a caixa das credenciais **não existia visualmente no tema claro** (fundo `#f3f6f9` sobre página `#eef1f5` = 1,05:1 de contraste).

**#90 — reset de senha in-app.** Quem esquece a senha não entra e, por não entrar, não alcança o "Meu perfil" para trocá-la. Bloco **"Senha"** dentro do "Editar membro" (escolha do dono entre pôr ali ou uma chave em cada linha da lista), com Edge Function **`resetar-senha`**. Descartado o "esqueci minha senha" por email: o §15 põe email fora de escopo, exigiria SMTP (o padrão do Supabase é limitado e cai em spam) e o link volta com token na URL, que este app não lê — navegação por estado, sem router.

- **O portão saiu das duas funções** e virou `_shared/admin.ts`. Não foi arrumação: a checagem de "admin **ativo**" já tinha sido esquecida uma vez, e essas funções rodam com `service_role`, **por fora da RLS**. O preço é redeployar as duas quando o portão muda — preço certo para código que não pode divergir. Nas duas, o portão passou a rodar **antes** de validar o corpo (validar antes de autorizar deixava descobrir os papéis válidos sem token; na `resetar-senha` pesaria mais, porque o corpo carrega o **id de outra pessoa**).
- **Três peças saíram do `NovoMembro`** para `lib/senha.js` e `Credenciais.jsx`, e o `MeuPerfil` passou a importar o mínimo em vez do `6` chumbado.

**O que a revisão adversarial pegou (6 confirmados) — e o padrão vale mais que os casos:**
- **Enter no campo da senha salvava o perfil e fechava a tela.** O campo mora dentro do form de editar membro, que tem botão de submit: o Enter disparava o **envio implícito** do HTML. Gravava nome/papel, fechava o editor, a senha sumia e o reset **nunca acontecia** — com toda a aparência de sucesso. Quatro verificadores confirmaram, independentes. É a **segunda vez** que este projeto leva a mesma rasteira (§#64).
- **Três achados eram uma raiz só:** a senha vivia num estado que a lista destrói por três gestos comuns — lápis de outra linha, busca que filtra a linha aberta para fora, e o pedido em voo (não abortável). A trava cobria só Salvar/Cancelar. A senha **mudou de dono**: mora na tela Equipe, que sobrevive aos três e tranca os três.
- A mensagem de falha **afirmava** que a senha não fora trocada; se a conexão cai depois da resposta, ela pode ter sido.

⚠ **Um erro só apareceu no navegador:** numa reescrita sobrou referência a uma variável renomeada — `ReferenceError` em produção. **`oxlint` e `npm run build` passaram os dois**, porque é JS válido até rodar. Neste projeto, nenhum dos dois protege contra isso: abrir o console é parte de testar.

**#89 — o gerente deixa de ser "Alguém"** (`0050`), e a `0051` que **nasceu de conferir a `0050`** — ver §1. A #89 foi aberta como issue normal; a exposição anônima **não**, porque o repositório é **público** e uma issue descrevendo uma brecha ativa com o nome do projeto é um convite. Foi conversada no chat e registrada só depois de fechada.

### Sessão de 06–10/08/2026 (issues #85/#86/#87/#88 fechadas)

**#85 — menu Orçamento/Fechamento + obra obrigatória (3 fases).**
- **F1:** o botão "Nova demanda" (FAB do celular e vermelho da barra) abre um **menu** — "Orçamento" (form de sempre) e um item por tipo **com ficha**, lido do banco pela flag `com_ficha` (`lib/useTiposComFicha.js`), nunca pelo nome. `criarInicial` deixou de ser boolean e virou `{ tipoId }`; entrar por um tipo com ficha abre o form com o tipo **travado**.
- **F2:** cliente e obra voltaram da ficha para a **tela de criação** do Fechamento (entre a #80 e a #85 o mesmo dado era editável em dois lugares). O cliente virou obrigatório em todo tipo, então "Preencher ficha" não abre sem ele; na ficha viraram leitura, reusando o `.nd-vinculada` da filha.
- **F3:** obra **obrigatória** com **cidade e estado**; `obra.endereco` → `obra.cidade_estado`; o fallback `lib/obraPadrao.js` (a "Obra de {cliente}" criada em silêncio, 16 das 36 obras) foi **removido**. Três migrações **nesta ordem, por um motivo**: `0047` só a coluna (aditiva — um `rename` quebraria o app no ar, e como é PWA cada aparelho ficaria quebrado até atualizar); `0048` a função `completar_cidade_obra`; `0049` o `check NOT VALID`, rodado **depois do deploy**.

**O que as revisões pegaram na #85 — o padrão vale mais que os casos:**
- **Na migração, antes de existir código:** a policy `obra_editar` só deixa admin/atendente dar UPDATE em obra, e update barrado por RLS volta **0 linhas SEM erro** — o vendedor digitaria a cidade, o app diria "salvo" e a obra seguiria vazia, para sempre. E o dono, sendo admin, passaria em todos os testes. Foi isso que originou a `0048`.
- **Na F1:** escolher no menu com o form já aberto não remontava a `NovaDemanda` — card travado num tipo velho, ou vazio num form impossível de enviar. E a primeira solução de rascunho (`rascunhoCombina`) **apagava rascunho não visto** e travava o auto-save; foi jogada fora, e o `tipoTravado` passou a derivar do tipo ATUAL.
- **Na F3:** a **demanda-filha ficava impossível de criar** (a RPC ia com string vazia e o banco recusava antes do insert) — quem valida já isentava a filha, faltou isentar quem grava. E no celular o card da obra fechava escondendo o campo que acabara de virar obrigatório: era o caminho PADRÃO, já que 35 das 36 obras não têm cidade, e invisível no PC.

**#86 — destaque do recorte ativo** no sub-menu do Início. O CSS já existia; faltava o menu **saber** qual recorte está aplicado. `lib/recortes.js` virou fonte única (a lista + `recorteAtivo(f)`), e **quem responde é a LISTA**, não o clique no menu — o filtro também muda pelo Dashboard, pelos chips do celular e pelo "limpar". Duas regras deliberadas: busca/vendedor/urgência **não** apagam o destaque (são filtros por cima); um status que não é recorte apaga **todos** (acender "Todas" ali seria mentira). Achado da revisão: faltava a limpeza no desmontar — sair da Início deixava DOIS itens acesos e prometia um recorte que a volta não cumpre (a lista remonta em "Todas").

**#87/#88 — export/backup dos dados e dos anexos** (pendência antiga do §17). Ver a seção própria abaixo.

### Sessão de 05–06/08/2026 (issues #82/#83/#84 fechadas)

**Modo desktop (#83).** Nasceu de uma observação do dono: "o app tem cara de app, mas no PC fica desproporcional". Prototipado como artifact e iterado com ele ANTES de codar. Entregue em 4 blocos, cada um testado por ele antes do commit — **B1** casca (`MenuDesktop.jsx` + `lib/useDesktop.js` + `lib/useContadoresLista.js`), **B2** telas de consulta, **B3** formulários com campos expostos (`CardCampo` ganhou `sempreAberto`), **B4** lista + detalhe lado a lado. Depois, uma rodada de acabamento pedida por ele: anel de seleção (o card real é o `<li>`, com `overflow:hidden` — o contorno no botão de dentro era cortado nos cantos; virou `background` + `box-shadow` no `li` via `:has()`), barra de status como **rodapé do painel** e depois **navy colada na borda inferior** (o `padding-bottom` da coluna empurrava o `sticky` 16px para cima), lista larga que só encolhe quando há detalhe, filtros abaixo da busca (busca com **lupa dentro**, "Filtrar" + "Ordenar por" lado a lado), e o menu lateral com a marca do **app** + **menu da conta** no rodapé. **Bloqueantes pegos pelas revisões/testes antes dos commits:** CSS do split escopado em `.app.desktop` (classe do hook de 900px — quando as duas leituras discordavam o layout aplicava pela metade); `detalheTelaCheia` órfão deixando a tela sem cabeçalho nem lista; remonte do detalhe ao mudar o ponto de montagem (perdia a ficha aberta); e o `Ordenar por` novo disparando o efeito que refazia o rascunho da box (apagava o status escolhido e não aplicado).

**Correções da revisão do #83 (#84).** A revisão adversarial do B4 rodou DEPOIS do commit e devolveu 13 achados confirmados (de 15 brutos). Os que valiam: (1) **regressão de celular publicada** — ao tirar `f.ordenacao` das deps do efeito que re-fotografa o rascunho, o × da tag "Ordem: X" deixou de sincronizar a box e o "Filtrar" seguinte RESSUSCITAVA a ordem removida; virou vigia condicional (`ordemVigiada = desktop ? null : f.ordenacao`), já que o problema original só existe no desktop; (2) **barra fixa cobrindo o fim do formulário da ficha** — o `padding-bottom: 12px` do split vale também em tela cheia, onde a barra volta a ser `fixed`; (3) **CSS de tela cheia preso ao `@media 1200px`** enquanto o JS congela a decisão — um Ctrl+ durante a ficha trazia a lista de volta por cima, sem cabeçalho; as regras de `so-detalhe` saíram do media query (dependem do ESTADO, não da largura) e `soDetalhe` passou a ler o valor congelado. Menores: barra flutuando quando o detalhe é curto demais para rolar, anel do último card cortado embaixo, `×` nativo do `type=search` brigando com a lupa, filtro aplicado ficando sem controle à vista ao encolher para o celular, e `aria-pressed`/`aria-label` no card+painel (o card virou toggle e nada anunciava isso).

**Não perder formulário pela metade (#82).** Trava de saída + **rascunho automático** por usuário (`lib/rascunho.js`, 7 dias, tudo em try/catch). Bloqueante pego na revisão: o sinal de "pediu para voltar" nunca era resetado e o efeito rodava na montagem — reabrir o formulário se auto-fechava **e apagava o rascunho**; corrigido com guarda de `useRef` que só age quando o valor MUDA.

### Sessão de 04–05/08/2026 (issues #78/#79/#80/#81 fechadas)

**Ficha — F3+F4 (#80).** F3: detalhe do fechamento ("Informação adicional", box de condições oculta, box da ficha com resumo) + `FichaDemanda` (ver/editar/preencher-atrasado; cards compartilhados em `FichaCards`; fieldset **por card** — o card abre pra ler mesmo travado; `Miolo` fora do componente senão o input perdia o foco a cada tecla). F4: `FichaPdf` (réplica do papel + `window.print()`; visibilidade do print **escopada** por classe no body — sem escopo, o print do Relatório sairia em branco; folha **no fluxo**, sem `position:absolute` — WebKit/Gecko clipam multi-página). Bloqueantes pegos pelas revisões antes dos commits: round-trip do **valor com centavos** (banco devolve `45000.5`; re-salvar virava 450005) e **RT editável-mas-descartada** no preencher-atrasado.

**Paginação da lista + 3 telas (#78/#79).** `lib/paginacao.js` (`todasAsLinhas`: páginas de 1000 até acabar; erro em qualquer página falha o todo; teto anti-loop). Aplicado em `Demandas.jsx` (linhas + as 2 RPCs, com desempate `.order('id')`), `Dashboard.jsx` (refatorado p/ o helper), `Relatorio.jsx`, `SeletorCliente.jsx` (o busca-primeiro anti-duplicata dependia de ver TODOS os clientes) e `Clientes.jsx`. Verificado ao vivo (RPC paginada via curl com `limit`/`offset` — que é o que o `.range()` do supabase-js emite; conferido no fonte instalado).

**Ficha de pedido de vendas — F1+F2 (#80).** Banco na `0045` (§1). Front: `transicoesDe()` (trilho por `com_ficha` — fecha a janela de deploy), `NovaDemanda` em modo fechamento (só tipo/prazo/"Informação adicional" opcional/anexos/Proprietário; botão "Preencher ficha"), tela `FichaFechamento` (hero + cards por seção do papel + seletor de cliente busca-primeiro DENTRO da ficha; salva demanda→ficha→anexos; estado lifted na NovaDemanda — voltar não perde nada), `lib/ficha.js` (parsers e subtítulos), `lib/obraPadrao.js` (deduplicado). Decisões do dono: fluxo `não iniciado → em andamento → concluído → enviado`; ficha editável (staff até terminal; dono em não-iniciado); 1º consultor = vendedor dono + até 2 extras; texto padrão quando sem informação adicional. **Bugs pegos pela revisão adversarial antes do commit:** `numeroBr` corrompia decimais de `<input type=number>` (2,5% virava 25 — separado em `numeroInput`); filha-fechamento perdia RT/arquiteto herdados do pai (ficha agora nasce semeada). E2E validado no app real (#36/#37: ficha no banco com valor BR parseado, trilho Iniciar→Concluir sem revisão aceito pelo banco). **Achado extra da revisão da 0045:** a 0039 tinha derrubado o aviso "prazo se aproximando" — restaurado na `0046`.

### Sessões de 27/07–04/08/2026 (issues #73–#77 fechadas; #78 aberta)

**Pizza "Origem das demandas" (#73).** Gráfico pizza SVG na mão (`PizzaOrigens.jsx`, sem dependência) no Dashboard, **só gerente/admin**: todas as demandas de donos vendedor/gerente (a conta de teste fica fora via RLS 0041), cores por origem + **tabela de contagens abaixo** (identidade não fica só na cor).

**"Revisão de demanda" (#74).** O botão de demanda-filha (§11) voltou, renomeado: **só o vendedor dono**, **só com status `enviado`**, entre os anexos de saída e o autor. Abre **tela cheia própria** (hero + voltar + sino) com card "Revisão vinculada a #N" no topo; **origem herdada e escondida**, tipo sem "Orçamento novo", condições pré-preenchidas do pai.

**Compressão de entrada ≤ 1 MB (#75).** O dono notou "foto da criação não comprime". Diagnóstico honesto: os dois caminhos JÁ comprimiam — o vazamento era o **alvo de 2 MB** (foto abaixo disso passava intacta). Fix: `ALVO_ENTRADA = 1 MB` em `lib/anexos.js`, passado nos dois chamadores. Resolução mantida (1920 px).

**Dono apaga anexo de entrada (0044 + #76).** 2ª regressão da 0042/0043: o dono via a lixeira mas o DELETE batia na RLS (`anexo_excluir` só olhava autor/admin) e apagava **0 linhas SEM erro** — no PostgREST, DELETE barrado por `USING` é filtro, não erro. `0044` abre tabela + Storage (pela **pasta**, pois o owner do objeto é o admin) para o dono, só entrada, só `nao_iniciado`. `remover()` agora usa **`.delete().select()`** e trata array vazio como falha visível. Verificado adversarialmente (5 casos).

**Dashboard Bloco C (#77) — contagem híbrida.** O `carregar()` puxava TODAS as demandas (corte de ~1000 do PostgREST → subcontagem silenciosa futura). Agora: **abertas como linhas** (paginadas por segurança; urgência segue só em `lib/urgencia.js`, sem 3ª cópia em SQL), **"enviado" como `count exact`/`head`**, **pizza como 6 counts** com filtro de dono via join `!inner` (só p/ quem vê), e a **RPC `datas_primeira_revisao` filtrada** pelos ids das abertas em revisão (sem filtro ela também sofria o corte, SEM `order by` — podia derrubar demanda atual). Verificação tripla: revisão adversarial (equivalência nos 4 papéis) + queries batidas ao vivo no PostgREST via curl + dashboard validado no app. A mesma exposição existe na **lista** → **#78** (aberta).

### Sessão de 24/07/2026 (issues #64–#72, todas fechadas)

**Nova demanda em CARDS (#64).** O form virou cards fechados (cada campo mostra no subtítulo o que já foi escolhido; o form inteiro cabe numa tela), no lugar dos `<select>` nativos (que no celular abrem uma roleta e escondem a tela). Componente reutilizável **`CardCampo`** (mesma linguagem da Administração). Cliente/Obra com busca "5 últimos"; Tipo/Origem como listas; **Prazo com calendário inline** (`Calendario.jsx`, sem dependência — grade de mês na mão); `club_casa` **derivado** da origem; **validação inteira em `lib/novaDemanda.js`** (sem o `required` dos `<select>`, a origem obrigatória viraria opcional em silêncio). `NovaDemanda` foi quebrado em componentes `Nd*` (um card por arquivo).

**Ocultar a conta de teste (0041).** `perfil.oculto` (flag data-driven, padrão da 0040) + helper `perfil_oculto()` SECURITY DEFINER; a `demanda_leitura` esconde as demandas de um perfil oculto — dashboard/listas/relatório herdam via RLS (comentário/histórico/anexo herdam via a subconsulta à demanda). O dono da conta sempre vê as próprias.

**Dashboard — reforma (Blocos A + B).**
- **Bloco A:** anéis "Por status" só da **fila em aberto** ("Concluído" entra; "Enviado" vira contador à parte; "Cancelada" **não aparece** — decisão do dono); "Por urgência" com a **legenda como alvo de toque** (segmento fino é impossível de acertar no celular); estados de carregando/vazio/"tudo em dia". Cabeçalho "Dashboard" + perfil **mantidos** (o dono vetou a saudação).
- **Bloco B:** KPIs "Atenção"/"Em aberto" lado a lado; **"Precisam de atenção" vira LISTA de itens** (cliente·obra·motivo, cada um abre o detalhe); chip **"Cancelamentos a decidir"** (só admin/atendente) + filtro `soCancelamentoSolicitado` com **chip próprio** na lista (senão ficava preso); **feed "Novidades nas suas demandas"** (só vendedor), reusando as notificações do sino (fonte única).

**Baixar todos os PDFs (.zip).** Nos anexos de **entrada**, botão "Baixar os N PDFs (.zip)" (aparece com 2+ PDFs). **`lib/zip.js`** monta o zip no navegador, **SEM dependência** (§5) — método "stored" (PDF já é comprimido; o ganho é juntar num arquivo só). Baixa cada PDF via `.download()` (passa pela RLS) em série. Validado extraindo pelo próprio Windows + com dados reais de produção.

**Admin define o proprietário (0042 + 0043).** Card **"Proprietário"** no fim da Nova demanda, **só admin**: escolhe o dono entre **vendedores + gerentes** ativos (exceto o oculto), 1 por vez; padrão = o próprio admin. `0042` abre a policy `demanda_criar` só para admin (os demais seguem forçados a si mesmos — autor inforjável, §5) e faz o gatilho de nova demanda passar o autor real → o **vendedor dono é notificado** (vê no feed da Início). `0043` corrige a policy `anexo_entrada_criar`, que assumia "criador = dono" e barrava o admin de anexar entrada. **Auditadas** todas as demais policies que assumiam isso: só essas duas eram estritas; o resto já tinha a saída "OU staff" ou é leitura.

**Bug mobile — selos saindo da tela.** Em cards com nome de cliente longo, status/urgência/coment saíam da tela (agravado pela troca "movida há X" → "Última atualização há X", um selo `nowrap` mais largo). Fix: `.badges { flex-shrink: 0 }`, coluna de texto `min-width: 0`, `.selo-mexida { white-space: normal }`, `.cliente-nome { overflow-wrap: anywhere }`.

### Sessão de 16/07/2026 (issues #47–#63)

Rede de segurança contra tela branca (`ErrorBoundary` em 2 níveis + `erro_log` `0035` + tela **Erros**); **Meu perfil** (foto+senha `0034`) + `<Avatar>` em todas as telas; tela **Administração** (agrupa Equipe+Erros); **Tema virou toggle** no perfil; **Relatório mensal** (§18 do CLAUDE.md); e vários de fluxo/UX (anexar após "enviado" via gatilho `0038`, sheet de status ícone+cor, filtro por status, "movida há X" + ordenar por atividade, aviso sem conexão, aviso de nova versão PWA, girar imagem, anexos múltiplos, custo atrasado 5→3 dias `0039`).

### Export/backup dos dados e dos anexos (§17, #87/#88)

**Administração → Backup.** Um botão baixa um `.zip` (~250 KB) com as **9 tabelas de conteúdo** em `dados/*.csv` e `json/*.json`, mais um `LEIA-ME` com data, índice e as chaves que ligam as tabelas. Outros dois botões baixam os **ARQUIVOS** dos anexos, separados por tipo (saída 63/60 MB · entrada 123/45 MB), numa pasta por demanda — o número da pasta é o `id`, que liga ao backup de dados. Sem dependência: reusa o `lib/zip.js` da #72, que absorveu o `baixarBlob` e o `nomeUnicoNoZip` antes soltos no `CarrosselEntrada`.

**Três detalhes decidem se o CSV presta:** **BOM UTF-8** (sem ele o Excel mostra "JosÃ©"); separador **`;`** e não `,` (o Excel usa o separador de lista do Windows, que em português é `;` — com vírgula as 16 colunas caem na coluna A); e **neutralizar fórmula** (célula começando com `= + - @` é avaliada — e "- 2 janelas de correr" é descrição comum aqui; duas descrições REAIS precisaram do apóstrofo). O CSV distorce nesses dois pontos de propósito; o `json/` é a cópia fiel.

**Nos anexos, o que os números reais ensinaram:** **15 arquivos precisaram de desempate de nome** (a demanda-17 tem cinco fotos do WhatsApp idênticas — sem isso, quatro sumiriam do backup em silêncio); em série levava **122s**, contra **8s** com 4 downloads em paralelo; e o **retry** nasceu de um caso real — 1 dos 123 falhou por oscilação de rede e, numa segunda passada, os 123 baixaram inteiros.

⚠ **A armadilha mais cara da leva**, achada pela revisão DEPOIS do commit: o `download()` do storage-js só converte em `{ data, error }` o que dá errado **até os cabeçalhos** — a leitura do corpo (`await result.blob()`) **relança um TypeError cru** se a conexão cair no meio. Com o `Promise.race` fora de try/catch, a rejeição pulava as 3 tentativas, derrubava os 4 trabalhadores e matava o backup inteiro — **justamente na falha para a qual o retry foi escrito**. Hoje: try/catch dentro do laço de tentativas E no corpo do trabalhador.

⚠ Outros dois da mesma revisão: `nomeUnicoNoZip` comparava a string EXATA, mas **NTFS não distingue maiúsculas** (`IMG_0042.JPG` × `img_0042.jpg` viravam duas entradas e uma sobrescrevia a outra ao extrair); e o LEIA-ME identificava a falha por `demanda-N/nome`, que pode ser IGUAL ao de um arquivo presente no zip — agora usa `anexo #id`.

⚠ O backup traz **o que a conta enxerga** (RLS): como admin é tudo, menos as demandas da conta oculta.
⚠ O `.gitignore` barra `service-desk-backup-*.zip` e `service-desk-anexos-*.zip` — um download de teste caiu na raiz do projeto, e esses arquivos têm CPF e dados bancários das fichas (§19).

## 6. Decisões tomadas (e o porquê) — não re-litigar sem motivo novo

| Decisão | Por quê |
|---|---|
| **`CardCampo` reutilizável** (ícone+título+subtítulo) | Reusa a linguagem da Administração; o subtítulo "fechado" vira a RESPOSTA (mostra o que foi escolhido), deixando o form inteiro numa tela. Serve p/ tipo/origem/cliente/obra/prazo/proprietário. |
| **Calendário inline sem dependência** | Grade de mês montada na mão. Montar a ISO pelos **números** (`AAAA-MM-DD`), nunca `new Date("...")` — a string ISO é lida como UTC e, no nosso fuso, grava o dia anterior. Navegação por setas do padrão ARIA foi **pulada de propósito** (mobile-first, toque; §2/§5). |
| **Anéis só da fila em aberto; "enviado" vira contador; "cancelada" não aparece** | "Enviado" é permanente — na base do arco, com o tempo, encolhe as fatias das abertas. "Cancelada" o dono não quis exibir. |
| **Urgência: a LEGENDA é o alvo de toque** | Segmento de 1-2 mm é impossível de acertar com o dedo (mobile-first, §3). A barra virou só visual (`aria-hidden`). |
| **Admin define o dono; autor inforjável para os demais** | A exceção vive na **RLS** (0042), não no front (§3). Admin já é confiável (reseta senhas etc.). O gatilho de nova demanda passa o **autor real** → notifica a ponta certa. |
| **`perfil.oculto` (flag)** vs filtrar por nome/id | Data-driven, como o `oculto_relatorio` (0040). Um `update` liga/desliga p/ qualquer conta. |
| **Zip "stored" (sem compressão)** | PDF já é comprimido → comprimir renderia ~0. O objetivo é **um arquivo só**. Sem lib (§5); o ZIP é formato simples de escrever à mão. |
| **Revisões adversariais (workflows) no fluxo** | Pegaram bugs reais **antes do commit** (ver §6 bugs). Vale rodar uma ao terminar uma tela/feature de risco. |
| **Bloco C HÍBRIDO** (abertas como linhas + counts no banco) | Escolha do dono entre 3 opções. Contar TUDO em SQL exigiria a **3ª cópia** da regra de urgência (além de `lib/urgencia.js` e `notificar_pendencias()` — o §8 do CLAUDE.md já alerta o desencontro com DUAS). Paginação pura manteria payload crescente. O híbrido: linhas só do que é pequeno (fila aberta), count do que é ilimitado. |
| **Compressão: alvo único `ALVO_ENTRADA` (1 MB)** | O limite de validação (2 MB) e o ALVO de compressão são coisas distintas: comprimir "até o limite" deixava fotos de 1–2 MB passarem intactas e encherem o Storage. Constante num lugar só, usada pelos dois caminhos de upload. |
| **`.delete().select()` como padrão de remoção** | DELETE barrado por RLS **não dá erro** no PostgREST (apaga 0 linhas e "sucede"). Sem o `.select()`, a falha é invisível. Checar `error \|\| !data.length`. |

*(As decisões de 16/07 — sheet de 2 toques, busca global descartada, toast descartado, cores fixas do sheet, "atrasado" só em nao_iniciado/em_andamento, `ultima_atividade()` na hora, anexo pós-envio via gatilho, PDF via `window.print()`, relatório por exceção ao §2 — seguem valendo.)*

### Bugs encontrados sem ninguém pedir (mantenha o hábito de investigar antes de codar)
1. `anexo_saida_criar` não checava status (regra vivia só no front) — corrigido na `0038`.
2. A #42 nunca foi aplicada no banco (custo atrasado desalinhado) — `0039`.
3. "Limpar tudo" dos filtros não limpava o vendedor — junto do #60.
4. **Enter num campo de busca submetia a Nova demanda** — ao tirar o `disabled` do botão, o implicit-submit do `<form>` voltou. Fix: `onKeyDown` no form barra Enter em `<input>`. *(Pego por revisão adversarial.)*
5. **Filtro de cancelamento (Bloco B) ficava preso** — sem chip próprio, nem "limpar" nem os chips de status o desligavam. Fix: chip "Cancelamentos" espelhando o de "Atenção". *(Pego por revisão adversarial.)*
6. **`anexo_entrada_criar` assumia criador = dono** — quebrou ao atribuir a demanda a outro (0042); os anexos de entrada falhavam. Fix na `0043`.
7. **`anexo_excluir` + `anexos_storage_delete` também assumiam autor = dono** — 2ª regressão da mesma família (0042): o dono não conseguia apagar entrada subida pelo admin, **sem nenhum erro** (DELETE barrado por RLS = 0 linhas em silêncio). Fix na `0044` + `.delete().select()` no front.
8. **`datas_primeira_revisao` sem filtro nem `order by`** — sujeita ao corte de ~1000 do PostgREST derrubando linhas ARBITRÁRIAS (o "custo atrasado" podia sumir de demanda atual). Pego na análise do Bloco C; no Dashboard já filtrada, na lista ainda não (#78).

> **Padrão reforçado:** ao mudar um **invariante de posse/permissão** (ex.: "o criador é o dono"), **audite TODAS as policies dependentes** — não só a que você mexeu (já mordeu DUAS vezes: 0043 no INSERT, 0044 no DELETE). Regra de negócio só no front é uma brecha; conferir sempre o par **front ↔ banco**.

## 7. ⏳ Pendências

- 📝 **Anotações da #80 (nada bloqueante):** fechamento fica com origem nula → "Sem origem" no relatório (aceito pelo dono) · o PDF imprime o **estado atual da tela** (edição não salva sai na folha — "imprime o que se vê", decisão de produto) · `@page A4/10mm` vale pra **todo** print do app, inclusive o Relatório (aceito e documentado no CSS).
- 🔁 **#29 (migrar demandas):** o **go-forward** (atribuir dono ao criar) está feito (0042/0043). Sobra, **se precisar**, reatribuir demandas **JÁ existentes** para outro dono.
- 🔒 **Anotado (sem issue):** o ramo `autor_id = auth.uid()` do `anexo_excluir` deixa o vendedor-autor apagar a própria entrada em **qualquer status** via API direta (o front nunca mostra o botão fora de `nao_iniciado`). Pré-existente à 0044; travar só se o dono quiser rigor total.
- 🧾 **Remover a coluna `obra.endereco`** — legado sem uso desde a `0047` (o app inteiro lê `cidade_estado`). Migração de uma linha, sem pressa.
- 🏗️ **35 obras sem cidade** — vão se completando conforme forem usadas (o formulário pede na hora). Nenhuma ação necessária.
- 🐢 **Detalhe pesado com muitos PDFs:** cada `MiniaturaPdf` renderiza via pdf.js; demandas com 20+ PDFs de entrada travam a tela ao abrir (renderizar miniaturas sob demanda resolveria). Relevante justo no caso "muitos PDFs".
- 🚪 **A sessão em si nunca cai** — nem por reset de senha (MEDIDO pelo dono: o celular logado continuou funcionando), nem por desativar. O token segue válido até expirar; encerrar sessão de verdade continua sendo no painel do Supabase. O que mudou com a `0052` é que o desativado deixou de **ver** — antes ele lia tudo pela API. Se algum dia for preciso "expulsar agora" (celular roubado), aí sim é Edge Function nova com `auth.admin.signOut` — não fazer sem o dono pedir.
- 🌀 **O feed muda a lista embaixo do dedo** — decisão do dono, com o risco na mesa. A revisão confirmou onde morde mais forte: ordenando por **atividade recente**, um comentário alheio move a chave de ordenação daquela demanda para "agora" e empurra as linhas de baixo; no celular a lista é a tela inteira e o toque ABRE o detalhe, então o dedo pode descer sobre X e abrir Y. Sem mitigação hoje (não há pausa por ponteiro nem âncora de rolagem). Se incomodar: pílula *"N novidades — atualizar"*.
- 💸 **Rajada de eventos espaçados = N recargas.** A espera de 400ms agrupa o que sai na MESMA transação (mover status → `demanda` + `historico_status` + `comentario` = 1 recarga). Não agrupa o que vem espaçado: anexar 5 arquivos numa demanda **já enviada** dispara o gatilho da `0038` uma vez por arquivo → 5 comentários → 5 recargas de 3 consultas paginadas. Caminho raro e sem dano — só custo. Um teto de intervalo (~2s) resolveria; não foi feito para não somar duas lógicas de tempo ao mesmo código.
- 🔎 **`0052`: falta observar o único caminho que ela realmente protege.** O dono testou os dois lados visíveis no app — com conta ativa a lista aparece normal (não houve regressão), e a conta desativada mostra **"Sua conta está desativada"**, não *"Seu usuário ainda não tem um perfil cadastrado"*, o que confirma que deixar a `perfil` fora da regra foi acerto. Mas repare: o frontend barra em [Painel.jsx:203](src/components/Painel.jsx:203) **antes** de a lista carregar, então pelo app um desativado nunca veria as demandas, com ou sem a `0052`. O que a migração fecha é o caminho da **API direta** — e esse ainda não foi observado. Para provar, bastaria logar via REST com a conta de teste desativada e bater na `demanda`: deve vir `[]`.
- 🗂️ **Backlog aberto:** #43 (documentação), #32 (co-vendedor), #18 (tela de tipos), #17 (box de cor).
- 🧹 Limpeza de anexos de entrada antigos (§14) · 📅 feriados no cálculo de prazo (§8).

## 8. 🎯 Próximo passo

Nada em andamento — o working tree está limpo e tudo o que foi feito está no ar.

Do backlog, em ordem de valor (opinião, não decisão):
1. **Remover `obra.endereco`** (acima) — barato e tira uma coluna que mente.
2. **#29** (reatribuir demandas já existentes), **#43** (documentação), **#32** (co-vendedor), **#18** (tela de tipos), **#17** (box de cor).
4. 🐢 **Detalhe pesado com muitos PDFs** — 20+ miniaturas via pdf.js travam a tela ao abrir; renderizar sob demanda resolveria.

## 9. ⚠️ Armadilhas do ambiente (economiza horas)

| Armadilha | O que fazer |
|---|---|
| **Login no navegador do harness fica INSTÁVEL** | Intermitente nesta sessão: às vezes o submit não entra (provável rate-limit do Supabase auth após muitas tentativas). Quando pegar logado, valide tudo de uma vez. Fluxo que funcionou: clicar no campo → `type` → clicar em Entrar (teclas reais, não só `form_input`). |
| **A preview / dev server CAI com frequência** | Reabra com `preview_start({name:'dev'})`. A aba nova nasce **deslogada** (tela de boas-vindas → Continuar → login). |
| **Detalhe com muitos PDFs congela o renderer** | 20-26 `MiniaturaPdf` (pdf.js) travam a preview → `javascript_tool`/`read_page` dão timeout. Evite abrir essas demandas para inspecionar; verifique a lógica por query/DOM em telas leves. |
| **Separar um commit quando o `App.css` tem 2 features** | `git diff -- src/App.css \| awk '/^@@/{c++} c<2{print} c>=2{exit}' > hunk.patch && git apply --cached hunk.patch` (stage só o 1º hunk), commita, depois `git add` o resto. |
| **`git add <arqs> && git commit` commita TUDO que estiver staged** | Use `git commit -m ... -- <paths>` quando houver outra coisa staged (hoje o `.gitignore` já barra `deno.lock` e `supabase/.temp/`). |
| **`npm run build` com o preview LIGADO** → `EINVAL` no service worker | Pare o preview antes de buildar. |
| **Buffer do console não limpa** em navigate/reload | Erro fantasma pode persistir; abra **aba nova** para buffer limpo antes de concluir que é real. |
| **Screenshot trava** no preview | Verificar por **DOM/`getComputedStyle`** via `javascript_tool` (mais confiável e preciso). |
| **`resize_window` NÃO dispara `matchMedia change`** | Provado com listeners crus (0 eventos). Trocar de modo (celular↔desktop) exige **reload** — senão os hooks continuam com a leitura antiga e o layout aplica pela metade. |
| **Ler o DOM no MESMO tick de um clique React** | `setState` é assíncrono: a medição sai do estado ANTERIOR e produz falso negativo. Clicar numa chamada, medir na **seguinte**. |
| **Preview "dorme"** (`innerWidth === 0`) | Se as medidas vierem zeradas, chame `resize_window` e **recarregue** antes de medir. |
| **`read_network_requests` não pega cross-origin** (supabase.co) | Interceptar `window.fetch`, ou usar o client via `import('/src/lib/supabase.js')` na página. |
| **Node/`gh` fora do PATH** | `export PATH="/c/Program Files/nodejs:$PATH"`; `gh` por caminho completo `C:/Program Files/GitHub CLI/gh.exe`. |
| **Senha da conta de teste MUDA** | O dono a troca ao validar o Meu perfil. **Peça a atual** para validar tela logada. A conta é **ADMIN** (dá p/ validar telas de gerente/admin, ex.: a pizza) e está **oculta** (0041). |
| **Validar query nova SEM depender do navegador** | Logar via REST (`POST /auth/v1/token?grant_type=password` com a anon key do `.env.local`) e bater a query com `curl` direto no PostgREST (`Prefer: count=exact`, `-I` p/ head). Prova sintaxe e semântica ao vivo, imune à instabilidade do login/preview. Usado no Bloco C. |
| **`storage.download()` pode REJEITAR, não só devolver `{error}`** | O storage-js só converte em `{ data, error }` o que falha até os CABEÇALHOS; a leitura do corpo (`await result.blob()`) relança um `TypeError` cru se a conexão cair no meio. Todo laço de retry sobre ele precisa de **try/catch** — senão a rejeição pula as tentativas e derruba tudo (mordeu no backup dos anexos, §#88). |
| **Nome de arquivo no zip: NTFS não distingue maiúsculas** | Desempatar por string exata deixa `IMG.JPG` e `img.jpg` virarem duas entradas — e uma sobrescreve a outra ao extrair, sem erro. Comparar sempre por `toLowerCase()`. |
| **CSV para o Excel em português** | Precisa de **BOM UTF-8** (senão "JosÃ©"), separador **`;`** (o Excel usa o separador de lista do Windows) e **apóstrofo** antes de `= + - @` (senão a célula vira fórmula — e "- 2 janelas" é descrição comum aqui). |
| **PWA cacheia a versão antiga** | Modo `prompt` ("Nova versão → Atualizar"). Se o deploy "não pegou", quase sempre é cache. |
| **`oxlint` e `npm run build` NÃO pegam variável inexistente** | Uma referência a variável renomeada passou pelos dois e só estourou como `ReferenceError` no navegador — é JS válido até rodar. **Abrir o console faz parte de testar**, não é zelo extra. |
| **Enter num `<input>` dentro de `<form>` = envio implícito** | Se o form tem um botão de submit habilitado, Enter em qualquer input o aciona — mesmo que o input seja de um bloco aninhado com finalidade totalmente outra. Já mordeu **duas vezes** (§#64 na Nova demanda, e o campo de senha nova dentro do "Editar membro", onde salvava o perfil e fechava a tela **parecendo sucesso**). Remédio: `e.preventDefault()` no `onKeyDown` do input e, se fizer sentido, disparar ali a ação que o dedo quis. |
| **Policy sem cláusula `to` vale para o ANÔNIMO** | Sem `to`, é `TO PUBLIC` — e no Supabase o PUBLIC inclui o `anon` (visitante sem sessão, só com a chave publishable, que por desenho vai no bundle). Quase nunca vaza, porque quase toda policy compara com `auth.uid()` ou chama `meu_papel()` e para o anônimo isso dá nulo. **Vaza quando a condição olha só a LINHA** (`papel in (...)`) — foi a `perfil_staff_visivel`, dois meses no ar. Auditoria barata: varrer TODAS as tabelas por curl anônimo (lista via `grep -rhoE "create table" supabase/migrations/`), antes e depois. Foi o que provou que o vazamento estava confinado a uma tabela. |
| **`functions.invoke` esconde o corpo do erro** | Resposta não-2xx vira sempre a MESMA frase em inglês no `error.message`. O texto que a função escreveu está no **`error.context`**, que é um `Response` ainda por ler (`await error.context.json()`). Sem isso a função fica bem-educada por dentro e fala inglês com o usuário. |
| **Deploy de Edge Function não precisa de `link`** | `npx supabase functions deploy <nome> --project-ref <ref>` (o `login` é interativo — é do dono). O `supabase/config.toml` **vai junto** e é ele que preserva o `verify_jwt` de cada função; sem ele, cada deploy religa a verificação e derruba o webhook do push. Conferir depois com `functions list`. |
| **PostgREST: ambiguidade de embed** com >1 FK | `tabela!fk_coluna` (ex.: `vendedor:perfil!vendedor_id(...)`). |
| **Enum do Postgres** não remove valor fácil | Por isso "concluído" virou legado. `ALTER TYPE ... ADD VALUE` não roda na mesma transação em que o tipo é criado. |

## 10. 🤝 Combinados de trabalho (além do §0 do CLAUDE.md)

- **Trabalho concluído → sempre registrar uma issue FECHADA** no GitHub, para o histórico (`gh issue create` + `gh issue close`, com o commit no corpo).
- **Ideia nova → confirmar ANTES** de criar a issue (propor título; criar só com o "ok").
- **Função nova que funcione + "ok" do dono → commit + push** (conferindo `git status` antes e `HEAD == origin/main` depois). Um commit por assunto (separar `App.css` por hunk quando preciso — §9).
- **Migração é do dono:** ele roda no SQL Editor. Sempre dizer **o que quebra se não rodar**; preferir que a ausência degrade só a tela nova. **Não commitar o front que depende da migração antes de o dono confirmar que rodou** (senão o deploy quebra). Vale igual para **Edge Function**: função primeiro, front depois — nada que dependa do servidor sobe antes de ele existir.
- **Conferir o efeito depois que ele roda**, não só perguntar se rodou. Foi verificar a `0050` que expôs a brecha que virou a `0051` — a confirmação do dono prova que o comando não deu erro, não que o efeito é o esperado.
- **Achado de segurança em repositório PÚBLICO não vira issue** enquanto está aberto. Conversar no chat, corrigir, e só então registrar. Uma issue descrevendo brecha ativa com o nome do projeto é um convite.

---

_Atualizado por Claude Code em 11/08/2026 (após `4210fac`; migrações até `0053`)._
