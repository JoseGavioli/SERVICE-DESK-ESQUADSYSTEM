# 📋 Relatório de Handoff — Service Desk - EsquadSystem

**Data:** 01/07/2026 · **Branch:** `main` (sincronizada com `origin`) · **HEAD:** `f61c84b`

> Documento de continuidade. Para retomar: leia a seção 6 (pendências) e 7 (próximos passos).

---

## 1. O que é o projeto
App web interno da **EsquadSystem** (esquadrias de alumínio) para gerir **demandas de orçamento**, substituindo WhatsApp + Kanban local. Nome do sistema: **"Service Desk - EsquadSystem"** (tagline "Orçamentos & Revisões"). Regido pelo `CLAUDE.md` (§0): **uma fase por vez, explicar antes e depois, trade-offs na mesa, perguntar em vez de assumir, identificadores em português, RLS no banco, componentes pequenos.** O dono está **aprendendo React** e quer entender cada parte.

## 2. Stack e infraestrutura
- **Front:** React + Vite (JavaScript puro, sem TS). Navegação por **estado** (sem react-router). **PWA** (vite-plugin-pwa, autoUpdate).
- **Back:** **Supabase** (Auth e-mail/senha + Postgres + RLS + Storage + **Realtime**). Ref `lvjqrtjytysejbcqoqmf`.
- **Deploy:** **Vercel**, CD ativo — push na `main` publica sozinho. App no ar.
- **Git:** origin = github.com/JoseGavioli/Novo-Controle-de-Demandas-Jose-Gavioli.
- **Workflow de commit:** função nova que funciona + "ok" → commit + push (conferindo `HEAD == origin/main`). Mensagem via **arquivo** (`git commit -F`), pois here-string inline no PowerShell quebra com aspas.

## 3. Estado atual
- **Fases 0–6 completas** e no ar: login/papéis, cadastros (cliente/obra/equipe) com RLS por papel, demanda (criar/listar/detalhe), máquina de estados + histórico + comentários + urgência + cancelamento, anexos (Storage), demanda-filha (árvore, código 10/10.1/10.1.1), filtros, PWA.
- **Pós-Fase 6 (tudo commitado e no ar):** repaginação visual (design tokens claro/escuro), **sistema de notificações in-app em tempo real**, "concluído" fora do fluxo, e a **reforma de UI em andamento** (ver §4).

## 4. Reforma de UI (feita até agora)
| Commit | Tela | O que mudou |
|---|---|---|
| `613db0a` | Notificações | Sistema in-app + tempo real (sino, toast, tela, user-to-user, limpar) |
| `a6f56fa` | Início + marca | Painel de boxes por status; renomeia o app p/ "Service Desk - EsquadSystem" |
| `a888cbb` | Login | Logo losango + título completo + subtítulo "Orçamentos & Revisões" |
| `ca0accb` | Demandas (lista) | Remove "Nova demanda"; botão "Voltar" fixo no rodapé |
| `06c660a` | Navegação (casca) | Cabeçalho enxuto (☰ + nome da tela + 🔔); **menu lateral (drawer)** com marca + atalhos + **Tema** (tela claro/escuro) + Sair; remove BotaoTema |
| `f61c84b` | Início (dashboard) | Container "Dashboard"; boxes de status com **fundo gradiente** na cor do status; congelado→amarelo, em revisão de custo→lilás; filtro Enviado ordena por mais recente; botão "incluir nova demanda" |

**Detalhes úteis da UI:**
- Navegação mora na **casca** (`Painel.jsx`) → mudar lá vale p/ todas as telas. `MenuLateral.jsx` (drawer) e `Tema.jsx` (tela) são novos.
- Início → Demandas passa **filtro/criar** via `Painel` (`filtroInicial` / `criarInicial` / `abrirDemandasComFiltro` / `abrirNovaDemanda`); a Demandas aplica no `useEffect`. Sort "mais recente" = `ordenarRecente` em `calcularLista`.
- Boxes de status: cor via CSS vars inline `--c` (forte) e `--cbg` (claro) + gradiente com `color-mix` (fallback sólido).
- "Enviado" aparece como **"Recebido"** só p/ vendedor (título da box).

## 5. Migrações (0001–0017, todas aplicadas)
0001 perfil · 0002 cliente_obra · 0003 equipe · 0004 demanda (enum status) · 0005 comentario · 0006 maquina_estados (mover_status) · 0007 perfil_staff_visivel · 0008 solicitar_cancelamento · 0009 anexos · 0010 demanda_filha · 0011 visualizacao · 0012 notificacoes · 0013 concluido_fora_do_fluxo · 0014 novidade_ignora_proprias_acoes · 0015 notificacoes_sistema · 0016 notificacao_descritiva · 0017 notificacao_delete.

> **Sistema de notificações:** tabela `notificacao` (destinatario/autor/demanda/tipo/lida/de_status/para_status) preenchida por **gatilhos** (à prova de forja). Regra **user-to-user** via `destinatarios_notif`: vendedor→staff; staff→vendedor dono; nunca o autor; vendedor nunca de outro vendedor. Realtime em `notificacao` e `demanda`. A tag "novidade" e o badge derivam das notificações não lidas.

## 6. ⏳ Pendências
- 👤 **Cadastro de usuários in-app (admin):** Edge Function `supabase/functions/criar-usuario/index.ts` **criada, NÃO deployada**. Falta: deploy pelo painel Supabase (Edge Functions → Via Editor, nome `criar-usuario`) + formulário na tela Equipe (`supabase.functions.invoke('criar-usuario', ...)`). Senha: admin define a inicial (sem SMTP). **Não commitado ainda.**
- 🎨 **Telas ainda a reformular:** **Detalhe da demanda** (densa), **Nova demanda**, **Clientes/Obras**, **Equipe**.
- 📱 **Push no SO** (celular/Windows) — "Fase B" das notificações (Web Push: VAPID + Edge Function + service worker; iPhone só com PWA instalado).
- 🚦 **Urgência definitiva** — limites provisórios em `lib/urgencia.js` (TRANQUILO_MIN=4, URGENTE_MAX=1); alinhar com os vendedores.
- 🔒 **`perfil.ativo` na RLS** — vendedor desativado ainda consegue agir.
- 🗂️ **Tela admin de tipos de demanda** (hoje os 6 são semeados).
- 🧹 **Reset de dados de teste** na virada (apagar demandas/clientes/obras/comentários/histórico/anexos/notificações + Storage + vendedor de teste; manter admin + 6 tipos). Destrutivo — só na hora.
- _(opcional)_ Logo colorido; "concluído" com roxo distinto do "em revisão de custo" (hoje compartilham o lilás; concluído é legado).

## 7. 🎯 Próximo passo
Continuar a reforma de UI. Sugestão: **Detalhe da demanda** (a tela mais densa). Depois: Nova demanda, Clientes/Obras, Equipe. O dono prioriza.

## 8. ⚠️ Notas de ambiente / armadilhas
- **Node fora do PATH** no harness → usar `.claude/launch.json` (node.exe por caminho completo).
- **Commit:** mensagem via arquivo (`-F`); here-string inline no PowerShell quebra.
- **Verificação do front:** o preview headless roda com **viewport ~1–3px** (resize não pega) e **screenshot trava** → usar `preview_snapshot` + `preview_logs` + `preview_eval` (medir via `getComputedStyle`). Telas **logadas** não dá pra ver se a sessão do preview estiver deslogada (sem credenciais do teste) — o dono valida no navegador dele.
- **PWA service worker cacheia o `index.html`** → título da aba / ícone / às vezes CSS aparecem "antigos" no preview e no app publicado até o SW renovar (próxima visita / hard-refresh / reinstalar o PWA). Não é bug: o arquivo está certo.
- **PostgREST:** ambiguidade de embed com >1 FK → `tabela!fk_coluna` (ex.: `vendedor:perfil!vendedor_id(...)`, `autor:perfil!autor_id(...)`).
- **Enum do Postgres** não permite remover valor facilmente (por isso "concluído" virou legado em vez de removido).

---

_Gerado por Claude Code em 01/07/2026 (HEAD f61c84b)._
