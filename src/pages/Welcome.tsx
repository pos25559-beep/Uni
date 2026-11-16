import { ArrowRight, BookOpen, CheckCircle2, GraduationCap } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { SUPPORTED_LANGUAGES } from '../i18n';
import { UniBuddy, UnipediaLogoMark } from '../components/brand/UnipediaMarks';
import {
  UniFocusRecallScene,
  UniLearningModesScene,
  UniPlanAndConnectScene,
} from '../components/brand/WelcomeScenes';
import { StickerBadge } from '../components/motion/Primitives';
import { normalizeAppLanguage } from '../lib/grading';
import type { UniFormId } from '../lib/localDb';
import { UNIPEDIA_BOUNCE_SPRING } from '../lib/motionTokens';
import { cx } from '../lib/uiHelpers';
import { hapticTap } from '../lib/nativeBridge';
import { UNI_ACCESSORIES, type UniAccessoryId } from '../lib/uniAccessories';
import { getStageInfo } from '../lib/uniMastery';
import { useStore } from '../store/useStore';
import type { AppLanguage } from '../types';

const FORM_CHOICES: UniFormId[] = ['nuvem', 'gota', 'estrela', 'cristal', 'folha'];

export default function WelcomePage() {
  const { t, i18n } = useTranslation(['onboarding', 'uni']);
  const currentLang: AppLanguage = normalizeAppLanguage(i18n.language);
  const updateSettings = useStore((s) => s.updateSettings);
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [previewAccessory, setPreviewAccessory] = useState<UniAccessoryId>('math');
  const [previewForm, setPreviewForm] = useState<UniFormId>('cristal');

  const slides = [
    {
      id: 'overview',
      bgClass: 'bg-pastel-peach dark:bg-[#332218]',
      eyebrow: t('onboarding:welcomeSlides.overviewEyebrow'),
      title: t('onboarding:welcomeSlides.overviewTitle'),
      accent: t('onboarding:welcomeSlides.overviewAccent'),
      description: t('onboarding:welcomeSlides.overviewDesc'),
    },
    {
      id: 'learning-modes',
      bgClass: 'bg-pastel-sage dark:bg-[#192D21]',
      eyebrow: t('onboarding:welcomeSlides.cycleEyebrow'),
      title: t('onboarding:welcomeSlides.cycleTitle'),
      accent: t('onboarding:welcomeSlides.cycleAccent'),
      description: t('onboarding:welcomeSlides.cycleDesc'),
    },
    {
      id: 'plan-and-connect',
      bgClass: 'bg-pastel-sky dark:bg-[#192838]',
      eyebrow: t('onboarding:welcomeSlides.planEyebrow'),
      title: t('onboarding:welcomeSlides.planTitle'),
      accent: t('onboarding:welcomeSlides.planAccent'),
      description: t('onboarding:welcomeSlides.planDesc'),
    },
    {
      id: 'focus-recall',
      bgClass: 'bg-pastel-mint dark:bg-[#162C25]',
      eyebrow: t('onboarding:welcomeSlides.focusEyebrow'),
      title: t('onboarding:welcomeSlides.focusTitle'),
      accent: t('onboarding:welcomeSlides.focusAccent'),
      description: t('onboarding:welcomeSlides.focusDesc'),
    },
    {
      id: 'specialist-unis',
      bgClass: 'bg-pastel-butter dark:bg-[#2F2815]',
      eyebrow: t('onboarding:welcomeSlides.unisEyebrow'),
      title: t('onboarding:welcomeSlides.unisTitle'),
      accent: t('onboarding:welcomeSlides.unisAccent'),
      description: t('onboarding:welcomeSlides.unisDesc'),
    },
  ];

  const slide = slides[step];
  const isLast = step === slides.length - 1;
  const masterStageInfo = getStageInfo(4, currentLang);

  const cycleLanguage = () => {
    void hapticTap();
    const idx = SUPPORTED_LANGUAGES.indexOf(currentLang);
    const nextLang = SUPPORTED_LANGUAGES[(idx + 1) % SUPPORTED_LANGUAGES.length] ?? 'pt-PT';
    updateSettings({ language: nextLang });
  };

  const markSeen = (extra?: Parameters<typeof updateSettings>[0]) => {
    updateSettings({ hasSeenWelcome: true, ...extra });
  };

  const handlePrimary = () => {
    void hapticTap();
    if (!isLast) {
      setStep((s) => Math.min(slides.length - 1, s + 1));
      return;
    }
    markSeen({
      ...(previewAccessory !== 'default' ? { uniAccessory: previewAccessory } : {}),
    });
    navigate('/entrar?mode=signup');
  };

  const handleExistingAccount = () => {
    void hapticTap();
    markSeen();
    navigate('/entrar');
  };

  const handleTryLocal = () => {
    void hapticTap();
    markSeen({ guestMode: true });
    const done = Boolean(useStore.getState().academicProfile?.onboardingCompleted);
    navigate(done ? '/' : '/configurar');
  };

  return (
    <div
      className={cx(
        'relative flex min-h-dvh flex-col justify-between overflow-x-hidden overscroll-y-none px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))] text-fg transition-colors duration-500 sm:pt-[max(1.25rem,env(safe-area-inset-top))] sm:pb-6',
        slide.bgClass,
      )}
    >
      {/* Formas de papelaria orgânicas a flutuar ao fundo */}
      <motion.div
        aria-hidden="true"
        animate={{ y: [0, 12, 0], x: [0, -8, 0], rotate: [0, 8, 0] }}
        transition={{ repeat: Infinity, duration: 7, ease: 'easeInOut' }}
        className="pointer-events-none absolute -top-12 -right-12 size-44 rounded-full bg-white/35 dark:bg-white/5"
      />
      <motion.div
        aria-hidden="true"
        animate={{ y: [0, -10, 0], rotate: [12, 22, 12] }}
        transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}
        className="pointer-events-none absolute top-44 -left-10 size-28 rounded-3xl bg-white/25 dark:bg-white/5"
      />

      {/* Topo com marca e atalho para entrar */}
      <header className="relative z-10 mx-auto flex w-full max-w-md items-center justify-between gap-2">
        <div className="flex shrink-0 items-center gap-2.5 whitespace-nowrap">
          <UnipediaLogoMark size={34} />
          <span className="font-display text-lg font-extrabold tracking-tight">Unipedia</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={cycleLanguage}
            aria-label="Language"
            className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-white/70 px-3 text-xs font-bold text-[#141312] backdrop-blur-sm transition hover:bg-white dark:bg-black/30 dark:text-[#FAF6EC]"
          >
            {currentLang.toUpperCase()}
          </button>
          <button
            type="button"
            onClick={handleExistingAccount}
            className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full bg-white/75 px-4 text-xs font-semibold text-[#141312] backdrop-blur-sm transition hover:bg-white dark:bg-black/30 dark:text-[#FAF6EC]"
          >
            {t('onboarding:ctaSignIn')}
          </button>
        </div>
      </header>

      {/* Palco central animado */}
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col py-2 text-center sm:py-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            initial={{ opacity: 0, x: 24, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -24, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="flex w-full flex-1 flex-col items-center justify-between gap-2.5 pb-2 sm:gap-4 sm:pb-3"
          >
            {/* Ilustração viva por slide centrada no espaço superior */}
            <div className="flex w-full flex-1 items-center justify-center">
              {step === 0 && (
                <div className="relative flex h-60 w-full items-center justify-center">
                  <motion.div
                    initial={{ rotate: -6, y: 12 }}
                    animate={{ rotate: -4, y: 0 }}
                    transition={UNIPEDIA_BOUNCE_SPRING}
                    className="absolute left-4 top-5 rounded-2xl bg-bg px-3.5 py-2.5 text-left shadow-card dark:bg-surface"
                  >
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <BookOpen size={14} className="text-accent-ink" />
                      <span>{t('onboarding:scenes.demoCourse')} · 2×50 min</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">{t('onboarding:scenes.demoTopic')}</p>
                  </motion.div>

                  <motion.div
                    initial={{ rotate: 5, y: 16 }}
                    animate={{ rotate: 4, y: 0 }}
                    transition={{ ...UNIPEDIA_BOUNCE_SPRING, delay: 0.08 }}
                    className="absolute right-4 bottom-3 rounded-2xl bg-pastel-sage px-3.5 py-2.5 text-left text-[#141312] shadow-card"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <CheckCircle2 size={14} className="text-[#0F6344]" />
                      <span>{t('onboarding:scenes.demoStatus')}</span>
                    </div>
                  </motion.div>

                  <div className="relative z-10">
                    <UniBuddy mood="celebrate" accessory="default" size={120} />
                  </div>
                </div>
              )}

              {step === 1 && <UniLearningModesScene />}

              {step === 2 && <UniPlanAndConnectScene />}

              {step === 3 && <UniFocusRecallScene />}

              {step === 4 && (
                <div className="flex w-full flex-col items-center space-y-2.5 sm:space-y-3.5">
                  <div className="relative flex size-24 items-center justify-center rounded-full bg-white/60 shadow-card dark:bg-black/25 sm:size-32">
                    <UniBuddy
                      mood="happy"
                      form={previewForm}
                      stage={3}
                      accessory={previewAccessory}
                      size={78}
                      onClick={() => {
                        void hapticTap();
                        const idx = UNI_ACCESSORIES.findIndex((a) => a.id === previewAccessory);
                        setPreviewAccessory(UNI_ACCESSORIES[(idx + 1) % UNI_ACCESSORIES.length].id);
                      }}
                      ariaLabel={t('onboarding:scenes.accessoryAria')}
                    />
                  </div>

                  {/* 5 formas base dos Unis especialistas */}
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                      {FORM_CHOICES.map((fId) => {
                        const active = previewForm === fId;
                        return (
                          <button
                            key={fId}
                            type="button"
                            onClick={() => {
                              void hapticTap();
                              setPreviewForm(fId);
                            }}
                            aria-label={t(`uni:forms.${fId}.label`)}
                            className={cx(
                              'flex min-h-11 items-center gap-1.5 rounded-full border-2 px-3 py-1 text-xs font-semibold transition',
                              active
                                ? 'border-fg bg-surface text-fg shadow-card'
                                : 'border-transparent bg-white/75 text-[#141312] hover:bg-white dark:bg-black/30 dark:text-[#FAF6EC]',
                            )}
                          >
                            <UniBuddy form={fId} stage={2} size={22} interactive={false} />
                            <span>{t(`uni:forms.${fId}.label`)}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="inline-flex items-center gap-1.5 rounded-full bg-white/75 px-3 py-1 text-xs font-medium text-[#141312] shadow-sm dark:bg-black/30 dark:text-[#FAF6EC]">
                      <GraduationCap size={13} className="text-[#0F6344] dark:text-[#4ADE80]" />
                      <span>
                        <strong>{t('uni:stages.0')} → {masterStageInfo.localizedLabel}:</strong>{' '}
                        {t('uni:adoptModal.summarySubtitle', { course: t('onboarding:scenes.demoCourseShort') })}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2.5 px-2">
              <StickerBadge tone={step === 1 || step === 3 ? 'sage' : 'butter'} tilt={-1.5}>
                {slide.eyebrow}
              </StickerBadge>
              <h1 className="font-display text-[28px] font-extrabold leading-[1.1] tracking-tight sm:text-4xl">
                {slide.title}{' '}
                <span className="font-serif font-normal italic">{slide.accent}</span>
              </h1>
              <p className="mx-auto max-w-sm text-sm leading-relaxed opacity-85">
                {slide.description}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Controlo de paginação & CTAs */}
      <footer className="relative z-10 mx-auto w-full max-w-md space-y-2 sm:space-y-3">
        <div className="flex items-center justify-center gap-1">
          {slides.map((s, i) => {
            const active = i === step;
            return (
              <button
                key={s.id}
                type="button"
                aria-label={`Slide ${i + 1}`}
                onClick={() => {
                  void hapticTap();
                  setStep(i);
                }}
                className="flex size-11 items-center justify-center"
              >
                <span
                  className={cx(
                    'block h-2 rounded-full transition-all',
                    active ? 'w-7 bg-fg' : 'w-2 bg-fg/25',
                  )}
                />
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handlePrimary}
          className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-full bg-ink-cta px-6 text-sm font-bold text-ink-cta-fg shadow-float transition active:scale-[0.98]"
        >
          <span>{isLast ? t('onboarding:ctaStart') : '→'}</span>
          <ArrowRight size={16} />
        </button>

        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs font-semibold opacity-85">
          <button type="button" onClick={handleTryLocal} className="min-h-11 px-2 hover:underline">
            {t('onboarding:ctaDemo')}
          </button>
          <span aria-hidden="true">·</span>
          <Link to="/privacidade" className="inline-flex min-h-11 items-center px-2 hover:underline">
            Privacidade
          </Link>
        </div>
      </footer>
    </div>
  );
}
