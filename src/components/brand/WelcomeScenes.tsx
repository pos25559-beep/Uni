import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { BookOpen, Brain, CalendarDays, CheckCircle2, HardDrive, Mail, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { UNIPEDIA_BOUNCE_SPRING } from '../motion/Primitives';
import { UniBuddy } from './UnipediaMarks';

/** Cena animada: Professor Uni ao quadro negro com alunos Uni nas carteiras. */
export function UniClassroomScene() {
  return (
    <div
      className="relative flex h-60 w-full max-w-[332px] flex-col items-center justify-between py-1 select-none"
      aria-label="Ilustração animada de uma aula com o Professor Uni no quadro e alunos Uni sentados"
    >
      {/* Quadro negro escolar */}
      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={UNIPEDIA_BOUNCE_SPRING}
        className="relative flex h-[116px] w-full items-center justify-between rounded-[22px] border-[5px] border-[#9C6B3F] bg-[#157F58] px-4 py-2.5 text-[#FAF8F2] shadow-card dark:border-[#7B5230] dark:bg-[#115F42]"
      >
        {/* Giz no quadro (visível desde o primeiro instante + traço suave) */}
        <svg
          viewBox="0 0 185 82"
          className="h-full w-[62%]"
          fill="none"
          aria-hidden="true"
        >
          {/* Eixos e curva suave */}
          <motion.path
            d="M 16 64 L 16 14 M 12 58 L 116 58"
            stroke="rgba(250,248,242,0.55)"
            strokeWidth="2"
            strokeLinecap="round"
            initial={{ pathLength: 0.35, opacity: 0.6 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          />
          <motion.path
            d="M 22 52 C 42 50, 52 20, 74 26 C 92 31, 98 14, 114 18"
            stroke="#FCE99F"
            strokeWidth="2.8"
            strokeLinecap="round"
            initial={{ pathLength: 0.25 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.7, delay: 0.08, ease: 'easeInOut' }}
          />
          <motion.circle
            cx="74"
            cy="26"
            r="4"
            fill="#FAD6BA"
            initial={{ scale: 0.7 }}
            animate={{ scale: [1, 1.18, 1] }}
            transition={{ repeat: Infinity, duration: 2.6, ease: 'easeInOut' }}
          />
          <text
            x="124"
            y="32"
            fill="#FAF8F2"
            fontSize="13"
            fontWeight="700"
            fontFamily="ui-monospace, monospace"
            opacity="0.94"
          >
            ∫ f(x)dx
          </text>
          <text
            x="124"
            y="53"
            fill="#C9DC9F"
            fontSize="11"
            fontWeight="700"
            fontFamily="ui-sans-serif, sans-serif"
            opacity="0.96"
          >
            + foco!
          </text>
        </svg>

        {/* Professor Uni com óculos e apontador */}
        <motion.div
          animate={{ y: [0, -3, 0], rotate: [-2, 1.5, -2] }}
          transition={{ repeat: Infinity, duration: 3.4, ease: 'easeInOut' }}
          className="relative flex shrink-0 flex-col items-center pr-1"
        >
          <UniBuddy mood="happy" accessory="humanities" skin="butter" size={62} />
          <motion.span
            aria-hidden="true"
            animate={{ rotate: [-14, -28, -14] }}
            transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut' }}
            className="absolute -left-3 bottom-4 h-1 w-7 origin-right rounded-full bg-[#FCE99F] shadow-sm"
          />
        </motion.div>

        {/* Calha de giz */}
        <div className="absolute -bottom-[6px] left-6 flex gap-1.5" aria-hidden="true">
          <span className="h-1.5 w-4 rounded-full bg-[#FAF8F2]" />
          <span className="h-1.5 w-3 rounded-full bg-[#FCE99F]" />
        </div>
      </motion.div>

      {/* Fila de carteiras com 3 alunos Uni */}
      <div className="relative mt-2 grid w-full grid-cols-3 gap-2.5 px-1">
        {[
          { skin: 'sage' as const, mood: 'curious' as const, accessory: 'math' as const, delay: 0 },
          { skin: 'classic' as const, mood: 'thinking' as const, accessory: 'default' as const, delay: 0.35 },
          { skin: 'crimson' as const, mood: 'happy' as const, accessory: 'science' as const, delay: 0.7 },
        ].map((student, idx) => (
          <div
            key={student.skin}
            className="relative flex flex-col items-center"
          >
            <motion.div
              animate={{
                y: [0, -3, 0],
                rotate: idx === 1 ? [0, -3, 0, 2, 0] : [0, 2, 0],
              }}
              transition={{
                repeat: Infinity,
                duration: 3 + idx * 0.45,
                delay: student.delay,
                ease: 'easeInOut',
              }}
              className="-mb-3 relative z-10"
            >
              <UniBuddy
                mood={student.mood}
                accessory={student.accessory}
                skin={student.skin}
                size={52}
              />
            </motion.div>
            {/* Carteira */}
            <div className="flex h-10 w-full flex-col items-center justify-center rounded-xl border border-[#B88456]/45 bg-[#E7BE96] px-2 shadow-sm dark:border-[#6E4F32] dark:bg-[#5E4229]">
              <div className="h-2.5 w-[72%] rounded-[4px] bg-[#FAF8F2] shadow-inner dark:bg-[#2E2922]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Cena animada: vários Unis juntos à volta de um caderno a estudar em grupo. */
export function UniStudyGroupScene() {
  return (
    <div
      className="relative flex h-60 w-full max-w-[332px] items-center justify-center select-none"
      aria-label="Ilustração animada de um grupo de estudo com quatro companheiros Uni à volta de cadernos"
    >
      {/* Stickers discretos a flutuar com ritmo SRS */}
      <motion.div
        animate={{ y: [0, -5, 0], rotate: [-4, -1, -4] }}
        transition={{ repeat: Infinity, duration: 4.2, ease: 'easeInOut' }}
        className="absolute left-3 top-2 flex items-center gap-1.5 rounded-full bg-bg px-3 py-1.5 text-xs font-bold text-fg shadow-card dark:bg-surface"
      >
        <Sparkles size={12} className="text-accent-ink" />
        <span>Revisão 1→3→7d</span>
      </motion.div>

      <motion.div
        animate={{ y: [0, 5, 0], rotate: [3, 6, 3] }}
        transition={{ repeat: Infinity, duration: 4.6, ease: 'easeInOut' }}
        className="absolute right-3 top-4 flex items-center gap-1.5 rounded-full bg-pastel-butter px-3 py-1.5 text-xs font-bold text-[#141312] shadow-card"
      >
        <BookOpen size={12} className="text-[#0F6344]" />
        <span>Caderno em grupo</span>
      </motion.div>

      {/* Mesa redonda de estudo */}
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={UNIPEDIA_BOUNCE_SPRING}
        className="relative mt-6 flex h-32 w-[256px] items-center justify-center rounded-[42px] border-2 border-[#157F58]/15 bg-[#FAF8F2]/92 shadow-card dark:border-white/10 dark:bg-[#23201B]/95"
      >
        {/* Folhas abertas no centro da mesa */}
        <div className="flex items-center gap-2">
          <div className="h-12 w-14 -rotate-6 rounded-lg border border-black/10 bg-white p-1.5 shadow-sm dark:border-white/10 dark:bg-[#1A1815]">
            <div className="h-1.5 w-8 rounded bg-[#157F58]/45" />
            <div className="mt-1.5 h-1 w-10 rounded bg-black/15 dark:bg-white/15" />
            <div className="mt-1 h-1 w-7 rounded bg-black/15 dark:bg-white/15" />
          </div>
          <div className="h-12 w-14 rotate-6 rounded-lg border border-black/10 bg-[#FCE99F]/75 p-1.5 shadow-sm dark:border-white/10 dark:bg-[#3A3114]">
            <div className="h-1.5 w-7 rounded bg-[#141312]/45 dark:bg-[#FAF6EC]/50" />
            <div className="mt-1.5 h-1 w-9 rounded bg-black/15 dark:bg-white/15" />
            <div className="mt-1 h-1 w-6 rounded bg-black/15 dark:bg-white/15" />
          </div>
        </div>

        {/* Uni topo-esquerda */}
        <motion.div
          animate={{ y: [0, -3, 0], rotate: [-4, 2, -4] }}
          transition={{ repeat: Infinity, duration: 3.1, ease: 'easeInOut' }}
          className="absolute -left-6 -top-8"
        >
          <UniBuddy mood="curious" accessory="math" skin="classic" size={62} />
        </motion.div>

        {/* Uni topo-direita */}
        <motion.div
          animate={{ y: [0, -4, 0], rotate: [3, -2, 3] }}
          transition={{ repeat: Infinity, duration: 3.5, delay: 0.4, ease: 'easeInOut' }}
          className="absolute -right-6 -top-7"
        >
          <UniBuddy mood="happy" accessory="tech" skin="sage" size={62} />
        </motion.div>

        {/* Uni baixo-esquerda */}
        <motion.div
          animate={{ y: [0, -2.5, 0], rotate: [-2, 3, -2] }}
          transition={{ repeat: Infinity, duration: 3.8, delay: 0.8, ease: 'easeInOut' }}
          className="absolute -bottom-7 left-5"
        >
          <UniBuddy mood="celebrate" accessory="arts" skin="crimson" size={58} />
        </motion.div>

        {/* Uni baixo-direita */}
        <motion.div
          animate={{ y: [0, -3, 0], rotate: [2, -3, 2] }}
          transition={{ repeat: Infinity, duration: 3.3, delay: 0.2, ease: 'easeInOut' }}
          className="absolute -bottom-7 right-5"
        >
          <UniBuddy mood="thinking" accessory="science" skin="butter" size={58} />
        </motion.div>
      </motion.div>
    </div>
  );
}

/**
 * Cena combinada (Slides 2+3): alterna suavemente entre a sala de aula e o grupo de estudo,
 * sem precisar de intervenção do utilizador.
 */
export function UniLearningModesScene() {
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<'classroom' | 'group'>('classroom');

  useEffect(() => {
    if (reducedMotion) return;
    const id = window.setInterval(() => {
      setPhase((prev) => (prev === 'classroom' ? 'group' : 'classroom'));
    }, 4200);
    return () => window.clearInterval(id);
  }, [reducedMotion]);

  return (
    <div className="relative flex h-64 w-full max-w-[336px] flex-col items-center justify-center">
      <AnimatePresence mode="wait">
        <motion.div
          key={phase}
          initial={reducedMotion ? false : { opacity: 0, y: 10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reducedMotion ? undefined : { opacity: 0, y: -10, scale: 0.97 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="flex w-full items-center justify-center"
        >
          {phase === 'classroom' ? <UniClassroomScene /> : <UniStudyGroupScene />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/**
 * Cena combinada (Slides 4+5): agrupa plano diário + integrações Google opcionais,
 * acompanhados por 2-3 pequenos Unis vivos discretos nas margens a passear e conversar.
 */
export function UniPlanAndConnectScene() {
  const reducedMotion = useReducedMotion();
  const [view, setView] = useState<'plan' | 'google'>('plan');

  useEffect(() => {
    if (reducedMotion) return;
    const id = window.setInterval(() => {
      setView((prev) => (prev === 'plan' ? 'google' : 'plan'));
    }, 4200);
    return () => window.clearInterval(id);
  }, [reducedMotion]);

  return (
    <div
      className="relative flex h-64 w-full max-w-[340px] items-center justify-center px-2 select-none"
      aria-label="Ilustração do plano semanal e ligações Google opcionais com pequenos companheiros Uni discretos nas margens"
    >
      {/* Pequeno Uni curioso a passear discretamente na margem superior direita */}
      <motion.div
        aria-hidden="true"
        animate={reducedMotion ? undefined : { x: [0, -14, -4, 0], y: [0, -2, 0] }}
        transition={reducedMotion ? undefined : { repeat: Infinity, duration: 7.2, ease: 'easeInOut' }}
        className="pointer-events-none absolute right-2 top-0 z-20 flex items-center gap-1 opacity-85"
      >
        <UniBuddy mood="curious" accessory="default" skin="butter" size={26} interactive={false} />
      </motion.div>

      {/* Dois pequenos Unis discretos a conversar num murmúrio sereno no canto inferior esquerdo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-1 z-20 flex items-end gap-1 opacity-90"
      >
        <motion.div
          animate={reducedMotion ? undefined : { y: [0, -2, 0], rotate: [-3, 2, -3] }}
          transition={reducedMotion ? undefined : { repeat: Infinity, duration: 3.4, ease: 'easeInOut' }}
        >
          <UniBuddy mood="shy" accessory="arts" skin="sage" size={26} interactive={false} />
        </motion.div>
        <motion.div
          animate={reducedMotion ? undefined : { y: [0, -2.5, 0], rotate: [2, -3, 2] }}
          transition={reducedMotion ? undefined : { repeat: Infinity, duration: 3.8, delay: 0.4, ease: 'easeInOut' }}
        >
          <UniBuddy mood="curious" accessory="tech" skin="crimson" size={24} interactive={false} />
        </motion.div>
        <motion.span
          animate={reducedMotion ? undefined : { opacity: [0.45, 0.9, 0.45] }}
          transition={reducedMotion ? undefined : { repeat: Infinity, duration: 3.6 }}
          className="mb-3 rounded-full bg-bg/90 px-2 py-0.5 text-xs font-medium text-muted shadow-sm dark:bg-surface/90"
        >
          psiu…
        </motion.span>
      </div>

      {/* Centro alternando suavemente entre cartões de plano e Google opcional */}
      <AnimatePresence mode="wait">
        {view === 'plan' ? (
          <motion.div
            key="plan"
            initial={reducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="flex w-full max-w-[292px] flex-col items-center gap-2.5"
          >
            {[
              { label: '09:30 · Rever capítulo 3', tone: 'bg-bg text-fg dark:bg-surface', tilt: -1.4 },
              { label: '14:00 · Ficha prática com o Uni', tone: 'bg-pastel-sage text-[#141312]', tilt: 1.4 },
              { label: '17:30 · Simulação de exame', tone: 'bg-pastel-butter text-[#141312]', tilt: -1 },
            ].map((card, i) => (
              <motion.div
                key={card.label}
                initial={reducedMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0, rotate: card.tilt }}
                transition={{ ...UNIPEDIA_BOUNCE_SPRING, delay: i * 0.06 }}
                className={`flex w-full items-center justify-between rounded-[20px] px-4 py-3 text-xs font-semibold shadow-card ${card.tone}`}
              >
                <span className="flex items-center gap-2">
                  <CalendarDays size={14} className="shrink-0 opacity-75" />
                  {card.label}
                </span>
                <Sparkles size={13} className="shrink-0 opacity-60" />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="google"
            initial={reducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="flex w-full max-w-[300px] flex-col gap-2 text-left"
          >
            {[
              {
                icon: HardDrive,
                title: 'Google Drive nas cadeiras',
                detail: 'Sebentas e fichas sem andar à procura.',
                tone: 'bg-bg text-fg dark:bg-surface',
              },
              {
                icon: CalendarDays,
                title: 'Google Agenda sincronizada',
                detail: 'Aulas e datas de provas sem duplicar.',
                tone: 'bg-pastel-sky text-[#141312]',
              },
              {
                icon: Mail,
                title: 'Avisos académicos opcionais',
                detail: 'Ativa quando quiseres, ao teu ritmo.',
                tone: 'bg-pastel-butter text-[#141312]',
              },
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.title}
                  initial={reducedMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...UNIPEDIA_BOUNCE_SPRING, delay: idx * 0.05 }}
                  className={`flex items-center gap-3 rounded-[20px] px-3.5 py-2.5 shadow-card ${item.tone}`}
                >
                  <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-black/5">
                    <Icon size={15} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold leading-tight">{item.title}</p>
                    <p className="mt-0.5 text-xs leading-snug opacity-75">{item.detail}</p>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Novo Slide 4: Cena simpática do Modo Foco & Recall Ativo com o Uni a celebrar minutos reais.
 */
export function UniFocusRecallScene() {
  const reducedMotion = useReducedMotion();

  return (
    <div
      className="relative flex h-64 w-full max-w-[336px] flex-col items-center justify-center select-none"
      aria-label="Ilustração do modo foco com temporizador e revisão ativa acompanhada pelo Uni"
    >
      {/* Sticker superior com progresso de Recall */}
      <motion.div
        animate={reducedMotion ? undefined : { y: [0, -4, 0], rotate: [-3, -1, -3] }}
        transition={reducedMotion ? undefined : { repeat: Infinity, duration: 3.8, ease: 'easeInOut' }}
        className="absolute left-3 top-2 flex items-center gap-1.5 rounded-full bg-bg px-3 py-1.5 text-xs font-bold text-fg shadow-card dark:bg-surface"
      >
        <Brain size={14} className="text-accent-ink" />
        <span>Lembrei bem · +7d</span>
      </motion.div>

      <motion.div
        animate={reducedMotion ? undefined : { y: [0, 4, 0], rotate: [2, 5, 2] }}
        transition={reducedMotion ? undefined : { repeat: Infinity, duration: 4.1, ease: 'easeInOut' }}
        className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full bg-pastel-mint px-3 py-1.5 text-xs font-bold text-[#141312] shadow-card"
      >
        <CheckCircle2 size={14} className="text-[#0F6344]" />
        <span>25 min reais guardados</span>
      </motion.div>

      {/* Cartão circular de foco pastel */}
      <motion.div
        initial={reducedMotion ? false : { scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={UNIPEDIA_BOUNCE_SPRING}
        className="relative flex items-center gap-4 rounded-[32px] border-2 border-accent/20 bg-bg/95 px-6 py-5 shadow-card dark:bg-surface/95"
      >
        <div className="flex flex-col items-start text-left">
          <span className="text-xs font-semibold text-accent-ink">Sessão de foco</span>
          <span className="mt-0.5 font-display text-3xl font-extrabold tracking-tight tabular text-fg">
            25:00
          </span>
          <span className="mt-1 text-xs text-muted">Sem pressa · recall no fim</span>
        </div>

        <motion.div
          animate={reducedMotion ? undefined : { y: [0, -5, 0], rotate: [-2, 3, -2] }}
          transition={reducedMotion ? undefined : { repeat: Infinity, duration: 3.2, ease: 'easeInOut' }}
        >
          <UniBuddy mood="celebrate" accessory="tech" skin="crimson" size={76} interactive={false} />
        </motion.div>
      </motion.div>
    </div>
  );
}
