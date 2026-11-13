---
name: unipedia-motion-ux
description: Regras oficiais de UI/UX, layout, motion, ergonomia Android e acessibilidade da Unipedia baseadas no sistema Estúdio Caderno Vivo (v3). Usar ao desenhar ou evoluir qualquer ecrã, onboarding ou componente tátil.
---

# Unipedia v3 — Estúdio Caderno Vivo & Motion UX

## 1. Direção de Marca e Anti-Slop
- **Propósito**: Ajudar estudantes do Ensino Superior e Secundário em Portugal a estudar com calma, ritmo e clareza.
- **Paleta oficial (Zero roxo/índigo AI-slop)**:
  - Papel Quente (`#FAF8F2`) no claro · Grafite Quente (`#141311`) no escuro.
  - Tinta Negra (`#141312` claro · `#FAF6EC` escuro) para CTAs principais e dock flutuante.
  - Verde Floresta Caderno (`#157F58` claro · `#4ADE80` escuro) + Coral Marcador (`#E04F33` claro · `#FF7A59` escuro).
  - Pastéis de Papelaria (`Manteiga`, `Salva`, `Menta`, `Céu`, `Pêssego`, `Rosa Papel`) em blocos coloridos sem bordas pesadas.
- **Anti-Slop na prática**:
  - Alternar ritmo visual (Cartão Hero pastel + Bento 2x1 `Ver ->` + Tira de dias + Listas nativas `ListGroup`/`ListRow` + Baralho empilhado `FolderCardDeck`).
  - Zero dados pessoais hardcoded, zero jargão técnico na interface, e sem modo de demonstração falso.

## 2. Física & Catálogo de Motion (`motion/react`)
- Wrapper obrigatório: `<MotionConfig reducedMotion="user">` em `App.tsx`.
- **Spring Estúdio**: `{ type: 'spring', stiffness: 360, damping: 28, mass: 0.9 }`.
- **Assinaturas aprovadas**:
  - `layoutId` em pílulas da dock flutuante (`mobile-dock-pill`), `SegmentedControl`, indicadores do onboarding e CTA circular -> cápsula (`onboarding-cta`).
  - Transição `clipPath` expansiva ao concluir o onboarding.
  - Abertura tátil em leque no `FolderCardDeck` e *stickers* inclinados (`-4deg` / `+3deg`).
  - Celebração pontual com `canvas-confetti` nas cores de papelaria apenas ao fechar meta diária ou onboarding.

## 3. Ergonomia Android / Capacitor & WCAG AA
- Alvo tátil mínimo: **`44px × 44px`** em todos os botões (`pointer: coarse` inclui `button`), inputs e linhas clicáveis (`ListRow >= 52px`).
- Tipografia mínima em mobile: **`12px`** (evitar `text-[10px]`); números sempre em `font-mono tabular-nums`.
- Dock flutuante em cápsula: máximo 5 destinos (`Hoje`, `Cadeiras`, `Plano`, `Tutor`, `Mais`), respeitando `env(safe-area-inset-bottom)`.
- Autenticação primária via Email/Palavra-passe (`/entrar`) ou uso local sem conta; nunca auto-disparar Google Auth em WebView.
