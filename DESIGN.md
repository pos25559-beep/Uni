# Unipedia v4 — Design System ("Estúdio Caderno Vivo Refinado")

## 1. Personalidade & Princípios Anti-Slop
A Unipedia ajuda estudantes em Portugal (Ensino Superior e Secundário) a planear, estudar e progredir com tranquilidade e energia positiva.
- **Direção visual (v4 Refinado)**: *Estúdio Caderno Vivo* — papel creme quente, tinta negra tátil, ritmo editorial (Display sans + Serif itálico), blocos coloridos de papelaria e mascotes simples e humanos, mantendo os stickers e formas pastel com prioridade de leitura acima da dobra no telemóvel.
- **Proibição de AI-Slop**:
  - **Zero roxo/índigo/violeta** no logo, acento primário ou modo escuro.
  - **Zero paredes infinitas de cartões brancos com borda** — alternar blocos pastel sem bordas pesadas (*color blocking*), listas limpas agrupadas (`ListGroup`) e bastante respiro entre secções.
  - **Zero `<select>` nativos do browser/OS** — todas as escolhas de opções usam `PillSelect` ou `Select` tátil (folha inferior no telemóvel, popover posicionado no desktop).
  - **Sem linguagem técnica ou de programador na UI**: zero jargão de ERP, zero emails/IDs reais hardcoded.

## 2. Paleta de Cores (WCAG AA)
### Superfícies & Tinta
| Token | Modo Claro (Papel Quente) | Modo Escuro (Grafite Quente) | Uso |
| :--- | :--- | :--- | :--- |
| `--bg` | `#FAF8F2` | `#141311` | Fundo principal da app |
| `--surface` | `#FFFFFF` | `#1E1C18` | Cartões limpos e listas |
| `--surface-2` | `#F2ECE1` | `#28241E` | Cápsulas inativas, inputs e separação suave |
| `--fg` | `#141312` | `#FAF6EC` | Texto principal e CTAs de tinta negra |
| `--muted` | `#5F5B54` | `#B5AFA4` | Subtítulos e metadados (`>= 4.5:1`) |
| `--line` | `#E6DFD3` | `#322D26` | Divisórias finas e contornos discretos |

### Acentos Floresta & Coral (Assinatura Unipedia)
| Token | Modo Claro | Modo Escuro | Uso |
| :--- | :--- | :--- | :--- |
| `--accent` | `#157F58` | `#4ADE80` | **Verde Floresta Caderno**: foco ativo, links, anéis, seleção |
| `--accent-soft` | `#DCF4EA` | `#173327` | Fundo suave de seleção e badges positivas |
| `--coral` | `#E04F33` | `#FF7A59` | **Coral Marcador**: urgência real, provas próximas, streak, marcador |
| `--coral-soft` | `#FDE8E2` | `#3A1F19` | Fundo suave de alertas urgentes |
| `--ink` | `#141312` | `#FAF6EC` | Botões primários ("Começar", dock flutuante) |

### Pastéis de Papelaria (Cadeiras, Bento & Baralho de Pastas)
Usados como superfícies coloridas com alto contraste (`#141312` em claro, tonalidades profundas em escuro):
- **Manteiga (`butter`)**: `#FCE99F` (escuro `#352D14`)
- **Salva (`sage`)**: `#C9DC9F` (escuro `#212E19`)
- **Menta (`mint`)**: `#BCEEE0` (escuro `#17312B`)
- **Céu (`sky`)**: `#C4E0FD` (escuro `#192A3D`)
- **Pêssego (`peach`)**: `#FAD6BA` (escuro `#382317`)
- **Rosa Papel (`blush`)**: `#F9C5BE` (escuro `#381E21`)

## 3. Tipografia & Escala Legível Universal
- **Famílias**:
  - Títulos & Display: `Bricolage Grotesque Variable`, sans-serif (`tracking: -0.025em`)
  - Ênfase Humana / Editorial: `Instrument Serif` (itálico dentro de títulos, ex: *"Estuda com calma"*)
  - Corpo & UI: `Geist Variable`, sans-serif
  - Números, horas, notas & datas curtas: `Geist Mono Variable` com `font-variant-numeric: tabular-nums`
- **Regra mínima v4**: todo o corpo, eyebrows, chips, dicas e metadados têm **`>= 12px`** (`text-xs` ou superior; `text-[11px]` permitido **exclusivamente** nos rótulos da dock móvel; **zero `text-[10px]`**).

## 4. Layout & Arquitetura dos Ecrãs
1. **Pré-login Editorial (`/bem-vindo`) & Entrada (`/entrar`)**: Carrossel de 5 slides em cores pastel quentes com preview de acessórios/cores do Uni e atalho imediato para entrar; balão do Uni em `/entrar` abre em popover sobreposto.
2. **Top Bar Humilde**: Saudação + avatar do **Uni** interativo à esquerda; ações circulares (`44×44px`) à direita.
3. **Dock Flutuante em Cápsula (Mobile)**: Barra arredondada (`rounded-[28px]`) flutuante acima da safe-area em `#141312` (`#24211D` em dark), com 5 destinos máximos (`Cadeiras`, `Plano`, `Hoje`, `Tutor`, `Mais`) e pílula ativa deslizante (`layoutId`).
4. **Blocos Lúdicos Refinados no Hoje (Prioridade acima da dobra)**:
   - No topo: Cabeçalho → 1 alerta contextual único (quando aplicável) + faixa fina de `Primeiros passos` após ≥ 2 ligados → Pulso do dia + **`Foco de hoje`** (`NotebookFocusSheet`) visível logo no 1.º ecrã no telemóvel.
   - Abaixo: `StickyTasksPad`, `AgendaRibbonCard`, `FolderCardDeck`, `AcademicGmailWidget`, `BentoMetricTile` 2×1 e `HighlightShapesGrid`.
5. **Companheiros Uni (`UniLivingOverlay`)**: No telemóvel ancorados exclusivamente em **bordas inferiores seguras acima da dock** (zero colisão com cabeçalhos ou texto); no desktop livres pelas margens externas.
6. **Cadeira (5 Abas) & Plano / Materiais Desktop**:
   - `CourseDetail` usa `SubpageHeader` v4 e 5 abas claras (`Visão & Regras`, `Matéria & Notas`, `Materiais`, `Horário`, `Tarefas`).
   - `Plano` expande para `max-w-7xl` no desktop (`4 cols` portátil / `7 cols` amplo).
   - `Materiais` usa largura total da biblioteca quando não existem Gemini Notebooks guardados.
7. **Controlos Táteis Personalizados**: Todos os seletores (`Select` e `PillSelect`) usam folha inferior no telemóvel ou popover estilizado no desktop, garantindo `44×44px` de toque.
8. **Definições & Privacidade**: Navegação das 5 categorias no topo em mobile seguida da personalização visual, com `ListGroup`/`ListRow` e `SubpageHeader`.

## 5. Motion, Ergonomia & Acesso
- **Alvos táteis**: `>= 44px × 44px` em botões, chips de filtro, checkboxes de linha, botões de fechar e controlos interativos tanto em touch como em desktop.
- **Motion (`motion/react` + `<MotionConfig reducedMotion="user">`)**:
  - Spring principal: `{ type: 'spring', stiffness: 380, damping: 24, mass: 0.85 }`.
  - Spring de ressalto: `{ type: 'spring', stiffness: 420, damping: 20 }`.
  - Feedback háptico discreto + confeti de papelaria apenas em conquistas reais.
- **Autenticação segura em Mobile/WebView**: Fluxo primário por **Email e Palavra-passe** (ou uso offline sem conta). Login Google estritamente opcional e nunca disparado automaticamente.
