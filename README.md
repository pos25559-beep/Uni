# Unipedia

Companheiro académico acolhedor e tátil para estudantes do Ensino Superior e Secundário em Portugal: organiza horário, plano de estudo diário, cadeiras, apontamentos, progresso e um Tutor IA focado no teu programa.

React 19 · Vite · TypeScript · Tailwind v4 · Motion · Capacitor Android · Zustand · Recharts.

## Correr localmente

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`. Ao iniciar pela primeira vez, a Unipedia guia-te num onboarding curto para configurar o teu curso e ritmo semanal.

## Ecrãs principais

| Ecrã | Para quê |
|---|---|
| Hoje | Resumo editorial do dia, aula seguinte, foco diário, tarefas e pastas das cadeiras |
| Cadeiras | Pastas coloridas por disciplina, matéria por tópicos, notas e regras |
| Plano | Blocos de estudo diários em tira semanal (`SEG`–`DOM`) com temporizador de foco |
| Tutor | Chat com a Gemini IA focado no teu semestre (mediante consentimento explícito) |
| Materiais | Biblioteca local e links (Drive, OneDrive, NotebookLM, CLIP, PDFs offline) |
| Calendário | Aulas, avaliações e prazos |
| Progresso | Horas por dia, streak e prontidão para provas |
| Definições | Conta (`/entrar`), tema (`Sistema / Claro / Escuro`), ligações e centro RGPD |

## Privacidade & Autenticação

- **Modo Local (por omissão)**: tudo fica guardado no dispositivo (`localStorage` / WebView Android), sem rastreadores publicitários.
- **Conta & Cloud Opcional (`/entrar`)**: fluxo principal por **Email e Palavra-passe** no Firebase Auth + Cloud Firestore (`/users/{userId}` sob regras estritas em [firestore.rules](firestore.rules)). Ligações Google (Drive / Calendário / Gmail) são estritamente opcionais e iniciadas apenas pelo utilizador.
