# Backlog — Service Desk · EsquadSystem

Fonte única de ideias, melhorias e problemas do app. A gente vai riscando
conforme faz.

**Regra do roteiro:** _estrutura antes do visual_ (não pintar parede que vai
mudar de lugar); e, dentro do visual, definir a "cara" primeiro e depois
aplicar tela por tela.

**Legenda:** ✅ no plano · 🤔 a avaliar · 💤 adiado · ⏳ ação sua (Supabase) · 💡 sugestão

---

## 🔧 A. Estrutura & Funcional
- [ ] ✅ **A1 — Unificar Início + Demandas**: Início vira a lista (já visível); a dashboard vira uma tela "Resumo" no menu; some o botão "Voltar".
- [ ] ✅ **A2 — Obra opcional**: sem obra escolhida, achar-ou-criar "obra de {cliente}" (a demanda continua sempre tendo uma obra).
- [ ] 💡 **Editar o prazo** da demanda, com registro no histórico (prazos mudam; a descrição continua imutável, o prazo é operacional).
- [ ] 💡 **Atalho "Precisam de atenção"**: 1 toque lista atrasadas + custo-atrasado + cancelamento solicitado.

## 🎨 B. Visual (tirar o "bruto")
- [ ] ✅ **B0 — Definir a cara** a partir das imagens de referência (cores, tipografia, espaçamento, cards, botões).
- [ ] ✅ **B1** — aplicar na casca + Início (lista) + Resumo.
- [ ] ✅ **B2** — tela da **Demanda aberta** (ideia 4).
- [ ] ✅ **B3** — tela de **Clientes** (ideia 5).
- [ ] 💡 **Ícones de verdade** no lugar dos emojis (🔔 🆕 ⏰ → set tipo Tabler) — maior ganho de "cara profissional".
- [ ] 💤 **Logo/ícone do app** (4 conceitos desenhados: janela, janela no losango, monograma ES, janela-balão).

## 🔔 C. Notificações
- [ ] ⏳ **Rodar `0020` + habilitar pg_cron** — destrava as notificações por tempo já implementadas (prazo vencido / custo atrasado).
- [ ] 💡 **Aviso "prazo se aproximando"** (vence hoje/amanhã), não só vencido.
- [ ] 💡 **"Há X dias em revisão de custo"** no detalhe da demanda.
- [ ] 💤 **Push no celular** (Web Push) — médio; iPhone só com o PWA instalado (iOS 16.4+).
- [ ] 💤 **E-mail** na mudança de status — alternativa mais simples que push.

## ⚙️ D. Admin & Config
- [ ] 💤 **Cadastro de usuários in-app** (Edge Function `criar-usuario` pronta; falta deploy + formulário na Equipe).

## 🤔 A avaliar (você está decidindo)
- [ ] **Box de cor na nova demanda** (revisão/fechamento perguntam se a cor mudou). Dúvida: pode ajudar ou virar passo que atrapalha; hoje a cor cabe na descrição.
- [ ] **Tela admin de tipos de demanda** (CRUD dos tipos, só admin, sem mexer no banco). Prioridade baixa — os 6 tipos cobrem os casos.
- [ ] 💡 **(mobile) anexar direto da câmera** — foto da medição na obra na hora. Esforço mínimo.
- [ ] 💡 **Skeleton no carregamento + telas vazias amigáveis** — polimento visual.

---

## 🐞 Problemas conhecidos / a verificar
- [ ] Altura da `.caixa-lista` (folga do botão "Voltar") é estimativa (10rem/11rem) — conferir no app; a ideia **A1** remove o "Voltar" e muda isso.
- [ ] Notificações por tempo só disparam após `0020` + pg_cron.
- [ ] `perfil.ativo` não é checado na RLS (vendedor desativado ainda consegue agir).
- [ ] Visual de urgência / custo-atrasado ainda a conferir logado (validação sua).

## 🧰 Pré-lançamento
- [ ] **Reset dos dados de teste** (demandas/clientes/obras/comentários/histórico/anexos/notificações + arquivos do Storage + vendedor de teste; manter admin + 6 tipos).
- [ ] Limite do anexo de saída (a confirmar).
- [ ] (futuro) feriados na urgência; WhatsApp (Cloud API).
