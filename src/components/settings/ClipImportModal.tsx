import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { FileText, Upload } from 'lucide-react';
import { useState } from 'react';
import type { ClipboardEvent, ReactNode } from 'react';
import {
  decodeHtmlBytes, icsToClipData, matchCourse, parseClipScheduleHtml, parsePastedSchedule,
} from '../../integrations/clip';
import type {
  ClipCourse, ClipImport, DraftAssessment, DraftClass, DraftEvent,
} from '../../integrations/clip';
import { parseIcs } from '../../integrations/ics';
import { colorNames, kindLabel, weekdayLong } from '../../lib/colors';
import { newId, useStore } from '../../store/useStore';
import type { Assessment, CalendarEvent, ClassSlot, Course, CourseColor } from '../../types';
import { Button, Modal, Select, Textarea, cx } from '../ui';
import { errorMessage } from './shared';

interface Preview extends ClipImport {
  rejected: string[];
  source: 'clip' | 'ics' | 'texto';
  /** Unidades curriculares do CLIP encontradas na página (para criar as em falta). */
  clipCourses: ClipCourse[];
}

/** Escolha do utilizador para uma linha: cadeira (vazia = não importa) e inclusão. */
interface Pick {
  courseId: string;
  include: boolean;
}

interface Row {
  key: string;
  label: string;
  detail: string;
  /** Cadeira por omissão (pode ser `new:<clipId>` = cadeira a criar). */
  courseId: string;
}

type Tab = 'clip' | 'ics' | 'text';
type Counts = { classes: number; assessments: number; events: number };

const NEW_PREFIX = 'new:';

const fmtDate = (iso: string, allDay = false) =>
  format(parseISO(iso), allDay ? 'd MMM yyyy' : 'd MMM yyyy, HH:mm', { locale: pt });

/**
 * Cadeira por omissão de uma linha: a existente que corresponde ao nome; se vier do
 * CLIP e não existir, a cadeira nova (a criar na importação).
 */
function defaultCourse(name: string, courses: Course[], shortName?: string, clipId?: string): string {
  const hit = matchCourse(name, courses) ?? (shortName ? matchCourse(shortName, courses) : undefined);
  if (hit) return hit.id;
  return clipId ? `${NEW_PREFIX}${clipId}` : '';
}

function buildRows(p: Preview, courses: Course[]): { classes: Row[]; assessments: Row[]; events: Row[] } {
  const classes = p.classes.map((c: DraftClass): Row => ({
    key: c.key,
    label: `${c.shortName ?? c.courseName} · ${c.type}${c.shift ? ` · ${c.shift}` : ''}`,
    detail: `${weekdayLong[c.weekday]} ${c.start}–${c.end}${c.room ? ` · ${c.room}` : ''}`,
    courseId: defaultCourse(c.courseName, courses, c.shortName, c.clipId),
  }));
  const assessments = p.assessments.map((a: DraftAssessment): Row => ({
    key: a.key,
    label: `${a.courseName} · ${a.title}`,
    detail: `${kindLabel[a.kind]} · ${fmtDate(a.date)}${a.location ? ` · ${a.location}` : ''}`,
    courseId: defaultCourse(a.courseName, courses),
  }));
  const events = p.events.map((e: DraftEvent): Row => ({
    key: e.id,
    label: `${e.courseName} · ${e.title}`,
    detail: `${fmtDate(e.start, e.allDay)}${e.location ? ` · ${e.location}` : ''}`,
    courseId: defaultCourse(e.courseName, courses),
  }));
  return { classes, assessments, events };
}

const kbd = 'rounded border border-line bg-surface px-1 font-mono text-[11px] text-fg';

export default function ClipImportModal({ onClose }: { onClose: () => void }) {
  const courses = useStore((s) => s.courses);
  const replaceSource = useStore((s) => s.replaceSource);
  const setIntegration = useStore((s) => s.setIntegration);

  const [tab, setTab] = useState<Tab>('clip');
  const [text, setText] = useState('');
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [done, setDone] = useState<Counts | null>(null);
  const [createMissing, setCreateMissing] = useState(true);

  const activeCourses = courses;

  const pickOf = (key: string, def: string): Pick =>
    picks[key] ?? { courseId: def, include: true };
  const setPick = (key: string, base: Pick, change: Partial<Pick>) =>
    setPicks((prev) => ({ ...prev, [key]: { ...base, ...change } }));

  /** Cadeira mostrada: uma cadeira a criar só conta se a opção estiver marcada. */
  const shownCourse = (p: Pick) =>
    p.courseId.startsWith(NEW_PREFIX) && !createMissing ? '' : p.courseId;

  /** Destino de uma linha (id existente ou `new:`), ou null se não será importada. */
  const targetOf = (key: string, def: string): string | null => {
    const p = pickOf(key, def);
    if (!p.include) return null;
    const id = shownCourse(p);
    return id === '' ? null : id;
  };

  const startPreview = (p: Preview) => {
    setPicks({});
    setPreview(p);
  };

  const toClipPreview = (classes: DraftClass[], clipCourses: ClipCourse[]): Preview => ({
    classes, assessments: [], events: [], rejected: [], source: 'clip', clipCourses,
  });

  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    setError(null);
    const html = e.clipboardData.getData('text/html');
    if (html.trim()) {
      const parsed = parseClipScheduleHtml(html, courses);
      if (parsed.classes.length > 0) {
        startPreview(toClipPreview(parsed.classes, parsed.courses));
        return;
      }
    }
    const plain = e.clipboardData.getData('text/plain');
    if (plain.trim()) {
      const r = parsePastedSchedule(plain, courses);
      if (r.classes.length > 0) {
        startPreview({ classes: r.classes, assessments: [], events: [], rejected: r.rejected, source: 'texto', clipCourses: [] });
        return;
      }
    }
    setError('Não encontrei aulas nesse conteúdo. Abre o Horário no CLIP, seleciona tudo (Ctrl/Cmd+A), copia (Ctrl/Cmd+C) e cola aqui.');
  };

  const onHtmlFile = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    setError(null);
    try {
      const html = decodeHtmlBytes(await file.arrayBuffer());
      const parsed = parseClipScheduleHtml(html, courses);
      if (parsed.classes.length === 0) {
        setError('Não encontrei aulas nessa página. Guarda a página do Horário do CLIP (Ctrl/Cmd+S) e escolhe esse ficheiro.');
        return;
      }
      startPreview(toClipPreview(parsed.classes, parsed.courses));
    } catch (e) {
      setError(errorMessage(e, 'Não foi possível ler a página.'));
    } finally {
      setReading(false);
    }
  };

  const onIcsFile = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    setError(null);
    try {
      const content = await file.text();
      const events = parseIcs(content);
      if (events.length === 0) {
        setError('Não encontrei eventos neste ficheiro. Confirma que é um .ics exportado do CLIP.');
        return;
      }
      startPreview({ ...icsToClipData(events, courses), rejected: [], source: 'ics', clipCourses: [] });
    } catch (e) {
      setError(errorMessage(e, 'Não foi possível ler o ficheiro.'));
    } finally {
      setReading(false);
    }
  };

  const analyseText = () => {
    setError(null);
    if (!text.trim()) {
      setError('Cola primeiro as linhas do horário.');
      return;
    }
    const r = parsePastedSchedule(text, courses);
    if (r.classes.length === 0 && r.rejected.length === 0) {
      setError('Não encontrei linhas com texto.');
      return;
    }
    startPreview({ classes: r.classes, assessments: [], events: [], rejected: r.rejected, source: 'texto', clipCourses: [] });
  };

  const missingCourses = preview
    ? preview.clipCourses.filter((c) => !matchCourse(c.name, activeCourses) && !matchCourse(c.shortName, activeCourses))
    : [];
  const rows = preview ? buildRows(preview, activeCourses) : null;
  const allRows = rows ? [...rows.classes, ...rows.assessments, ...rows.events] : [];
  const importable = allRows.filter((r) => targetOf(r.key, r.courseId) !== null).length;

  const importAll = () => {
    if (!preview) return;
    const now = new Date().toISOString();
    const store = useStore.getState();

    // Cria as cadeiras em falta primeiro e guarda o id novo de cada unidade do CLIP.
    const newIds = new Map<string, string>();
    if (createMissing) {
      const used = new Set<CourseColor>(store.courses.map((c) => c.color));
      missingCourses.forEach((mc, i) => {
        const id = newId();
        const color = colorNames.find((c) => !used.has(c)) ?? colorNames[i % colorNames.length] ?? 'emerald';
        used.add(color);
        store.upsert('courses', {
          id,
          code: mc.shortName.replace(/\s+/g, '').toUpperCase(),
          name: mc.name,
          shortName: mc.shortName,
          ects: 6,
          color,
          targetGrade: 10,
          topics: [],
          clipUrl: undefined,
        });
        newIds.set(mc.clipId, id);
      });
    }

    const resolveId = (key: string, def: string): string | null => {
      const target = targetOf(key, def);
      if (target === null) return null;
      if (target.startsWith(NEW_PREFIX)) return newIds.get(target.slice(NEW_PREFIX.length)) ?? null;
      return target;
    };

    const classes: ClassSlot[] = [];
    for (const c of preview.classes) {
      const courseId = resolveId(c.key, defaultCourse(c.courseName, activeCourses, c.shortName, c.clipId));
      if (!courseId) continue;
      classes.push({
        id: `clip:${newId()}`,
        courseId,
        type: c.type,
        weekday: c.weekday,
        start: c.start,
        end: c.end,
        room: c.room,
        source: 'clip',
      });
    }

    const assessments: Assessment[] = [];
    for (const a of preview.assessments) {
      const courseId = resolveId(a.key, defaultCourse(a.courseName, activeCourses));
      if (!courseId) continue;
      assessments.push({
        id: `clip:${newId()}`,
        courseId,
        kind: a.kind,
        title: a.title,
        date: a.date,
        weight: 0,
        topicIds: [],
        location: a.location,
        source: 'clip',
      });
    }

    const events: CalendarEvent[] = [];
    for (const e of preview.events) {
      const courseId = resolveId(e.id, defaultCourse(e.courseName, activeCourses));
      if (!courseId) continue;
      events.push({
        id: `clip:${newId()}`,
        title: e.title,
        start: e.start,
        end: e.end,
        allDay: e.allDay,
        location: e.location,
        source: 'clip',
        courseId,
      });
    }

    replaceSource('classes', 'clip', classes);
    replaceSource('assessments', 'clip', assessments);
    replaceSource('events', 'clip', events);
    setIntegration('clip', { connected: true, lastSync: now, error: undefined });
    setDone({ classes: classes.length, assessments: assessments.length, events: events.length });
  };

  const renderRows = (list: Row[]) => (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
      {list.map((row) => {
        const p = pickOf(row.key, row.courseId);
        const shown = shownCourse(p);
        const missing = shown === '';
        return (
          <li key={row.key} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
            <input
              type="checkbox"
              className="size-4 accent-accent"
              checked={p.include && !missing}
              disabled={missing}
              aria-label={`Incluir ${row.label}`}
              onChange={(e) => setPick(row.key, p, { include: e.target.checked })}
            />
            <div className="min-w-0 flex-1">
              <p className={cx('truncate text-sm font-medium', missing && 'text-muted line-through')}>{row.label}</p>
              <p className="truncate text-xs text-muted">
                {row.detail}
                {missing && <span className="text-warn"> · sem cadeira, não será importado</span>}
              </p>
            </div>
            <Select
              className="w-36 text-xs"
              aria-label="Cadeira"
              value={shown}
              onChange={(e) => setPick(row.key, p, { courseId: e.target.value })}
            >
              <option value="">Sem cadeira</option>
              {activeCourses.map((c) => (
                <option key={c.id} value={c.id}>{c.shortName}</option>
              ))}
              {createMissing && missingCourses.map((c) => (
                <option key={`${NEW_PREFIX}${c.clipId}`} value={`${NEW_PREFIX}${c.clipId}`}>
                  {c.shortName} (nova)
                </option>
              ))}
            </Select>
          </li>
        );
      })}
    </ul>
  );

  const section = (title: string, list: Row[] | undefined) => (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">
        {title} <span className="font-normal text-muted">({list?.length ?? 0})</span>
      </h3>
      {list && list.length > 0 ? renderRows(list) : (
        <p className="rounded-xl border border-dashed border-line px-3 py-3 text-xs text-muted">Nada detetado.</p>
      )}
    </div>
  );

  let footer: ReactNode;
  if (done) {
    footer = <Button variant="primary" onClick={onClose}>Fechar</Button>;
  } else if (preview) {
    footer = (
      <>
        <Button onClick={() => { setPreview(null); setPicks({}); }}>Voltar</Button>
        <Button variant="primary" disabled={importable === 0} onClick={importAll}>
          Importar {importable} {importable === 1 ? 'item' : 'itens'}
        </Button>
      </>
    );
  } else {
    footer = <Button onClick={onClose}>Cancelar</Button>;
  }

  const TABS: [Tab, string][] = [
    ['ics', 'Ficheiro .ics'],
    ['clip', 'Colar página / HTML'],
    ['text', 'Texto'],
  ];

  return (
    <Modal open onClose={onClose} title="Importar horário" footer={footer}>
      {done && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-ok">Importação concluída.</p>
          <p className="text-sm text-muted">
            {done.classes} {done.classes === 1 ? 'aula' : 'aulas'}, {done.assessments}{' '}
            {done.assessments === 1 ? 'avaliação' : 'avaliações'} e {done.events}{' '}
            {done.events === 1 ? 'evento' : 'eventos'} importados.
          </p>
        </div>
      )}

      {!done && !preview && (
        <>
          <div className="inline-flex w-full rounded-xl border border-line bg-surface-2 p-1">
            {TABS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={tab === value}
                onClick={() => { setTab(value); setError(null); }}
                className={cx(
                  'h-8 flex-1 rounded-lg text-xs font-medium transition',
                  tab === value ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'clip' && (
            <div className="space-y-4">
              <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted marker:text-fg">
                <li>Abre o <b className="font-medium text-fg">Horário</b> no portal da tua escola ou faculdade.</li>
                <li>Seleciona tudo (<kbd className={kbd}>Ctrl</kbd>/<kbd className={kbd}>Cmd</kbd> + <kbd className={kbd}>A</kbd>) e copia (<kbd className={kbd}>Ctrl</kbd>/<kbd className={kbd}>Cmd</kbd> + <kbd className={kbd}>C</kbd>).</li>
                <li>Cola aqui (<kbd className={kbd}>Ctrl</kbd>/<kbd className={kbd}>Cmd</kbd> + <kbd className={kbd}>V</kbd>).</li>
              </ol>

              <div
                tabIndex={0}
                role="textbox"
                aria-multiline="true"
                aria-label="Zona para colar o horário"
                onPaste={onPaste}
                className="grid min-h-40 cursor-text place-items-center rounded-2xl border border-dashed border-line bg-surface-2 px-4 py-10 text-center text-sm font-medium text-muted transition hover:border-accent focus:border-accent focus:outline-none"
              >
                Clica aqui e cola o horário
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                <span>ou carrega a página guardada (.html):</span>
                <label className={cx(
                  'inline-flex h-8 cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 font-medium text-fg hover:border-muted/50',
                  reading && 'pointer-events-none opacity-60',
                )}>
                  <Upload size={14} />
                  <span>{reading ? 'A ler página…' : 'Escolher .html'}</span>
                  <input
                    type="file"
                    accept=".html,.htm,text/html"
                    className="sr-only"
                    disabled={reading}
                    onChange={(e) => { void onHtmlFile(e.target.files?.[0]); e.target.value = ''; }}
                  />
                </label>
              </div>
            </div>
          )}

          {tab === 'ics' && (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                Exporta o teu calendário académico em formato .ics e carrega-o aqui. Aulas recorrentes entram no horário e datas de provas viram avaliações.
              </p>
              <label className={cx(
                'flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted transition hover:border-accent hover:text-fg',
                reading && 'pointer-events-none opacity-60',
              )}>
                <Upload size={20} />
                <span>{reading ? 'A ler ficheiro…' : 'Escolher ficheiro .ics'}</span>
                <input
                  type="file"
                  accept=".ics,text/calendar"
                  className="sr-only"
                  disabled={reading}
                  onChange={(e) => { void onIcsFile(e.target.files?.[0]); e.target.value = ''; }}
                />
              </label>
            </div>
          )}

          {tab === 'text' && (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                Uma aula por linha. Exemplos: <code className="text-xs text-fg">Seg 09:00-11:00 AM2 T Ed.VII 1A</code> ou{' '}
                <code className="text-xs text-fg">segunda;9:00;11:00;Análise Matemática II;TP;sala 2B</code>.
              </p>
              <Textarea
                rows={6}
                value={text}
                placeholder="Cola aqui o horário…"
                onChange={(e) => setText(e.target.value)}
                aria-label="Horário em texto"
              />
              <Button variant="secondary" onClick={analyseText} disabled={!text.trim()}>
                <FileText size={16} />
                Analisar texto
              </Button>
            </div>
          )}

          {error && <p className="break-words text-sm text-danger">{error}</p>}
        </>
      )}

      {!done && preview && rows && (
        <>
          <div className="rounded-xl bg-warn/12 px-3 py-2 text-xs text-warn">
            Importar substitui o que foi importado antes do CLIP (aulas, avaliações e eventos). Os dados de outras fontes não mudam.
          </div>

          {missingCourses.length > 0 && (
            <div className="space-y-2 rounded-xl border border-line px-3 py-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  className="size-4 accent-accent"
                  checked={createMissing}
                  onChange={(e) => setCreateMissing(e.target.checked)}
                />
                Criar {missingCourses.length} {missingCourses.length === 1 ? 'cadeira em falta' : 'cadeiras em falta'}
              </label>
              <ul className="space-y-0.5 pl-6 text-xs text-muted">
                {missingCourses.map((c) => (
                  <li key={c.clipId}>{c.name} · {c.shortName}</li>
                ))}
              </ul>
            </div>
          )}

          {activeCourses.length === 0 && missingCourses.length === 0 && (
            <p className="text-sm text-warn">Ainda não tens cadeiras. Cria-as em Cadeiras antes de importar.</p>
          )}

          {section('Aulas', rows.classes)}
          {section('Avaliações', rows.assessments)}
          {section('Eventos', rows.events)}

          {preview.rejected.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-warn">
                {preview.rejected.length} {preview.rejected.length === 1 ? 'linha não reconhecida' : 'linhas não reconhecidas'} (não serão importadas)
              </p>
              <ul className="max-h-32 space-y-1 overflow-y-auto rounded-xl bg-surface-2 p-3 font-mono text-xs text-warn">
                {preview.rejected.map((line, i) => (
                  <li key={i} className="break-all">{line}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
