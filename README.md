# Service Desk — EsquadSystem

Aplicativo web (PWA) interno da **EsquadSystem** (esquadrias de alumínio) para
**controle das demandas de orçamento**. Substitui o fluxo por WhatsApp por um
**canal único de entrada**, com **histórico permanente**, **visibilidade para o
vendedor** e **controle de estado por demanda**.

> **Status:** no ar (deploy contínuo na Vercel). Fases 0–6 concluídas + reforma
> visual completa (marca EsquadSystem, tema claro/escuro, PWA) + notificações
> in-app em tempo real.

A especificação completa (regras de negócio, decisões e convenções) vive em
[`CLAUDE.md`](CLAUDE.md) — **este README é o resumo prático**; o `CLAUDE.md` é a
fonte da verdade.

---

## Sumário

- [O problema](#o-problema)
- [Funcionalidades](#funcionalidades)
- [Papéis e permissões](#papéis-e-permissões)
- [Stack técnica](#stack-técnica)
- [Como rodar localmente](#como-rodar-localmente)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Banco de dados e migrações](#banco-de-dados-e-migrações)
- [Máquina de estados](#máquina-de-estados)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Scripts](#scripts)
- [Deploy](#deploy)
- [PWA](#pwa)
- [Convenções de código](#convenções-de-código)
- [Backlog](#backlog)

---

## O problema

Hoje as demandas de orçamento chegam por WhatsApp. Resultado: o histórico se
perde, só o atendente enxerga o quadro, e o vendedor não acompanha o andamento
do que pediu. O app resolve isso concentrando tudo numa ferramenta interna e
enxuta — **não é um Jira/Movidesk**, é o fluxo real da EsquadSystem.

## Funcionalidades

- **Demandas de orçamento** com tipo, descrição (imutável), prazo e status.
- **Máquina de estados** com transições controladas e **histórico** de cada
  mudança (ver [Máquina de estados](#máquina-de-estados)).
- **Urgência derivada do prazo** (calculada em dias úteis, muda sozinha com o
  tempo) — 5 níveis, do "sem urgência" ao "atrasado".
- **Alerta de custo atrasado** (demanda parada em revisão de custo).
- **Clientes e obras** com busca‑primeiro (anti‑duplicata).
- **Demanda‑filha**: toda continuação após "enviado" é uma nova demanda
  vinculada à demanda‑pai (nunca reabertura), com visão em árvore.
- **Anexos** no Storage: entrada (vendedor) e saída (atendente), com limites e
  formatos por tipo.
- **Comentários** por demanda, com comentário obrigatório nas transições que
  exigem justificativa (congelar, cancelar, "voltas").
- **Cancelamento em duas etapas**: o vendedor *solicita*, o admin *efetiva*.
- **Notificações in‑app em tempo real** (Supabase Realtime): sino com contador,
  tela de notificações, toast, e marcadores de "novidade" na lista — preenchidas
  por **gatilhos no banco** (à prova de forja), com regra *user‑to‑user*.
- **Dashboard (Resumo)** acionável: atenção, em aberto, por status (anéis), por
  urgência e por vendedor — cada widget abre a lista já filtrada.
- **PWA** instalável, **tema claro/escuro** e layout responsável (mobile‑first).

## Papéis e permissões

Três papéis, modelados separadamente (hoje uma pessoa acumula Admin + Atendente).
As permissões são garantidas no **banco (RLS)**, não só no frontend.

| Papel | O que pode fazer |
|---|---|
| **Admin** | Tudo do Atendente + cadastrar/editar a equipe, ativar/desativar membros e **efetivar cancelamentos**. |
| **Atendente** | Mover demandas pelos status, comentar, anexar saída, criar/selecionar cliente e obra. |
| **Vendedor** | Criar demanda e demanda‑filha, anexar entrada, comentar, **solicitar** cancelamento. Vê **apenas as próprias** demandas. Não move status. |

> Um usuário **desativado** (`perfil.ativo = false`) não consegue agir (RLS) nem
> entrar (bloqueio no login).

## Stack técnica

- **Frontend:** [React 19](https://react.dev) + [Vite](https://vite.dev)
  (JavaScript, sem TypeScript). Navegação por **estado** (sem react‑router).
- **Backend:** [Supabase](https://supabase.com) — Auth (email + senha),
  Postgres, **Row Level Security (RLS)**, Storage e Realtime.
- **Ícones:** [lucide‑react](https://lucide.dev) via um wrapper `Icone`.
- **PWA:** [`vite-plugin-pwa`](https://vite-pwa-org.netlify.app) (auto‑update).
- **Lint:** [oxlint](https://oxc.rs).
- **Hospedagem:** [Vercel](https://vercel.com) com deploy contínuo.

## Como rodar localmente

Pré‑requisitos: **Node.js** (LTS) e **npm**, e um **projeto Supabase** com as
migrações aplicadas (ver [Banco de dados](#banco-de-dados-e-migrações)).

```bash
# 1. Instalar as dependências
npm install

# 2. Configurar o ambiente
cp .env.example .env.local
#    edite o .env.local com a URL e a anon key do SEU projeto Supabase

# 3. Rodar em desenvolvimento (http://localhost:5173)
npm run dev
```

## Variáveis de ambiente

Ficam em `.env.local` (nunca vai pro Git). No Vite, toda variável exposta ao
frontend **precisa** começar com `VITE_`. Os valores vêm de
**Supabase → Project Settings → API**.

| Variável | Descrição |
|---|---|
| `VITE_SUPABASE_URL` | URL do projeto Supabase. |
| `VITE_SUPABASE_ANON_KEY` | Chave pública (anon/publishable). É segura no frontend — quem protege os dados é a **RLS**. |

Em produção, as mesmas variáveis são configuradas no **painel da Vercel**.

## Banco de dados e migrações

O schema e a RLS são construídos por **migrações SQL** versionadas em
[`supabase/migrations/`](supabase/migrations), numeradas em ordem
(`0001` … `0025`). Não há CLI de migração no fluxo atual: cada arquivo é
**colado e rodado no SQL Editor do Supabase**, **em ordem**.

- Cada migração começa com um cabeçalho explicando o que faz e como aplicar.
- **RLS‑first:** toda tabela nasce com suas policies. A lógica sensível
  (mover status, solicitar/descartar cancelamento) vive em **funções no banco**
  (`security definer`), que são a fonte da verdade.
- Entidades principais: `perfil`, `cliente`, `obra`, `tipo_demanda`, `demanda`,
  `comentario`, `anexo`, `historico_status`, `notificacao`.

Existe também uma **Edge Function** (`supabase/functions/criar-usuario`) para o
cadastro de usuários in‑app — **criada, ainda não deployada** (ver
[Backlog](#backlog)).

## Máquina de estados

```
nao_iniciado → em_andamento → em_revisao_custo → enviado [TERMINAL]
                    │                 │ (volta)
                congelado         em_andamento

qualquer estado não‑terminal → cancelada [TERMINAL, só o Admin efetiva]
```

- `enviado` e `cancelada` são **terminais** (não retrocedem); qualquer
  continuação vira **demanda‑filha**.
- **Revisão de custo é obrigatória** (não existe atalho de `em_andamento` direto
  para `enviado`).
- **Congelar** só a partir de `em_andamento`; descongelar volta para
  `em_andamento`.
- O status `concluido` existe no enum como **legado** (fora do fluxo novo).

Detalhes e a tabela completa de transições estão em [`CLAUDE.md`](CLAUDE.md) §7.

## Estrutura do projeto

```
├── src/
│   ├── App.jsx                # raiz: sessão → BoasVindas/Login ou Painel
│   ├── App.css                # estilos do app (usa os design tokens)
│   ├── main.jsx               # bootstrap do React (o PWA é injetado pelo plugin)
│   ├── components/
│   │   ├── Painel.jsx         # casca do app logado (navegação por "secao")
│   │   ├── MenuLateral.jsx · BottomNav.jsx · Login.jsx · BoasVindas.jsx · Tema.jsx
│   │   ├── Demandas.jsx       # lista + filtros + busca (a "Início")
│   │   ├── NovaDemanda.jsx · DetalheDemanda.jsx · LinhaTempoStatus.jsx
│   │   ├── AcoesStatus.jsx · Cancelamento.jsx · SeloUrgencia.jsx · FiltrosDemandas.jsx
│   │   ├── Dashboard.jsx      # tela "Resumo" (widgets acionáveis)
│   │   ├── Clientes.jsx · ObrasDoCliente.jsx · SeletorCliente.jsx · SeletorObra.jsx
│   │   ├── Equipe.jsx · LinhaPerfil.jsx
│   │   ├── Anexos.jsx · CarrosselEntrada.jsx · Lightbox.jsx
│   │   ├── Comentarios.jsx · HistoricoStatus.jsx
│   │   ├── Notificacoes.jsx · ToastNotificacao.jsx
│   │   └── Icone.jsx · EstadoVazio.jsx
│   ├── lib/
│   │   ├── supabase.js        # cliente Supabase (lê as VITE_*)
│   │   ├── status.js · transicoes.js   # rótulos e transições de status
│   │   ├── urgencia.js        # cálculo de urgência + custo atrasado (dias úteis)
│   │   ├── anexos.js          # validação/upload de anexos
│   │   ├── useNotificacoes.js # hook de notificações (Realtime + toast)
│   │   └── notificacaoTexto.js
│   └── index.css              # design tokens (paleta, tema claro/escuro)
├── supabase/
│   ├── migrations/            # 0001…0025 — rodar no SQL Editor, em ordem
│   └── functions/criar-usuario/   # Edge Function (não deployada)
├── public/                    # ícones do PWA, manifest assets
├── CLAUDE.md                  # especificação / fonte da verdade
└── BACKLOG.md                 # espelho do backlog (ver Backlog)
```

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (Vite + HMR). |
| `npm run build` | Build de produção em `dist/`. |
| `npm run preview` | Serve o build de produção localmente. |
| `npm run lint` | Roda o oxlint. |

## Deploy

- Hospedado na **Vercel**, conectado ao GitHub, com **deploy contínuo**: cada
  push na branch `main` **publica automaticamente**.
- As variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` ficam no painel da
  Vercel.
- As **migrações** e o deploy de **Edge Functions** são feitos à parte, no
  Supabase (não são disparados pela Vercel).

## PWA

Instalável na tela inicial (sem loja) e com **auto‑update** ao publicar uma nova
versão. Ícone próprio da marca EsquadSystem. No iPhone, notificações push
futuras (fora do escopo atual) exigem o **PWA instalado** (iOS 16.4+).

## Convenções de código

- **Identificadores de domínio em português** (`demanda`, `vendedor`, `obra`,
  `cliente`, `anexo`, `comentario`, `status`, `prazo`).
- **Um arquivo/componente por responsabilidade**; clareza acima de esperteza.
- **RLS primeiro**: nenhuma permissão vive só no frontend — o banco é a fonte da
  verdade de quem pode ver/fazer o quê.
- **Zero dependências desnecessárias**.

Mais detalhes (incluindo como o projeto é conduzido) em [`CLAUDE.md`](CLAUDE.md).

## Backlog

O backlog é rastreado em **GitHub Issues** e espelhado em
[`BACKLOG.md`](BACKLOG.md). Itens fora do escopo atual incluem: cadastro de
usuários in‑app (Edge Function pronta, falta deploy + formulário), push no
sistema operacional (Web Push), e‑mail na mudança de status, tela admin de tipos
de demanda e o reset dos dados de teste antes do lançamento.

---

_Projeto interno da EsquadSystem — uso privado._
