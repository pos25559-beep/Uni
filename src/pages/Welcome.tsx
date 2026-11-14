import { ArrowRight, BookOpen, CalendarDays, CheckCircle2, HardDrive, Mail, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UniBuddy, UnipediaLogoMark } from '../components/brand/UnipediaMarks';
import { UniClassroomScene, UniStudyGroupScene } from '../components/brand/WelcomeScenes';
import { StickerBadge, UNIPEDIA_BOUNCE_SPRING } from '../components/motion/Primitives';
import { cx } from '../components/ui';
import { hapticTap } from '../lib/nativeBridge';
import { UNI_ACCESSORIES, type UniAccessoryId } from '../lib/uniAccessories';
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
    bgClass: 'bg-[#FAD6BA] dark:bg-[#332218]',
    eyebrow: 'O teu caderno escolar & universitário',
    title: 'O teu semestre,',
    accent: 'sem complicações',
    description:
      'Junta cadeiras, datas de provas, apontamentos e ritmo diário num caderno leve pensado para estudar com calma.',
  },
  {
    id: 'classroom',
    bgClass: 'bg-[#C9DC9F] dark:bg-[#192D21]',
    eyebrow: 'Universo Uni em sala de aula',
    title: 'Aprende em ritmo',
    accent: 'calmo e visual',
    description:
      'Na sala do Uni cada aula vira resumo claro, tópicos organizados e preparação passo a passo — sem stress antes dos testes.',
  },
  {
    id: 'study-group',
    bgClass: 'bg-[#FCE99F] dark:bg-[#302813]',
    eyebrow: 'Companheiros discretos à tua volta',
    title: 'Nunca estudas',
    accent: 'sozinho no ecrã',
    description:
      'Os Unis têm vida própria no teu caderno: estudam juntos em silêncio e espreitam pelos cantos sem nunca te distrair.',
  },
  {
    id: 'planner',
    bgClass: 'bg-[#C4E0FD] dark:bg-[#192838]',
    eyebrow: 'Plano semanal inteligente',
    title: 'Cada dia com o foco',
    accent: 'no sítio certo',
    description:
      'Distribui sessões pelos teus dias livres, acompanha exames próximos e transforma avisos em tarefas com um toque.',
  },
  {
    id: 'google-ecosystem',
    bgClass: 'bg-[#D6ECDC] dark:bg-[#172B22]',
    eyebrow: 'Ecossistema Google opcional',
    title: 'As tuas apps Google,',
    accent: 'já ligadas',
    description:
      'Ao entrar com Google associas Drive, Agenda, Gmail académico e o Tutor Uni num só sítio — sem perderes tempo a copiar links.',
  },
  {
    id: 'uni',
    bgClass: 'bg-[#FAD6BA] dark:bg-[#2F2117]',
    eyebrow: 'Personalizável ao teu curso',
    title: 'O Uni adapta-se',
    accent: 'à tua área',
    description:
      'Toca abaixo para experimentar os visuais do Uni por disciplina. Depois personalizas paleta, tom da app e créditos no onboarding.',
  },
];

export default function WelcomePage() {
  const updateSettings = useStore((s) => s.updateSettings);
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [previewAccessory, setPreviewAccessory] = useState<UniAccessoryId>('math');

  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

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
        'relative flex min-h-dvh flex-col justify-between overflow-x-hidden overscroll-y-none px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-[#141312] transition-colors duration-500 dark:text-[#FAF6EC]',
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
          className="inline-flex min-h-[40px] shrink-0 items-center whitespace-nowrap rounded-full bg-white/65 px-3.5 text-xs font-semibold text-[#141312] backdrop-blur-sm transition hover:bg-white/90 dark:bg-black/25 dark:text-[#FAF6EC]"
        >
          Saltar · Entrar
        </button>
      </header>

      {/* Palco central animado */}
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center py-6 text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            initial={{ opacity: 0, x: 28, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -28, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="flex w-full flex-col items-center space-y-6"
          >
            {/* Ilustração viva por slide */}
            {step === 0 && (
              <div className="relative flex h-56 w-full items-center justify-center">
                <motion.div
                  initial={{ rotate: -6, y: 12 }}
                  animate={{ rotate: -4, y: 0 }}
                  transition={UNIPEDIA_BOUNCE_SPRING}
                  className="absolute left-5 top-4 rounded-[22px] bg-[#FAF8F2] px-3.5 py-2.5 text-left shadow-card dark:bg-[#23201B]"
                >
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <BookOpen size={14} className="text-[#157F58] dark:text-[#4ADE80]" />
                    <span>Matemática · 68%</span>
                  </div>
                  <p className="mt-0.5 text-[11px] opacity-65">Teste em 5 dias</p>
                </motion.div>

                <motion.div
                  initial={{ rotate: 5, y: 16 }}
                  animate={{ rotate: 4, y: 0 }}
                  transition={{ ...UNIPEDIA_BOUNCE_SPRING, delay: 0.08 }}
                  className="absolute right-5 bottom-2 rounded-[22px] bg-[#C9DC9F] px-3.5 py-2.5 text-left text-[#141312] shadow-card"
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    <CheckCircle2 size={14} className="text-[#157F58]" />
                    <span>Meta diária concluída!</span>
                  </div>
                </motion.div>

                <div className="relative z-10">
                  <UniBuddy mood="celebrate" accessory="default" size={120} />
                </div>
              </div>
            )}

            {step === 1 && <UniClassroomScene />}

            {step === 2 && <UniStudyGroupScene />}

            {step === 3 && (
              <div className="relative flex h-56 w-full flex-col items-center justify-center gap-2.5 px-3">
                {[
                  { label: '09:30 · Rever capítulo 3', tone: 'bg-[#FAF8F2] dark:bg-[#23201B]', tilt: -1.5 },
                  { label: '14:00 · Ficha prática com o Uni', tone: 'bg-[#C9DC9F] text-[#141312]', tilt: 1.5 },
                  { label: '17:30 · Simulação de exame', tone: 'bg-[#FCE99F] text-[#141312]', tilt: -1 },
                ].map((card, i) => (
                  <motion.div
                    key={card.label}
                    initial={{ opacity: 0, y: 18, rotate: 0 }}
                    animate={{ opacity: 1, y: 0, rotate: card.tilt }}
                    transition={{ ...UNIPEDIA_BOUNCE_SPRING, delay: i * 0.08 }}
                    className={cx(
                      'flex w-full max-w-[285px] items-center justify-between rounded-[20px] px-4 py-3 text-xs font-semibold shadow-card',
                      card.tone,
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <CalendarDays size={14} className="shrink-0 opacity-75" />
                      {card.label}
                    </span>
                    <Sparkles size={13} className="shrink-0 opacity-60" />
                  </motion.div>
                ))}
              </div>
            )}

            {step === 4 && (
              <div className="relative flex w-full max-w-[330px] flex-col gap-2 text-left">
                {[
                  {
                    icon: HardDrive,
                    title: 'Google Drive nas cadeiras',
                    detail: 'Sebentas, fichas e PDFs encontrados sem procuras.',
                    tone: 'bg-[#FAF8F2] dark:bg-[#23201B]',
                    iconClass: 'text-[#157F58] dark:text-[#4ADE80]',
                  },
                  {
                    icon: CalendarDays,
                    title: 'Google Agenda sincronizada',
                    detail: 'Provas, aulas e entregas no teu plano semanal.',
                    tone: 'bg-[#C4E0FD] text-[#141312]',
                    iconClass: 'text-[#141312]',
                  },
                  {
                    icon: Mail,
                    title: 'Correio académico no Hoje',
                    detail: 'Mudanças de sala e avisos sempre à mão.',
                    tone: 'bg-[#FCE99F] text-[#141312]',
                    iconClass: 'text-[#141312]',
                  },
                  {
                    icon: Sparkles,
                    title: 'Uni Nativo + Gemini Notebook',
                    detail: 'Tutor com fontes e acesso direto aos teus cadernos.',
                    tone: 'bg-[#C9DC9F] text-[#141312]',
                    iconClass: 'text-[#157F58]',
                  },
                ].map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <motion.div
                      key={item.title}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...UNIPEDIA_BOUNCE_SPRING, delay: idx * 0.06 }}
                      className={cx(
                        'flex items-center gap-3 rounded-[20px] px-3.5 py-2.5 shadow-card',
                        item.tone,
                      )}
                    >
                      <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-black/5 dark:bg-white/10">
                        <Icon size={16} className={item.iconClass} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold leading-tight">{item.title}</p>
                        <p className="mt-0.5 text-[11px] leading-snug opacity-75">{item.detail}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {step === 5 && (
              <div className="flex w-full flex-col items-center space-y-4">
                <div className="relative flex size-36 items-center justify-center rounded-full bg-white/55 shadow-card dark:bg-black/20">
                  <UniBuddy
                    mood="happy"
                    accessory={previewAccessory}
                    size={104}
                    onClick={() => {
                      void hapticTap();
                      const idx = UNI_ACCESSORIES.findIndex((a) => a.id === previewAccessory);
                      setPreviewAccessory(UNI_ACCESSORIES[(idx + 1) % UNI_ACCESSORIES.length].id);
                    }}
                    ariaLabel="Mudar estilo do Uni"
                  />
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
                          'min-h-[38px] rounded-full px-3 py-1 text-xs font-semibold transition',
                          active
                            ? 'bg-[#141312] text-[#FAF8F2] shadow-card dark:bg-[#FAF6EC] dark:text-[#141312]'
                            : 'bg-white/65 text-[#141312] hover:bg-white/90 dark:bg-black/25 dark:text-[#FAF6EC]',
                        )}
                      >
                        {acc.shortLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-2.5 px-2">
              <StickerBadge tone={step === 1 || step === 4 ? 'sage' : 'butter'} tilt={-1.5}>
                {slide.eyebrow}
              </StickerBadge>
              <h1 className="font-display text-[30px] font-extrabold leading-[1.1] tracking-tight sm:text-4xl">
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
      <footer className="relative z-10 mx-auto w-full max-w-md space-y-3.5">
        <div className="flex items-center justify-center gap-2">
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
                className="flex size-8 items-center justify-center"
              >
                <span
                  className={cx(
                    'block h-2 rounded-full transition-all',
                    active ? 'w-7 bg-[#141312] dark:bg-[#FAF6EC]' : 'w-2 bg-[#141312]/25 dark:bg-white/30',
                  )}
                />
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handlePrimary}
          className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-full bg-[#141312] px-6 text-sm font-bold text-[#FAF8F2] shadow-float transition active:scale-[0.98] dark:bg-[#FAF6EC] dark:text-[#141312]"
        >
          <span>{isLast ? 'Criar conta ou entrar' : 'Seguinte'}</span>
          <ArrowRight size={16} />
        </button>

        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs font-semibold opacity-80">
          <button type="button" onClick={handleTryLocal} className="min-h-[38px] px-2 hover:underline">
            Usar só neste telemóvel
          </button>
          <span aria-hidden="true">·</span>
          <Link to="/privacidade" className="inline-flex min-h-[38px] items-center px-1 hover:underline">
            Privacidade
          </Link>
        </div>
      </footer>
    </div>
  );
}
