// Integração com Gmail da Faculdade (API v1) — só leitura.
// Lê mensagens reais dos docentes e avisos institucionais do CLIP diretamente da conta Google do utilizador.
// NUNCA gera nem inventa emails falsos ou simulados.

import { getCachedGoogleAccessToken, getAcademicGoogleAccessToken } from '../lib/firebase';
import { googleFetch } from './googleAuth';
import type { Course } from '../types';
import { matchCourseByText } from '../lib/courseAliases';

export interface AcademicEmail {
  id: string;
  threadId: string;
  from: string;
  fromName: string;
  subject: string;
  snippet: string;
  date: string; // ISO datetime
  courseId?: string;
  isClipNotice: boolean;
  unread: boolean;
  labels: string[];
}

export interface GmailFetchDetailedResult {
  emails: AcademicEmail[];
  hasPermission: boolean;
  error?: 'unauthenticated' | 'insufficient_scopes' | 'network_error';
  errorMessage?: string;
}

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailMessageDetail {
  id: string;
  threadId: string;
  snippet: string;
  internalDate: string;
  labelIds?: string[];
  payload?: {
    headers?: GmailHeader[];
  };
}

interface GmailListResponse {
  messages?: { id: string; threadId: string }[];
  resultSizeEstimate?: number;
  nextPageToken?: string;
}

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me/messages';

/** Identifica a cadeira a que pertence o email com base no assunto, corpo e remetente */
export function detectCourseFromEmail(
  subject: string,
  snippet: string,
  from: string,
  courses: Course[],
): string | undefined {
  const fullText = `${subject} ${snippet} ${from}`;
  const matched = matchCourseByText(fullText, courses);
  return matched?.id;
}

export function isGmailConnected(): boolean {
  return Boolean(getAcademicGoogleAccessToken() || getCachedGoogleAccessToken());
}

// Cache global em memória para evitar chamadas de rede repetidas e rate-limiting da Google
let academicEmailsCache: {
  emails: AcademicEmail[];
  timestamp: number;
} | null = null;

export function getCachedAcademicEmails(): AcademicEmail[] | null {
  if (academicEmailsCache && Date.now() - academicEmailsCache.timestamp < 10 * 60 * 1000) {
    return academicEmailsCache.emails;
  }
  return null;
}

export function clearAcademicEmailsCache(): void {
  academicEmailsCache = null;
}

/**
 * Consulta detalhada do Gmail que identifica se faltam permissões de escopo (403).
 * Prioriza a conta académica conectada.
 * Usa cache em memória (10 minutos) a menos que `forceRefresh` seja verdadeiro.
 */
export async function fetchAcademicEmailsDetailed(
  courses: Course[],
  forceRefresh = false,
): Promise<GmailFetchDetailedResult> {
  if (!forceRefresh && academicEmailsCache && Date.now() - academicEmailsCache.timestamp < 10 * 60 * 1000) {
    // Reassocia com a lista atualizada de cadeiras
    const reassigned = academicEmailsCache.emails.map((em) => ({
      ...em,
      courseId: em.courseId || detectCourseFromEmail(em.subject, em.snippet, em.from, courses),
    }));
    return { emails: reassigned, hasPermission: true };
  }

  const token = getAcademicGoogleAccessToken() || getCachedGoogleAccessToken();
  if (!token) {
    return { emails: [], hasPermission: false, error: 'unauthenticated' };
  }

  try {
    // Procura abrangente de emails académicos usando também as siglas/nomes das cadeiras do utilizador
    const courseKeywords = courses
      .flatMap((c) => [c.shortName, c.code].filter(Boolean))
      .map((k) => k!.replace(/[^a-zA-Z0-9À-ÿ]/g, '').trim())
      .filter((k) => k.length >= 2)
      .slice(0, 8);
    const subjectTerms = ['teste', 'exame', 'nota', 'pauta', 'aula', 'cadeira', 'trabalho', 'entrega', ...courseKeywords];
    const q = `from:(professor OR docente OR secretaria) OR subject:(${subjectTerms.join(' OR ')})`;
    const url = `${GMAIL_API}?q=${encodeURIComponent(q)}&maxResults=30`;

    const listData = await googleFetch<GmailListResponse>(url, token);
    const msgIds = (listData.messages ?? []).slice(0, 25).map((m) => m.id);

    if (msgIds.length === 0) {
      academicEmailsCache = { emails: [], timestamp: Date.now() };
      return { emails: [], hasPermission: true };
    }

    // Carregamento paralelo em lote para máxima rapidez (em vez de esperar 20 chamadas sequenciais)
    const details = await Promise.all(
      msgIds.map(async (id) => {
        try {
          return await googleFetch<GmailMessageDetail>(
            `${GMAIL_API}/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
            token,
          );
        } catch {
          return null;
        }
      }),
    );

    const emails: AcademicEmail[] = [];
    for (const detail of details) {
      if (!detail) continue;
      const headers = detail.payload?.headers ?? [];
      const fromHeader = headers.find((h) => h.name.toLowerCase() === 'from')?.value ?? '';
      const subjectHeader =
        headers.find((h) => h.name.toLowerCase() === 'subject')?.value ?? '(Sem assunto)';
      const dateHeader = headers.find((h) => h.name.toLowerCase() === 'date')?.value;

      let fromName = fromHeader;
      const matchName = /(.*?)\s*<.*?>/.exec(fromHeader);
      if (matchName) fromName = matchName[1].replace(/["']/g, '').trim();

      const isoDate = dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString();
      const snippet = detail.snippet ?? '';
      const isClipNotice =
        fromHeader.toLowerCase().includes('clip') ||
        subjectHeader.toLowerCase().includes('clip');
      const courseId = detectCourseFromEmail(subjectHeader, snippet, fromHeader, courses);

      emails.push({
        id: detail.id,
        threadId: detail.threadId,
        from: fromHeader,
        fromName: fromName || 'Faculdade',
        subject: subjectHeader,
        snippet,
        date: isoDate,
        courseId,
        isClipNotice,
        unread: (detail.labelIds ?? []).includes('UNREAD'),
        labels: detail.labelIds ?? [],
      });
    }

    academicEmailsCache = { emails, timestamp: Date.now() };
    return { emails, hasPermission: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('Erro ao consultar Gmail da faculdade:', msg);

    if (msg.includes('403') || msg.toLowerCase().includes('insufficient') || msg.toLowerCase().includes('scope')) {
      return {
        emails: [],
        hasPermission: false,
        error: 'insufficient_scopes',
        errorMessage: 'A sessão Google ativa não tem permissão para ler o Gmail. Concede a permissão para carregar os emails.',
      };
    }

    return {
      emails: [],
      hasPermission: true,
      error: 'network_error',
      errorMessage: msg,
    };
  }
}

/**
 * Procura emails académicos REAIS da faculdade através da API do Gmail.
 * Se não houver autenticação Google ativa, devolve lista vazia.
 * NUNCA devolve emails inventados.
 */
export async function fetchAcademicEmails(courses: Course[]): Promise<AcademicEmail[]> {
  const res = await fetchAcademicEmailsDetailed(courses);
  return res.emails;
}

/** Interpreta um ficheiro real .eml (RFC 2822) para pré-visualização e criação de tarefa local. */
export function parseEmlToAcademicEmail(rawText: string, courses: Course[], idSeed?: string): AcademicEmail {
  const normalized = rawText.replace(/\r\n/g, '\n');
  const splitIdx = normalized.indexOf('\n\n');
  const headerBlock = splitIdx >= 0 ? normalized.slice(0, splitIdx) : normalized;
  const bodyBlock = splitIdx >= 0 ? normalized.slice(splitIdx + 2) : '';

  const readHeader = (name: string): string => {
    const re = new RegExp(`^${name}:\\s*(.+(?:\\n[ \\t].+)*)`, 'im');
    const match = re.exec(headerBlock);
    return match ? match[1].replace(/\n[ \t]+/g, ' ').trim() : '';
  };

  const from = readHeader('From') || 'Remetente desconhecido';
  const subject = readHeader('Subject') || '(Sem assunto)';
  const dateRaw = readHeader('Date');
  const parsedDate = dateRaw && !Number.isNaN(Date.parse(dateRaw)) ? new Date(dateRaw).toISOString() : new Date().toISOString();

  let fromName = from;
  const matchName = /(.*?)\s*<.*?>/.exec(from);
  if (matchName && matchName[1].trim()) {
    fromName = matchName[1].replace(/["']/g, '').trim();
  }

  const plainBody = bodyBlock
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const snippet = plainBody.slice(0, 260) || '(Mensagem sem pré-visualização de texto)';
  const courseId = detectCourseFromEmail(subject, snippet, from, courses);

  return {
    id: idSeed ?? `eml-${Date.now()}`,
    threadId: idSeed ?? `eml-${Date.now()}`,
    from,
    fromName,
    subject,
    snippet,
    date: parsedDate,
    courseId,
    isClipNotice: false,
    unread: true,
    labels: ['IMPORTADO'],
  };
}
