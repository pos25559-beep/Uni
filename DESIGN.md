---
name: Unipedia
description: Caderno Editorial & Geométrico Vivo — instrumento de estudo tátil, claro e escuro, com cor para progresso e cadeiras, números em mono tabular.
colors:
  light:
    bg: "#faf8f5"
    surface: "#ffffff"
    surface-2: "#f3efe7"
    line: "#e5dfd3"
    fg: "#111318"
    muted: "#5f6470"
    accent: "#4f46e5"
    accent-fg: "#ffffff"
    accent-soft: "#eef0ff"
    ink-cta: "#111318"
    ink-cta-fg: "#ffffff"
    ok: "#15803d"
    warn: "#b45309"
    danger: "#dc2626"
  dark:
    bg: "#0b0d12"
    surface: "#131720"
    surface-2: "#1b202c"
    line: "#272d3d"
    fg: "#f6f5f1"
    muted: "#9ca3af"
    accent: "#818cf8"
    accent-fg: "#0b0d12"
    accent-soft: "#1f2442"
    ink-cta: "#f6f5f1"
    ink-cta-fg: "#0b0d12"
    ok: "#4ade80"
    warn: "#fbbf24"
    danger: "#f87171"
typography:
  display: { family: "Bricolage Grotesque Variable", use: "h1 e cabeçalhos hero", tracking: "-0.025em" }
  editorial: { family: "Instrument Serif", use: "ênfase itálica pontual em headlines de onboarding/hero" }
  body: { family: "Geist Variable", size: "14px", lineHeight: 1.5 }
  mono: { family: "Geist Mono Variable", use: "notas, médias, horas, minutos, percentagens, contagens" }
  scale: [11, 12, 14, 16, 20, 26, 34]
radius: { control: "12px", card: "18px", pill: "9999px" }
spacing: { unit: "4px", card-padding: "20px", section-gap: "24px" }
elevation: "tátil por contraste de papel, borda 1px #E5DFD3/#272D3D e acento semântico"
motion: { library: "motion/react", spring: "stiffness 380, damping 32", reducedMotion: "user" }
---

# Unipedia — DESIGN.md

Este ficheiro define o sistema de design oficial da **Unipedia**, uma marca focada em ajudar estudantes universitários e do ensino secundário a organizar o percurso escolar, estudar melhor e progredir com confiança.

## 1. Direção: Caderno Editorial & Geométrico Vivo

- **Personalidade tátil**: superfícies inspiradas em papel editorial quente (`#FAF8F5`) no modo claro e obsidiana profunda (`#0B0D12`) no modo escuro, com bordas limpas de 1px e zero sombras pesadas.
- **Assinatura cromática**: Índigo Elétrico (`#4F46E5` / `#818CF8`) para foco interativo, progresso e ação primária; cartões Bento e cadeiras recebem fundos pastel controlados semânticos com contraste mínimo `4.5:1`.
- **Tipografia com carácter**: `Bricolage Grotesque` nos títulos principais combinada com `Instrument Serif` em itálico pontual para palavras de ênfase emocional (*"Domina o teu semestre"*), `Geist` para interface e `Geist Mono` (`tabular`) para todos os dados numéricos.

## 2. Acessibilidade & Ergonomia Mobile

- Contraste mínimo WCAG 2.1 AA (`4.5:1` em texto normal, `3:1` em títulos grandes e ícones funcionais).
- Navegação mobile estrita em **5 destinos etiquetados** (`Hoje`, `Cadeiras`, `Plano`, `Assistente`, `Mais`) com pílula ativa animada via `layoutId`.
- Alvos táteis ≥ `44px`, respeitando `env(safe-area-inset-*)` e `--keyboard-height`.
- Motion com `<MotionConfig reducedMotion="user">`: fluido, direto e desligado automaticamente quando o sistema pede redução de movimento.

## 3. Grafismos & Arte Original

- Todas as ilustrações de onboarding e ícones da marca provêm da pasta **`Unipedia Brand`** criada no Canva (`canva_canva`) ou de SVG geométrico original Unipedia (`src/components/brand/UnipediaMarks.tsx`), sem copiar ilustrações externas.

## 4. Transparência & RGPD Europeu

- Qualquer funcionalidade de IA (Tutor Gemini, OCR de prints escolares) exige consentimento explícito (`aiConsent`) e exibe nota de transparência **EU AI Act**.
- Portabilidade total em JSON (`DataCard`) e eliminação definitiva de conta/dados acessíveis na app e em URL público (`/privacidade`, `/termos`, `/eliminar-conta`).
