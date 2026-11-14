export interface ExtractedHistoryItem {
  code?: string;
  name: string;
  grade?: number;
  ects?: number;
  semester?: 1 | 2;
  status: 'aprovada' | 'a_fazer' | 'por_fazer';
}

export interface ExtractedScheduleSlot {
  courseName: string;
  courseCode?: string;
  type: 'T' | 'TP' | 'P' | 'OT';
  weekday: number;
  start: string;
  end: string;
  room?: string;
}

export interface ExtractedScheduleAssessment {
  courseName: string;
  title: string;
  date: string;
  kind: 'exame' | 'teste' | 'trabalho' | 'projeto' | 'quiz';
}

export interface ExtractedSchedulePayload {
  slots: ExtractedScheduleSlot[];
  assessments: ExtractedScheduleAssessment[];
}

function stripJsonFences(rawText: string): string {
  return (rawText || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    .trim();
}

function parseJsonFlexible(rawText: string): unknown {
  const cleaned = stripJsonFences(rawText);
  if (!cleaned) return {};
  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBracket = cleaned.indexOf('[');
    const firstBrace = cleaned.indexOf('{');
    if (firstBracket >= 0 && (firstBrace < 0 || firstBracket < firstBrace)) {
      const lastBracket = cleaned.lastIndexOf(']');
      if (lastBracket > firstBracket) {
        return JSON.parse(cleaned.slice(firstBracket, lastBracket + 1));
      }
    }
    if (firstBrace >= 0) {
      const lastBrace = cleaned.lastIndexOf('}');
      if (lastBrace > firstBrace) {
        return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
      }
    }
    throw new Error(
      'O Uni recebeu uma resposta fora do formato JSON esperado. Tenta outra imagem mais nítida.',
    );
  }
}

function normalizeWeekday(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 && raw <= 6) {
    return Math.round(raw);
  }
  const str = String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (/^[0-6]$/.test(str)) return Number(str);
  if (str.startsWith('2') || str.includes('seg') || str.includes('mon')) return 1;
  if (str.startsWith('3') || str.includes('ter') || str.includes('tue')) return 2;
  if (str.startsWith('4') || str.includes('qua') || str.includes('wed')) return 3;
  if (str.startsWith('5') || str.includes('qui') || str.includes('thu')) return 4;
  if (str.startsWith('6') || str.includes('sex') || str.includes('fri')) return 5;
  if (str.includes('sab') || str.includes('sat')) return 6;
  if (str.includes('dom') || str.includes('sun')) return 0;
  return 1;
}

function normalizeTimeHHMM(raw: unknown): string | null {
  const s = String(raw ?? '').trim().toLowerCase();
  const match = /(\d{1,2})[:h.](\d{2})/.exec(s);
  if (match) {
    const h = Math.min(23, Math.max(0, Number(match[1])));
    const m = Math.min(59, Math.max(0, Number(match[2])));
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  const hourOnly = /^(\d{1,2})h?$/.exec(s);
  if (hourOnly) {
    const h = Math.min(23, Math.max(0, Number(hourOnly[1])));
    return `${String(h).padStart(2, '0')}:00`;
  }
  return null;
}

function addMinutesToHHMM(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = Math.min(23 * 60 + 59, Math.max(0, h * 60 + m + mins));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function normalizeClassType(raw: unknown): 'T' | 'TP' | 'P' | 'OT' {
  const s = String(raw ?? '').trim().toUpperCase();
  if (s.startsWith('TP') || s.startsWith('PL')) return 'TP';
  if (s.startsWith('OT') || s.startsWith('S')) return 'OT';
  if (s.startsWith('P') || s.startsWith('L')) return 'P';
  if (s.startsWith('T')) return 'T';
  return 'TP';
}

function parseSemesterTag(raw: unknown): 1 | 2 | undefined {
  if (raw === 1 || raw === '1') return 1;
  if (raw === 2 || raw === '2') return 2;
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!s) return undefined;
  if (/\b(2|2o|2a|s2)\b|2\s*[.°ºo]?\s*(sem|semestre|trim|trimestre)|\b(3|4)\s*[.°ºo]?\s*trim/.test(s)) {
    return 2;
  }
  if (/\b(1|1o|1a|s1)\b|1\s*[.°ºo]?\s*(sem|semestre|trim|trimestre)/.test(s)) {
    return 1;
  }
  return undefined;
}

export function parseHistoryJsonText(rawText: string): ExtractedHistoryItem[] {
  const parsed = parseJsonFlexible(rawText || '[]');
  const rawList: unknown[] = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object'
      ? (['courses', 'disciplinas', 'cadeiras', 'items', 'data']
          .map((k) => (parsed as Record<string, unknown>)[k])
          .find((v): v is unknown[] => Array.isArray(v)) ?? [])
      : [];

  return rawList
    .filter((item): item is Record<string, unknown> =>
      Boolean(
        item &&
          typeof item === 'object' &&
          ('name' in item || 'disciplina' in item || 'courseName' in item),
      ),
    )
    .map((item) => {
      const rawGrade = item.grade ?? item.nota;
      const parsedGrade =
        typeof rawGrade === 'number'
          ? rawGrade
          : typeof rawGrade === 'string' && rawGrade.trim()
            ? Number(rawGrade.replace(',', '.'))
            : Number.NaN;
      const gradeNum =
        !Number.isNaN(parsedGrade) && parsedGrade >= 0 && parsedGrade <= 20
          ? parsedGrade
          : undefined;
      const rawEcts = item.ects ?? item.creditos;
      const parsedEcts =
        typeof rawEcts === 'number'
          ? rawEcts
          : typeof rawEcts === 'string' && rawEcts.trim()
            ? Number(rawEcts.replace(',', '.'))
            : Number.NaN;
      const ectsNum = !Number.isNaN(parsedEcts) && parsedEcts > 0 ? parsedEcts : 6;
      const statusRaw = String(item.status ?? '');
      const status: ExtractedHistoryItem['status'] =
        statusRaw === 'aprovada' || statusRaw === 'a_fazer' || statusRaw === 'por_fazer'
          ? statusRaw
          : gradeNum !== undefined && gradeNum >= 10
            ? 'aprovada'
            : 'a_fazer';

      const name = String(item.name ?? item.disciplina ?? item.courseName ?? '').trim();
      const rawCode = item.code ?? item.sigla ?? item.courseCode;
      const semester = parseSemesterTag(item.semester ?? item.semestre ?? item.term ?? item.periodo);
      return {
        code: typeof rawCode === 'string' && rawCode.trim() ? rawCode.trim() : undefined,
        name,
        grade: gradeNum,
        ects: ectsNum,
        ...(semester ? { semester } : {}),
        status,
      };
    })
    .filter((item) => item.name.length > 0);
}

export function parseScheduleJsonText(rawText: string): ExtractedSchedulePayload {
  const parsed = parseJsonFlexible(rawText || '{}');
  const obj =
    parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;

  const rawSlots: unknown[] = Array.isArray(parsed)
    ? parsed
    : obj
      ? (['slots', 'classes', 'aulas', 'horario', 'schedule', 'items']
          .map((k) => obj[k])
          .find((v): v is unknown[] => Array.isArray(v)) ?? [])
      : [];

  const rawAssessments: unknown[] = obj
    ? (['assessments', 'avaliacoes', 'testes', 'exams']
        .map((k) => obj[k])
        .find((v): v is unknown[] => Array.isArray(v)) ?? [])
    : [];

  const slots: ExtractedScheduleSlot[] = rawSlots
    .filter((s): s is Record<string, unknown> => Boolean(s && typeof s === 'object'))
    .map((s): ExtractedScheduleSlot | null => {
      const courseName = String(
        s.courseName ??
          s.name ??
          s.disciplina ??
          s.subject ??
          s.title ??
          s.courseCode ??
          s.code ??
          s.sigla ??
          '',
      ).trim();
      const rawCode = s.courseCode ?? s.code ?? s.sigla;
      const courseCode =
        typeof rawCode === 'string' && rawCode.trim() ? rawCode.trim() : undefined;
      const start = normalizeTimeHHMM(s.start ?? s.inicio ?? s.startTime);
      const parsedEnd = normalizeTimeHHMM(s.end ?? s.fim ?? s.endTime);
      const rawRoom = s.room ?? s.sala ?? s.location;
      if (!courseName || !start) return null;
      return {
        courseName,
        courseCode,
        type: normalizeClassType(s.type ?? s.tipo),
        weekday: normalizeWeekday(s.weekday ?? s.day ?? s.dia),
        start,
        end: parsedEnd ?? addMinutesToHHMM(start, 90),
        room: typeof rawRoom === 'string' && rawRoom.trim() ? rawRoom.trim() : undefined,
      };
    })
    .filter((s): s is ExtractedScheduleSlot => s !== null);

  const assessments: ExtractedScheduleAssessment[] = rawAssessments
    .filter((a): a is Record<string, unknown> => Boolean(a && typeof a === 'object'))
    .map((a): ExtractedScheduleAssessment | null => {
      const courseName = String(a.courseName ?? a.name ?? a.disciplina ?? '').trim();
      const date = String(a.date ?? a.data ?? '').trim();
      if (!courseName || !date) return null;
      const kind = a.kind ?? a.tipo;
      return {
        courseName,
        title: typeof a.title === 'string' && a.title.trim() ? a.title.trim() : 'Avaliação',
        date,
        kind:
          kind === 'exame' ||
          kind === 'teste' ||
          kind === 'trabalho' ||
          kind === 'projeto' ||
          kind === 'quiz'
            ? kind
            : 'teste',
      };
    })
    .filter((a): a is ExtractedScheduleAssessment => a !== null);

  return { slots, assessments };
}
