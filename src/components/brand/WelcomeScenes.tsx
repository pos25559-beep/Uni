import { motion } from 'motion/react';
import { BookOpen, Sparkles } from 'lucide-react';
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
        className="absolute left-3 top-2 flex items-center gap-1.5 rounded-full bg-[#FAF8F2] px-3 py-1.5 text-[11px] font-bold text-[#141312] shadow-card dark:bg-[#23201B] dark:text-[#FAF6EC]"
      >
        <Sparkles size={12} className="text-[#157F58] dark:text-[#4ADE80]" />
        <span>Revisão 1→3→7d</span>
      </motion.div>

      <motion.div
        animate={{ y: [0, 5, 0], rotate: [3, 6, 3] }}
        transition={{ repeat: Infinity, duration: 4.6, ease: 'easeInOut' }}
        className="absolute right-3 top-4 flex items-center gap-1.5 rounded-full bg-[#FCE99F] px-3 py-1.5 text-[11px] font-bold text-[#141312] shadow-card"
      >
        <BookOpen size={12} className="text-[#157F58]" />
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
