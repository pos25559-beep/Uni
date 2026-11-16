import { Calendar, CheckCircle2, ExternalLink, GraduationCap, Mail, MapPin, Scale } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Course } from '../../types';
import { Badge, Button, Card } from '../ui';
import { courseColors } from '../../lib/colors';

interface Props {
  course: Course;
  onOpenClipModal?: () => void;
}

export default function CourseRulesTab({ course, onOpenClipModal }: Props) {
  const { t } = useTranslation('courses');
  const rules = course.rules;
  const colors = courseColors[course.color];

  return (
    <div className="space-y-6">
      {/* Cabeçalho das Regras e Fórmula */}
      <div className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <GraduationCap size={20} className={colors.text} />
            <h2 className="text-base font-semibold">{t('rulesTab.title')}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {course.clipUrl && (
              <a
                href={course.clipUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs font-medium text-fg hover:border-muted/50"
              >
                {t('rulesTab.openPortal')}
                <ExternalLink size={12} className="text-muted" />
              </a>
            )}
            {onOpenClipModal && (
              <Button size="sm" variant="secondary" onClick={onOpenClipModal}>
                {t('rulesTab.update')}
              </Button>
            )}
          </div>
        </div>

        {rules ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {/* Fórmula de Avaliação */}
            <div className="rounded-xl border border-line bg-surface-2/60 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
                <Scale size={14} />
                {t('rulesTab.formula')}
              </div>
              <p className="mt-2 font-mono text-sm font-semibold text-fg">
                {rules.evaluationFormula}
              </p>
              <p className="mt-2 text-xs text-muted">
                {t('rulesTab.formulaHint')}
              </p>
            </div>

            {/* Critério de Nota Mínima */}
            <div className="rounded-xl border border-line bg-surface-2/60 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
                <CheckCircle2 size={14} />
                {t('rulesTab.minGrade')}
              </div>
              <p className="mt-2 text-xs font-medium leading-relaxed text-fg">
                {rules.minimumGradeRule}
              </p>
              <p className="mt-2 text-xs text-muted">
                {rules.examRule}
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-line bg-surface-2 p-4 text-sm text-muted">
            {t('rulesTab.empty')}
          </div>
        )}
      </div>

      {/* Requisitos de Assiduidade e Docência */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Assiduidade & Horários de Dúvidas */}
        <Card title={t('rulesTab.attendanceCard')}>
          <div className="space-y-4 text-xs">
            <div>
              <span className="font-semibold text-fg">{t('rulesTab.attendance')}</span>
              <p className="mt-1 leading-relaxed text-muted">
                {rules?.attendanceRule || t('rulesTab.attendanceDefault')}
              </p>
            </div>

            {rules?.officeHours && (
              <div>
                <span className="font-semibold text-fg">{t('rulesTab.officeHours')}</span>
                <div className="mt-1 flex items-center gap-1.5 font-medium text-fg">
                  <Calendar size={13} className="text-muted" />
                  <span>{rules.officeHours}</span>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Corpo Docente */}
        <Card title={t('rulesTab.staff')}>
          {rules?.professors && rules.professors.length > 0 ? (
            <ul className="divide-y divide-line text-xs">
              {rules.professors.map((p, idx) => (
                <li key={idx} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-fg">{p.name}</span>
                    <Badge>{p.role}</Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-muted">
                    {p.email && (
                      <a href={`mailto:${p.email}`} className="inline-flex items-center gap-1 hover:text-accent">
                        <Mail size={12} />
                        {p.email}
                      </a>
                    )}
                    {p.office && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={12} />
                        {p.office}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-xs text-muted">
              {course.teacher ? t('rulesTab.teacher', { name: course.teacher }) : t('rulesTab.noTeacher')}
            </div>
          )}
        </Card>
      </div>

      {/* Programa sintético */}
      {rules?.syllabusSummary && rules.syllabusSummary.length > 0 && (
        <Card title={t('rulesTab.syllabus')}>
          <ul className="space-y-2 text-xs leading-relaxed text-muted">
            {rules.syllabusSummary.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-accent" />
                <span className="text-fg">{item}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
