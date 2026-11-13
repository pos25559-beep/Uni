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
          <h3 className="text-sm font-semibold">Gemini Notebook &amp; Caderno do Uni</h3>
          <p className="mt-0.5 text-xs text-muted">
            Gera guias e resumos com citações das tuas fontes dentro da Unipedia e abre os teus cadernos Gemini Notebook sem sair da app.
          </p>
        </div>
      </div>

      <Field label="Link do teu Gemini Notebook (opcional)">
        <Input
          value={personalNotebookUrl}
          placeholder="https://notebooklm.google.com/notebook/..."
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => updateSettings({ personalNotebookUrl: e.target.value.trim() })}
        />
      </Field>

      <div className="flex flex-wrap gap-2 text-xs">
        <Link
          to="/assistente"
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-ink-cta px-4 font-semibold text-ink-cta-fg"
        >
          <Sparkles size={14} /> Abrir Caderno do Uni
        </Link>
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            void openInAppBrowser(
              personalNotebookUrl.trim() || 'https://notebooklm.google.com/',
            )
          }
        >
          <ExternalLink size={14} /> Abrir Gemini Notebook na app
        </Button>
      </div>
    </Card>
  );
}
