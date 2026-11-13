import { ClipboardList, Pencil, Plus, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { kindLabel } from '../../lib/colors';
import { fmtGrade, gradeSummary } from '../../lib/selectors';
import { useStore } from '../../store/useStore';
import type { Assessment, Course } from '../../types';
import { Badge, Button, Card, EmptyState, Input, Progress } from '../ui';
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
                  onCommit={(grade) => patch('assessments', a.id, { grade })}
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
    </div>
  );
}

/** Nota inline (0–20). Vazio = ainda não avaliado. Grava ao sair do campo. */
function GradeInput({ value, onCommit }: { value?: number; onCommit: (grade: number | undefined) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted">
      <span className="hidden sm:inline">Nota</span>
      <Input
        type="number"
        min={0}
        max={20}
        step={0.1}
        aria-label="Nota (0 a 20)"
        placeholder="—"
        defaultValue={value ?? ''}
        className="h-8 w-20 text-right tabular"
        onBlur={(e) => {
          const raw = e.target.value.trim();
          if (raw === '') { if (value !== undefined) onCommit(undefined); return; }
          const n = Math.min(20, Math.max(0, Number(raw.replace(',', '.'))));
          if (!Number.isFinite(n)) return;
          if (n !== value) onCommit(n);
        }}
        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
          if (e.nativeEvent.isComposing || e.keyCode === 229) return;
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
    </label>
  );
}
