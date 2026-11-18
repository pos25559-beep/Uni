# Revisão dos commits de 17 e 18 de novembro

**Base:** `main` em `08c018c` · 30 commits desde `b26cca4` · revisão só de leitura, em três frentes (planeador e commits de hoje; voz, podcast e Voz Live; caderno, guia, PDF, fontes e foco).

**Estado geral:** com as dependências instaladas, `npm run check` passa (36 ficheiros, 192 testes). Mas `npm ci` falha no `main` tal como está no GitHub, e há falhas de privacidade e de dados que os testes não apanham.

Legenda: ✅ confirmado a correr código ou a ler as linhas exatas · ⚠️ suspeito (depende de execução real).

---

## Crítico (corrigir antes de mais nada)

| # | O quê | Onde | O que acontece |
|---|---|---|---|
| 1 | ✅ **A Voz Live não pede consentimento nem 18+** | `UniLiveVoiceModal.tsx`, `geminiLiveVoice.ts` (nenhuma chamada a `hasAiAccess`) | Quem nunca aceitou a IA, ou não confirmou 18 anos, abre o microfone e envia áudio e o resumo do semestre para a Google. Todos os outros caminhos de IA verificam isto; este não. Viola o ADR-001. |
| 2 | ✅ **`npm ci` partido e dois ficheiros de dependências** | `package.json` tem `lottie-web`; `bun.lock` também; `package-lock.json` não | Quem instala com npm não compila. O workflow usa `bun install --frozen-lockfile \|\| bun install --no-save`: se o primeiro falhar, instala versões sem as fixar e publica em produção. É o mesmo problema que já partiu o deploy com o MSAL. |

## Alto

| # | O quê | Onde | O que acontece |
|---|---|---|---|
| 3 | ✅ Desbloquear uma sessão não chega à nuvem | `SessionModal.tsx:54` (`locked ? true : undefined`), `firestoreSync.ts` (`stripUndefined` + `merge`) | O campo «indefinido» é ignorado em vez de apagado. Noutro dispositivo, ou ao voltar a entrar, a sessão aparece bloqueada outra vez. O mesmo vale para tirar o material ou o tópico. |
| 4 | ✅ O plano feito pela IA no briefing ignora as regras do planeador | `studyBriefingPlan.ts:271` (`% 7`), sem `avail.enabled`, `avail.minutes` nem prazo do teste; `slots.ts` `findFirstFreeSlotOnDate` sem avaliações | Blocos em dias desligados, acima da meta diária, depois da hora do teste, e a «dar a volta» para dias que já passaram. O planeador normal (`engine.ts`) não tem estes erros. |
| 5 | ✅ Os dias de estudo nas Definições deixam de contar | `plannerBriefing.ts:77` usa `weekdaySchedule` e ignora `settings.studyDays` | Depois de usar o criador de plano uma vez, desligar um dia nas Definições não muda nada. |
| 6 | ✅ Comparar dois testes tira um deles | `tutorSources.ts` (`ordinalAssessmentKeys`, `findTargetAssessmentDocument`) | «compara o 1.º e o 2.º teste de 2009/10» escolhe só o 2.º, retira o 1.º e diz ao Uni que os outros não foram enviados. |
| 7 | ✅ O teste pedido não é reconhecido com nomes comuns | mesmo ficheiro | Com ficheiros «Teste 2 2011-2012.pdf», a pergunta «alínea c do teste 2 de 2011-2012» não encontra nada. «2.ª frequência» e «exame de recurso 2019/20» também falham. Os testes só cobrem o formato «2º Teste TMIII 2009 2010». |
| 8 | ✅ Guias longos dão PDF em branco no iPhone | `StudyGuidePrintHost.tsx:227` (`Math.max(1, …)` anula o limite) | Acima de ~15–20 páginas a imagem passa do limite do Safari e as páginas saem vazias, sem erro. |
| 9 | ⚠️ O guia pode demorar muito e não se cancela | `gemini/core.ts` (150 s × modelos × 3 rondas), `generateStudyGuide` sem `AbortSignal` | Em sobrecarga, minutos de espera; fechar o Caderno não pára o trabalho. Um 429 diário é repetido dezenas de vezes. `modelCooldownUntil.clear()` apaga o estado de outros pedidos ao mesmo tempo. |
| 10 | ✅ Android sem permissão de microfone | `AndroidManifest.xml` sem `RECORD_AUDIO` | Na app Android, ditado, Voz Live e notas de voz falham com «microfone recusado». |
| 11 | ✅ Podcast com uma só voz em certos nomes | `uniVoice.ts:332-338` (`includes('co')`, `includes('alex')`) | Um Uni chamado «Alex», «Marco» ou «Coral» faz todas as falas irem para a mesma voz. |
| 12 | ✅ A Voz Live fica muda quando a Google fecha a sessão | `geminiLiveVoice.ts` (`onclose` sem aviso; um só modelo `gemini-3.8-live`) | O ecrã continua em «a ouvir» com o microfone já desligado. Sem modelo de reserva. |
| 13 | ✅ Refazer um tópico pode gravar na ficha errada | `UniNotebookDrawer.tsx` `handleRefineTopic` | Se mudares de ficha enquanto o pedido corre, o resultado mistura-se com a outra ficha e é guardado. |

## Médio

- ✅ **Quota cobrada por guias falhados:** se todas as secções falham, o guia sai só com o mapa e a geração conta na mesma; erros de consentimento e de chave são engolidos como «falha de tópico».
- ✅ **Cada um dos ~7 pedidos do guia reenvia todos os PDFs.**
- ✅ **`plainMath` estraga links e alguns textos:** `https://x.com/phi_2` ganha `$\phi_{2}$`; «Delta do Tejo» vira fórmula; `F_y` passa a `F_{\text{y}}` dentro de fórmulas com `\sigma`.
- ✅ **Avisos (toasts) e a pílula do foco ficam escondidos atrás das páginas de leitura** (o diálogo nativo fica por cima de tudo): «Copiado», «PDF pronto» e «PDF falhou» nunca se veem dali.
- ✅ **Começar outro foco apaga o que está a correr** sem perguntar; depois de recarregar, a pílula desaparece fora do Hoje e do Plano.
- ✅ **O cartão «guardar datas» ainda aparece em explicações** («a alínea 1.2 pede as tensões…» conta como data).
- ✅ **Guias e podcasts guardados no `localStorage`:** apagar a ficha a partir das Cadeiras deixa-os órfãos; com 30 a 60 guias enche os ~5 MB e falha em silêncio.
- ✅ **Microfone pode ficar ligado** se o ecrã fechar durante o pedido de permissão, ou se o gravador falhar ao arrancar.
- ✅ **Podcast:** quando uma parte falha, as outras continuam a gastar pedidos; partes com número ímpar de bytes metem ruído na junção; a memória de um episódio de 5 min passa de 100 MB em cópias de texto.
- ✅ **«Ouvir» corta em silêncio aos 3800 caracteres** e não cancela o pedido pago ao parar.
- ✅ **Texto em português fixo no criador de plano** (`plannerBriefing.ts`: «manhã», «tarde», etiquetas) mostrado em todas as línguas.
- ✅ **Ficheiros gigantes de volta:** `useOnboardingState.ts` 1237 linhas, `engine.ts` 967 (com `generatePlan` numa só função de ~840), `PlanBuilderModal.tsx` 909, `Planner.tsx` 863. O código mudou de sítio, a complexidade ficou.

## Baixo

- Pílula do foco arrastável com botões de 32–36 px (abaixo dos 44).
- `ambiguousDocNote` dispara em perguntas como «quando é o teste de 2010?».
- Voz Live: transcrição sem `aria-live`, bocados de palavras partidos com espaços, propostas que podem aparecer duas vezes, uso registado em sessões que nunca ligaram.
- Voz do dispositivo pode ler português com uma voz inglesa quando não há voz pt.
- `@google/genai` (393 KB) carrega com o Tutor por causa de um import em `uniTools.ts`.
- Resto de código morto em `studyBriefingPlan.ts` (`void baseTargetDate`, bloco `if` vazio).

## O que está bem

- A divisão do planeador manteve as regras importantes: nada depois do teste, cobertura de tópicos, revisões e modo teste.
- Firestore: `materialId`, `locked` e `uniVoice` têm regras e tipos; a chave pessoal nunca é registada nem sincronizada.
- `lottie-web` e `html-to-image` só carregam quando são precisos.
- A página de leitura (ReaderShell) está bem feita em acessibilidade: diálogo nativo, Escape, foco devolvido, alvos de 44 px.
- `plannerBriefing.test.ts` e `studyBriefingPlan.test.ts` testam comportamento real.

## Testes que faltam (por risco)

1. Ciclo de novas tentativas (`runModelChain`, `isOverloadError`).
2. `generateStudyGuide` e `mergeGuideTopic` (quota, falha parcial, citações).
3. `findTargetAssessmentDocument` com listas, «frequência» e ficheiros sem «º».
4. Sincronização de campos apagados (`locked`, `materialId`).
5. Plano do briefing contra dias desligados, meta e data do teste.
6. Síntese do podcast com SDK simulado; nomes dos locutores.
7. Ciclo de vida da Voz Live (consentimento, fecho, ferramentas).
8. `useOnboardingState` (1237 linhas sem testes).

## Ordem proposta

1. **Já (S):** consentimento na Voz Live; um só ficheiro de dependências e `npm ci` no workflow sem fallback.
2. **Esta semana (M):** sincronizar campos apagados; regras do planeador no plano do briefing e nos «mover»; uma só fonte para os dias de estudo; comparar testes e nomes de ficheiros; PDF longo; cancelar e limitar o guia; `RECORD_AUDIO`; nomes do podcast; Voz Live a avisar quando fecha.
3. **Depois:** o resto do «Médio», partir `generatePlan` e `useOnboardingState`, e os testes da lista acima.
