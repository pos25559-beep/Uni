import { Award, BookOpenCheck, FileText, MessageSquare, Shield, Trash2 } from 'lucide-react';
import {
  appendMessage,
  type Conversation,
} from '../../lib/geminiConversations';
import { openUniCheckIn } from '../../lib/uniCheckInBus';
import type { UniAccessoryId, UniPersonaMode } from '../../lib/uniAccessories';
import { newId } from '../../store/useStore';
import type { Course, Material } from '../../types';
import UniCollectiblesModal from '../brand/UniCollectiblesModal';
import GeminiKeyGuideModal from '../settings/GeminiKeyGuideModal';
import { ActionSheet, Badge, Button, Modal } from '../ui';
import { ContextPanel } from './ContextPanel';
import ConversationsModal from './ConversationsModal';
import UniNotebookDrawer from './UniNotebookDrawer';
import WeeklyTutorModal from './WeeklyTutorModal';

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
  tutorOpen: boolean;
  onCloseTutor: () => void;
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
  tutorOpen,
  onCloseTutor,
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
  attachedMaterials,
  uniAccessory,
  uniPersona,
}: AssistantModalsProps) {
  return (
    <>
      <ActionSheet
        open={menuOpen}
        onClose={onCloseMenu}
        title="Opções do Tutor"
        actions={[
          {
            id: 'diary',
            label: 'Fazer check-in / Diário',
            hint: 'Regista aula, fim do dia ou matéria de teste com o Uni',
            icon: <BookOpenCheck size={16} />,
            onSelect: () => openUniCheckIn({ kind: 'day', courseId: activeCourse?.id }),
          },
          {
            id: 'checkin',
            label: 'Check-in semanal',
            hint: 'Avalia o ritmo e ajusta o planeador',
            icon: <MessageSquare size={16} />,
            onSelect: onOpenWeeklyTutor,
          },
          {
            id: 'docs',
            label: 'Anexar documentos',
            hint: 'Seleciona PDFs ou links como contexto',
            icon: <FileText size={16} />,
            onSelect: onOpenDocPicker,
          },
          {
            id: 'collectibles',
            label: 'Coleção do Uni',
            hint: 'Estilos e acessórios desbloqueados',
            icon: <Award size={16} />,
            onSelect: onOpenCollectibles,
          },
          {
            id: 'privacy',
            label: 'Preferências do Uni',
            hint: 'Gerir permissões e modelo do Uni',
            icon: <Shield size={16} />,
            onSelect: onNavigateSettings,
          },
          {
            id: 'context-view',
            label: 'O que o Uni sabe',
            hint: 'Ver resumo enviado com as perguntas',
            icon: <Shield size={16} />,
            onSelect: onOpenContextModal,
          },
          {
            id: 'clear',
            label: 'Apagar esta conversa',
            danger: true,
            icon: <Trash2 size={16} />,
            onSelect: onRequestDeleteConv,
          },
        ]}
      />

      <Modal
        open={showDocPicker}
        onClose={onCloseDocPicker}
        title="Anexar Documentos de Estudo"
        footer={
          <Button variant="primary" onClick={onCloseDocPicker}>
            Concluir
          </Button>
        }
      >
        <div className="mb-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge tone={hasCustomKey ? 'accent' : 'neutral'}>
              {hasCustomKey
                ? `Modo Caderno ativo · até ${maxAiFiles} fontes`
                : `Modo Nativo · até ${maxAiFiles} fontes`}
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
                  className="font-semibold text-accent-ink hover:underline dark:text-accent"
                >
                  Selecionar tudo (até {maxAiFiles})
                </button>
                {selectedMaterialIds.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearAttachedMaterials}
                    className="text-muted hover:text-fg"
                  >
                    Limpar
                  </button>
                )}
              </div>
            )}
          </div>
          <p className="text-xs text-muted">
            Até <strong className="text-fg">{maxAiFiles} PDFs, Google Docs ou ficheiros locais</strong> têm
            o conteúdo real lido por pergunta; materiais{' '}
            <span className="font-medium text-fg">Fixados</span> da cadeira entram automaticamente.
            {!hasCustomKey && (
              <>
                {' '}
                Com chave pessoal Google Gemini podes ler até <strong className="text-fg">12 fontes</strong> de uma vez (estilo Google Notebook).
              </>
            )}
          </p>
        </div>
        {availableMaterials.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted">
            Nenhum material encontrado para esta cadeira. Podes adicionar na página Materiais.
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
                  className="flex cursor-pointer items-center justify-between rounded-xl p-2 hover:bg-surface-2"
                >
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-fg">
                      <span className="truncate">{mat.title}</span>
                      {mat.pinned && (
                        <Badge tone="accent" className="shrink-0 text-xs">
                          Fixado
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted">
                      {isNotebookLink
                        ? 'LINK NOTEBOOK · cola resumos no Caderno do Uni'
                        : mat.provider === 'gdrive'
                          ? 'GOOGLE DRIVE · leitura direta de PDF/Doc'
                          : mat.provider === 'upload'
                            ? 'FICHEIRO LOCAL · leitura direta'
                            : mat.provider.toUpperCase()}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={checked}
                    aria-label={`Anexar ${mat.title}`}
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
        title="Apagar conversa?"
        footer={
          <>
            <Button onClick={onCloseDeleteConv}>Cancelar</Button>
            <Button variant="danger" onClick={onConfirmDeleteConv}>
              Apagar
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Apaga o histórico de mensagens desta conversa. Os teus dados de estudo e outras conversas
          não são afetados.
        </p>
      </Modal>

      <WeeklyTutorModal open={tutorOpen} onClose={onCloseTutor} />
      <GeminiKeyGuideModal open={keyGuideOpen} onClose={onCloseKeyGuide} />
      <UniCollectiblesModal open={collectiblesOpen} onClose={onCloseCollectibles} />
      {contextModalOpen && (
        <Modal
          open
          onClose={onCloseContextModal}
          title="O que o Uni sabe"
          footer={
            <Button variant="primary" onClick={onCloseContextModal}>
              Fechar
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
        courseName={activeCourse?.shortName || activeCourse?.name}
        attachedMaterials={attachedMaterials}
        accessory={uniAccessory}
        persona={uniPersona}
        onSendToChat={(markdown) => {
          void appendMessage(activeConvId, {
            id: newId(),
            role: 'model',
            text: markdown,
            at: new Date().toISOString(),
            sourceDocTitles: attachedMaterials.map((m) => m.title),
          });
        }}
      />
    </>
  );
}
