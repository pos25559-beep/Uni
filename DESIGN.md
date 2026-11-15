# Unipedia v4 — Design System ("Estúdio Caderno Vivo Refinado")

## 1. Personalidade & Princípios Anti-Slop
A Unipedia ajuda estudantes em Portugal (Ensino Superior e Secundário) a planear, focar, praticar matéria real e medir retenção com tranquilidade.
- **Direção visual (v4 Refinado)**: *Estúdio Caderno Vivo* — papel creme quente, tinta negra tátil, ritmo editorial (Display sans + Serif itálico), blocos coloridos de papelaria e mascotes discretos (Uni & micropets), mantendo leitura prioritária acima da dobra no telemóvel.
- **Proibição de AI-Slop & Portão `ui-guard`**:
  - **Zero roxo/índigo/violeta** no logo, acento primário ou modo escuro.
  - **Zero paredes de cartões repetitivos**: alternar superfícies pastel sem bordas pesadas (*color blocking*), listas agrupadas (`ListGroup`) e métricas inline dentro das superfícies existentes (em vez de empilhar novos cartões no dashboard).
  - **Zero `<select>` ou `<input type="date|time">` nativos**: todas as escolhas usam `Select` / `PillSelect` e pickers táteis top-layer (folha inferior com gesto *swipe-to-dismiss* no telemóvel, popover no desktop).
  - **Sem jargão técnico na UI**: copy natural de caderno/estudo, sem IDs ou linguagem de sistema expostos ao aluno.

## 2. Paleta de Cores (WCAG AA)
### Superfícies & Tinta
| Token | Modo Claro (Papel Quente) | Modo Escuro (Grafite Quente) | Uso |
| :--- | :--- | :--- | :--- |
| `--bg` | `#FAF8F2` | `#141311` | Fundo principal da app |
| `--surface` | `#FFFFFF` | `#1E1C18` | Cartões limpos, gráficos e folhas |
| `--surface-2` | `#F2ECE1` | `#28241E` | Cápsulas inativas, inputs e separação suave |
| `--fg` | `#141312` | `#FAF6EC` | Texto principal e CTAs de tinta negra |
| `--muted` | `#5F5B54` | `#B5AFA4` | Subtítulos e metadados (`>= 4.5:1`) |
| `--line` | `#E6DFD3` | `#322D26` | Divisórias finas e contornos discretos |

### Acentos Floresta & Coral (Assinatura Unipedia)
| Token | Modo Claro | Modo Escuro | Uso |
| :--- | :--- | :--- | :--- |
| `--accent` | `#157F58` | `#4ADE80` | **Verde Floresta Caderno**: foco ativo, retenção positiva, links, anéis, seleção |
| `--accent-soft` | `#DCF4EA` | `#173327` | Fundo suave de seleção e badges positivas |
| `--coral` | `#E04F33` | `#FF7A59` | **Coral Marcador**: urgência real, revisões em risco, provas próximas, streak |
| `--coral-soft` | `#FDE8E2` | `#3A1F19` | Fundo suave de alertas urgentes |
| `--ink` | `#141312` | `#FAF6EC` | Botões primários e dock flutuante |

### Pastéis de Papelaria
Superfícies coloridas com alto contraste (`#141312` em claro, tonalidades profundas em escuro):
- **Manteiga (`butter`)**: `#FCE99F` (escuro `#352D14`)
- **Salva (`sage`)**: `#C9DC9F` (escuro `#212E19`)
- **Menta (`mint`)**: `#BCEEE0` (escuro `#17312B`)
- **Céu (`sky`)**: `#C4E0FD` (escuro `#192A3D`)
- **Pêssego (`peach`)**: `#FAD6BA` (escuro `#382317`)
- **Rosa Papel (`blush`)**: `#F9C5BE` (escuro `#381E21`)

## 3. Tipografia & Escala Legível Universal
- **Famílias**:
  - Títulos & Display: `Bricolage Grotesque Variable`, sans-serif (`tracking: -0.025em`)
  - Ênfase Humana / Editorial: `Instrument Serif` (itálico dentro de títulos, ex.: *"Estuda com calma"*)
  - Corpo & UI: `Geist Variable`, sans-serif
  - Números, horas, percentagens & datas curtas: `Geist Mono Variable` com `font-variant-numeric: tabular-nums`
- **Regra mínima v4 (verificada por `node scripts/ui-guard.mjs --strict`)**: todo o texto UI usa **`>= 12px`** (`text-xs` ou superior; rótulos da dock permitem `12px`; **zero `text-[10px]` / `text-[11px]`**).

## 4. Arquitetura Visual dos Ecrãs & Fluxos
1. **Pré-login Editorial (`/bem-vindo`) & Entrada (`/entrar`)**: Carrossel de boas-vindas em cores pastel quentes com pré-visualização das paletas/cores do Uni e login simples por Email ou Google (opcional).
2. **Dock Flutuante em Cápsula (Mobile)**: Barra arredondada flutuante acima da `safe-area` (`Cadeiras`, `Plano`, `Hoje`, `Tutor`, `Mais`) com pílula ativa deslizante (`layoutId`).
3. **Hoje (`/`)**: Pulso diário + `Foco de hoje` visível logo acima da dobra no telemóvel (incluindo sugestões de revisão/manutenção em dias de descanso quando há plano ativo), seguido de `Notas & Tarefas`, `As tuas pastas`, `Agenda de hoje`, `Correio académico` e `Destaques de hoje`.
4. **Diário do Uni & Check-ins (`UniDiarySheet`)**: Layout conversacional com separadores rápidos (*Aula*, *Dia*, *Semana*, *Teste*), rascunho persistido em `localStorage` e resumo estruturado aplicado ao gerador de planos.
5. **FocusTimer & Escudo Anti-distração**: Ecrã imersivo com anel circular, cartões de saída honesta (*"Bem-vindo de volta"* quando regressa após `>= 2s`), painel colapsável de som ambiente/escudo e conclusão direta com **Prática Real (`ActivePracticeDeck`)**.
6. **Prática Real & Revisão SRS (`ActivePracticeDeck` / `ActiveReviewModal`)**: Cartões de pergunta/resposta com revelação tátil, 3 botões claros de avaliação (`Rever já`, `Com esforço`, `Dominei`), criação manual `+ Novo cartão` offline e fila prioritária de revisão espaçada acessível no `Plano` (`Rever devidos`), `TopicsTab` (`Praticar`) e `Progresso`.
7. **Gráficos & Retenção (`Progresso`)**: Todos os gráficos usam `ChartCard`, `ChartTooltip` e tokens de `chartStyle.ts` (zero sombras pesadas ou gradientes artificiais), incluindo `Retenção & Qualidade de Foco` com métricas de foco limpo e até 3 prioridades acionáveis.
8. **Tour & Guias Contextuais**: Cartões-guia de 1.ª visita (`TabGuideBanner`) e tour `driver.js` responsivo ao viewport móvel.

## 5. Motion, Ergonomia & Verificação Automática
- **Alvos táteis**: `>= 44px × 44px` em botões, chips, seletores de tópico e controlos de fecho; folhas inferiores suportam *swipe-to-dismiss* sem botões redundantes.
- **Motion (`motion/react` + `<MotionConfig reducedMotion="user">`)**:
  - Spring principal: `{ type: 'spring', stiffness: 380, damping: 24, mass: 0.85 }`.
  - Feedback háptico nativo discreto (`@capacitor/haptics`) e confeti apenas em conquistas reais.
- **Garantia contínua**: cada alteração passa por `npm run check` (`tsc`, `oxlint`, `ui-guard --strict`, `vitest`, `vite build`) e `npm run a11y:smoke` (`axe-core` WCAG 2 AA + overflow `360px` / `390px` / `1440px`).
