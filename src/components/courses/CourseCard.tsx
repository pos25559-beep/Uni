import { CalendarClock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { courseColors, kindLabel } from '../../lib/colors';
import { fmtGrade, topicProgress, type GradeSummary } from '../../lib/selectors';
import type { Assessment, Course } from '../../types';
import { Badge, cx, Ring } from '../ui';
import { dueLabel } from './helpers';

interface Props {
  course: Course;
  summary: GradeSummary;
  next?: Assessment;
}

/** Estado do objetivo: no caminho certo, precisa de X, ou fora de alcance. */
function trackBadge(course: Course, summary: GradeSummary) {
  const { current, needed } = summary;
  if (current !== null && current >= course.targetGrade) return <Badge tone="ok">No objetivo</Badge>;
  if (needed === null) return <Badge tone="danger">Objetivo não atingido</Badge>;
  if (needed <= 0) return <Badge tone="ok">No objetivo</Badge>;
  if (needed > 20) return <Badge tone="danger">Objetivo fora de alcance</Badge>;
  return <Badge tone="warn">Precisa de {fmtGrade(needed)} no que falta</Badge>;
}

export default function CourseCard({ course, summary, next }: Props) {
  const progress = topicProgress(course);
  const colors = courseColors[course.color];

  return (
    <Link
      to={`/cadeiras/${course.id}`}
      className="rise group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition hover:border-muted/50 hover:shadow-sm"
    >
      <div className={cx('h-1 w-full', colors.dot)} />
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold tracking-tight group-hover:text-accent">{course.name}</h2>
            <p className="mt-0.5 truncate text-xs text-muted">
              {[course.code, `${course.ects} ECTS`, course.teacher].filter(Boolean).join(' · ')}
            </p>
          </div>
          <Ring value={progress} size={56} stroke={5} color={colors.hex}>
            <span>{Math.round(progress * 100)}%</span>
          </Ring>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-surface-2 p-3">
            <p className="text-xs text-muted">Nota atual</p>
            <p className="mt-1 text-lg font-semibold tabular">{fmtGrade(summary.current)}</p>
          </div>
          <div className="rounded-xl bg-surface-2 p-3">
            <p className="text-xs text-muted">Objetivo</p>
            <p className="mt-1 text-lg font-semibold tabular">{fmtGrade(course.targetGrade)}</p>
          </div>
        </div>

        <div>{trackBadge(course, summary)}</div>

        <div className="mt-auto flex items-center gap-2 border-t border-line pt-3 text-xs text-muted">
          <CalendarClock size={14} className="shrink-0" />
          {next ? (
            <span className="truncate">
              Próxima: {kindLabel[next.kind]} · {next.title} · <span className="font-medium text-fg">{dueLabel(next.date)}</span>
            </span>
          ) : (
            <span>Sem avaliações agendadas</span>
          )}
        </div>
      </div>
    </Link>
  );
}
