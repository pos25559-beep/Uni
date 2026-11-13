# Unipedia v3 — Design System ("Estúdio Caderno Vivo")

## 1. Personalidade & Princípios Anti-Slop
A Unipedia ajuda estudantes em Portugal (Ensino Superior e Secundário) a planear, estudar e progredir com tranquilidade e energia positiva.
- **Direção visual**: *Estúdio Caderno Vivo* — papel creme quente, tinta negra tátil, ritmo editorial (Display sans + Serif itálico), blocos coloridos de papelaria e mascotes simples e humanos.
- **Proibição de AI-Slop**:
  - **Zero roxo/índigo/violeta** no logo, acento primário ou modo escuro.
  - **Zero paredes infinitas de cartões brancos com borda** — alternar blocos pastel sem bordas pesadas (*color blocking*), listas limpas agrupadas (`ListGroup`) e bastante respiro entre secções.
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

## 3. Tipografia & Escala Legível Mobile
- **Famílias**:
  - Títulos & Display: `Bricolage Grotesque Variable`, sans-serif (`tracking: -0.025em`)
  - Ênfase Humana / Editorial: `Instrument Serif` (itálico dentro de títulos, ex: *"Estuda com calma"*)
  - Corpo & UI: `Geist Variable`, sans-serif
  - Números, horas, notas & datas curtas: `Geist Mono Variable` com `font-variant-numeric: tabular-nums`
- **Regra mínima mobile**: corpo e metadados legíveis **`>= 12px`** (permitido `11px` apenas em legendas da dock inferior; **zero `text-[10px]`**).

## 4. Layout & Arquitetura dos Ecrãs
1. **Pré-login Editorial (`/bem-vindo`) & Entrada (`/entrar`)**: Carrossel de apresentação em cores pastel quentes (`#FAD6BA`, `#C4E0FD`, `#FCE99F`) com atalho imediato para criar conta ou entrar; em `/entrar`, o balão do Uni abre em popover sobreposto para manter o rodapé legal sempre visível.
2. **Top Bar Humilde**: Saudação + avatar do **Uni** interativo à esquerda; no máximo 2 ações circulares (`44x44px`) à direita.
3. **Dock Flutuante em Cápsula (Mobile)**: Barra arredondada (`rounded-[28px]`) flutuante acima da safe-area em `#141312` (`#24211D` em dark), com 5 destinos máximos (`Hoje`, `Cadeiras`, `Plano`, `Tutor`, `Mais`) e pílula ativa deslizante (`layoutId`).
4. **Blocos Lúdicos de Papelaria no Hoje**: Hero colorido (`Color Block`) -> Grelha Bento 2x1 (`Ver ->`) -> Mosaico orgânico (`HighlightShapesGrid`) -> Caderno pautado (`NotebookFocusSheet`), post-it amarelo (`StickyTasksPad`), fita pêssego (`AgendaRibbonCard`) e postal azul-céu (`AcademicGmailWidget`) ao lado do baralho empilhado de pastas (`FolderCardDeck`).
5. **Uni com Acessórios & Personalidade**: O componente `UniBuddy` adapta o visual por área do conhecimento (`math`, `tech`, `health`, `arts`, `science`, `humanities`, `default`) automaticamente ou por escolha em Definições, moldando também o tom de tutor no **Tutor** (`Amigo`, `Exigente`, `Anti-stress`) e o **Caderno do Uni**.
6. **Controlos Táteis Personalizados**: Seletores importantes (como filtro de cadeira no Tutor) usam `PillSelect` em vez de menus nativos crus do browser.
7. **Definições & Privacidade**: Lista agrupada nativa (`ListGroup`/`ListRow`) com sub-ecrãs limpos (`SubpageHeader`) e cartão **"A tua privacidade em 30 segundos"**.

## 5. Motion, Ergonomia & Acesso
- **Alvos táteis**: `>= 44px × 44px` obrigatórios em todos os botões, inputs, checkboxes de linha, pílulas e controlos (`@media (pointer: coarse)` inclui explicitamente `button`).
- **Motion (`motion/react` + `<MotionConfig reducedMotion="user">`)**:
  - Spring principal: `{ type: 'spring', stiffness: 360, damping: 28, mass: 0.9 }`.
  - Onboarding com indicadores morfáveis, botão `>` que morfa em pílula `Começar`, transição expansiva `clipPath`, orbitadores suaves e *stickers* inclinados (`-4deg` / `+3deg`).
  - Feedback háptico discreto + mini-confeti nas cores de papelaria apenas em conquistas reais (fechar meta diária ou concluir onboarding).
- **Autenticação segura em Mobile/WebView**: Fluxo primário por **Email e Palavra-passe** (ou uso offline sem conta). Login Google estritamente opcional e nunca disparado automaticamente.
