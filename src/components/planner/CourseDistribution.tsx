// Barras horizontais: minutos planeados e realizados por cadeira numa semana.
import { courseColors } from '../../lib/colors';
import { fmtMinutes } from '../../lib/selectors';
import type { Course } from '../../types';
import type { CourseMinutes } from '../../lib/planner';
import { CourseChip } from '../ui';

interface CourseDistributionProps {
  rows: CourseMinutes[];
  courseById: Map<string, Course>;
}

export default function CourseDistribution({ rows, courseById }: CourseDistributionProps) {
  const max = Math.max(1, ...rows.map((r) => r.planned));
  return (
    <ul className="space-y-4">
      {rows.map((r) => {
        const course = courseById.get(r.courseId);
        if (!course) return null;
        const hex = courseColors[course.color].hex;
        const plannedPct = (r.planned / max) * 100;
        const donePct = (r.done / max) * 100;
        return (
          <li key={r.courseId}>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <CourseChip course={course} />
              <span className="text-xs text-muted tabular">
                {fmtMinutes(r.done)} <span className="opacity-60">/ {fmtMinutes(r.planned)}</span>
              </span>
            </div>
            <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className="absolute inset-y-0 left-0 rounded-full opacity-30 transition-[width] duration-500"
                style={{ width: `${plannedPct}%`, backgroundColor: hex }}
              />
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
                style={{ width: `${donePct}%`, backgroundColor: hex }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
