import { Check, FolderOpen, MessageSquarePlus, Pencil, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import {
  TUTOR_SUBJECTS,
  groupConversations,
  subjectLabel,
  type Conversation,
} from '../../lib/geminiConversations';
import type { Course } from '../../types';
import { Button, Input, Modal, cx } from '../ui';

interface ConversationsModalProps {
  open: boolean;
  initialTab?: 'list' | 'new';
  onClose: () => void;
  conversations: Conversation[];
  activeConvId: string;
  courses: Course[];
  defaultCourseId: string;
  defaultSubject: string;
  onSelectConversation: (conv: Conversation) => void;
  onCreateConversation: (opts: { title: string; courseId?: string; subject: string }) => Promise<void>;
  onRenameConversation: (conv: Conversation, title: string) => Promise<void>;
  onDeleteConversation: (id: string) => Promise<void>;
}

export default function ConversationsModal({
  open,
  initialTab = 'list',
  onClose,
  conversations,
  activeConvId,
  courses,
  defaultCourseId,
  defaultSubject,
  onSelectConversation,
  onCreateConversation,
  onRenameConversation,
  onDeleteConversation,
}: ConversationsModalProps) {
  const [creating, setCreating] = useState(initialTab === 'new');
  const [newTitle, setNewTitle] = useState('');
  const [newCourseId, setNewCourseId] = useState(defaultCourseId === 'all' ? '' : defaultCourseId);
  const [newSubject, setNewSubject] = useState(defaultSubject === 'all' ? 'geral' : defaultSubject);
  const [customSubject, setCustomSubject] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const groups = groupConversations(conversations, courses);

  const handleStartNew = async () => {
    const resolvedSubject = customSubject.trim() || newSubject || 'geral';
    await onCreateConversation({
      title: newTitle.trim() || 'Nova conversa',
      courseId: newCourseId || undefined,
      subject: resolvedSubject,
    });
    setNewTitle('');
    setCustomSubject('');
    setCreating(false);
    onClose();
  };

  const commitRename = async (conv: Conversation) => {
    const clean = editDraft.trim();
    if (clean && clean !== conv.title) {
      await onRenameConversation(conv, clean);
    }
    setEditingId(null);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Conversas & Assuntos"
      maxWidthClass="sm:max-w-xl"
    >
      <div className="space-y-4">
        <p className="text-xs leading-relaxed text-muted">
          Organiza o teu estudo por cadeira, tema ou tipo de preparação e apaga conversas antigas.
        </p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted">
            {conversations.length}{' '}
            {conversations.length === 1 ? 'conversa guardada' : 'conversas guardadas'}
          </p>
          <Button
            size="sm"
            variant={creating ? 'secondary' : 'primary'}
            onClick={() => setCreating((v) => !v)}
          >
            {creating ? <X size={15} /> : <MessageSquarePlus size={15} />}
            {creating ? 'Fechar criação' : 'Nova conversa por assunto'}
          </Button>
        </div>

        {creating && (
          <div className="space-y-3 rounded-[22px] border border-line bg-surface-2/65 p-4">
            <p className="font-display text-sm font-bold text-fg">Criar nova conversa</p>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">
                1. Tipo de assunto
              </label>
              <div className="flex flex-wrap gap-1.5">
                {TUTOR_SUBJECTS.map((s) => {
                  const active = !customSubject.trim() && newSubject === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setNewSubject(s.id);
                        setCustomSubject('');
                      }}
                      className={cx(
                        'min-h-[38px] rounded-full border px-3 text-xs font-semibold transition',
                        active
                          ? 'border-accent bg-ink-cta text-ink-cta-fg'
                          : 'border-line bg-surface text-fg hover:border-accent/50',
                      )}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
              <Input
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                placeholder="Ou escreve um assunto próprio (ex.: Capítulo 4, Projeto Final)…"
                className="mt-2"
              />
            </div>

            {courses.length > 0 && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">
                  2. Associar a uma cadeira (opcional)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setNewCourseId('')}
                    className={cx(
                      'min-h-[38px] rounded-full border px-3 text-xs font-semibold transition',
                      newCourseId === ''
                        ? 'border-accent bg-accent-soft text-accent'
                        : 'border-line bg-surface text-muted hover:text-fg',
                    )}
                  >
                    Geral (sem cadeira)
                  </button>
                  {courses.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setNewCourseId(c.id)}
                      className={cx(
                        'min-h-[38px] rounded-full border px-3 text-xs font-semibold transition',
                        newCourseId === c.id
                          ? 'border-accent bg-accent-soft text-accent'
                          : 'border-line bg-surface text-muted hover:text-fg',
                      )}
                    >
                      {c.shortName || c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">
                3. Título da conversa (opcional)
              </label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Deixa vazio para dar título automático com a 1.ª pergunta"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="primary" size="sm" onClick={() => void handleStartNew()}>
                <MessageSquarePlus size={15} /> Começar conversa
              </Button>
            </div>
          </div>
        )}

        {groups.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-line px-4 py-8 text-center">
            <FolderOpen size={24} className="mx-auto text-muted" />
            <p className="mt-2 text-sm font-semibold text-fg">Ainda sem conversas guardadas</p>
            <p className="mt-1 text-xs text-muted">
              Cria uma conversa acima ou envia logo a tua primeira dúvida no chat.
            </p>
          </div>
        ) : (
          <div className="max-h-[48dvh] space-y-4 overflow-y-auto pr-1">
            {groups.map((group) => (
              <div key={group.key} className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">
                  {group.label} · {group.items.length}
                </p>
                <div className="space-y-1.5">
                  {group.items.map((conv) => {
                    const isActive = conv.id === activeConvId;
                    const isEditing = editingId === conv.id;
                    const isConfirmingDelete = confirmDeleteId === conv.id;

                    return (
                      <div
                        key={conv.id}
                        className={cx(
                          'flex flex-wrap items-center justify-between gap-2 rounded-[18px] border px-3.5 py-2.5 transition',
                          isActive
                            ? 'border-accent bg-accent-soft/45'
                            : 'border-line bg-surface hover:bg-surface-2/60',
                        )}
                      >
                        {isEditing ? (
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <Input
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') void commitRename(conv);
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                              autoFocus
                            />
                            <Button
                              size="sm"
                              variant="primary"
                              iconOnly
                              aria-label="Guardar título"
                              onClick={() => void commitRename(conv)}
                            >
                              <Check size={15} />
                            </Button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectConversation(conv);
                              onClose();
                            }}
                            className="min-w-0 flex-1 text-left"
                          >
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-semibold text-fg">
                                {conv.title}
                              </span>
                              {isActive && (
                                <span className="shrink-0 rounded-full bg-ink-cta px-2 py-0.5 text-[10px] font-bold text-ink-cta-fg">
                                  Ativa
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-muted">
                              Assunto: {subjectLabel(conv.subject)}
                            </p>
                          </button>
                        )}

                        {!isEditing && (
                          <div className="flex shrink-0 items-center gap-1">
                            {isConfirmingDelete ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={async () => {
                                    await onDeleteConversation(conv.id);
                                    setConfirmDeleteId(null);
                                  }}
                                >
                                  Apagar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setConfirmDeleteId(null)}
                                >
                                  Cancelar
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  iconOnly
                                  aria-label={`Renomear ${conv.title}`}
                                  title="Renomear conversa"
                                  onClick={() => {
                                    setEditingId(conv.id);
                                    setEditDraft(conv.title);
                                  }}
                                >
                                  <Pencil size={15} />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  iconOnly
                                  aria-label={`Apagar ${conv.title}`}
                                  title="Apagar conversa"
                                  onClick={() => setConfirmDeleteId(conv.id)}
                                  className="text-danger hover:bg-danger/10"
                                >
                                  <Trash2 size={15} />
                                </Button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
