import { Award, BookOpenCheck, FileText, MessageSquare, Shield, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Conversation } from '../../lib/geminiConversations';
import { openUniCheckIn } from '../../lib/uniCheckInBus';
import type { UniAccessoryId, UniPersonaMode } from '../../lib/uniAccessories';
import type { Course, Material } from '../../types';
import UniCollectiblesModal from '../brand/UniCollectiblesModal';
import GeminiKeyGuideModal from '../settings/GeminiKeyGuideModal';
import { ActionSheet, Badge, Button, Modal } from '../ui';
import { ContextPanel } from './ContextPanel';
import ConversationsModal from './ConversationsModal';
import UniNotebookDrawer from './UniNotebookDrawer';

interface AssistantModalsProps {
  menuOpen: boolean;
  onCloseMenu: () => void;
  onOpenWeeklyTutor: () => void;
  onOpenDocPicker: () => void;
  onOpenCollectibles: () => void;
  onNavigateSettings: () => void;
  onOpenContextModal: () => void;
  onRequestDeleteConv: () => void;
  showDocPicker: boolean;
  onCloseDocPicker: () => void;
  hasCustomKey: boolean;
  maxAiFiles: number;
  availableMaterials: Material[];
  selectedMaterialIds: string[];
  onToggleMaterial: (id: string) => void;
  onSelectAllMaterials: (ids: string[]) => void;
  onClearAttachedMaterials: () => void;
  confirmDeleteConv: boolean;
  onCloseDeleteConv: () => void;
  onConfirmDeleteConv: () => void;
  keyGuideOpen: boolean;
  onCloseKeyGuide: () => void;
  collectiblesOpen: boolean;
  onCloseCollectibles: () => void;
  contextModalOpen: boolean;
  onCloseContextModal: () => void;
  convsModalMode: 'list' | 'new' | null;
  onCloseConvsModal: () => void;
  conversations: Conversation[];
  activeConvId: string;
  courses: Course[];
  activeCourse: Course | undefined;
  activeCourseId: string;
  activeSubject: string;
  onSelectConversation: (conv: Conversation) => void;
  onCreateConversation: (opts?: { title?: string; courseId?: string; subject?: string }) => Promise<void>;
  onRenameConversation: (conv: Conversation, title: string) => Promise<void>;
  onDeleteConversation: (id: string) => Promise<void>;
  notebookOpen: boolean;
  onCloseNotebook: () => void;
  onSendNoteToChat: (markdown: string, sourceDocTitles?: string[]) => Promise<void> | void;
  attachedMaterials: Material[];
  uniAccessory: UniAccessoryId;
  uniPersona: UniPersonaMode;
}

/** Conjunto de folhas e modais auxiliares da página Tutor (opções, anexos, histórico, caderno e diário). */
export default function AssistantModals({
  menuOpen,
  onCloseMenu,
  onOpenWeeklyTutor,
  onOpenDocPicker,
  onOpenCollectibles,
  onNavigateSettings,
  onOpenContextModal,
  onRequestDeleteConv,
  showDocPicker,
  onCloseDocPicker,
  hasCustomKey,
  maxAiFiles,
  availableMaterials,
  selectedMaterialIds,
  onToggleMaterial,
  onSelectAllMaterials,
  onClearAttachedMaterials,
  confirmDeleteConv,
  onCloseDeleteConv,
  onConfirmDeleteConv,
  keyGuideOpen,
  onCloseKeyGuide,
  collectiblesOpen,
  onCloseCollectibles,
  contextModalOpen,
  onCloseContextModal,
  convsModalMode,
  onCloseConvsModal,
  conversations,
  activeConvId,
  courses,
  activeCourse,
  activeCourseId,
  activeSubject,
  onSelectConversation,
  onCreateConversation,
  onRenameConversation,
  onDeleteConversation,
  notebookOpen,
  onCloseNotebook,
  onSendNoteToChat,
  attachedMaterials,
  uniAccessory,
  uniPersona,
}: AssistantModalsProps) {
  const { t } = useTranslation('assistant');
  return (
    <>
      <ActionSheet
        open={menuOpen}
        onClose={onCloseMenu}
        title={t('modals.optionsTitle')}
        actions={[
          {
            id: 'diary',
            label: t('modals.diary'),
            hint: t('modals.diaryHint'),
            icon: <BookOpenCheck size={16} />,
            onSelect: () => openUniCheckIn({ kind: 'day', courseId: activeCourse?.id }),
          },
          {
            id: 'checkin',
            label: t('modals.checkin'),
            hint: t('modals.checkinHint'),
            icon: <MessageSquare size={16} />,
            onSelect: onOpenWeeklyTutor,
          },
          {
            id: 'docs',
            label: t('modals.docs'),
            hint: t('modals.docsHint'),
            icon: <FileText size={16} />,
            onSelect: onOpenDocPicker,
          },
          {
            id: 'collectibles',
            label: t('modals.collectibles'),
            hint: t('modals.collectiblesHint'),
            icon: <Award size={16} />,
            onSelect: onOpenCollectibles,
          },
          {
            id: 'privacy',
            label: t('modals.privacy'),
            hint: t('modals.privacyHint'),
            icon: <Shield size={16} />,
            onSelect: onNavigateSettings,
          },
          {
            id: 'context-view',
            label: t('modals.contextView'),
            hint: t('modals.contextViewHint'),
            icon: <Shield size={16} />,
            onSelect: onOpenContextModal,
          },
          {
            id: 'clear',
            label: t('modals.clear'),
            danger: true,
            icon: <Trash2 size={16} />,
            onSelect: onRequestDeleteConv,
          },
        ]}
      />

      <Modal
        open={showDocPicker}
        onClose={onCloseDocPicker}
        title={t('modals.docsTitle')}
        footer={
          <Button variant="primary" onClick={onCloseDocPicker}>
            {t('modals.done')}
          </Button>
        }
      >
        <div className="mb-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge tone={hasCustomKey ? 'accent' : 'neutral'}>
              {hasCustomKey
                ? t('modals.modeNotebook', { n: maxAiFiles })
                : t('modals.modeNative', { n: maxAiFiles })}
            </Badge>
            {availableMaterials.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    const readableIds = availableMaterials
                      .filter((m) => m.provider === 'gdrive' || m.provider === 'upload')
                      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)))
                      .slice(0, maxAiFiles)
                      .map((m) => m.id);
                    const picked =
                      readableIds.length > 0
                        ? readableIds
                        : availableMaterials.slice(0, maxAiFiles).map((m) => m.id);
                    onSelectAllMaterials(picked);
                  }}
                  className="inline-flex min-h-11 items-center rounded-full px-2 font-semibold text-accent-ink hover:underline dark:text-accent"
                >
                  {t('modals.selectAll', { n: maxAiFiles })}
                </button>
                {selectedMaterialIds.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearAttachedMaterials}
                    className="inline-flex min-h-11 items-center rounded-full px-2 text-muted hover:text-fg"
                  >
                    {t('modals.clearSel')}
                  </button>
                )}
              </div>
            )}
          </div>
          <p className="text-xs text-muted">
            {t('modals.readInfo', { n: maxAiFiles })}
            {!hasCustomKey && (
              <>
                {' '}
                {t('modals.keyInfo')}
              </>
            )}
          </p>
        </div>
        {availableMaterials.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted">
            {t('modals.noMaterials')}
          </p>
        ) : (
          <ul className="max-h-60 divide-y divide-line overflow-y-auto">
            {availableMaterials.map((mat) => {
              const checked = selectedMaterialIds.includes(mat.id);
              const isNotebookLink = mat.provider === 'notebooklm';
              return (
                <li
                  key={mat.id}
                  onClick={() => onToggleMaterial(mat.id)}
                  className="flex min-h-11 cursor-pointer items-center justify-between rounded-xl p-2 hover:bg-surface-2"
                >
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-fg">
                      <span className="truncate">{mat.title}</span>
                      {mat.pinned && (
                        <Badge tone="accent" className="shrink-0 text-xs">
                          {t('modals.pinned')}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted">
                      {isNotebookLink
                        ? t('modals.provNotebook')
                        : mat.provider === 'gdrive'
                          ? t('modals.provDrive')
                          : mat.provider === 'upload'
                            ? t('modals.provLocal')
                            : mat.provider.toUpperCase()}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={checked}
                    aria-label={t('modals.attach', { title: mat.title })}
                    onChange={() => {}}
                    className="size-4 rounded border-line"
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Modal>

      <Modal
        open={confirmDeleteConv}
        onClose={onCloseDeleteConv}
        title={t('modals.deleteTitle')}
        footer={
          <>
            <Button onClick={onCloseDeleteConv}>{t('modals.cancel')}</Button>
            <Button variant="danger" onClick={onConfirmDeleteConv}>
              {t('modals.delete')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          {t('modals.deleteBody')}
        </p>
      </Modal>

      <GeminiKeyGuideModal open={keyGuideOpen} onClose={onCloseKeyGuide} />
      <UniCollectiblesModal open={collectiblesOpen} onClose={onCloseCollectibles} />
      {contextModalOpen && (
        <Modal
          open
          onClose={onCloseContextModal}
          title={t('modals.knowsTitle')}
          footer={
            <Button variant="primary" onClick={onCloseContextModal}>
              {t('notebook.close')}
            </Button>
          }
        >
          <ContextPanel defaultOpen />
        </Modal>
      )}
      {convsModalMode && (
        <ConversationsModal
          open
          initialTab={convsModalMode}
          onClose={onCloseConvsModal}
          conversations={conversations}
          activeConvId={activeConvId}
          courses={courses}
          defaultCourseId={activeCourseId}
          defaultSubject={activeSubject}
          onSelectConversation={onSelectConversation}
          onCreateConversation={onCreateConversation}
          onRenameConversation={onRenameConversation}
          onDeleteConversation={onDeleteConversation}
        />
      )}
      <UniNotebookDrawer
        open={notebookOpen}
        onClose={onCloseNotebook}
        courseId={activeCourse?.id}
        courseName={activeCourse?.shortName || activeCourse?.name}
        courseTopics={activeCourse?.topics}
        attachedMaterials={attachedMaterials}
        accessory={uniAccessory}
        persona={uniPersona}
        onSendToChat={(markdown) => {
          void onSendNoteToChat(
            markdown,
            attachedMaterials.map((m) => m.title),
          );
        }}
      />
    </>
  );
}
