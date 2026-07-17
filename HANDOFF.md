# 📋 Handoff — Service Desk - EsquadSystem

**Data:** 16/07/2026 · **Branch:** `main` (sincronizada com `origin`) · **HEAD:** `19228a2`

> Documento de continuidade. Para retomar: leia a **§7** (pendências) e a **§9** (armadilhas).
> A fundação é o **`CLAUDE.md`** — leia-o por completo antes de mexer em qualquer coisa.
> _(Substitui o handoff de 01/07/2026, que ficou muito defasado.)_

---

## 1. ✅ Migrações: todas aplicadas (`0001` → `0040`)

Confirmado com o dono em **16/07** — incluindo a `0036` e a `0038`, que **tinham passado batido** e foram rodadas só depois de este handoff apontá-las.

> **Lição para as próximas.** O dono roda as migrações no SQL Editor, e duas ficaram para trás sem ninguém notar. A `0038` era a pior: sem ela, anexar numa demanda enviada **funcionava, mas não registrava no histórico nem avisava o vendedor** — uma **falha silenciosa**, do tipo que só aparece quando o vendedor reclama que não foi avisado.
>
> Então: **peça confirmação explícita** de que a migração rodou (não presuma pelo silêncio), sempre diga **o que quebra se não rodar**, e — quando der — faça a ausência dela degradar **só a tela nova**, não o app (ex.: `MeuPerfil` busca `avatar_path` sozinho, fora do boot, justamente por isso).

---

## 2. O que é o projeto

App web interno da **EsquadSystem** (esquadrias de alumínio) para gerir **demandas de orçamento**, substituindo WhatsApp + Kanban local. Regido pelo `CLAUDE.md` (§0): **uma fase por vez, explicar antes e depois, trade-offs na mesa, perguntar em vez de assumir, identificadores em português, RLS no banco, componentes pequenos (~200 linhas), evitar dependências.** O dono está **aprendendo React** e quer entender cada parte.

## 3. Stack e infraestrutura

- **Front:** React 19 + Vite (JavaScript puro, sem TS). Navegação por **estado** (sem react-router — por isso a URL não identifica a tela). **PWA** (vite-plugin-pwa, agora em modo **`prompt`**).
- **Back:** **Supabase** (Auth e-mail/senha + Postgres + RLS + Storage + Realtime + Edge Functions). Ref `lvjqrtjytysejbcqoqmf`.
- **Deploy:** **Vercel**, CD ativo — push na `main` publica sozinho.
- **Git:** origin = `github.com/JoseGavioli/SERVICE-DESK-ESQUADSYSTEM`.
- **Buckets:** `anexos` (privado, URL assinada) e `avatares` (**público**, foto de perfil).

## 4. Estado atual

- **Fases 0–6 completas** e no ar. Migrações **`0001` → `0040`**, todas aplicadas (§1).
- **Web Push (#14): CONCLUÍDO** — validado nas 3 plataformas (desktop, Android e **iOS** com PWA instalado).
- **Menu "Mais":** `Meu perfil · Administração (só admin) · Sair`. Para o vendedor, 2 itens.
- **Todas as telas reformadas.** A única pendente de redesenho é o **Dashboard** (o dono vai mandar os detalhes).
- **Fora do versionamento de propósito:** `deno.lock` e `supabase/functions/criar-usuario/` (Edge Function criada, **não deployada** — pendência #16).

## 5. O que foi feito na sessão de 16/07 (issues #47–#63, todas fechadas)

**Rede de segurança contra "tela branca"** (#50/#52/#53)
- `ErrorBoundary` (classe nativa, sem dependência) em **dois níveis**: topo (`main.jsx`) e por tela (`Painel`, dentro da `<section key={secao}>` — se **uma** tela trava, o menu continua e dá pra sair navegando).
- `lib/erros.js` → tabela `erro_log` (`0035`): à prova de falha (o log nunca pode virar loop de erro) + trava anti-enxurrada (máx 10/sessão + dedupe) + captura de erros **fora do React** (`window.onerror`, promise sem catch).
- Tela **Erros** (admin, em *Administração*). O campo `componente` diz **qual tela** quebrou — como não há rotas, a URL sozinha não ajudaria.

**Perfil e avatares** (#47/#48/#49) — tela "Meu perfil" (foto + senha; `0034`), `<Avatar>` + `lib/avatar.js` em todas as telas, remover foto.

**Organização** (#55/#56) — tela **Administração** (agrupa Equipe + Erros; futuramente #18/#16); **Tema virou toggle** no Meu perfil (`Tema.jsx` apagado).

**Relatório mensal** (#62) — por vendedor → origem → clientes. Regras no **§18 do CLAUDE.md**.

**Fluxo/UX** — anexar após "enviado" com registro (#59), sheet de status com ícone+cor (#58), filtro por status (#60), "movida há X" + ordenar por atividade (#57), aviso de sem conexão (#54), aviso de nova versão (PWA), girar imagem, anexos múltiplos (#63), ícones no menu (#51), custo atrasado 5→3 dias (#61).

## 6. Decisões tomadas (e o porquê) — não re-litigar sem motivo novo

| Decisão | Por quê |
|---|---|
| **Sheet de status mantém os 2 toques** | Avaliamos trocar por 2 botões (fluxo × exceção). O dono concluiu que **o 2º toque É a confirmação** — perdê-la num "Marcar como enviado" sai caro. Só o visual mudou. |
| **Busca global: descartada** | A busca atual já casa código/tipo/cliente/obra/descrição. O ganho real era **~1 toque** (a Início está a 1 toque no nav). Não valia o código. |
| **Toast de erro: descartado** | Investigamos: **todas** as ações críticas já mostram erro inline — toast duplicaria a mensagem. (Só as ações de notificação são silenciosas, por serem otimistas.) |
| **Cores do sheet de status são FIXAS** | **Não** usar os tokens `--st-*`: eles mudam com o tema, e o sheet é **sempre navy** (`--marca-navy` só existe no `:root`). No tema escuro os botões sumiriam. |
| **"Atrasado" só em `nao_iniciado`/`em_andamento`** | Da revisão de custo em diante o alerta que importa é o **custo atrasado**. Nos demais status o prazo vencido vira `muito_urgente` (não perde o destaque). |
| **`ultima_atividade()` calcula na hora** | Em vez de coluna + gatilhos: sempre correto por construção, sem risco de desencontrar se entrar um tipo de atividade novo. Se a base crescer muito, migrar p/ coluna. |
| **Anexo pós-envio via GATILHO** | Inforjável + **bônus**: o comentário dispara a notificação existente → o vendedor é avisado na hora (mata o WhatsApp, §1). |
| **`perfil.oculto_relatorio` (flag)** | Em vez de filtrar por **nome** (quebra ao renomear) ou cravar **id** (número mágico). Data-driven, como o resto (§10). |
| **PDF via `window.print()` + `@media print`** | Zero dependência nova (§5). O projeto não tem lib de PDF e não vale adicionar. |
| **Relatório entrou por exceção ao §2** | Pedido do **gerente de vendas**; é de **volume**, não de tempo. `CLAUDE.md` atualizado (§2 revisto + §18) para spec e realidade não se desencontrarem. |

### Bugs encontrados sem ninguém pedir
Todos vieram de **investigar antes de codar** — vale manter o hábito:
1. **Regra de anexo vivia só no frontend** — a policy `anexo_saida_criar` não checava status nenhum. Contrariava o **§3**. Corrigido na `0038`.
2. **A #42 nunca foi aplicada no banco** — o app parou de contar "custo atrasado" fora da revisão, mas o job diário continuava notificando. Corrigido na `0039`.
3. **"Limpar tudo" dos filtros não limpava o vendedor** — a tag sobrevivia. Corrigido junto do #60.

> **Padrão:** regra de negócio que existe só no front **é uma brecha**. Ao mexer em permissão ou alerta, conferir sempre o par **front ↔ banco**.

## 7. ⏳ Pendências

- 🎨 **Dashboard** — o dono vai mandar os detalhes de como quer que fique. **Não começar sem eles.**
- 📝 **Da lista de melhorias sugeridas**, sobraram: *não perder formulário pela metade* (a "Nova demanda" perde tudo se tocar em voltar) e *export/backup dos dados*.
- 🗂️ **Backlog aberto:** #43 (documentação), #32 (co-vendedor), #29 (migrar demandas), #18 (tela de tipos), #17 (box de cor), #16 (cadastro in-app — Edge Function criada, **não deployada**).
- 🧹 **Limpeza de anexos de entrada antigos** (§14) — anexos de **saída** são permanentes.
- 📅 **Feriados no cálculo de prazo** (§8) — hoje só dias úteis seg–sex.

## 8. 🎯 Próximo passo
Aguardar os detalhes do **Dashboard** (é o pedido explícito do dono). Enquanto isso, a §1 (verificar `0036`/`0038`) é a coisa de maior valor e menor esforço.

## 9. ⚠️ Armadilhas do ambiente (economiza horas)

| Armadilha | O que fazer |
|---|---|
| **`npm run build` com o preview LIGADO** → `EINVAL: Unable to write the service worker file` | **Pare o preview antes de buildar.** Não é bug do código. |
| **Buffer do console não limpa** em navigate/reload | Um erro **fantasma** pode persistir e te fazer caçar um bug inexistente. Abra **aba nova** (`tabs_create`) para ter buffer limpo antes de concluir que o erro é real. |
| **HMR às vezes não re-renderiza** um componente | O DOM mostrava `multiple: false` com o arquivo **servido** já tendo `multiple: true`. Compare o DOM com `fetch('/src/.../X.jsx')` e **recarregue**. |
| **`read_network_requests` não captura cross-origin** | As chamadas ao `supabase.co` não aparecem. Para provar que uma chamada saiu, **intercepte `window.fetch`** na página. |
| **Screenshot trava** no preview | Verificar por **DOM/`getComputedStyle`** via `javascript_tool` (funciona bem e é mais preciso). |
| **Node fora do PATH** | `export PATH="/c/Program Files/nodejs:$PATH"`. |
| **`gh` fora do PATH** | Chamar por caminho completo: `C:/Program Files/GitHub CLI/gh.exe`. |
| **`git add <arqs> && git commit` commita TUDO que estiver staged** | Uma vez levou `deno.lock` + `criar-usuario` por engano (corrigido em `baa547b`). Use `git commit -m ... -- <paths>` quando houver outra coisa staged. |
| **Senha da conta de teste (`teste@gmail.com`) MUDA** | O dono a troca ao validar o Meu perfil. **Peça a atual** quando precisar validar tela logada — ele passa numa boa, e aí dá pra verificar de verdade em vez de só inspecionar código. |
| **PWA cacheia a versão antiga** | O app está em modo `prompt`: aparece "Nova versão disponível → Atualizar". Se parecer que o deploy "não pegou", quase sempre é cache — confira o bundle publicado antes de acusar o código. |
| **PostgREST: ambiguidade de embed** com >1 FK | Usar `tabela!fk_coluna` (ex.: `vendedor:perfil!vendedor_id(...)`, `autor:perfil!autor_id(...)`). |
| **Enum do Postgres** não permite remover valor facilmente | Por isso "concluído" virou legado em vez de removido. E `ALTER TYPE ... ADD VALUE` **não pode ser usado na mesma transação** em que é criado (foi o caso da 0030/0031). |

## 10. 🤝 Combinados de trabalho (além do §0 do CLAUDE.md)

- **Trabalho concluído → sempre registrar uma issue FECHADA** no GitHub, para o histórico (`gh issue create` + `gh issue close`, com o commit no corpo).
- **Ideia nova → confirmar ANTES** de criar a issue (propor título + label; criar só com o "ok").
- **A cada função nova que funcione + "ok" do dono → commit + push** (conferindo `git status` antes e `HEAD == origin/main` depois).
- **Migração é do dono:** ele roda no SQL Editor. Sempre dizer **o que quebra se não rodar** — e preferir que a ausência dela degrade **só a tela nova**, não o app (ex.: `MeuPerfil` busca `avatar_path` sozinho, fora do boot).

---

_Gerado por Claude Code em 16/07/2026 (HEAD `19228a2`)._
