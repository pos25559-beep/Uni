import { ClipboardList, Pencil, Plus, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { kindLabel } from '../../lib/colors';
import { daysUntil, fmtGrade, gradeSummary, parsePtGrade } from '../../lib/selectors';
import { useStore } from '../../store/useStore';
import type { Assessment, Course } from '../../types';
import { Badge, Button, Card, EmptyState, Input, Modal, Progress } from '../ui';
import AssessmentFormModal from './AssessmentFormModal';
import { DeleteButton } from './ConfirmModal';
import { dueLabel, fmtAssessmentDate, sortAssessments } from './helpers';

interface Props {
  course: Course;
}

export default function AssessmentsTab({ course }: Props) {
  const allAssessments = useStore((s) => s.assessments);
  const patch = useStore((s) => s.patch);
  const remove = useStore((s) => s.remove);
  const [form, setForm] = useState<Assessment | 'new' | null>(null);
  const [pendingFutureGrade, setPendingFutureGrade] = useState<{
    assessment: Assessment;
    grade: number;
    daysLeft: number;
  } | null>(null);

  const mine = useMemo(
    () => sortAssessments(allAssessments.filter((a) => a.courseId === course.id)),
    [allAssessments, course.id],
  );
  const summary = useMemo(() => gradeSummary(course, allAssessments), [course, allAssessments]);
  const weightOk = Math.round(summary.totalWeight) === 100;

  return (
    <div className="space-y-4">
      <Card title="Resumo de notas" action={
        <Button variant="primary" size="sm" onClick={() => setForm('new')}>
          <Plus size={14} /> Nova avaliação
        </Button>
      }>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted">Média ponderada atual</p>
            <p className="mt-1 text-xl font-semibold tabular">{fmtGrade(summary.current)}</p>
          </div>
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>Peso já avaliado</span>
              <span className="tabular">{Math.round(summary.gradedWeight)}%</span>
            </div>
            <Progress value={summary.gradedWeight / 100} className="mt-2" />
          </div>
        </div>
        <div className="mt-4">
          {weightOk ? (
            <Badge tone="ok"><CheckCircle2 size={12} /> Pesos somam 100%</Badge>
          ) : (
            <Badge tone="warn"><AlertTriangle size={12} /> Peso total {Math.round(summary.totalWeight)}% (deve somar 100%)</Badge>
          )}
        </div>
      </Card>

      {mine.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={28} />}
          title="Sem avaliações"
          hint="Regista testes, exames e trabalhos com o respetivo peso para calcular a nota final."
          action={<Button variant="primary" onClick={() => setForm('new')}><Plus size={16} /> Nova avaliação</Button>}
        />
      ) : (
        <ul className="space-y-2">
          {mine.map((a) => (
            <li key={a.id} className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="accent">{kindLabel[a.kind]}</Badge>
                  <span className="truncate text-sm font-medium">{a.title}</span>
                </div>
                <p className="mt-1 text-xs text-muted tabular">
                  {fmtAssessmentDate(a.date)} · {dueLabel(a.date)} · {a.weight}% · {a.topicIds.length} tópicos
                  {a.location ? ` · ${a.location}` : ''}
                </p>
              </div>

              <div className="flex items-center justify-between gap-2 sm:justify-end">
                <GradeInput
                  key={`${a.id}-${a.grade ?? ''}`}
                  value={a.grade}
                  onCommit={(grade) => {
                    const daysLeft = daysUntil(a.date);
                    if (grade !== undefined && daysLeft > 0) {
                      setPendingFutureGrade({ assessment: a, grade, daysLeft });
                      return;
                    }
                    patch('assessments', a.id, { grade });
                  }}
                />
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" aria-label="Editar avaliação" title="Editar" onClick={() => setForm(a)}>
                    <Pencil size={14} />
                  </Button>
                  <DeleteButton
                    message={`Apagar a avaliação "${a.title}"?`}
                    onConfirm={() => remove('assessments', a.id)}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {form && (
        <AssessmentFormModal
          course={course}
          assessment={form === 'new' ? undefined : form}
          onClose={() => setForm(null)}
        />
      )}

      <Modal
        open={Boolean(pendingFutureGrade)}
        onClose={() => setPendingFutureGrade(null)}
        title="Já realizaste esta avaliação?"
      >
        {pendingFutureGrade && (
          <div className="space-y-4 text-sm">
            <p className="text-muted leading-relaxed">
              <strong className="text-fg">{pendingFutureGrade.assessment.title}</strong> está marcada para daqui a{' '}
              <strong className="text-fg">
                {pendingFutureGrade.daysLeft} {pendingFutureGrade.daysLeft === 1 ? 'dia' : 'dias'}
              </strong>
              . Ao guardar a nota <strong className="text-fg tabular">{fmtGrade(pendingFutureGrade.grade)}</strong>, esta avaliação passa a contar como concluída no plano.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => setPendingFutureGrade(null)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  patch('assessments', pendingFutureGrade.assessment.id, { grade: pendingFutureGrade.grade });
                  setPendingFutureGrade(null);
                }}
              >
                Sim, já realizei
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/** Nota inline (0–20) em formato português ou decimal. Vazio = ainda não avaliado. */
function GradeInput({ value, onCommit }: { value?: number; onCommit: (grade: number | undefined) => void }) {
  const [text, setText] = useState(() => (value !== undefined ? fmtGrade(value) : ''));
  const [error, setError] = useState<string | null>(null);

  const commit = () => {
    const parsed = parsePtGrade(text);
    if (parsed === 'invalid') {
      setError('Usa um valor entre 0 e 20 (ex.: 12,5)');
      return;
    }
    setError(null);
    if (parsed === null) {
      if (value !== undefined) onCommit(undefined);
      return;
    }
    setText(fmtGrade(parsed));
    if (parsed !== value) onCommit(parsed);
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <label className="flex items-center gap-2 text-xs text-muted">
        <span className="hidden sm:inline">Nota</span>
        <Input
          type="text"
          inputMode="decimal"
          aria-label="Nota (0 a 20)"
          aria-invalid={Boolean(error)}
          placeholder="—"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError(null);
          }}
          className="min-h-[44px] w-20 text-right tabular sm:min-h-[36px]"
          onBlur={commit}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (e.nativeEvent.isComposing || e.keyCode === 229) return;
            if (e.key === 'Enter') {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
        />
      </label>
      {error && (
        <span role="alert" className="text-xs font-medium text-coral-ink">
          {error}
        </span>
      )}
    </div>
  );
}
