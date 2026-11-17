// Leitura com Gemini Vision de horários, históricos académicos e agendas (imagens e texto).
import type { Content, GenerationConfig } from 'firebase/ai';
import {
  collectKnownCourseCandidates,
  getDegreeCurriculum,
  type CourseIdentityCandidate,
} from '../../lib/portugalCurriculum';
import {
  parseHistoryJsonText,
  parseScheduleJsonText,
  type ExtractedHistoryItem,
  type ExtractedSchedulePayload,
} from '../../lib/visionParsers';
import { useStore } from '../../store/useStore';
import { callDirectRest, resolveGeminiConfig, runNativeGenerate } from './core';
import { OCR_PRIMARY_TIMEOUT_MS, THINKING_FAST } from './models';
import { ACADEMIC_HISTORY_SCHEMA, TIMETABLE_EXTRACTION_SCHEMA } from './schemas';

export interface KnownCourseHint {
  code?: string;
  shortName?: string;
  name: string;
}

function buildKnownCoursesPromptSection(explicitHints?: KnownCourseHint[]): string {
  const state = useStore.getState();
  const profile = state.academicProfile;
  const degreeTemplates =
    profile?.universityId && profile?.degreeId
      ? (getDegreeCurriculum(profile.universityId, profile.degreeId)?.courses ?? [])
      : [];

  const merged: CourseIdentityCandidate[] = collectKnownCourseCandidates({
    extraHints: explicitHints,
    courses: state.courses,
    completedCourses: profile?.completedCourses ?? [],
    degreeTemplates,
  }).slice(0, 40);

  if (merged.length === 0) return '';

  const listText = merged
    .map((c) => (c.code ? `- ${c.code}: ${c.name}` : `- ${c.name}`))
    .join('\n');

  return `\n\nCADEIRAS REAIS CONHECIDAS DO ESTUDANTE (usa esta lista como referência prioritária para resolver siglas):
${listText}
REGRA CRÍTICA ANTI-ALUCINAÇÃO:
- Se o print mostrar apenas uma sigla curta (ex.: "MdF", "SNTI", "FabAd", "C3 D", "TEP") e ela corresponder a uma cadeira da lista acima, usa o nome REAL dessa lista (ex.: "Mecânica dos Fluidos") e mantém a sigla visível em "code"/"courseCode".
- Se uma sigla não existir na lista acima e o nome completo não estiver escrito na imagem, NUNCA adivinhes nem inventes um nome completo — devolve apenas a sigla exata que lês na imagem.`;
}

/** Analisa um print/captura do portal académico com Gemini Vision (nativo ou chave própria). */
export async function parseAcademicHistoryFromScreenshot(
  base64Data: string,
  mimeType: string,
  options?: { currentSemester?: 1 | 2; knownCourses?: KnownCourseHint[] },
): Promise<ExtractedHistoryItem[]> {
  const { customKey, model } = resolveGeminiConfig();
  const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  const activeSemHint =
    options?.currentSemester === 2
      ? 'O aluno está atualmente no 2.º Semestre: cadeiras sem nota em "1º Semestre" ou "1º Trimestre" devem vir com "semester": 1 e "status": "por_fazer" (não estão ativas agora).'
      : options?.currentSemester === 1
        ? 'O aluno está atualmente no 1.º Semestre: cadeiras sem nota em "2º Semestre" ou "2º Trimestre" devem vir com "semester": 2 e "status": "por_fazer" (ainda não começaram).'
        : 'Usa "semester": 1 para cadeiras do 1.º Semestre/1.º Trimestre e "semester": 2 para 2.º Semestre/2.º Trimestre.';

  const knownSection = buildKnownCoursesPromptSection(options?.knownCourses);

  const prompt = `Extrai todas as unidades curriculares (cadeiras/disciplinas) visíveis nesta captura de ecrã de um portal académico ou lista de inscrições/pauta em português.
Devolve APENAS um array JSON válido onde cada item segue exatamente o formato:
{"code": "sigla curta ou null", "name": "nome completo da cadeira", "grade": número entre 0 e 20 ou null se ainda não tiver nota, "ects": número ou 6, "semester": 1 | 2 | null, "status": "aprovada" | "a_fazer" | "por_fazer"}
Regras:
- Se tiver nota >= 10 (ou "Aprovado"), status = "aprovada".
- Se houver secções ou cabeçalhos como "1º Semestre", "2º Semestre", "1º Trimestre", "2º Trimestre", preenche sempre "semester": 1 (para 1.º Semestre/1.º Trimestre) ou "semester": 2 (para 2.º Semestre/2.º Trimestre).
- ${activeSemHint}
- Só marques status = "a_fazer" para cadeiras atualmente inscritas no semestre ativo sem nota final.
- Se tiver reprovado ou indicado como falta realizar/em atraso, status = "por_fazer".
- Não dupliques a mesma cadeira com e sem sigla e não inventes cadeiras que não estejam na imagem.${knownSection}`;

  const contents: Content[] = [
    {
      role: 'user',
      parts: [
        { type: 'text', text: prompt },
        { type: 'inlineData', inlineData: { mimeType, data: cleanBase64 } },
      ],
    },
  ];
  const generationConfig: GenerationConfig = {
    temperature: 0.1,
    maxOutputTokens: 4096,
    responseMimeType: 'application/json',
    responseSchema: ACADEMIC_HISTORY_SCHEMA,
    thinkingConfig: THINKING_FAST,
  };

  const rawText = customKey
    ? await callDirectRest({
        key: customKey,
        model,
        contents,
        generationConfig,
        primaryTimeoutMs: OCR_PRIMARY_TIMEOUT_MS,
      })
    : await runNativeGenerate({
        model,
        contents,
        generationConfig,
        primaryTimeoutMs: OCR_PRIMARY_TIMEOUT_MS,
      });

  return parseHistoryJsonText(rawText);
}

/** Extrai disciplinas, aulas semanais e datas de avaliação a partir de uma foto do horário, testes ou agenda. */
export async function parseTimetableFromScreenshot(
  base64Data: string,
  mimeType: string,
  focusOrOptions:
    | 'schedule'
    | 'assessments'
    | { focus?: 'schedule' | 'assessments'; knownCourses?: KnownCourseHint[] } = 'schedule',
): Promise<ExtractedSchedulePayload> {
  const focus =
    typeof focusOrOptions === 'string' ? focusOrOptions : (focusOrOptions.focus ?? 'schedule');
  const knownCourses = typeof focusOrOptions === 'string' ? undefined : focusOrOptions.knownCourses;
  const knownSection = buildKnownCoursesPromptSection(knownCourses);
  const { customKey, model } = resolveGeminiConfig();
  const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  const prompt =
    focus === 'assessments'
      ? `Analisa esta foto ou print de um calendário de testes, pauta de exames, datas de avaliações ou entregas académicas em português.
Devolve APENAS JSON válido no formato exato:
{
  "slots": [],
  "assessments": [
    {"courseName": "Nome ou sigla da cadeira", "title": "1.º Teste", "date": "2026-11-25T14:00:00", "kind": "teste|exame|trabalho|projeto|quiz"}
  ]
}
Regras importantes para leitura de provas e testes:
- Extrai TODAS as datas de testes, frequências, exames (normal/recurso), minitestes, quizzes, apresentações e entregas de projetos visíveis na imagem.
- Formata date em ISO local "YYYY-MM-DDTHH:mm:00" (se não houver hora visível, usa "09:00:00"; se não houver ano visível, infere o ano letivo atual 2026/2027 com meses Set–Dez em 2026 e Jan–Jul em 2027).
- kind deve ser exatamente um de: "teste", "exame", "trabalho", "projeto", "quiz".
- Usa o nome real da cadeira (da lista de cadeiras conhecidas abaixo se existir correspondência) ou a sigla exata visível (ex.: "C3 D", "FabAd", "MdF", "SNTI") sem inventar nomes.
- Só devolvas "slots" se a imagem também contiver claramente uma grelha semanal de aulas. Caso contrário devolve "slots": [].${knownSection}`
      : `Analisa esta foto ou print de um horário escolar/universitário ou agenda académica portuguesa.
Devolve APENAS JSON válido no formato exato:
{
  "hasSaturdayColumn": false,
  "slots": [
    {"courseName": "Nome real da cadeira ou sigla exata visível", "courseCode": "SIGLA opcional", "dayHeader": "2ª|3ª|4ª|5ª|6ª|Sáb|Dom", "type": "T|TP|P|OT", "weekday": 1, "start": "09:00", "end": "11:00", "room": "Sala opcional"}
  ],
  "assessments": [
    {"courseName": "Nome da Cadeira", "title": "Teste 1", "date": "2026-11-25T14:00:00", "kind": "teste|exame|trabalho|projeto|quiz"}
  ]
}
Regras muito importantes para grelhas visuais de horários:
- REGRA DE SUBCOLUNAS SOBREPOSTAS (MUITO IMPORTANTE — tabelas CLIP / horários universitários):
  * Se um dia tiver aulas sobrepostas (ex.: dois blocos lado a lado em Quinta-feira / "5ª"), o cabeçalho azul/cinzento desse dia ("5ª") fica LARGO (colspan=2 ou 3) e cobre TODAS essas subcolunas lado a lado!
  * Traça uma linha vertical imaginária desde as bordas esquerda e direita da célula do cabeçalho ("2ª", "3ª", "4ª", "5ª", "6ª", "Sábado", "Domingo"). TUDO o que estiver debaixo da largura do cabeçalho "5ª" pertence a "5ª" (weekday=4), mesmo na 2.ª subcoluna à direita!
  * Só passa a "6ª" (weekday=5) o que estiver literalmente debaixo do cabeçalho "6ª", e só passa a "Sábado" (weekday=6) o que estiver literalmente debaixo do cabeçalho "Sábado" (que em horários de faculdade normalmente está completamente vazio).
  * NUNCA contes o índice da coluna pela largura simples da grelha; segue sempre a barra do cabeçalho imediatamente acima de cada retângulo!
- PORTUGAL DAY RULE (CRÍTICA):
  * "2ª" / "Seg" = dayHeader "2ª", weekday = 1 (Segunda-feira)
  * "3ª" / "Ter" = dayHeader "3ª", weekday = 2 (Terça-feira)
  * "4ª" / "Qua" = dayHeader "4ª", weekday = 3 (Quarta-feira)
  * "5ª" / "Qui" = dayHeader "5ª", weekday = 4 (Quinta-feira)
  * "6ª" / "Sex" = dayHeader "6ª", weekday = 5 (Sexta-feira)
  * CUIDADO: "6ª" é SEXTA-FEIRA (weekday 5), NUNCA uses 6 para "6ª"!
  * Sábado (weekday = 6) e hasSaturdayColumn = true SÓ devem ser usados se houver REALMENTE blocos de aula colocados debaixo de uma coluna escrita "Sáb" ou "Sábado" (se a coluna "Sábado" existir no cabeçalho mas estiver vazia, hasSaturdayColumn = false).
- Para CADA retângulo de aula, verifica com precisão em que coluna vertical ele está alinhado olhando diretamente para o cabeçalho no topo dessa coluna e preenche sempre "dayHeader" com o texto exato do cabeçalho ("2ª", "3ª", "4ª", "5ª", "6ª"...) além do número "weekday".
- Se as horas não estiverem escritas dentro do retângulo colorido, LÊ a hora de início e de fim pela posição vertical do topo e fundo do retângulo relativamente ao eixo de horas à esquerda (ex.: 8:00, 9:00, 10:00... 24:00) e às linhas da grelha (ex.: meio bloco = 30 min).
- Quando o bloco só mostrar sigla curta (ex.: "FabAd tp.1 Ed 7: 3.4/Ed.VII", "MdF l.1 Ed 8: 3.09", "C3 D t.2", "SNTI t.1"):
  * courseCode = sigla principal visível ("FabAd", "MdF", "C3 D", "SNTI")
  * courseName = nome completo real se estiver visível na imagem OU se existir na lista de cadeiras conhecidas abaixo; caso contrário usa APENAS a própria sigla exata visível (NUNCA inventes um nome completo por dedução!)
  * type: "t.*" -> "T", "tp.*" -> "TP", "l.*" / "p.*" -> "P", "s.*" / "ot.*" -> "OT"
  * room = localização/sala (ex.: "Ed 7: 3.4/Ed.VII")
- start e end no formato "HH:mm".
- Se não houver avaliações visíveis na foto, devolve "assessments": [].
- Não inventes blocos que não existam visualmente na grelha.${knownSection}`;

  const contents: Content[] = [
    {
      role: 'user',
      parts: [
        { type: 'text', text: prompt },
        { type: 'inlineData', inlineData: { mimeType, data: cleanBase64 } },
      ],
    },
  ];
  const generationConfig: GenerationConfig = {
    temperature: 0.1,
    maxOutputTokens: 4096,
    responseMimeType: 'application/json',
    responseSchema: TIMETABLE_EXTRACTION_SCHEMA,
    thinkingConfig: THINKING_FAST,
  };

  const rawText = customKey
    ? await callDirectRest({
        key: customKey,
        model,
        contents,
        generationConfig,
        primaryTimeoutMs: OCR_PRIMARY_TIMEOUT_MS,
      })
    : await runNativeGenerate({
        model,
        contents,
        generationConfig,
        primaryTimeoutMs: OCR_PRIMARY_TIMEOUT_MS,
      });

  return parseScheduleJsonText(rawText);
}

/** Converte rapidamente uma resposta em texto (ex.: do Tutor Uni) em aulas/avaliações estruturadas para sincronizar com a app. */
export async function extractScheduleFromText(
  sourceText: string,
  knownCourses?: KnownCourseHint[],
): Promise<ExtractedSchedulePayload> {
  const clean = sourceText.trim();
  if (!clean) return { slots: [], assessments: [] };

  const { customKey, model } = resolveGeminiConfig();
  const knownSection = buildKnownCoursesPromptSection(knownCourses);
  const prompt = `Extrai TODAS as datas de testes, frequências, exames, entregas de projetos/trabalhos e aulas semanais mencionadas no texto abaixo.
Devolve APENAS JSON válido no formato exato:
{
  "hasSaturdayColumn": false,
  "slots": [
    {"courseName": "Nome real da cadeira", "courseCode": "SIGLA opcional", "dayHeader": "2ª|3ª|4ª|5ª|6ª|Sáb", "type": "T|TP|P|OT", "weekday": 1, "start": "09:00", "end": "11:00", "room": "Sala opcional"}
  ],
  "assessments": [
    {"courseName": "Nome real da cadeira", "courseCode": "SIGLA opcional", "title": "1.º Teste", "date": "2026-11-20T14:30:00", "kind": "teste|exame|trabalho|projeto|quiz", "location": "Sala opcional"}
  ]
}
Regras:
- Regra Portugal para aulas: "2ª"=1, "3ª"=2, "4ª"=3, "5ª"=4, "6ª"=5 (6ª é Sexta-feira, NUNCA 6).
- Para avaliações sem ano explícito: Set–Dez = 2026, Jan–Jul = 2027. Se não houver hora, usa "09:00:00".
- Liga sempre à cadeira real da lista abaixo se corresponder à sigla/nome.${knownSection}

Texto a extrair:
"""
${clean.slice(0, 6000)}
"""`;

  const contents: Content[] = [{ role: 'user', parts: [{ type: 'text', text: prompt }] }];
  const generationConfig: GenerationConfig = {
    temperature: 0.1,
    maxOutputTokens: 2048,
    responseMimeType: 'application/json',
    responseSchema: TIMETABLE_EXTRACTION_SCHEMA,
    thinkingConfig: THINKING_FAST,
  };

  const rawJson = customKey
    ? await callDirectRest({ key: customKey, model, contents, generationConfig })
    : await runNativeGenerate({ model, contents, generationConfig });

  return parseScheduleJsonText(rawJson);
}
