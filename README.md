# Campus

"ERP" pessoal para a faculdade: junta horário, avaliações, matéria, materiais e
plano de estudo num só sítio, para saber todos os dias o que estudar e como
está a correr o semestre.

React 19 · Vite · TypeScript · Tailwind v4 · Zustand · Recharts.

## Correr

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`. A app arranca com dados de demonstração; em
**Definições → Dados** podes apagá-los.

## Páginas

| Página | Para quê |
|---|---|
| Hoje | Foco do dia, alerta da avaliação mais urgente, agenda, tarefas |
| Cadeiras | Matéria por tópicos, notas, nota necessária para o objetivo, horário |
| Calendário | Aulas, avaliações, estudo e eventos em mês / semana / agenda |
| Plano de estudo | Gera um plano de 14 dias e tem temporizador de foco |
| Progresso | Gráficos: horas por dia, planeado vs. feito, notas, pontos fracos |
| Materiais | Biblioteca de ficheiros e links (Drive, OneDrive, NotebookLM, CLIP) |
| Assistente | Chat com o Gemini, com o contexto do semestre |
| Definições | Perfil, semestre e ligação das fontes de dados |

## Fontes de dados

| Fonte | Como entra | Estado |
|---|---|---|
| Firebase / Cloud Firestore | Sincronização em tempo real na nuvem por utilizador | Ativo (`campus-erp-84964`) |
| Google Sign-In (Firebase Auth) | 1 clique na barra lateral (com scopes Drive e Calendar) | Ativo |
| Google Agenda / Drive | OAuth integrado via Google Sign-In ou Client ID | Ativo |
| Gemini IA (`gemini-3.8-flash`) | Chave do projeto por omissão ou chave própria nas Definições | Ativo |
| CLIP (NOVA FCT) | Copiar a página do Horário e colar na app (ou carregar o `.html`) | Sem API pública; exames à mão |
| OneDrive | MSAL no browser, só leitura (precisa de um Client ID teu) | Por testar com conta real |
| NotebookLM | Links por cadeira | Sem API pública |

Os passos de configuração de cada fonte estão na própria página de Definições.

## Dados e privacidade

A app suporta dois modos:
1. **Modo Cloud (Firebase)**: Ao entrar com a conta Google, os teus dados de estudo (cadeiras, tarefas, sessões, horários) e as conversas com o Gemini são guardados e sincronizados em tempo real no Cloud Firestore sob `/users/{userId}`, com regras de segurança estritas ([firestore.rules](firestore.rules)).
2. **Modo Local**: Sem início de sessão, tudo permanece no `localStorage` do browser (`uni-erp-v1`).

## Estrutura

```
src/
  types.ts            contrato de dados
  store/useStore.ts   estado (Zustand + persistência)
  lib/                selectors, gerador de plano, cores, dados de demonstração
  integrations/       Google, OneDrive, Gemini, CLIP, iCalendar
  components/         kit de UI e componentes por página
  pages/              uma página por rota
DESIGN.md             regras de design (ler antes de mexer na interface)
```

## Design

As regras de aspeto estão em [DESIGN.md](DESIGN.md): monocromático, modo branco
e modo escuro, cor só para dados, números em mono.
