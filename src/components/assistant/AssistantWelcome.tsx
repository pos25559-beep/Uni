import { Brain, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TUTOR_SUBJECTS } from '../../lib/geminiConversations';
import type { UniAgentRecord } from '../../lib/localDb';
import type { UniAccessoryId } from '../../lib/uniAccessories';
import { getStageInfo } from '../../lib/uniMastery';
import { cx } from '../../lib/uiHelpers';
import type { AppLanguage, Course, UniPetId, UniSkinId } from '../../types';
import { UniBuddy, UniPetBuddy } from '../brand/UnipediaMarks';

export interface AssistantWelcomeProps {
  isMinimal: boolean;
  loading: boolean;
  uniWelcomeMood: 'happy' | 'calm' | 'curious' | 'thinking';
  courseUniAgent?: UniAgentRecord | null;
  activeCourse?: Course;
  globalUniSkin: UniSkinId;
  globalUniPet: UniPetId;
  uniAccessory: UniAccessoryId;
  firstName: string;
  appLang: AppLanguage;
  activeSubject: string;
  onChangeSubject: (subject: string) => void;
  attachedCount: number;
  recentLogSuggestion: string | null;
  onSendStarter: (text: string) => void;
  onOpenCourseUniMemory: () => void;
  onOpenCollectibles: () => void;
}

export function AssistantWelcome(props: AssistantWelcomeProps) {
  const {
    isMinimal,
    loading,
    uniWelcomeMood,
    courseUniAgent,
    activeCourse,
    globalUniSkin,
    globalUniPet,
    uniAccessory,
    firstName,
    appLang,
    activeSubject,
    onChangeSubject,
    attachedCount,
    recentLogSuggestion,
    onSendStarter,
    onOpenCourseUniMemory,
    onOpenCollectibles,
  } = props;
  const { t } = useTranslation('assistant');

  return (
    <section
      className={cx(
        'mx-auto flex min-h-full w-full max-w-xl flex-col items-center justify-center px-2 py-4 text-center sm:px-6 sm:py-8',
        !isMinimal &&
          'bg-[radial-gradient(ellipse_at_50%_42%,rgba(201,220,159,0.22),transparent_68%)] dark:bg-[radial-gradient(ellipse_at_50%_42%,rgba(21,127,88,0.16),transparent_65%)]',
      )}
    >
      {!isMinimal ? (
        <div className="relative flex size-16 shrink-0 items-center justify-center rounded-full bg-pastel-butter/75 shadow-card dark:bg-surface-2 sm:size-20">
          <UniBuddy
            mood={uniWelcomeMood}
            form={courseUniAgent?.formId}
            stage={courseUniAgent?.stage}
            skin={courseUniAgent?.skinId ?? globalUniSkin}
            accessory={uniAccessory}
            size={44}
            onClick={() =>
              courseUniAgent ? onOpenCourseUniMemory() : onOpenCollectibles()
            }
            ariaLabel={
              courseUniAgent
                ? t('page.agentAria', { name: courseUniAgent.name })
                : t('page.uniAria')
            }
          />
          {(courseUniAgent?.petId ?? globalUniPet) !== 'none' && (
            <span className="absolute -bottom-1 -right-1 rounded-full bg-surface p-0.5 shadow-xs">
              <UniPetBuddy
                pet={(courseUniAgent?.petId ?? globalUniPet) as Exclude<UniPetId, 'none'>}
                size={22}
              />
            </span>
          )}
        </div>
      ) : (
        <div className="grid size-12 shrink-0 place-items-center rounded-full border border-line bg-surface text-accent">
          <Sparkles size={20} />
        </div>
      )}

      <h2 className="mt-4 font-display text-2xl font-bold leading-tight tracking-tight text-fg sm:mt-5 sm:text-3xl">
        {t('page.hello', { name: firstName ? `, ${firstName}` : '' })}{' '}
        <span className="block sm:inline">
          {courseUniAgent ? (
            activeCourse?.shortName &&
            courseUniAgent.name.trim().toLowerCase() ===
              activeCourse.shortName.trim().toLowerCase() ? (
              <>
                {t('page.hereIs', { name: '' }).trim()}{' '}
                <span
                  className={cx(
                    !isMinimal && 'font-serif font-medium italic text-accent-ink dark:text-accent',
                  )}
                >
                  {courseUniAgent.name}
                </span>
                .
              </>
            ) : (
              <>
                {t('page.hereIs', { name: courseUniAgent.name })}{' '}
                {activeCourse?.shortName && (
                  <span
                    className={cx(
                      !isMinimal && 'font-serif font-medium italic text-accent-ink dark:text-accent',
                    )}
                  >
                    ({activeCourse.shortName})
                  </span>
                )}
                .
              </>
            )
          ) : (
            <>
              {t('page.whatOn')}{' '}
              <span
                className={cx(
                  !isMinimal && 'font-serif font-medium italic text-accent-ink dark:text-accent',
                )}
              >
                {t('page.thinking')}
              </span>
              ?
            </>
          )}
        </span>
      </h2>
      <p className="mt-2 max-w-sm text-xs leading-relaxed text-muted sm:text-sm">
        {courseUniAgent
          ? t('specialistIntro', {
              stage: getStageInfo(courseUniAgent.stage, appLang).localizedLabel,
              mastery: courseUniAgent.mastery,
            })
          : t('page.introGeneric')}
      </p>
      {courseUniAgent && (
        <button
          type="button"
          onClick={onOpenCourseUniMemory}
          className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-xs font-semibold text-fg transition hover:border-accent"
        >
          <Brain size={14} className="text-accent" />
          {t('whatKnowsBtn', { name: courseUniAgent.name })}
        </button>
      )}

      {/* Seletor discreto de assunto inline no mobile sem roubar espaço ao chat */}
      <div className="mt-4 flex max-w-full items-center gap-1.5 overflow-x-auto pb-0.5 md:hidden">
        {[{ id: 'all', label: t('page.all') }, ...TUTOR_SUBJECTS].map((subj) => {
          const active = activeSubject === subj.id;
          return (
            <button
              key={subj.id}
              type="button"
              onClick={() => onChangeSubject(subj.id)}
              className={cx(
                'min-h-11 shrink-0 rounded-full px-3.5 text-xs font-medium transition',
                active
                  ? 'bg-accent-soft font-semibold text-accent-ink'
                  : 'bg-surface/80 text-muted hover:text-fg',
              )}
            >
              {subj.label}
            </button>
          );
        })}
      </div>

      {attachedCount > 0 && (
        <p className="mt-2.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-ink">
          {t('page.activeDocsChat', { count: attachedCount })}
        </p>
      )}

      <div className="mt-4 flex flex-wrap justify-center gap-2 sm:mt-5">
        {[
          ...(recentLogSuggestion ? [recentLogSuggestion] : []),
          t('page.starter1'),
          t('page.starter2'),
          t('page.starter3'),
        ].map((starter) => (
          <button
            key={starter}
            type="button"
            disabled={loading}
            onClick={() => onSendStarter(starter)}
            className="min-h-11 rounded-full border border-line/80 bg-surface/90 px-3.5 py-1.5 text-xs font-medium text-fg shadow-sm transition hover:border-accent hover:bg-accent-soft/45 disabled:opacity-50"
          >
            {starter}
          </button>
        ))}
      </div>
    </section>
  );
}
