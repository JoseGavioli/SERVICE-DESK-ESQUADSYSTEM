# CLAUDE.md — App de Controle de Demandas (EsquadSystem)

> Este arquivo é a fundação do projeto. Leia-o por completo antes de qualquer ação.
> Ele define **o que o app é**, **as regras de negócio** e **como você (Claude Code) deve trabalhar comigo**.

> **Status atual (jul/2026):** Fases 0–6 **concluídas** e app **no ar** (deploy na **Vercel**, CD ativo — push na `main` publica). Depois delas: **repaginação visual** (marca **EsquadSystem**, tema claro/escuro, PWA com ícone próprio), **"concluído" fora do fluxo** (§7) e um **sistema de notificações in-app em tempo real** (§15). Backend em Supabase; migrações `0001`–`0017` aplicadas. Pendências ativas em §17.

---

## 0. COMO VOCÊ DEVE TRABALHAR COMIGO (ler primeiro, vale para todas as fases)

Eu quero **entender cada parte do código**. Não quero um app que funciona mas que eu não sei explicar. Por isso:

1. **Uma fase por vez.** Nunca pule para frente. Não implemente a Fase 2 enquanto a Fase 1 não estiver aprovada por mim.
2. **Explique antes de codar.** Antes de escrever o código de uma fase, descreva em português: o que vai criar, quais arquivos, e por quê. Espere meu "ok".
3. **Explique depois de codar.** Depois de implementar, explique o que cada parte faz em linguagem acessível. Eu sei HTML/CSS/JS e Python, e estou **aprendendo React** — não assuma fluência em React.
4. **Trade-off na mesa.** Quando houver decisão técnica com mais de um caminho, apresente as opções e o trade-off **antes** de escolher. Não decida sozinho em silêncio.
5. **Código pequeno e legível vence código "esperto".** Prefira clareza a concisão. Evite dependências desnecessárias.
6. **Ambiguidade = pergunta.** Se algo nesta spec estiver incompleto ou ambíguo, pergunte antes de assumir. Não preencha lacunas com suposição.
7. **Marque pendências.** Quando esbarrar num ponto marcado como "pendência" ou "a decidir" neste arquivo, pare e me pergunte; não invente.

---

## 1. O PROBLEMA (por que este app existe)

Hoje, na EsquadSystem (esquadrias de alumínio), as demandas de orçamento chegam por WhatsApp. Resultado:
- o histórico se perde;
- só o atendente enxerga o quadro (hoje é um Kanban local de uso pessoal);
- o vendedor não acompanha o andamento do que pediu.

O app resolve isso com: **canal único de entrada, histórico permanente, visibilidade para o vendedor, e controle de estado por demanda.**

---

## 2. O QUE O APP **NÃO** É (escopo fechado)

Não é Jira/Movidesk. É uma ferramenta interna, enxuta, da EsquadSystem. **Não inclui** (nesta versão):
- notificação por WhatsApp;
- notificação por e-mail (fica para fase futura — ver §13);
- relatórios de métricas de tempo / dashboard de gestão;
- app nativo (é web/PWA);
- integração com o CEM (sistema de orçamento atual).

Mirar em features do Jira é o caminho para estourar o prazo. A spec sai do fluxo real da EsquadSystem, não de produtos de mercado.

---

## 3. STACK TÉCNICA

- **Frontend:** React + Vite. Responsivo (uso confortável no celular do vendedor). **PWA** (instalável na tela inicial do celular, sem loja, atualiza sozinho ao publicar nova versão).
- **Backend:** Supabase — Auth + Postgres + Row Level Security (RLS) + Storage.
- **Segurança:** RLS por papel é **obrigatória**. Nenhuma regra de permissão pode viver só no frontend. O banco é a fonte da verdade de quem pode ver/fazer o quê.
- **Hosting do frontend:** **Vercel** (decidido na Fase 0), com **deploy contínuo** — cada push na branch `main` publica automaticamente. As variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` ficam no painel da Vercel.

---

## 4. CONVENÇÕES DE CÓDIGO

- **Idioma dos identificadores de domínio:** **português** (`demanda`, `vendedor`, `obra`, `cliente`, `anexo`, `comentario`, `status`, `prazo`). Palavras-chave do framework permanecem em inglês (padrão). Motivo: meu objetivo central é **entender** o código.
  > [Decisão default — me avise se preferir tudo em inglês.]
- **Comentários no código:** em português, explicando o *porquê*, não o óbvio.
- **Um arquivo/componente por responsabilidade.** Sem arquivos gigantes. Se um componente passa de ~200 linhas, provavelmente deve ser quebrado.
- **RLS primeiro:** ao criar qualquer tabela, defina as policies de RLS junto, e me explique cada uma.

---

## 5. PAPÉIS E PERMISSÕES (3 papéis)

Hoje **eu ocupo Admin + Atendente** sozinho. Mesmo assim, modele os três papéis separadamente — no dia em que entrar um segundo orçamentista, nada precisa ser reescrito.

| Papel | O que pode fazer |
|---|---|
| **Admin** | Tudo do Atendente + cadastrar/editar vendedores, resetar senhas, **cancelar demandas** (efetivar o cancelamento) |
| **Atendente** | Mover demandas pelos status, comentar, anexar saída, criar/selecionar cliente e obra |
| **Vendedor** | Criar demanda, criar demanda-filha, anexar entrada, comentar, **solicitar** cancelamento. Vê **apenas as próprias demandas**. Não move status. |

**Regras-chave de permissão:**
- O vendedor **não move status. Nenhum.**
- Efetivar cancelamento é **exclusivo do Admin**.
- O vendedor vê só as demandas que ele mesmo criou (RLS por `vendedor_id`).
- O autor de uma demanda é **sempre** o usuário logado — não é possível forjar (garantido por RLS, não por checagem no frontend).

---

## 6. MODELO DE DADOS

> Descrição das entidades e relações. As tabelas e policies de RLS serão construídas **incrementalmente** nas Fases 0–1, com explicação de cada coluna. Não gere todo o SQL de uma vez.

### Autenticação
Login via **Supabase Auth**, baseado em **email + senha** (nativo do Supabase).
> [Decisão default a confirmar na Fase 1:] o "login" do vendedor **é o email**. Os campos `nome_completo` e `celular` ficam no perfil. Se eu quiser um username separado do email, decidimos na Fase 1 — mas o default é email-como-login, por ser o caminho nativo e mais simples.

### `perfil` (vinculado ao `auth.users` do Supabase)
- `id` (= id do usuário no Supabase Auth)
- `nome_completo`
- `celular`
- `papel` — enum: `admin` | `atendente` | `vendedor`
- `ativo` — boolean (desativar vendedor sem apagar histórico)
- `created_at`

### `cliente`
- `id`
- `nome`
- `observacoes` (opcional)
- `created_at`
- Relação: **um cliente tem N obras**.

### `obra`
- `id`
- `cliente_id` (FK → cliente)
- `nome` / identificação da obra
- `endereco` (opcional)
- `created_at`

### `tipo_demanda` (data-driven — ver §10)
- `id`
- `nome`
- `ativo` — boolean
- `created_at`

### `demanda`
- `id` (automático)
- `obra_id` (FK → obra) — o cliente é alcançado via obra → cliente
- `tipo_demanda_id` (FK → tipo_demanda)
- `vendedor_id` (FK → perfil) — **automático**, do usuário logado
- `descricao` — texto. **IMUTÁVEL após a criação** (ver §9)
- `prazo` — data (definida pelo vendedor)
- `status` — enum (ver §7). Nasce em `nao_iniciado`
- `demanda_pai_id` (FK → demanda, nullable) — vínculo de demanda-filha (ver §11)
- `created_at` — automático

> **A urgência NÃO é uma coluna.** Ela é **derivada do `prazo`** em tempo de exibição (ver §8).

**Campos preenchidos pelo VENDEDOR ao criar:** cliente, obra, tipo, descrição, prazo.
**Campos automáticos:** id, vendedor (do login), data de criação, status inicial.
> [Decisão default — me avise se quiser diferente:] o vendedor pode **criar** cliente/obra na hora de abrir a demanda, mas a tela deve **buscar os existentes primeiro** (search-first) para evitar duplicatas ("Casa Silva" vs "casa do silva"). Esse anti-duplicação é o motivo de cliente e obra serem entidades separadas.

### `comentario`
- `id`
- `demanda_id` (FK → demanda)
- `autor_id` (FK → perfil)
- `texto`
- `contexto` — nullable: `null` (comentário normal) | `solicitacao_cancelamento` | `mudanca_status`
- `created_at`

### `anexo`
- `id`
- `demanda_id` (FK → demanda)
- `autor_id` (FK → perfil)
- `tipo` — enum: `entrada` | `saida`
- `caminho_storage` — path no Supabase Storage
- `nome_original`
- `tamanho_bytes`
- `created_at`

### `historico_status`
- `id`
- `demanda_id` (FK → demanda)
- `de_status`
- `para_status`
- `autor_id` (FK → perfil)
- `comentario_id` (FK → comentario, nullable) — vincula a justificativa quando obrigatória
- `created_at`

---

## 7. MÁQUINA DE ESTADOS

```
nao_iniciado -> em_andamento -> em_revisao_custo -> concluido -> enviado [TERMINAL]
                     |                  | (volta)        | (volta)
                 congelado          em_andamento    em_andamento / em_revisao_custo

qualquer estado nao-terminal -> cancelada [TERMINAL, so Admin efetiva]
```

**Transições permitidas (e somente estas):**

| De | Pode ir para |
|---|---|
| `nao_iniciado` | `em_andamento` · `cancelada` |
| `em_andamento` | `em_revisao_custo` · `congelado` · `cancelada` |
| `congelado` | `em_andamento` · `cancelada` |
| `em_revisao_custo` | `concluido` · `em_andamento` · `cancelada` |
| `concluido` | `enviado` · `em_revisao_custo` · `em_andamento` · `cancelada` |
| `enviado` | — (terminal; qualquer continuação é demanda-filha — ver §11) |
| `cancelada` | — (terminal) |

**Regras da máquina de estados:**
- **Revisão de custo é obrigatória.** Não existe atalho `em_andamento → concluido`. (No caso raro de um orçamento já chegar revisado, o atendente passa pelo status mesmo assim antes de concluir.)
- `enviado` e `cancelada` são **terminais**: não retrocedem. Qualquer ação posterior vira **demanda-filha**, nunca reabertura. (Há um único caminho para cada resultado — isso mantém o histórico honesto.)
- **Congelar** só a partir de `em_andamento`; ao descongelar, **volta para `em_andamento`**.
- **Cancelamento** só é **efetivado** pelo Admin. O vendedor apenas **solicita** (ver §12).
- Apenas Atendente/Admin movem status. O vendedor nunca.

> **Atualização (pós-Fase 6, ajustes de UX):** o status `concluido` foi **removido do fluxo**. Hoje `em_revisao_custo` vai **direto para `enviado`** (o terminal de sucesso, exibido em verde). O valor `concluido` **permanece no enum** como **legado** — nenhuma demanda nova entra nele, mas demandas que já estavam nesse estado continuam válidas e podem ser movidas. Mudança **não destrutiva** (não mexe no enum nem no histórico). Ver migração `0013_concluido_fora_do_fluxo.sql`. O diagrama e a tabela acima refletem o desenho **original**; a regra "revisão de custo é obrigatória" continua valendo (ninguém pula de `em_andamento` direto para `enviado`).

---

## 8. URGÊNCIA (derivada do prazo — calculada, não armazenada)

A urgência **não é escolhida** pelo vendedor nem guardada no banco. É **calculada a partir de quantos dias úteis faltam até o `prazo`**, recalculada a cada exibição. Logo, ela muda sozinha com o passar do tempo.

| Nível | Regra (exemplo — a confirmar) |
|---|---|
| Tranquilo | faltam **mais de 3 dias úteis** |
| Pouco urgente | faltam **2 a 3 dias úteis** |
| Urgente | faltam **menos de 2 dias úteis** |
| Muito urgente | prazo **estourou** (data já passou) |

- **Dias = dias úteis (segunda a sexta).** O cálculo pula sábado e domingo.
- **Feriados são ignorados nesta versão** (pular feriado exigiria tabela de feriados com manutenção anual — fica para melhoria futura). Contorno operacional atual: em semana com feriado, o vendedor adiciona manualmente dias ao prazo.

> **PENDÊNCIA (resolver antes da Fase 3):** as fronteiras exatas ainda não estão fechadas. "3 dias certinhos" é Tranquilo ou Pouco urgente? "2 dias certinhos" é Pouco urgente ou Urgente? Vou alinhar com os vendedores. **Não chute os limites — pergunte quando chegar a Fase 3.**

---

## 9. DESCRIÇÃO IMUTÁVEL

A `descricao` da demanda é **congelada na criação**. **Não existe edição de descrição** — não construa botão nem tela de edição para ela.

Correções acontecem por dois caminhos já existentes:
- **Faltou um detalhe / pequena correção:** o vendedor (ou admin) adiciona um **comentário**. O histórico fica em ordem cronológica, com autor e data (automáticos).
- **Erro grave (demanda toda errada):** o vendedor **solicita o cancelamento** e cria uma nova. A decisão de "é grave o bastante para cancelar?" é **do vendedor**, não do sistema.

Motivo do design: a descrição vira o "pedido original, fiel ao que foi feito"; tudo que mudou vive nos comentários. Histórico completo sem tabela de versões.

---

## 10. TIPOS DE DEMANDA (data-driven)

Os tipos vivem na tabela `tipo_demanda` (banco), **não** chumbados no código. Assim, novos tipos são adicionados por uma tela de cadastro (Admin), **sem tocar em código**.

**Lista inicial (6):**
1. Orçamento novo
2. Revisão de orçamento
3. Fechamento
4. Adendo de obra fechada
5. Adendo de orçamento apresentado ao cliente
6. Orçamento novo para obra em andamento (novo contrato, mesmo cliente e obra)

> Ressalva: tipos são "rótulos" (nome + status ativo). Se um dia um tipo precisar de **comportamento** próprio (ex.: "fechamento obriga anexar contrato"), isso volta a exigir código. Para o uso atual, rótulo basta.

---

## 11. DEMANDA-FILHA (vínculos)

Toda continuação após `enviado` é uma **demanda nova vinculada à demanda-pai** (`demanda_pai_id`), **nunca** uma reabertura.

```
DEMANDA #12 (Orcamento novo) - obra "Casa Silva", vendedor Fabinho
   +- enviada ->
        +- DEMANDA #15 (Revisao de orcamento) -- demanda_pai_id = 12
        +- DEMANDA #20 (Fechamento)           -- demanda_pai_id = 12
```

Benefícios: cada ação tem sua própria data e status (histórico honesto); o app mostra a **árvore da obra** (quantos orçamentos, revisões, fechamentos). Reabrir status terminal é proibido — a filha é o único caminho.

---

## 12. CANCELAMENTO (fluxo)

1. Dentro da demanda há um botão **"Solicitar cancelamento"** (visível ao vendedor dono da demanda).
2. Ao clicar → tela de **confirmação** → **caixa de comentário obrigatória** com o motivo.
3. Isso cria um `comentario` com `contexto = solicitacao_cancelamento` e sinaliza a demanda como "cancelamento solicitado".
4. A solicitação **aparece para o Admin**, que então **efetiva** (ou não) o cancelamento.
5. O vendedor **nunca** cancela direto — só solicita. Manter simples; não transformar em fluxo de aprovação com múltiplas etapas.

---

## 13. COMENTÁRIO EM TRANSIÇÃO DE STATUS

- **Obrigatório** (o app não deixa avançar sem texto):
  - Congelar (por quê congelou)
  - Cancelar (motivo)
  - Toda **volta** (`em_revisao_custo → em_andamento`, `concluido → em_andamento`, `concluido → em_revisao_custo`)
- **Opcional** nos avanços normais (`nao_iniciado → em_andamento → em_revisao_custo → concluido → enviado`).

Motivo: comentário obrigatório só onde ele **significa** algo. Forçar justificativa no caminho feliz geraria "ok/feito" sem valor e poluiria o histórico.

---

## 14. ANEXOS

| Origem | Quem | Formatos | Limite |
|---|---|---|---|
| **Entrada** | Vendedor | Imagem (JPG/PNG) ou PDF | **≤ 2 MB** |
| **Saída** | Atendente | PDF (principal); outros formatos permitidos | (definir limite na Fase 4) |

- Storage: **Supabase Storage**. Referência de dimensionamento: ~4 anos de PDFs de orçamento da EsquadSystem ≈ 3 GB no total; só os artefatos de **saída** pesam pouco no dia a dia. O plano free (1 GB) comporta o início. Upgrade de plano amplia o storage **sem reescrever código**.
- Limites são configuração (fáceis de ajustar depois).
- **Pendência futura (não é Fase 1):** política de limpeza de anexos de **entrada** antigos para conter peso. Anexos de **saída** (orçamentos entregues) são permanentes — nunca expiram.

---

## 15. NOTIFICAÇÕES

- **Nesta versão (implementado — migrações `0015`–`0017`):** **sistema de notificações in-app em tempo real** (Supabase Realtime). Tabela `notificacao` preenchida por **gatilhos** no banco (à prova de forja), com regra **user-to-user**:
  - ação de **vendedor → atendente/admin**; ação de **staff → vendedor dono**;
  - **nunca** o próprio autor; um vendedor **nunca** recebe de outro vendedor.
  - Na interface: **sino no topo** com contador de não lidas; **tela de notificações** (cada item abre a demanda e marca como lida; "marcar todas como lidas" e **"limpar" com confirmação**); **pop-up (toast)** ao chegar algo novo; **descrição específica** do evento ("Fulano iniciou a demanda de Cliente").
  - A **Início** (contador de demandas em aberto) e os marcadores da lista (tag **"novidade"** + **💬 novo**) derivam **desse mesmo sistema**.
- **Fases futuras (registrado, fora do escopo atual):**
  1. **Push no sistema operacional** (notificação na barra do celular / Windows) via **Web Push** (VAPID + service worker + Edge Function). Ressalva: no iPhone só funciona com o **PWA instalado** (iOS 16.4+).
  2. **E-mail** automático na mudança de status (redundância caso o vendedor não veja o app). Mais simples que WhatsApp; sem burocracia.
  3. **WhatsApp** via API oficial (Cloud API). Exige homologação na Meta, número dedicado, templates aprovados e custo por mensagem — é projeto administrativo, não só técnico. **Não usar bibliotecas que automatizam o WhatsApp Web** (violam os termos e arriscam o número da empresa).

---

## 16. FASES DE IMPLEMENTAÇÃO

Cada fase é pequena o bastante para eu ler, entender e aprovar antes da próxima. No Claude Code eu vou pedir uma fase de cada vez.

| Fase | Entrega |
|---|---|
| **0** | Setup: projeto Supabase, estrutura do projeto React+Vite, schema base, autenticação funcionando. |
| **1** | Cadastros (vendedor, cliente, obra) + login + papéis + RLS por papel. Confirmar aqui a decisão login=email. |
| **2** | Demanda: criar, listar, ver detalhe. Status ainda simples (sem todas as transições). |
| **3** | Máquina de estados completa + histórico de status + comentários + cálculo de urgência. (Fechar as fronteiras de urgência aqui.) |
| **4** | Anexos no Storage (entrada e saída) com limites e formatos. |
| **5** | Demanda-filha (vínculos) + visão da árvore da obra. |
| **6** | Painéis e filtros (vendedor vê as próprias; atendente vê a fila) + notificação dentro do app + ajuste PWA. |

> **✅ Fases 0–6 concluídas** e no ar (Vercel). **Pós-Fase 6:** repaginação visual (design tokens claro/escuro, marca EsquadSystem, cards, ícone do PWA), **"concluído" fora do fluxo** (§7) e o **sistema de notificações in-app em tempo real** (§15) — evoluções de UX pedidas pelo dono, fora do plano original de fases.

**Fora de escopo (fase 7+):** push no SO (Web Push, celular/Windows), e-mail, WhatsApp, cadastro de usuário in-app (Edge Function `criar-usuario` já criada, **ainda não deployada**), relatórios de tempo, dashboard de gestão, integração com CEM, tabela de feriados, histórico de versões de texto, limpeza automática de anexos.

---

## 17. PENDÊNCIAS CONHECIDAS (pare e pergunte ao chegar nelas)

**Ainda em aberto:**
1. **Fronteiras exatas da urgência** (§8) — os limites hoje são **provisórios** (em `lib/urgencia.js`); falta alinhar com os vendedores o tratamento de "exatamente 2/3 dias".
4. **Limite de tamanho do anexo de saída** (§14) — a confirmar/ajustar (é só configuração).
6. **`perfil.ativo` na RLS** — um vendedor desativado ainda consegue agir; falta aplicar a checagem na RLS.
7. **Reset dos dados de teste** antes do lançamento real (apagar demandas/clientes/obras/comentários/histórico/anexos/notificações + arquivos do Storage + vendedor de teste; manter admin + 6 tipos). Só na virada — vira destrutivo com dados reais.
8. **Cadastro de usuários in-app** — Edge Function `criar-usuario` criada, **não deployada** (falta o deploy + o formulário na Equipe).
9. **Tela admin de tipos de demanda** — hoje os 6 tipos são semeados no banco.

**Já resolvidas:**
2. ~~Login = email ou username~~ → **email** (Supabase Auth nativo).
3. ~~Permissão de criar cliente/obra pelo vendedor~~ → **pode**, com **busca-primeiro** (anti-duplicata).
5. ~~Hosting do frontend~~ → **Vercel** (CD ativo).
