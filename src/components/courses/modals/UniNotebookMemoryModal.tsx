import { Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { UniAgentRecord } from '../../../lib/localDb';
import { cx, showToast } from '../../../lib/uiHelpers';
import { Button, Input, Modal, Switch } from '../../ui';

const LEARNING_STYLES: Array<{ id: 'exemplos' | 'teoria' | 'exercicios'; label: string }> = [
  { id: 'exemplos', label: 'Exemplos primeiro' },
  { id: 'teoria', label: 'Teoria e intuição' },
  { id: 'exercicios', label: 'Exercícios práticos' },
];

export function UniNotebookMemoryModal({
  open,
  onClose,
  agent,
  courseName,
  onUpdateAgent,
}: {
  open: boolean;
  onClose: () => void;
  agent: UniAgentRecord;
  courseName: string;
  onUpdateAgent: (next: UniAgentRecord) => Promise<void>;
}) {
  const { t } = useTranslation(['uni', 'common']);
  const [newGoal, setNewGoal] = useState('');
  const [newWeakTopic, setNewWeakTopic] = useState('');
  const [newWeakNote, setNewWeakNote] = useState('');
  const [newStrength, setNewStrength] = useState('');

  const patchNotebook = async (patch: Partial<UniAgentRecord['notebook']>, topLevel?: Partial<UniAgentRecord>) => {
    const now = new Date().toISOString();
    await onUpdateAgent({
      ...agent,
      ...topLevel,
      notebook: {
        ...agent.notebook,
        ...patch,
        updatedAt: now,
      },
      updatedAt: now,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('memory.title', { name: agent.name, course: courseName })}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              void patchNotebook({
                goals: [],
                weakSpots: [],
                strengths: [],
                customNotes: [],
                learningStyle: undefined,
              }).then(() => showToast(t('memory.cleared')));
            }}
          >
            <Trash2 size={14} /> {t('memory.deleteAll')}
          </Button>
          <Button size="sm" variant="primary" onClick={onClose}>
            {t('memory.done')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface-2/60 p-3.5">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-fg">{t('memory.auto')}</p>
            <p className="text-xs text-muted">
              {t('memory.autoHint')}
            </p>
          </div>
          <Switch
            checked={agent.memoryEnabled}
            onCheckedChange={(checked) => {
              void onUpdateAgent({
                ...agent,
                memoryEnabled: checked,
                updatedAt: new Date().toISOString(),
              });
            }}
            label={t('memory.toggle')}
          />
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted">{t('memory.pref')}</p>
          <div className="flex flex-wrap gap-1.5">
            {LEARNING_STYLES.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => void patchNotebook({ learningStyle: st.id })}
                className={cx(
                  'min-h-11 rounded-full border px-3 text-xs font-semibold transition',
                  agent.notebook.learningStyle === st.id
                    ? 'border-accent bg-accent-soft text-accent-ink'
                    : 'border-line bg-surface-2 text-muted hover:text-fg',
                )}
              >
                {t(`memory.style.${st.id}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted">{t('memory.goals')}</p>
          {agent.notebook.goals.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {agent.notebook.goals.map((g, idx) => (
                <span
                  key={`${g}-${idx}`}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface-2 py-1 pl-3 pr-1.5 text-xs font-medium text-fg"
                >
                  <span>{g}</span>
                  <button
                    type="button"
                    aria-label={t('memory.removeGoal', { x: g })}
                    onClick={() =>
                      void patchNotebook({
                        goals: agent.notebook.goals.filter((_, i) => i !== idx),
                      })
                    }
                    className="grid size-9 place-items-center rounded-full text-muted hover:bg-coral-soft hover:text-coral"
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              placeholder={t('memory.goalPh')}
              maxLength={120}
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={!newGoal.trim()}
              onClick={() => {
                const next = newGoal.trim();
                if (!next) return;
                setNewGoal('');
                void patchNotebook({
                  goals: [...agent.notebook.goals, next].slice(0, 10),
                });
              }}
            >
              <Plus size={14} /> {t('memory.join')}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted">{t('memory.weak')}</p>
          {agent.notebook.weakSpots.length === 0 ? (
            <p className="rounded-xl bg-surface-2/60 px-3 py-2 text-xs text-muted">
              {t('memory.noWeak')}
            </p>
          ) : (
            <div className="space-y-1.5">
              {agent.notebook.weakSpots.map((w, idx) => (
                <div
                  key={`${w.topic}-${idx}`}
                  className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-surface px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-fg">{w.topic}</p>
                    <p className="text-xs text-muted">{w.note}</p>
                  </div>
                  <button
                    type="button"
                    aria-label={t('memory.removeWeak', { x: w.topic })}
                    onClick={() =>
                      void patchNotebook({
                        weakSpots: agent.notebook.weakSpots.filter((_, i) => i !== idx),
                      })
                    }
                    className="grid size-11 shrink-0 place-items-center rounded-xl text-muted hover:bg-coral-soft hover:text-coral"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
            <Input
              value={newWeakTopic}
              onChange={(e) => setNewWeakTopic(e.target.value)}
              placeholder={t('memory.topicPh')}
              maxLength={60}
            />
            <Input
              value={newWeakNote}
              onChange={(e) => setNewWeakNote(e.target.value)}
              placeholder={t('memory.notePh')}
              maxLength={140}
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={!newWeakTopic.trim() || !newWeakNote.trim()}
              onClick={() => {
                const t = newWeakTopic.trim();
                const n = newWeakNote.trim();
                if (!t || !n) return;
                setNewWeakTopic('');
                setNewWeakNote('');
                void patchNotebook({
                  weakSpots: [{ topic: t, note: n, seen: 1 }, ...agent.notebook.weakSpots].slice(0, 6),
                });
              }}
            >
              <Plus size={14} />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted">{t('memory.strong')}</p>
          {agent.notebook.strengths.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {agent.notebook.strengths.map((st, idx) => (
                <span
                  key={`${st}-${idx}`}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-ok/30 bg-accent-soft/40 py-1 pl-3 pr-1.5 text-xs font-medium text-ok-ink"
                >
                  <span>{st}</span>
                  <button
                    type="button"
                    aria-label={t('memory.removeStrong', { x: st })}
                    onClick={() =>
                      void patchNotebook({
                        strengths: agent.notebook.strengths.filter((_, i) => i !== idx),
                      })
                    }
                    className="grid size-9 place-items-center rounded-full text-muted hover:bg-coral-soft hover:text-coral"
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={newStrength}
              onChange={(e) => setNewStrength(e.target.value)}
              placeholder={t('memory.strongPh')}
              maxLength={120}
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={!newStrength.trim()}
              onClick={() => {
                const s = newStrength.trim();
                if (!s) return;
                setNewStrength('');
                void patchNotebook({
                  strengths: [s, ...agent.notebook.strengths].slice(0, 6),
                });
              }}
            >
              <Plus size={14} /> {t('memory.join')}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
