import { BookOpen, ExternalLink, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { openInAppBrowser } from '../../lib/nativeBridge';
import { useStore } from '../../store/useStore';
import { Button, Card, Field, Input } from '../ui';

export default function NotebookCard() {
  const personalNotebookUrl = useStore((s) => s.settings.personalNotebookUrl ?? '');
  const updateSettings = useStore((s) => s.updateSettings);

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
          <BookOpen size={18} />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Caderno do Uni &amp; Atalho Externo</h3>
          <p className="mt-0.5 text-xs text-muted">
            Cria fichas, guias e quizzes diretamente aqui dentro no Caderno do Uni, ou guarda opcionalmente um atalho privado para um caderno externo.
          </p>
        </div>
      </div>

      <Field label="Atalho direto para um caderno externo (URL opcional)">
        <Input
          value={personalNotebookUrl}
          placeholder="Opcional: https://..."
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => updateSettings({ personalNotebookUrl: e.target.value.trim() })}
        />
      </Field>

      <div className="flex flex-wrap gap-2 text-xs">
        <Link
          to="/assistente"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-ink-cta px-4 font-semibold text-ink-cta-fg"
        >
          <Sparkles size={14} /> Abrir Caderno do Uni
        </Link>
        {personalNotebookUrl.trim() && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void openInAppBrowser(personalNotebookUrl.trim())}
          >
            <ExternalLink size={14} /> Abrir caderno externo
          </Button>
        )}
      </div>
    </Card>
  );
}
