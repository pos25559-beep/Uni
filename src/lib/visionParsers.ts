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
  courseCode?: string;
  title: string;
  date: string;
  kind: 'exame' | 'teste' | 'trabalho' | 'projeto' | 'quiz';
  location?: string;
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

const PT_MONTHS: Record<string, number> = {
  jan: 1,
  janeiro: 1,
  fev: 2,
  fevereiro: 2,
  mar: 3,
  marco: 3,
  abr: 4,
  abril: 4,
  mai: 5,
  maio: 5,
  jun: 6,
  junho: 6,
  jul: 7,
  julho: 7,
  ago: 8,
  agosto: 8,
  set: 9,
  setembro: 9,
  out: 10,
  outubro: 10,
  nov: 11,
  novembro: 11,
  dez: 12,
  dezembro: 12,
};

function inferAcademicYearForMonth(month: number): number {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  // Se estamos no 1.º semestre (Set–Dez) e o mês extraído for Jan–Jul, aponta para o ano civil seguinte.
  if (m >= 9 && month <= 7) return y + 1;
  if (m <= 7 && month >= 9) return y - 1;
  return y;
}

/** Normaliza datas PT/ISO de avaliações para `YYYY-MM-DDTHH:mm:00` válido para `parseISO`. */
export function normalizeAssessmentIsoDate(rawDate: unknown, rawTime?: unknown): string | null {
  const raw = String(rawDate ?? '').trim();
  if (!raw) return null;

  const explicitTime = normalizeTimeHHMM(rawTime) ?? normalizeTimeHHMM(raw.match(/(\d{1,2}[:h]\d{2})/)?.[1]);
  const hhmm = explicitTime ?? '09:00';

  const isoPrefix = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(raw);
  if (isoPrefix) {
    const [, y, m, d] = isoPrefix;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${hhmm}:00`;
  }

  const dmyFull = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(raw);
  if (dmyFull) {
    const [, d, m, yrRaw] = dmyFull;
    const yr = yrRaw.length === 2 ? `20${yrRaw}` : yrRaw;
    return `${yr}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${hhmm}:00`;
  }

  const dmyShort = /^(\d{1,2})[/.-](\d{1,2})(?:\b|$)/.exec(raw);
  if (dmyShort) {
    const [, d, m] = dmyShort;
    const monthNum = Number(m);
    if (monthNum >= 1 && monthNum <= 12) {
      const yr = inferAcademicYearForMonth(monthNum);
      return `${yr}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${hhmm}:00`;
    }
  }

  const normText = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const ptNamed = /(\d{1,2})\s+(?:de\s+)?([a-z]{3,10})(?:\s+(?:de\s+)?(\d{4}))?/.exec(normText);
  if (ptNamed) {
    const [, d, mWord, yrExplicit] = ptNamed;
    const monthNum = PT_MONTHS[mWord] ?? PT_MONTHS[mWord.slice(0, 3)];
    if (monthNum) {
      const yr = yrExplicit ? Number(yrExplicit) : inferAcademicYearForMonth(monthNum);
      return `${yr}-${String(monthNum).padStart(2, '0')}-${d.padStart(2, '0')}T${hhmm}:00`;
    }
  }

  return null;
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

  const hasSaturdayColumn =
    obj && typeof obj.hasSaturdayColumn === 'boolean' ? obj.hasSaturdayColumn : undefined;

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

      const explicitDaySource = s.dayHeader ?? s.dayLabel ?? s.day ?? s.dia;
      let weekday =
        explicitDaySource !== undefined && explicitDaySource !== null && String(explicitDaySource).trim() !== ''
          ? normalizeWeekday(explicitDaySource)
          : normalizeWeekday(s.weekday);

      if (weekday === 6) {
        const dayText = String(explicitDaySource ?? '')
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        const explicitSat = dayText.includes('sab') || dayText.includes('sat');
        if (!explicitSat && hasSaturdayColumn === false) {
          weekday = 5;
        }
      }

      return {
        courseName,
        courseCode,
        type: normalizeClassType(s.type ?? s.tipo),
        weekday,
        start,
        end: parsedEnd ?? addMinutesToHHMM(start, 90),
        room: typeof rawRoom === 'string' && rawRoom.trim() ? rawRoom.trim() : undefined,
      };
    })
    .filter((s): s is ExtractedScheduleSlot => s !== null);

  const assessments: ExtractedScheduleAssessment[] = rawAssessments
    .filter((a): a is Record<string, unknown> => Boolean(a && typeof a === 'object'))
    .map((a): ExtractedScheduleAssessment | null => {
      const courseName = String(
        a.courseName ??
          a.name ??
          a.disciplina ??
          a.subject ??
          a.courseCode ??
          a.code ??
          a.sigla ??
          '',
      ).trim();
      const date = normalizeAssessmentIsoDate(a.date ?? a.data ?? a.dia, a.time ?? a.hora);
      if (!courseName || !date) return null;
      const kind = a.kind ?? a.tipo;
      const rawCode = a.courseCode ?? a.code ?? a.sigla;
      const rawLoc = a.location ?? a.sala ?? a.room;
      return {
        courseName,
        ...(typeof rawCode === 'string' && rawCode.trim() ? { courseCode: rawCode.trim() } : {}),
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
        ...(typeof rawLoc === 'string' && rawLoc.trim() ? { location: rawLoc.trim() } : {}),
      };
    })
    .filter((a): a is ExtractedScheduleAssessment => a !== null);

  return { slots, assessments };
}

/** Separa o texto visível ao aluno de qualquer bloco estruturado `<uni-sync>...</uni-sync>` emitido pelo Tutor. */
export function extractUniSyncBlock(rawText: string): {
  displayText: string;
  payload: ExtractedSchedulePayload | null;
} {
  const closedMatch = /<uni[-_]sync>([\s\S]*?)<\/uni[-_]sync>/i.exec(rawText);
  if (closedMatch) {
    const displayText = rawText.replace(/<uni[-_]sync>[\s\S]*?<\/uni[-_]sync>/gi, '').trim();
    try {
      const parsed = parseScheduleJsonText(closedMatch[1] ?? '');
      const hasItems = parsed.slots.length > 0 || parsed.assessments.length > 0;
      return { displayText, payload: hasItems ? parsed : null };
    } catch {
      return { displayText, payload: null };
    }
  }

  // Enquanto o stream ainda está a escrever `<uni-sync...`, oculta o JSON bruto no chat
  const openMatch = /<uni[-_]sync/i.exec(rawText);
  if (openMatch) {
    return { displayText: rawText.slice(0, openMatch.index).trim(), payload: null };
  }

  return { displayText: rawText, payload: null };
}

/** Deteta se um texto do Tutor lista datas de testes, exames, entregas ou horários sincronizáveis. */
export function looksSyncableReply(text: string): boolean {
  const clean = text.trim();
  if (clean.length < 18) return false;
  const hasAcademicKind =
    /(teste|exame|frequ[eê]ncia|avalia[cç]|trabalho|projeto|entrega|hor[aá]rio|aula|calend[aá]rio)/i.test(
      clean,
    );
  const hasDateOrSlotMarker =
    /(\b\d{1,2}[/.-]\d{1,2}\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\s+de\s+(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)|\b\d{1,2}[:h]\d{2}\b|\b[2-6][ªa]\b|\b(?:segunda|ter[cç]a|quarta|quinta|sexta)(?:-feira)?\b)/i.test(
      clean,
    );
  return hasAcademicKind && hasDateOrSlotMarker;
}
