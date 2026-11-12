import { ExternalLink, Pin, PinOff, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Select, cx } from '../ui';
import { ConfirmModal } from '../courses/ConfirmModal';
import { useStore } from '../../store/useStore';
import { courseColors, providerLabel } from '../../lib/colors';
import type { Course, Material } from '../../types';
import { materialIcon, relativeDate, safeHref } from './meta';

export default function MaterialRow({ material: m, courses, course }: {
  material: Material;
  courses: Course[];
  course: Course | undefined;
}) {
  const patch = useStore((s) => s.patch);
  const remove = useStore((s) => s.remove);

  const [confirming, setConfirming] = useState(false);

  const Icon = materialIcon(m);
  const href = safeHref(m.url);
  const modified = relativeDate(m.modifiedAt);

  return (
    <li className="flex gap-3 px-4 py-3">
      <div className={cx(
        'grid size-10 shrink-0 place-items-center rounded-xl',
        course ? courseColors[course.color].soft : 'bg-surface-2 text-muted',
      )}
      >
        <Icon size={18} />
      </div>

      <div className="min-w-0 flex-1">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="group flex min-w-0 items-center gap-1.5 text-sm font-medium text-fg hover:text-accent"
          >
            <span className="truncate">{m.title}</span>
            <ExternalLink size={12} className="shrink-0 text-muted opacity-0 transition group-hover:opacity-100" />
          </a>
        ) : (
          <span className="block truncate text-sm font-medium">{m.title}</span>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <Badge>{providerLabel[m.provider]}</Badge>
          {modified && <span>Modificado {modified}</span>}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="w-44 max-w-full">
            <Select
              aria-label={`Cadeira de ${m.title}`}
              value={m.courseId ?? ''}
              onChange={(e) => patch('materials', m.id, { courseId: e.target.value || undefined })}
            >
              <option value="">Sem cadeira</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => patch('materials', m.id, { pinned: !m.pinned })}
            aria-pressed={!!m.pinned}
          >
            {m.pinned ? <PinOff size={14} /> : <Pin size={14} />}
            {m.pinned ? 'Desafixar' : 'Fixar'}
          </Button>
          <Button size="sm" variant="danger" onClick={() => setConfirming(true)}>
            <Trash2 size={14} />
            Remover
          </Button>
        </div>
      </div>

      {confirming && (
        <ConfirmModal
          title="Remover material"
          message={`Remover "${m.title}" da biblioteca? O ficheiro na nuvem não é apagado.`}
          confirmLabel="Remover"
          onConfirm={() => remove('materials', m.id)}
          onClose={() => setConfirming(false)}
        />
      )}
    </li>
  );
}
