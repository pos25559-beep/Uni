import { Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { hasCustomGeminiKey } from '../../integrations/gemini';
import { resolveUniAccessory } from '../../lib/uniAccessories';
import { useUniAgent } from '../../lib/uniAgents';
import { requestAiConsent } from '../../store/useAiConsentStore';
import { useStore } from '../../store/useStore';
import type { Course } from '../../types';
import { Composer } from '../assistant/Composer';
import { Markdown } from '../assistant/Markdown';
import UniToolProposalCard from '../assistant/UniToolProposalCard';
import { useAssistantChat } from '../assistant/useAssistantChat';
import { UniBuddy } from '../brand/UnipediaMarks';
import { Button } from '../ui';

/**
 * Chat do Uni especialista dentro do ecrã de foco (só em ecrã inteiro). Usa o mesmo estado
 * do Tutor, por isso as mensagens ficam na conversa da cadeira e aparecem depois no Tutor.
 */
export default function FocusUniChat({ course, onClose }: { course: Course; onClose: () => void }) {
  const { t } = useTranslation(['plan', 'assistant']);
  const courses = useStore((s) => s.courses);
  const materials = useStore((s) => s.materials);
  const academicProfile = useStore((s) => s.academicProfile);
  const uniPreference = useStore((s) => s.settings.uniAccessory);
  const uniPersona = useStore((s) => s.settings.uniPersona ?? 'amigo');
  const aiConsent = useStore((s) => Boolean(s.settings.aiConsent));
  const hasCustomKey = useStore((s) => Boolean(s.settings.geminiApiKey?.trim()) || hasCustomGeminiKey());
  const userName = useStore((s) => s.settings.userName);
  const setIntegration = useStore((s) => s.setIntegration);
  const { agent } = useUniAgent(course.id);
  const uniAccessory = useMemo(
    () => resolveUniAccessory(uniPreference, course.name, course.shortName, academicProfile?.degreeName),
    [uniPreference, course.name, course.shortName, academicProfile?.degreeName],
  );

  const chat = useAssistantChat({
    activeCourseId: course.id,
    setActiveCourseId: () => {},
    activeSubject: 'all',
    activeCourse: course,
    courses,
    materials,
    academicProfile,
    hasCustomKey,
    uniAccessory,
    uniPersona: agent?.personaId ?? uniPersona,
    uniAgent: agent,
    userName,
    setIntegration,
    persistSessionState: false,
  });

  // Usa a conversa mais recente desta cadeira; se não houver, cria uma (uma só vez).
  const pickedRef = useRef(false);
  const { currentConv, filteredConversations, setActiveConvId, handleCreateConversation, user, conversations } = chat;
  useEffect(() => {
    if (pickedRef.current) return;
    if (currentConv?.courseId === course.id) {
      pickedRef.current = true;
      return;
    }
    if (filteredConversations.length > 0) {
      pickedRef.current = true;
      setActiveConvId(filteredConversations[0].id);
      return;
    }
    // Espera pela primeira leitura das conversas antes de criar uma nova.
    if (user && conversations.length === 0) return;
    pickedRef.current = true;
    void handleCreateConversation({ courseId: course.id, subject: 'duvidas' });
  }, [course.id, conversations.length, currentConv?.courseId, filteredConversations, handleCreateConversation, setActiveConvId, user]);

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [chat.messages.length, chat.streamingText]);

  const name = agent?.name ?? course.shortName;

  return (
    <aside
      aria-label={t('plan:focus.chat.region', { name })}
      className="flex h-full min-h-0 flex-col rounded-t-3xl border border-line bg-bg lg:rounded-3xl"
    >
      <header className="flex items-center gap-2 border-b border-line px-4 py-2">
        <UniBuddy
          size={28}
          mood={chat.loading ? 'thinking' : 'calm'}
          accessory={uniAccessory}
          skin={agent?.skinId}
          {...(agent ? { form: agent.formId, stage: agent.stage } : {})}
          interactive={false}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-fg">{name}</p>
          <p className="truncate text-xs text-muted">{t('plan:focus.chat.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('plan:focus.chat.close')}
          className="flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
        >
          <X size={18} />
        </button>
      </header>

      <div role="log" aria-live="polite" className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {chat.messages.length === 0 && !chat.loading && (
          <p className="px-2 py-6 text-center text-sm text-muted">{t('plan:focus.chat.empty', { name })}</p>
        )}
        {chat.messages.map((m) =>
          m.role === 'user' ? (
            <div
              key={m.id}
              className="ml-auto max-w-[85%] whitespace-pre-wrap break-words rounded-3xl rounded-br-md bg-ink-cta px-3.5 py-2.5 text-sm text-ink-cta-fg"
            >
              {m.text}
            </div>
          ) : (
            <div key={m.id} className="max-w-[95%] rounded-3xl rounded-bl-md bg-surface px-3.5 py-3 text-sm">
              <Markdown text={m.text} />
              {chat.pendingToolsByMsgId[m.id]?.map((proposal) => (
                <UniToolProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  busy={chat.busyToolId === proposal.id}
                  onConfirm={() => void chat.confirmToolProposal(m.id, proposal.id)}
                  onCancel={() => chat.cancelToolProposal(m.id, proposal.id)}
                />
              ))}
            </div>
          ),
        )}
        {chat.loading && chat.streamingText && (
          <div className="max-w-[95%] rounded-3xl rounded-bl-md bg-surface px-3.5 py-3 text-sm">
            <Markdown text={chat.streamingText} />
          </div>
        )}
        {chat.loading && !chat.streamingText && (
          <div role="status" className="flex w-fit items-center gap-2 rounded-3xl bg-surface px-3.5 py-2 text-sm text-muted">
            <Sparkles size={14} className="animate-pulse text-accent" />
            {t('assistant:page.thinkingNow')}
          </div>
        )}
        {chat.error && (
          <div role="alert" className="rounded-2xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
            {chat.error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-line px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {!aiConsent ? (
          <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs text-muted">
            <span>{t('plan:focus.chat.needConsent')}</span>
            <Button size="sm" variant="primary" onClick={() => requestAiConsent()}>
              {t('assistant:page.enableBtn')}
            </Button>
          </div>
        ) : (
          <Composer
            disabled={chat.loading}
            loading={chat.loading}
            onSend={chat.send}
            onStop={chat.stop}
            hidePaperclipOnMobile
            placeholder={t('plan:focus.chat.placeholder', { name })}
          />
        )}
      </div>
    </aside>
  );
}
