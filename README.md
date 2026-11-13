# Unipedia

Companheiro académico acolhedor e tátil para estudantes do Ensino Superior e Secundário em Portugal: organiza horário, plano de estudo diário, cadeiras, apontamentos, progresso e o **Uni**, o tutor com personalidade própria movido a Gemini.

React 19 · Vite · TypeScript · Tailwind v4 · Motion · Capacitor Android · Firebase Auth & Firestore · Zustand · Recharts.

## Correr localmente

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`. Na primeira visita, a Unipedia apresenta o carrossel editorial de boas-vindas (`/bem-vindo`), seguido do ecrã de acesso (`/entrar`) e do onboarding em 4 passos para configurar o curso e o ritmo semanal.

## Ecrãs principais

| Ecrã | Para quê |
|---|---|
| Bem-vindo (`/bem-vindo`) | Pré-login editorial em 4 slides com benefícios do ecossistema Google e experimentação dos visuais do Uni por área |
| Entrar (`/entrar`) | Acesso por Email/Palavra-passe, Google opcional ou modo local no dispositivo, com o Uni interativo |
| Hoje | Saudação com o Uni dinâmico, resumo do dia, mosaico de destaques pastel, caderno pautado de foco, bloco post-it de tarefas, agenda e postal de correio académico (`.eml` ou Gmail) |
| Cadeiras | Pastas coloridas por disciplina, matéria por tópicos, notas, avisos e regras |
| Plano | Blocos de estudo diários em tira semanal (`SEG`–`DOM`) com temporizador de foco |
| Tutor | Chat em *streaming* e multimodal (texto, fotos e PDFs) com o **Uni Nativo** (Firebase AI Logic `gemini-4-hydrogen` / `gemini-2.5-flash` + App Check, 15 msgs + 3 cadernos/dia sem precisar de chave), 3 personalidades (`Amigo`, `Exigente`, `Anti-stress`) e **Caderno do Uni** com citações |
| Materiais | Biblioteca local e atalhos para Drive, OneDrive, Gemini Notebook, PDFs e apontamentos offline |
| Calendário | Aulas, avaliações e prazos |
| Progresso | Horas por dia, sequência (*streak*) e prontidão para provas |
| Definições | Conta (`/entrar`), tema (`Sistema / Claro / Escuro`), acessório e personalidade do Uni, Uni Nativo / Avançado (AI Studio opcional), Gemini Notebook e centro RGPD |

## Privacidade & Autenticação

- **Modo Local (por omissão)**: tudo fica guardado no dispositivo (`localStorage` / WebView Android), sem rastreadores publicitários nem dados fictícios de demonstração — incluindo acesso ao **Uni Nativo** dentro da quota diária gratuita (15 mensagens + 3 gerações de caderno/dia).
- **Conta & Cloud Opcional (`/entrar`)**: fluxo principal por **Email e Palavra-passe** ou **Google Sign-In** no Firebase Auth + Cloud Firestore (`/users/{userId}` sob regras estritas em [firestore.rules](firestore.rules)). Ao iniciar sessão com conta Google, Drive, Calendário e Email são associados automaticamente sem fluxos repetidos; para testes offline de avisos é possível importar ficheiros `.eml` reais diretamente no cartão **Correio Académico**.
- **Ativação do Uni Nativo no Firebase**: para chamadas reais em produção sem chave pessoal, ativar **Firebase AI Logic** (`GoogleAIBackend`), **Firebase App Check** e registar o Web App ID no projeto `campus-erp-84964`. Para uso ilimitado, os utilizadores podem colar opcionalmente uma chave própria do Google AI Studio em **Definições → Uni · Tutor IA → Avançado**.
