import { ArrowRight, BookOpen, CheckCircle2, Trophy } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UniBuddy, UnipediaLogoMark } from '../components/brand/UnipediaMarks';
import {
  UniFocusRecallScene,
  UniLearningModesScene,
  UniPlanAndConnectScene,
} from '../components/brand/WelcomeScenes';
import { StickerBadge, UNIPEDIA_BOUNCE_SPRING } from '../components/motion/Primitives';
import { cx } from '../components/ui';
import { hapticTap } from '../lib/nativeBridge';
import { UNI_ACCESSORIES, type UniAccessoryId } from '../lib/uniAccessories';
import { UNI_SKINS, type UniSkinId } from '../lib/uniCollectibles';
import { useStore } from '../store/useStore';

interface Slide {
  id: string;
  bgClass: string;
  eyebrow: string;
  title: string;
  accent: string;
  description: string;
}

const SLIDES: Slide[] = [
  {
    id: 'overview',
    bgClass: 'bg-pastel-peach dark:bg-[#332218]',
    eyebrow: 'O teu caderno escolar & universitário',
    title: 'O teu semestre,',
    accent: 'sem complicações',
    description:
      'Junta cadeiras, datas de provas, apontamentos e ritmo diário num caderno leve pensado para estudar com calma.',
  },
  {
    id: 'learning-modes',
    bgClass: 'bg-pastel-sage dark:bg-[#192D21]',
    eyebrow: 'Universo Uni · Aulas & Grupo',
    title: 'Aprende em ritmo',
    accent: 'calmo e acompanhado',
    description:
      'Na sala ou em grupo, cada aula transforma-se em tópicos claros e os companheiros Uni ficam contigo sem distrair.',
  },
  {
    id: 'plan-and-connect',
    bgClass: 'bg-pastel-sky dark:bg-[#192838]',
    eyebrow: 'Plano diário + Google opcional',
    title: 'Tudo organizado,',
    accent: 'ao teu jeito',
    description:
      'Distribui sessões pelos teus dias livres e liga Drive, Agenda e Gmail quando quiseres — sem duplicar trabalho.',
  },
  {
    id: 'focus-recall',
    bgClass: 'bg-pastel-mint dark:bg-[#162C25]',
    eyebrow: 'Modo Foco & Recall Ativo',
    title: 'Estudo real,',
    accent: 'memória mais forte',
    description:
      'Sessões cronometradas com revisão espaçada inteligente (1→3→7→21 dias) que adapta automaticamente os próximos blocos.',
  },
  {
    id: 'uni-collectibles',
    bgClass: 'bg-pastel-butter dark:bg-[#2F2815]',
    eyebrow: 'Personalidade & Conquistas por Mérito',
    title: 'Coleciona Unis',
    accent: 'com o teu esforço',
    description:
      'Experimenta acessórios da tua área e desbloqueia novas cores do Uni ao manteres ritmo, check-ins e revisões ativas.',
  },
];

export default function WelcomePage() {
  const updateSettings = useStore((s) => s.updateSettings);
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [previewAccessory, setPreviewAccessory] = useState<UniAccessoryId>('math');
  const [previewSkin, setPreviewSkin] = useState<UniSkinId>('classic');

  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;
  const activeSkinMeta = UNI_SKINS.find((s) => s.id === previewSkin) ?? UNI_SKINS[0];

  const markSeen = (extra?: Parameters<typeof updateSettings>[0]) => {
    updateSettings({ hasSeenWelcome: true, ...extra });
  };

  const handlePrimary = () => {
    void hapticTap();
    if (!isLast) {
      setStep((s) => Math.min(SLIDES.length - 1, s + 1));
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
        className="pointer-events-none absolute top-44 -left-10 size-28 rounded-[28px] bg-white/25 dark:bg-white/5"
      />

      {/* Topo com marca e atalho para entrar */}
      <header className="relative z-10 mx-auto flex w-full max-w-md items-center justify-between gap-2">
        <div className="flex shrink-0 items-center gap-2.5 whitespace-nowrap">
          <UnipediaLogoMark size={34} />
          <span className="font-display text-lg font-extrabold tracking-tight">Unipedia</span>
        </div>
        <button
          type="button"
          onClick={handleExistingAccount}
          className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full bg-white/75 px-4 text-xs font-semibold text-[#141312] backdrop-blur-sm transition hover:bg-white dark:bg-black/30 dark:text-[#FAF6EC]"
        >
          Saltar · Entrar
        </button>
      </header>

      {/* Palco central animado */}
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col py-2 text-center sm:py-4">
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
                    className="absolute left-4 top-5 rounded-[22px] bg-bg px-3.5 py-2.5 text-left shadow-card dark:bg-surface"
                  >
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <BookOpen size={14} className="text-accent-ink" />
                      <span>Cadeira · 68%</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">Teste em 5 dias</p>
                  </motion.div>

                  <motion.div
                    initial={{ rotate: 5, y: 16 }}
                    animate={{ rotate: 4, y: 0 }}
                    transition={{ ...UNIPEDIA_BOUNCE_SPRING, delay: 0.08 }}
                    className="absolute right-4 bottom-3 rounded-[22px] bg-pastel-sage px-3.5 py-2.5 text-left text-[#141312] shadow-card"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <CheckCircle2 size={14} className="text-[#0F6344]" />
                      <span>Meta diária concluída!</span>
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
                      accessory={previewAccessory}
                      skin={previewSkin}
                      size={78}
                      onClick={() => {
                        void hapticTap();
                        const idx = UNI_ACCESSORIES.findIndex((a) => a.id === previewAccessory);
                        setPreviewAccessory(UNI_ACCESSORIES[(idx + 1) % UNI_ACCESSORIES.length].id);
                      }}
                      ariaLabel="Mudar acessório do Uni"
                    />
                  </div>

                  {/* Cores colecionáveis do Uni + critério de mérito */}
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
                      {UNI_SKINS.map((sk) => {
                        const active = previewSkin === sk.id;
                        return (
                          <button
                            key={sk.id}
                            type="button"
                            onClick={() => {
                              void hapticTap();
                              setPreviewSkin(sk.id);
                            }}
                            aria-label={`Pré-visualizar ${sk.name}`}
                            className={cx(
                              'flex min-h-11 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                              active
                                ? 'border-fg bg-ink-cta text-ink-cta-fg shadow-card'
                                : 'border-black/10 bg-white/75 text-[#141312] hover:bg-white dark:border-white/15 dark:bg-black/30 dark:text-[#FAF6EC]',
                            )}
                          >
                            <span
                              className="size-3.5 shrink-0 rounded-full border border-black/15"
                              style={{ backgroundColor: sk.swatchHex }}
                            />
                            <span>{sk.name.replace('Uni ', '')}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="inline-flex items-center gap-1.5 rounded-full bg-white/75 px-3 py-1 text-xs font-medium text-[#141312] shadow-sm dark:bg-black/30 dark:text-[#FAF6EC]">
                      <Trophy size={13} className="text-[#0F6344] dark:text-[#4ADE80]" />
                      <span>
                        <strong>{activeSkinMeta.name}:</strong>{' '}
                        {activeSkinMeta.id === 'classic'
                          ? 'Disponível desde o início'
                          : `Mérito · ${activeSkinMeta.unlockHint}`}
                      </span>
                    </div>
                  </div>

                  {/* Chips táteis para experimentar acessórios por área */}
                  <div className="flex max-w-sm flex-wrap items-center justify-center gap-1.5">
                    {UNI_ACCESSORIES.filter((a) => a.id !== 'default').map((acc) => {
                      const active = previewAccessory === acc.id;
                      return (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => {
                            void hapticTap();
                            setPreviewAccessory(acc.id);
                          }}
                          className={cx(
                            'min-h-11 rounded-full px-3.5 py-1.5 text-xs font-semibold transition',
                            active
                              ? 'bg-ink-cta text-ink-cta-fg shadow-card'
                              : 'bg-white/70 text-[#141312] hover:bg-white/95 dark:bg-black/25 dark:text-[#FAF6EC]',
                          )}
                        >
                          {acc.shortLabel}
                        </button>
                      );
                    })}
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
      </main>

      {/* Controlo de paginação & CTAs */}
      <footer className="relative z-10 mx-auto w-full max-w-md space-y-2 sm:space-y-3">
        <div className="flex items-center justify-center gap-1">
          {SLIDES.map((s, i) => {
            const active = i === step;
            return (
              <button
                key={s.id}
                type="button"
                aria-label={`Ver página ${i + 1}`}
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
          <span>{isLast ? 'Criar conta ou entrar' : 'Seguinte'}</span>
          <ArrowRight size={16} />
        </button>

        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs font-semibold opacity-85">
          <button type="button" onClick={handleTryLocal} className="min-h-11 px-2 hover:underline">
            Usar só neste telemóvel
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
