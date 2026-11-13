import { BookOpen, ExternalLink, FileText, Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { generateNotebookBrief, type NotebookSourceInput } from '../../integrations/gemini';
import { openInAppBrowser } from '../../lib/nativeBridge';
import type { UniAccessoryId, UniPersonaMode } from '../../lib/uniAccessories';
import { useStore } from '../../store/useStore';
import type { Material } from '../../types';
import { UniBuddy } from '../brand/UnipediaMarks';
import { Button, Modal, Textarea, cx } from '../ui';
import { Markdown } from './Markdown';

export default function UniNotebookDrawer({
  open,
  onClose,
  courseName,
  attachedMaterials,
  accessory,
  persona,
  onSendToChat,
}: {
  open: boolean;
  onClose: () => void;
  courseName?: string;
  attachedMaterials: Material[];
  accessory: UniAccessoryId;
  persona: UniPersonaMode;
  onSendToChat: (markdown: string) => void;
}) {
  const personalNotebookUrl = useStore((s) => s.settings.personalNotebookUrl?.trim() ?? '');
  const [notesSource, setNotesSource] = useState('');
  const [mode, setMode] = useState<'guide' | 'quiz' | 'summary'>('guide');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<string | null>(null);

  const handleGenerate = async () => {
    setBusy(true);
    setError(null);
    try {
      const sources: NotebookSourceInput[] = [];
      for (const m of attachedMaterials) {
        sources.push({
          title: m.title,
          content: m.url
            ? `Material de referência (${m.provider}): ${m.title} — ${m.url}`
            : `Material guardado: ${m.title}`,
        });
      }
      if (notesSource.trim()) {
        sources.push({
          title: courseName ? `Apontamentos de ${courseName}` : 'As minhas notas da aula',
          content: notesSource.trim(),
        });
      }

      const result = await generateNotebookBrief({
        mode,
        sources,
        courseName,
        persona,
        accessory,
      });
      setOutput(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível gerar este caderno agora.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={courseName ? `Caderno do Uni · ${courseName}` : 'Caderno do Uni'}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              void openInAppBrowser(personalNotebookUrl || 'https://notebooklm.google.com/')
            }
          >
            <ExternalLink size={14} /> Abrir Gemini Notebook
          </Button>
          <div className="flex items-center gap-2">
            {output && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  onSendToChat(output);
                  onClose();
                }}
              >
                Usar no Tutor
              </Button>
            )}
            <Button size="sm" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-[20px] bg-[#FCE99F]/70 p-3.5 text-[#141312] dark:bg-surface-2 dark:text-[#FAF6EC]">
          <UniBuddy mood={busy ? 'thinking' : 'curious'} accessory={accessory} size={46} interactive={false} />
          <div className="min-w-0 text-xs">
            <p className="font-bold">Caderno com fontes &amp; citações</p>
            <p className="opacity-80">
              Cola texto de slides ou apontamentos e junta materiais anexados para gerar um guia ou quiz.
            </p>
          </div>
        </div>

        {attachedMaterials.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted">Fontes anexadas ({attachedMaterials.length})</p>
            <div className="flex flex-wrap gap-1.5">
              {attachedMaterials.map((m) => (
                <span
                  key={m.id}
                  className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs text-fg"
                >
                  <FileText size={12} className="text-accent" />
                  <span className="max-w-[160px] truncate">{m.title}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-muted">
            Cola apontamentos, definições ou texto da sebenta
          </label>
          <Textarea
            value={notesSource}
            onChange={(e) => setNotesSource(e.target.value)}
            placeholder="Ex: Teorema de Rolle, exemplos da aula prática, fórmulas importantes..."
            className="min-h-28"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              ['guide', 'Guia de Estudo'],
              ['quiz', 'Quiz com Citações'],
              ['summary', 'Resumo Rápido'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={cx(
                'min-h-[38px] rounded-full border px-3 text-xs font-semibold transition',
                mode === id
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-line bg-surface-2 text-muted hover:text-fg',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <Button
          variant="primary"
          onClick={() => void handleGenerate()}
          disabled={busy || (!notesSource.trim() && attachedMaterials.length === 0)}
          className="w-full"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          {busy ? 'O Uni está a organizar as fontes…' : 'Gerar a partir das fontes'}
        </Button>

        {error && (
          <p className="rounded-xl bg-coral-soft px-3 py-2 text-xs font-medium text-coral">{error}</p>
        )}

        {output && (
          <div className="max-h-64 overflow-y-auto rounded-[20px] border border-line bg-surface-2/60 p-4 text-sm">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-accent">
              <BookOpen size={13} /> Resultado do Caderno
            </div>
            <Markdown text={output} />
          </div>
        )}
      </div>
    </Modal>
  );
}
