# Unipedia

Companheiro académico acolhedor e tátil para estudantes do Ensino Superior e Secundário em Portugal: organiza horário, plano de estudo semanal, blocos de foco com escudo opcional, revisão espaçada com prática real nos apontamentos, progresso e o **Uni**, o tutor com personalidade própria movido a Gemini.

React 19 · Vite 8 · TypeScript · Tailwind CSS v4 · Motion · Capacitor 8 (Android) · Firebase Auth, Firestore & AI Logic · Zustand · Recharts · Vitest.

**App em produção:** https://campus-erp-84964.web.app

---

## Loop central de estudo

1. **Planear (`Plano` & `Diário do Uni`)**: gera blocos semanais ajustados às datas de avaliação, disponibilidade real e foco declarado nos check-ins de *Aula*, *Dia*, *Semana* ou *Modo Teste*.
2. **Focar sem distrações (`FocusTimer` + Escudo opcional)**: temporizador em anel com recuperação automática caso o ecrã recarregue, som ambiente (*chuva* / *ruído branco* Web Audio), Wake Lock, ecrã inteiro e, em Android nativo, modo *Não Incomodar* (`ACCESS_NOTIFICATION_POLICY`) e *App Pinning* opcionais.
3. **Praticar matéria real (`ActivePracticeDeck` & SRS)**: no fim de cada bloco (ou diretamente via `Rever devidos` / botão `Praticar` em cada tópico), gera 3–5 cartões de revisão a partir dos PDFs, slides ou testes carregados + notas recentes do Diário (ou permite criar cartões offline `+ Novo cartão`).
4. **Medir retenção (`Progresso`)**: calcula retenção estimada por tópico e por cadeira (decaimento SRS + acerto real em prática + sequência de *recall*), destaca tópicos frágeis acionáveis e mede a limpeza das sessões no Modo Foco.

---

## Scripts de desenvolvimento & qualidade

```bash
npm install
npm run dev          # Servidor local em http://localhost:5173
```

Portas automáticas de verificação (`npm run check` corre todas em sequência):

```bash
npm run check        # tsc -b --noEmit + oxlint + ui-guard --strict + vitest + vite build
npm run test         # Testes unitários Vitest (planner, selectors, SRS, practiceEngine, focusShield, check-ins)
npm run guard:ui     # Valida regras anti-slop e tipografia mínima (>= 12px) em src/
npm run a11y:smoke   # Smoke Playwright + axe-core WCAG 2 AA + deteção de overflow em 8 rotas × 3 viewports
npm run android:sync # Build web + npx cap sync android
```

---

## Ecrãs principais

| Ecrã | Para quê |
|---|---|
| Bem-vindo (`/bem-vindo`) | Carrossel editorial com benefícios do ecossistema, pré-visualização de paletas e visuais do Uni |
| Entrar (`/entrar`) | Acesso por Email/Palavra-passe, Google Sign-In opcional ou modo 100% local no dispositivo |
| Hoje (`/`) | Saudação com o Uni e estado diário, pulso da semana, cartão **Foco de hoje**, bloco **Notas & Tarefas**, baralho de pastas das cadeiras, agenda, avisos académicos (`.eml` / Gmail) e check-ins do **Diário do Uni** |
| Cadeiras (`/cadeiras`, `/cadeiras/:id`) | Pastas por disciplina com 5 separadores (*Visão & Regras*, *Matéria & Notas*, *Materiais*, *Horário*, *Tarefas*), etiqueta de retenção estimada por tópico e botão `Praticar` |
| Plano (`/plano`) | Tira semanal (`SEG`–`DOM`), criador de plano personalizado, `FocusTimer` com Escudo Anti-distração, atalho `Rever devidos (N)` e check-in semanal |
| Tutor (`/assistente`) | Chat em *streaming* multimodal (texto, imagens e PDFs) com `gemini-3.8-flash` (fallback `gemini-3.5-flash-lite` / `gemini-3.1-flash-lite`) via **Firebase AI Logic**, 3 personalidades e anexos colapsáveis |
| Materiais (`/materiais`) | Biblioteca local e atalhos para Google Drive, OneDrive, NotebookLM, PDFs e apontamentos offline usados na prática ativa |
| Calendário (`/calendario`) | Horário de aulas, eventos e avaliações sincronizáveis |
| Progresso (`/progresso`) | Anel de progresso geral, retenção média, revisões devidas, coleção de Unies, gráficos de estudo/prontidão, **Retenção & Qualidade de Foco** e histórico do Diário do Uni |
| Definições (`/definicoes`) | Perfil académico, paletas do caderno, notificações locais, integrações, chave Gemini opcional e centro RGPD (`/privacidade`, `/termos`, `/eliminar-conta`) |

---

## Privacidade, Segurança & Firebase

- **Modo Local (por omissão)**: os dados permanecem no dispositivo (`localStorage` / WebView Android), sem rastreadores publicitários nem analytics comportamental.
- **Conta & Cloud Opcional (`/entrar`)**: sincronização em `/users/{uid}` no Cloud Firestore sob validação estrita em [firestore.rules](firestore.rules) (incluindo limites de campos para sessões de foco, cartões de prática e histórico do Diário).
- **IA com consentimento explícito**: as chamadas ao Gemini só acontecem quando `aiConsent` está ativo — nativamente via **Firebase AI Logic** com **Firebase App Check** (com quota diária conservadora) ou usando uma chave pessoal opcional do Google AI Studio em **Definições → Uni · Tutor IA → Avançado**.
- **Android Focus Shield (`FocusShieldPlugin`)**: opcional e inteiramente local; utiliza apenas APIs oficiais do Android (*Do Not Disturb* via `ACCESS_NOTIFICATION_POLICY` restaurado automaticamente ao terminar/fechar a app, e *Lock Task / App Pinning* do sistema), sem serviços de Acessibilidade nem VPN local.
