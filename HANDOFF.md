# 📋 Handoff — Service Desk - EsquadSystem

**Data:** 04/08/2026 · **Branch:** `main` (sincronizada com `origin`) · **HEAD:** `2f8ce4d`

> Documento de continuidade. Para retomar: leia a **§7** (pendências) e a **§9** (armadilhas).
> A fundação é o **`CLAUDE.md`** — leia-o por completo antes de mexer em qualquer coisa.

---

## 1. ✅ Migrações: todas aplicadas (`0001` → `0044`)

Todas rodadas e confirmadas pelo dono no SQL Editor. As mais recentes:
- **`0041`** — `perfil.oculto` + helper `perfil_oculto()`; esconde as demandas de um perfil oculto (a conta de teste) de todo mundo, menos do próprio dono.
- **`0042`** — admin pode definir o **dono** da demanda ao criar; + o gatilho de nova demanda passa o **autor real** (`auth.uid()`).
- **`0043`** — admin pode **anexar entrada** em demanda de outro dono (fix da 0042).
- **`0044`** — o **dono** da demanda pode **apagar anexo de entrada** dela (tabela + Storage, este pela pasta) enquanto `nao_iniciado` — 2ª regressão da 0042/0043 (ver §6).

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

- **Fases 0–6 completas** e no ar. Migrações **`0001` → `0044`**, todas aplicadas (§1).
- **Web Push (#14): CONCLUÍDO** — validado nas 3 plataformas (desktop, Android, iOS com PWA).
- **Nova demanda:** reformada em **cards** (§5) — a última tela que faltava padronizar.
- **Dashboard: reforma COMPLETA** — Blocos A, B e **C** (contagem híbrida, #77). A **lista** ainda tem a exposição ao corte de ~1000 (#78, aberta — ver §7).
- **Anexos de entrada:** comprimidos para **≤ 1 MB** (`ALVO_ENTRADA` em `lib/anexos.js`) nos DOIS caminhos (criação e detalhe).
- **Conta de teste** (`teste@gmail.com` = 'USUARIO DE TESTE'): **oculta** (0041) — não aparece nas listas/dashboard/relatório dos outros; e fora do relatório (0040).
- **Fora do versionamento de propósito:** `deno.lock` e `supabase/functions/criar-usuario/` (Edge Function criada, **não deployada** — pendência #16).

## 5. O que foi feito

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

- 📊 **#78 — "Bloco C da lista":** `Demandas.jsx` tem a exposição ao corte de ~1000 **em triplo** (as linhas da lista + `datas_primeira_revisao` + `ultima_atividade`, todas sem filtro/paginação). Preventivo, sem efeito no volume atual. A estratégia da lista em si (paginar vs. janela) é decisão de UX — **discutir antes de implementar**.
- 🔁 **#29 (migrar demandas):** o **go-forward** (atribuir dono ao criar) está feito (0042/0043). Sobra, **se precisar**, reatribuir demandas **JÁ existentes** para outro dono.
- 🔒 **Anotado (sem issue):** o ramo `autor_id = auth.uid()` do `anexo_excluir` deixa o vendedor-autor apagar a própria entrada em **qualquer status** via API direta (o front nunca mostra o botão fora de `nao_iniciado`). Pré-existente à 0044; travar só se o dono quiser rigor total.
- 📝 **Da lista de melhorias:** *não perder formulário pela metade* (a Nova demanda perde tudo se tocar em voltar) e *export/backup dos dados*.
- 🐢 **Detalhe pesado com muitos PDFs:** cada `MiniaturaPdf` renderiza via pdf.js; demandas com 20+ PDFs de entrada travam a tela ao abrir (renderizar miniaturas sob demanda resolveria). Relevante justo no caso "muitos PDFs".
- 🗂️ **Backlog aberto:** #43 (documentação), #32 (co-vendedor), #18 (tela de tipos), #17 (box de cor), #16 (cadastro in-app — Edge Function criada, **não deployada**).
- 🧹 Limpeza de anexos de entrada antigos (§14) · 📅 feriados no cálculo de prazo (§8).

## 8. 🎯 Próximo passo
A reforma do Dashboard está **completa** (A+B+C). Candidatos: **#78** (Bloco C da lista — começar discutindo a UX da lista), *não perder formulário pela metade*, export/backup, ou o que o dono priorizar.

## 9. ⚠️ Armadilhas do ambiente (economiza horas)

| Armadilha | O que fazer |
|---|---|
| **Login no navegador do harness fica INSTÁVEL** | Intermitente nesta sessão: às vezes o submit não entra (provável rate-limit do Supabase auth após muitas tentativas). Quando pegar logado, valide tudo de uma vez. Fluxo que funcionou: clicar no campo → `type` → clicar em Entrar (teclas reais, não só `form_input`). |
| **A preview / dev server CAI com frequência** | Reabra com `preview_start({name:'dev'})`. A aba nova nasce **deslogada** (tela de boas-vindas → Continuar → login). |
| **Detalhe com muitos PDFs congela o renderer** | 20-26 `MiniaturaPdf` (pdf.js) travam a preview → `javascript_tool`/`read_page` dão timeout. Evite abrir essas demandas para inspecionar; verifique a lógica por query/DOM em telas leves. |
| **Separar um commit quando o `App.css` tem 2 features** | `git diff -- src/App.css \| awk '/^@@/{c++} c<2{print} c>=2{exit}' > hunk.patch && git apply --cached hunk.patch` (stage só o 1º hunk), commita, depois `git add` o resto. |
| **`git add <arqs> && git commit` commita TUDO que estiver staged** | Use `git commit -m ... -- <paths>` quando houver outra coisa staged (`deno.lock`/`criar-usuario` seguem fora). |
| **`npm run build` com o preview LIGADO** → `EINVAL` no service worker | Pare o preview antes de buildar. |
| **Buffer do console não limpa** em navigate/reload | Erro fantasma pode persistir; abra **aba nova** para buffer limpo antes de concluir que é real. |
| **Screenshot trava** no preview | Verificar por **DOM/`getComputedStyle`** via `javascript_tool` (mais confiável e preciso). |
| **`read_network_requests` não pega cross-origin** (supabase.co) | Interceptar `window.fetch`, ou usar o client via `import('/src/lib/supabase.js')` na página. |
| **Node/`gh` fora do PATH** | `export PATH="/c/Program Files/nodejs:$PATH"`; `gh` por caminho completo `C:/Program Files/GitHub CLI/gh.exe`. |
| **Senha da conta de teste MUDA** | O dono a troca ao validar o Meu perfil. **Peça a atual** para validar tela logada. A conta é **ADMIN** (dá p/ validar telas de gerente/admin, ex.: a pizza) e está **oculta** (0041). |
| **Validar query nova SEM depender do navegador** | Logar via REST (`POST /auth/v1/token?grant_type=password` com a anon key do `.env.local`) e bater a query com `curl` direto no PostgREST (`Prefer: count=exact`, `-I` p/ head). Prova sintaxe e semântica ao vivo, imune à instabilidade do login/preview. Usado no Bloco C. |
| **PWA cacheia a versão antiga** | Modo `prompt` ("Nova versão → Atualizar"). Se o deploy "não pegou", quase sempre é cache. |
| **PostgREST: ambiguidade de embed** com >1 FK | `tabela!fk_coluna` (ex.: `vendedor:perfil!vendedor_id(...)`). |
| **Enum do Postgres** não remove valor fácil | Por isso "concluído" virou legado. `ALTER TYPE ... ADD VALUE` não roda na mesma transação em que o tipo é criado. |

## 10. 🤝 Combinados de trabalho (além do §0 do CLAUDE.md)

- **Trabalho concluído → sempre registrar uma issue FECHADA** no GitHub, para o histórico (`gh issue create` + `gh issue close`, com o commit no corpo).
- **Ideia nova → confirmar ANTES** de criar a issue (propor título; criar só com o "ok").
- **Função nova que funcione + "ok" do dono → commit + push** (conferindo `git status` antes e `HEAD == origin/main` depois). Um commit por assunto (separar `App.css` por hunk quando preciso — §9).
- **Migração é do dono:** ele roda no SQL Editor. Sempre dizer **o que quebra se não rodar**; preferir que a ausência degrade só a tela nova. **Não commitar o front que depende da migração antes de o dono confirmar que rodou** (senão o deploy quebra).

---

_Gerado por Claude Code em 04/08/2026 (HEAD `2f8ce4d`)._
