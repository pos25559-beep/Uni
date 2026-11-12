import { ExternalLink, FileText, Pin, PinOff, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { providerLabel } from '../../lib/colors';
import { newId, useStore } from '../../store/useStore';
import type { Course, Material } from '../../types';
import { Badge, Button, EmptyState, Input } from '../ui';
import { DeleteButton } from './ConfirmModal';
import { fmtShortDate, normalizeUrl } from './helpers';

interface Props {
  course: Course;
}

export default function MaterialsTab({ course }: Props) {
  const allMaterials = useStore((s) => s.materials);
  const upsert = useStore((s) => s.upsert);
  const patch = useStore((s) => s.patch);
  const remove = useStore((s) => s.remove);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Fixados primeiro; dentro de cada grupo mantém a ordem original.
  const materials = useMemo(() => {
    const mine = allMaterials.filter((m) => m.courseId === course.id);
    return [...mine].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
  }, [allMaterials, course.id]);

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError('Indique um título.');
    const link = normalizeUrl(url);
    if (!link) return setError('Indique um link válido.');
    setError(null);
    const item: Material = { id: newId(), courseId: course.id, title: title.trim(), url: link, provider: 'link' };
    upsert('materials', item);
    setTitle('');
    setUrl('');
  };

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row" noValidate>
        <Input aria-label="Título do material" placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} className="sm:max-w-56" />
        <Input aria-label="Link do material" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} className="flex-1" />
        <Button type="submit" variant="primary">
          <Plus size={16} /> Adicionar
        </Button>
      </form>
      {error && <p className="text-sm text-danger">{error}</p>}

      {materials.length === 0 ? (
        <EmptyState
          icon={<FileText size={28} />}
          title="Sem materiais"
          hint="Guarda aqui os links para slides, fichas e pastas partilhadas desta cadeira."
        />
      ) : (
        <ul className="space-y-2">
          {materials.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
              <FileText size={18} className="shrink-0 text-muted" />
              <div className="min-w-0 flex-1">
                <a
                  href={m.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex max-w-full items-center gap-1.5 truncate text-sm font-medium hover:text-accent"
                >
                  <span className="truncate">{m.title}</span>
                  <ExternalLink size={12} className="shrink-0 text-muted" />
                </a>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <Badge>{providerLabel[m.provider]}</Badge>
                  {m.modifiedAt && <span className="tabular">Alterado {fmtShortDate(m.modifiedAt)}</span>}
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                aria-label={m.pinned ? 'Desafixar' : 'Fixar'}
                title={m.pinned ? 'Desafixar' : 'Fixar'}
                onClick={() => patch('materials', m.id, { pinned: !m.pinned })}
              >
                {m.pinned ? <PinOff size={14} /> : <Pin size={14} />}
              </Button>
              <DeleteButton message={`Remover o material "${m.title}" da lista?`} onConfirm={() => remove('materials', m.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
