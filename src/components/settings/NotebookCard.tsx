import { BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../ui';

export default function NotebookCard() {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
          <BookOpen size={18} />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">NotebookLM</h3>
          <p className="mt-0.5 text-xs text-muted">Cadernos de estudo ligados por link.</p>
        </div>
      </div>
      <p className="text-sm text-muted">
        O NotebookLM não tem API pública. Os cadernos são ligados por link: por cadeira, na página de cada cadeira, ou na página de Materiais.
      </p>
      <div className="flex flex-wrap gap-2 text-sm">
        <Link to="/cadeiras" className="rounded-xl border border-line bg-surface-2 px-3 py-2 font-medium text-accent hover:border-accent">
          Ver cadeiras
        </Link>
        <Link to="/materiais" className="rounded-xl border border-line bg-surface-2 px-3 py-2 font-medium text-accent hover:border-accent">
          Ver materiais
        </Link>
      </div>
    </Card>
  );
}
