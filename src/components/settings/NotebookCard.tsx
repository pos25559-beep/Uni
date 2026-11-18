import { BookOpen, ExternalLink, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { openInAppBrowser } from '../../lib/nativeBridge';
import { useStore } from '../../store/useStore';
import { Button, Card, Field, Input } from '../ui';

function isValidHttpUrlOrEmpty(raw: string): boolean {
  if (!raw) return true;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function NotebookCard() {
  const { t } = useTranslation(['settings', 'courses']);
  const personalNotebookUrl = useStore((s) => s.settings.personalNotebookUrl ?? '');
  const updateSettings = useStore((s) => s.updateSettings);
  const [draftState, setDraftState] = useState<{ base: string; draft: string }>({
    base: personalNotebookUrl,
    draft: personalNotebookUrl,
  });
  const [urlError, setUrlError] = useState<string | null>(null);
  const urlDraft = draftState.base === personalNotebookUrl ? draftState.draft : personalNotebookUrl;

  const commitUrl = (raw: string) => {
    const trimmed = raw.trim();
    if (!isValidHttpUrlOrEmpty(trimmed)) {
      setUrlError(t('courses:materialsModals.addLink.invalidUrl'));
      return;
    }
    setUrlError(null);
    if (trimmed !== personalNotebookUrl) {
      updateSettings({ personalNotebookUrl: trimmed });
    }
    setDraftState({ base: trimmed, draft: trimmed });
  };

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
          <BookOpen size={18} />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{t('settings:notebook.title')}</h3>
          <p className="mt-0.5 text-xs text-muted">
            {t('settings:notebook.desc')}
          </p>
        </div>
      </div>

      <Field label={t('settings:notebook.urlLabel')} error={urlError ?? undefined}>
        <Input
          value={urlDraft}
          placeholder={t('settings:notebook.urlPlaceholder')}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            setDraftState({ base: personalNotebookUrl, draft: e.target.value });
            if (urlError) setUrlError(null);
          }}
          onBlur={() => commitUrl(urlDraft)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitUrl(urlDraft);
            }
          }}
        />
      </Field>

      <div className="flex flex-wrap gap-2 text-xs">
        <Link
          to="/assistente"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-ink-cta px-4 font-semibold text-ink-cta-fg"
        >
          <Sparkles size={14} /> {t('settings:notebook.openUniNotebook')}
        </Link>
        {isValidHttpUrlOrEmpty(urlDraft.trim()) && urlDraft.trim() && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void openInAppBrowser(urlDraft.trim())}
          >
            <ExternalLink size={14} /> {t('settings:notebook.openExternal')}
          </Button>
        )}
      </div>
    </Card>
  );
}
