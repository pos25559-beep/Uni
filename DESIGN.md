---
name: Campus
description: Instrumento de estudo monocromático — modo branco e modo escuro, números em mono, cor só para dados.
colors:
  light:
    bg: "#ffffff"
    surface: "#ffffff"
    surface-2: "#f4f4f5"
    line: "#e4e4e7"
    fg: "#0a0a0a"
    muted: "#6b6b70"
    accent: "#0a0a0a"
    accent-fg: "#ffffff"
    accent-soft: "#ededee"
    ok: "#1a7f46"
    warn: "#9a6700"
    danger: "#c62828"
  dark:
    bg: "#0a0a0a"
    surface: "#121212"
    surface-2: "#1c1c1c"
    line: "#2a2a2a"
    fg: "#f5f5f5"
    muted: "#a0a0a0"
    accent: "#f5f5f5"
    accent-fg: "#0a0a0a"
    accent-soft: "#262626"
    ok: "#5fc28a"
    warn: "#e0a84a"
    danger: "#f2796f"
typography:
  display: { family: "Bricolage Grotesque Variable", use: "apenas h1 de página", tracking: "-0.02em" }
  body: { family: "Geist Variable", size: "14px", lineHeight: 1.5 }
  mono: { family: "Geist Mono Variable", use: "todos os números, horas, notas, datas curtas" }
  scale: [11, 12, 14, 16, 24, 32]
radius: { control: "8px", card: "10px", pill: "9999px" }
spacing: { unit: "4px", card-padding: "20px", section-gap: "24px" }
elevation: "nenhuma — hierarquia por borda de 1px e contraste de superfície"
motion: { duration: "220ms", easing: "ease-out", rule: "só para explicar mudança de estado" }
---

# Campus — DESIGN.md

Este ficheiro é a fonte de verdade do aspeto da app. Segue o formato DESIGN.md
(tokens em YAML no topo, regras em prosa em baixo), pensado para ser lido por
pessoas e por agentes de código antes de tocarem na interface. Os tokens vivem em
`src/index.css`; se mudarem lá, mudam aqui.

## 1. Direção

**Monocromático.** Dois modos, escolhidos pelo estudante: **branco** (fundo
branco puro, tinta preta) e **escuro** (preto neutro, tinta clara). Não há cor
de marca: o que é interativo é preto no modo branco e branco no modo escuro. A
cor fica reservada para o que é dado — as cadeiras e os estados. Números
compostos em mono, como numa folha de laboratório. Deve parecer um instrumento
de trabalho, não uma landing page.

Três adjetivos que decidem empates: **legível, denso, calmo.**

O que a app *não* é: um dashboard SaaS roxo sobre preto, com gradientes,
brilhos e cartões de vidro.

## 2. Cor

- **Sem cor de marca.** `accent` é a própria tinta (preto / branco) e marca só
  o que é clicável ou o estado ativo (botão principal, item de navegação
  atual, foco, hoje no calendário). Nunca decora.
- **Dois modos equivalentes.** Tudo tem de funcionar no modo branco e no modo
  escuro; nenhum é "o principal". Testar sempre os dois.
- **Semânticas com significado fixo.** `ok` = no objetivo / concluído,
  `warn` = atenção / prazo a aproximar-se, `danger` = em atraso / objetivo
  fora de alcance / destrutivo. Não usar estas cores para categorias.
- **Cor de cadeira = dado, não decoração.** Cada cadeira tem uma cor
  (`courseColors` em `src/lib/colors.ts`). Aparece em pontos, bordas esquerdas,
  etiquetas e séries de gráficos — sempre a mesma cor para a mesma cadeira em
  toda a app.
- **Superfícies.** `bg` é a página, `surface` os blocos, `surface-2` campos e
  estados de hover. Não há mais níveis. No modo branco a página e os blocos
  são ambos brancos: quem separa é a borda `line`, não um fundo cinzento.
- **Proibido:** gradientes, brilhos, sombras coloridas, transparências de
  vidro, cores hex fora dos tokens (exceto o `hex` das cadeiras em SVG e
  gráficos).
- Contraste mínimo de texto: 4.5:1 sobre a superfície onde assenta, nos dois
  temas. `muted` é para texto secundário, nunca para informação essencial.

## 3. Tipografia

- **Display (Bricolage Grotesque)** só no `h1` de cada página. Dá carácter sem
  contaminar a leitura.
- **Corpo (Geist)** para tudo o resto. Pesos: 400 texto, 500 rótulos e
  controlos, 600 títulos de secção. Não usar 700+.
- **Mono (Geist Mono)** para qualquer valor numérico: notas, horas, minutos,
  percentagens, contagens decrescentes. Usar a classe `tabular`.
- Hierarquia faz-se por **tamanho e peso**, não por rótulos em maiúsculas com
  espaçamento largo, nem por pílulas decorativas.
- Texto de interface em português europeu, na segunda pessoa informal, curto.
  Um botão diz o que acontece ("Gerar plano", "Mover para hoje"), não
  "Submeter" ou "OK".

## 4. Forma e espaço

- Cantos contidos: 8px em controlos, 10px em blocos. Pílulas só em etiquetas
  de estado e de cadeira.
- **Sem sombras.** Os blocos separam-se por uma borda de 1px `line`.
- **Proximidade antes de contentores.** Não embrulhar cada coisa num cartão;
  não pôr cartões dentro de cartões. Uma lista dentro de um bloco usa linhas
  divisórias, não mini-cartões.
- Grelha de 4px. Padding de bloco 20px; 24px entre secções.
- Cada ecrã tem **um ponto focal** e **uma ação principal** (um único botão
  `primary` visível).
- Móvel primeiro: tudo funciona a 375px sem scroll horizontal da página.

## 5. Componentes

Compor sempre a partir de `src/components/ui.tsx` (`PageHeader`, `Card`,
`Button`, `Badge`, `CourseChip`, `Progress`, `Ring`, `Stat`, `EmptyState`,
`Modal`, `Field`, `Input`, `Select`, `Textarea`). Antes de criar um componente
novo, confirmar que nenhum destes serve.

- **Estados vazios** explicam o que falta e oferecem a ação seguinte.
- **Ações destrutivas** pedem confirmação num `Modal` da app (nunca
  `window.confirm`) e dizem o que se perde.
- **Ícones** (lucide) acompanham texto; não se usam sozinhos como decoração
  nem dentro de "azulejos" coloridos.
- **Erros** mostram a mensagem real e o que fazer a seguir.

## 6. Gráficos

Biblioteca: **Recharts** (MIT). Um gráfico só existe se responder a uma
pergunta do estudante ("quanto estudei?", "onde estou mais fraco?").

- Séries por cadeira usam `courseColors[cor].hex`. Séries sem cadeira usam
  `var(--accent)`; referências/objetivos usam `var(--muted)` em tracejado.
- Grelha: só linhas horizontais, `var(--line)`. Eixos sem linha de eixo nem
  marcas; rótulos a 11px em mono, cor `var(--muted)`.
- Preenchimentos sólidos (barras) ou com opacidade fixa (áreas, 0.15). **Sem
  gradientes.** Barras com cantos de 3px no topo.
- Tooltip próprio: `surface`, borda `line`, sem sombra, valores em mono com
  unidade ("1 h 20 min", "14,5").
- Título em frase que diz a conclusão ou a pergunta, não o tipo de gráfico.
  Legenda só quando há mais de uma série.
- Animação de entrada ≤ 400ms; desligada com `prefers-reduced-motion`.
- Todo o gráfico tem estado vazio e um resumo textual do valor principal ao
  lado, para não depender só da leitura visual.
- Formas a evitar: tartes com mais de 5 fatias, 3D, eixos duplos.

## 7. Movimento

220ms, `ease-out`, e só para explicar uma mudança (um bloco que entra, uma
barra que cresce até ao valor). Nada se move em repouso. Nada anima o texto que
se está a ler. Respeitar `prefers-reduced-motion`.

## 8. Teste de remoção (anti-slop)

Antes de dar um ecrã por terminado, percorrer esta lista e retirar o que
falhar:

1. Este elemento podia estar igual numa app de outro tema qualquer? Então não
   está a dizer nada — remover ou tornar específico.
2. Se apagar este rótulo, pílula, ícone ou cartão, perde-se informação? Se
   não, apagar.
3. Há gradiente, brilho, sombra ou vidro? Remover.
4. Há números inventados, métricas falsas ou texto de enchimento? Remover; os
   dados de demonstração estão assinalados como tal.
5. Há mais de um botão principal no ecrã? Fica um.
6. A cor está a decorar ou a informar? Só fica se informar.
7. Não compensar uma remoção com um efeito novo.

## 9. Referências

- Formato DESIGN.md (Google Labs / Stitch, Apache-2.0) e a coleção
  `VoltAgent/awesome-design-md`.
- Regras anti-slop adaptadas da skill `no-ai-design-slop` de `MengTo/Skills`
  e de `samber/cc-skills` (`frontend-design-deslop`).
- Fontes: Geist, Geist Mono e Bricolage Grotesque (SIL OFL 1.1), servidas
  localmente via Fontsource.
- Gráficos: Recharts (MIT). Ícones: Lucide (ISC).
