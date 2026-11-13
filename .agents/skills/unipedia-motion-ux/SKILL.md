---
name: unipedia-motion-ux
description: Regras oficiais de UI/UX, motion, ergonomia Android e acessibilidade da Unipedia baseadas no sistema Caderno Editorial & Geométrico Vivo. Usar ao desenhar ou evoluir qualquer ecrã, onboarding ou componente tátil.
---

# Unipedia Motion & UX Guide

## 1. Direção de Marca e Personalidade
- **Propósito**: Ajudar estudantes do Ensino Superior e Secundário em Portugal a estudar com clareza e progredir no semestre.
- **Linguagem visual**: *Caderno Editorial & Geométrico Vivo*.
  - Papel quente (`#FAF8F5`) no modo claro; Obsidiana (`#0B0D12`) no modo escuro.
  - Acento assinatura: Índigo Elétrico (`#4F46E5` claro / `#818CF8` escuro).
  - Cor de cadeira como dado tátil (superfície pastel com contraste mínimo WCAG AA `4.5:1`).
- **Proibição anti-slop**: Nunca copiar desenhos/ilustrações de apps externas; usar apenas grafismos originais Unipedia (Canva `Unipedia Brand` + SVG geométrico próprio). Sem glassmorphism decorativo genérico, sem sombras difusas pesadas, sem textos em inglês na UI PT-PT.

## 2. Física & Orçamento de Motion (`motion/react`)
- **Wrapper obrigatório**: `<MotionConfig reducedMotion="user">` na raiz de `App.tsx`.
- **Presete Spring Tátil**:
  - Cartões / Navegação: `{ type: 'spring', stiffness: 380, damping: 32, mass: 0.9 }`
  - Pressão de botão (`whileTap`): `{ scale: 0.97 }` em botões/chips táteis.
  - `layoutId` para pílulas ativas (`mobile-nav-pill`, filtros, tabs).
- **Regra de ouro**: Máximo 1 foco principal animado por ecrã; nada abana em repouso.

## 3. Ergonomia Android / Capacitor & WCAG AA
- Barra inferior mobile: máximo **5 destinos** com ícone + rótulo (`Hoje`, `Cadeiras`, `Plano`, `Assistente`, `Mais`).
- Alvos táteis mínimos: `44px × 44px`.
- Safe Areas & Teclado: usar `env(safe-area-inset-top)`, `env(safe-area-inset-bottom)` e `var(--keyboard-height, 0px)`.
- Números, notas, médias, horas e datas curtas sempre em `font-mono tabular`.
