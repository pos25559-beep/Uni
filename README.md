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
| CLIP (NOVA FCT) | Copiar a página do Horário e colar na app (ou carregar o `.html`) | Sem API pública; exames à mão |
| Google Agenda / Drive | OAuth no browser, só leitura (precisa de um Client ID teu) | Por testar com conta real |
| OneDrive | MSAL no browser, só leitura (precisa de um Client ID teu) | Por testar com conta real |
| Gemini | Chave da API guardada só no browser | Por testar com chave real |
| NotebookLM | Links por cadeira | Sem API pública |

Os passos de configuração de cada fonte estão na própria página de Definições.

## Dados e privacidade

Não há servidor. Tudo fica no `localStorage` do browser (chave `uni-erp-v1`),
incluindo a chave do Gemini. A cópia de segurança exportada não inclui a chave.

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
