import type { Assessment, ID, StudySession } from '../../types';

const EXAM_REASONS = new Set(['exam_prep', 'exam_marathon', 'exam_eve']);

/**
 * Separa as sessões em atraso (`!done && date < today`) em três grupos:
 *
 * - `expired`: já não fazem sentido. A avaliação ligada (`assessmentId`) já passou
 *   (data < hoje), ou a cadeira já não tem avaliações por classificar e o motivo
 *   da sessão é de exame (`exam_prep` | `exam_marathon` | `exam_eve`).
 * - `missedGenerated`: geradas e não fixadas. O motor regenera o plano a partir de
 *   hoje, por isso já ficam recobertas pelo novo plano.
 * - `manual`: criadas à mão ou fixadas (`locked`); só se recuperam se o aluno quiser.
 *
 * Sessões de cadeiras pausadas (`pausedCourseIds`) ficam de fora de `manual`
 * e de `missedGenerated`; só aparecem em `expired` se forem de facto caducadas.
 */
export function classifyOverdue(args: {
  sessions: StudySession[];
  today: string;
  assessments: Assessment[];
  pausedCourseIds?: ID[];
}): {
  missedGenerated: StudySession[];
  manual: StudySession[];
  expired: StudySession[];
} {
  const { sessions, today, assessments, pausedCourseIds = [] } = args;
  const paused = new Set(pausedCourseIds);
  const byId = new Map(assessments.map((a) => [a.id, a] as const));
  const coursesWithOpenAssessment = new Set(
    assessments.filter((a) => a.grade === undefined).map((a) => a.courseId),
  );

  const missedGenerated: StudySession[] = [];
  const manual: StudySession[] = [];
  const expired: StudySession[] = [];

  for (const s of sessions) {
    if (s.done || s.date >= today) continue;

    const linked = s.assessmentId ? byId.get(s.assessmentId) : undefined;
    const linkedPast = !!linked && linked.date.slice(0, 10) < today;
    const examRelated = !!s.reason && EXAM_REASONS.has(s.reason.code);
    const noExamLeft = examRelated && !coursesWithOpenAssessment.has(s.courseId);

    if (linkedPast || noExamLeft) {
      expired.push(s);
      continue;
    }
    if (paused.has(s.courseId)) continue;
    if (s.generated && !s.locked) missedGenerated.push(s);
    else manual.push(s);
  }

  return { missedGenerated, manual, expired };
}
