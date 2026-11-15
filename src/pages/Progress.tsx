import { ArrowRight, BarChart3, BookOpenCheck, Lock, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import UniCollectiblesModal from '../components/brand/UniCollectiblesModal';
import { UniBuddy, UniPetBuddy } from '../components/brand/UnipediaMarks';
import { AnimatedPage } from '../components/motion/Primitives';
import { TabGuideBanner, TabGuideHelpButton } from '../components/onboarding/TabGuideBanner';
import { CourseTimeChart } from '../components/progress/CourseTimeChart';
import { GradeBullets } from '../components/progress/GradeBullets';
import { PlannedDoneChart } from '../components/progress/PlannedDoneChart';
import { PERIODS, periodRange, type Period } from '../components/progress/data';
import { ReadinessChart } from '../components/progress/ReadinessChart';
import { StreakHeatmap } from '../components/progress/StreakHeatmap';
import { StudyByDayChart } from '../components/progress/StudyByDayChart';
import { WeaknessChart } from '../components/progress/WeaknessChart';
import { Badge, Button, Card, PageHeader, Progress, Ring, SegmentedControl } from '../components/ui';
import { cx, showToast } from '../lib/uiHelpers';
import { openUniCheckIn } from '../lib/uniCheckInBus';
import type { StudyLogKind } from '../types';
import {
  computeUniCompanionState,
  getUniCollectibleStates,
  readCollectibleTelemetry,
} from '../lib/uniCollectibles';
import { fmtGrade, fmtMinutes, semesterAverage, sessionMinutes, studyStreak, todayStr } from '../lib/selectors';
import { useStore } from '../store/useStore';

export default function ProgressPage() {
  const [period, setPeriod] = useState<Period>('30d');
  const [logFilter, setLogFilter] = useState<'all' | StudyLogKind>('all');
  const [collectiblesOpen, setCollectiblesOpen] = useState(false);
  const [showEmptyCharts, setShowEmptyCharts] = useState(false);
  const courses = useStore((s) => s.courses);
  const assessments = useStore((s) => s.assessments);
  const sessions = useStore((s) => s.sessions);
  const settings = useStore((s) => s.settings);
  const weeklyCheckIns = useStore((s) => s.weeklyCheckIns);
  const studyLogs = useStore((s) => s.studyLogs);
  const removeStudyLog = useStore((s) => s.removeStudyLog);
  const tasks = useStore((s) => s.tasks);
  const updateSettings = useStore((s) => s.updateSettings);

  const activeSkin = settings.uniSkin ?? 'classic';
  const activePet = settings.uniPet ?? 'cat';
  const [now] = useState(() => new Date());
  const today = useMemo(() => todayStr(), []);
  const companion = useMemo(
    () =>
      computeUniCompanionState({
        sessions,
        tasks,
        weeklyCheckIns,
        studyLogs,
        today,
      }),
    [sessions, tasks, weeklyCheckIns, studyLogs, today],
  );
  const range = useMemo(() => periodRange(period, settings, now), [period, settings, now]);

  const collectibles = useMemo(
    () => getUniCollectibleStates(readCollectibleTelemetry(sessions, courses, weeklyCheckIns)),
    [sessions, courses, weeklyCheckIns],
  );
  const unlockedCount = collectibles.filter((c) => c.unlocked).length;
  const nextLocked = collectibles.find((c) => !c.unlocked);
  const nextLockedPct = nextLocked && nextLocked.progressTarget > 0
    ? Math.max(0, Math.min(1, nextLocked.progressCurrent / nextLocked.progressTarget))
    : 0;

  const hasSessions = sessions.length > 0;
  const hasTopics = courses.some((c) => c.topics.length > 0);
  const hasGradesOrAssessments = assessments.length > 0;

  const summary = useMemo(() => {
    const allTopics = courses.flatMap((c) => c.topics);
    const covered = allTopics.filter((t) => t.status === 'done' || t.status === 'review').length;
    const pct = allTopics.length > 0 ? covered / allTopics.length : 0;
    const totalDoneMin = sessions.filter((s) => s.done).reduce((sum, s) => sum + sessionMinutes(s), 0);
    return {
      pct,
      pctLabel: `${Math.round(pct * 100)}%`,
      covered,
      totalTopics: allTopics.length,
      totalDoneMin,
      avg: semesterAverage(courses, assessments),
      streak: studyStreak(sessions),
    };
  }, [courses, assessments, sessions]);

  return (
    <AnimatedPage className="space-y-5">
      <PageHeader
        eyebrow="Análise"
        title="O teu"
        accentTitle="progresso"
        subtitle={settings.semesterName.trim() || undefined}
        actions={
          <div className="flex items-center gap-2">
            <TabGuideHelpButton tabKey="progresso" />
            <SegmentedControl
              layoutId="progress-period-pill"
              value={period}
              onChange={(v) => setPeriod(v as Period)}
              items={PERIODS.map((p) => ({ id: p.value, label: p.label }))}
            />
          </div>
        }
      />

      <TabGuideBanner tabKey="progresso" />

      {/* Cartão Hero Bento "Progresso Geral" com anel estilo papelaria */}
      <section className="flex flex-wrap items-center justify-between gap-5 rounded-[26px] bg-pastel-sky/75 p-5 text-[#141312] shadow-card dark:bg-surface-2 dark:text-[#FAF6EC]">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider opacity-70">Progresso geral do semestre</p>
          <p className="font-display text-4xl font-bold tracking-tight tabular">{summary.pctLabel}</p>
          <p className="text-xs opacity-80">
            {summary.totalTopics > 0
              ? `${summary.covered} de ${summary.totalTopics} tópicos concluídos ou revistos`
              : 'Adiciona tópicos nas cadeiras para acompanhar a preparação'}
          </p>
          <div className="flex flex-wrap gap-4 pt-2 text-xs font-medium">
            <span className="tabular">Média: <strong>{fmtGrade(summary.avg)}</strong></span>
            <span className="tabular">Estudado: <strong>{fmtMinutes(summary.totalDoneMin)}</strong></span>
            <span className="tabular">Sequência: <strong>{summary.streak}d</strong></span>
          </div>
        </div>
        <Ring value={summary.pct} size={88} stroke={8} color="#157F58">
          <span className="font-display text-base font-bold tabular">{summary.pctLabel}</span>
        </Ring>
      </section>

      {/* Showcase inline dos Colecionáveis do Uni */}
      <section className="space-y-4 rounded-[26px] bg-pastel-butter/70 p-5 text-[#141312] shadow-card dark:bg-surface-2 dark:text-[#FAF6EC]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-[0.12em] opacity-70">
                Coleção do Uni · {unlockedCount}/{collectibles.length} cores
              </p>
              <Badge tone="ok">{companion.stage.label} · ⚡ {companion.dailyEnergy}/{companion.dailyEnergyGoal}</Badge>
            </div>
            <h2 className="mt-0.5 font-display text-lg font-bold">
              {nextLocked
                ? `Próximo: ${nextLocked.skin.name} (${nextLocked.progressLabel})`
                : 'Coleção completa desbloqueada!'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {activePet !== 'none' && (
              <div className="hidden items-center gap-1 rounded-full bg-white/75 px-2.5 py-1 dark:bg-black/25 sm:flex">
                <UniPetBuddy pet={activePet} size={22} />
              </div>
            )}
            <Button size="sm" variant="secondary" onClick={() => setCollectiblesOpen(true)}>
              <Sparkles size={14} /> Abrir ninho &amp; pets
            </Button>
          </div>
        </div>

        {nextLocked && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs opacity-80">
              <span>{nextLocked.skin.unlockHint}</span>
              <span className="font-mono tabular">{Math.round(nextLockedPct * 100)}%</span>
            </div>
            <Progress value={nextLockedPct} color="bg-[#157F58] dark:bg-accent" />
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {collectibles.map((item) => {
            const isEquipped = activeSkin === item.skin.id;
            return (
              <button
                key={item.skin.id}
                type="button"
                onClick={() => {
                  if (item.unlocked) {
                    updateSettings({ uniSkin: item.skin.id });
                    showToast(`${item.skin.name} equipado!`);
                  } else {
                    setCollectiblesOpen(true);
                  }
                }}
                className={cx(
                  'flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-[18px] border px-1.5 py-2 text-center transition',
                  isEquipped
                    ? 'border-[#157F58] bg-white/95 shadow-card dark:border-accent dark:bg-surface'
                    : item.unlocked
                      ? 'border-black/10 bg-white/65 hover:bg-white dark:border-white/10 dark:bg-black/20'
                      : 'border-dashed border-black/15 bg-white/35 opacity-75 dark:border-white/15 dark:bg-black/10',
                )}
              >
                <div className="relative">
                  <UniBuddy size={36} skin={item.skin.id} mood={item.unlocked ? 'happy' : 'calm'} interactive={false} />
                  {!item.unlocked && (
                    <span className="absolute -right-1 -bottom-1 grid size-4 place-items-center rounded-full bg-[#141312] text-white">
                      <Lock size={9} />
                    </span>
                  )}
                </div>
                <span className="line-clamp-1 text-xs font-semibold">
                  {item.skin.name.replace(/^Uni\s+/, '')}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {!hasSessions && !showEmptyCharts ? (
        <section className="space-y-4 rounded-[26px] bg-pastel-mint/55 p-5 text-[#141312] shadow-card dark:bg-surface-2 dark:text-[#FAF6EC]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-lg space-y-1">
              <p className="text-xs font-bold uppercase tracking-[0.1em] opacity-75">
                Caderno de ritmo &amp; métricas
              </p>
              <h2 className="font-display text-lg font-bold">
                Os teus gráficos ganham vida com o primeiro bloco de estudo
              </h2>
              <p className="text-xs leading-relaxed opacity-85">
                Em vez de mostrar painéis vazios agora, assim que concluires uma sessão no Plano ou no Temporizador verás aqui quanto estudaste por dia, consistência e distribuição por cadeira.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/plano">
                <Button size="sm" variant="primary">
                  Gerar plano de estudo <ArrowRight size={14} />
                </Button>
              </Link>
              <Button size="sm" variant="secondary" onClick={() => setShowEmptyCharts(true)}>
                <BarChart3 size={14} /> Prever grelha
              </Button>
            </div>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-3">
            <div className="rounded-[18px] bg-white/75 p-3 dark:bg-black/20">
              <p className="text-xs font-bold">1. Tempo por dia</p>
              <p className="mt-1 text-xs opacity-75">Comparação diária face à tua meta de estudo.</p>
            </div>
            <div className="rounded-[18px] bg-white/75 p-3 dark:bg-black/20">
              <p className="text-xs font-bold">2. Mapa de consistência</p>
              <p className="mt-1 text-xs opacity-75">Sequência ativa para desbloquear novos Unies.</p>
            </div>
            <div className="rounded-[18px] bg-white/75 p-3 dark:bg-black/20">
              <p className="text-xs font-bold">3. Preparação &amp; notas</p>
              <p className="mt-1 text-xs opacity-75">Cobertura de tópicos e alertas antes dos exames.</p>
            </div>
          </div>
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {(hasSessions || showEmptyCharts) && (
            <>
              <StudyByDayChart courses={courses} sessions={sessions} settings={settings} range={range} />
              <PlannedDoneChart sessions={sessions} range={range} />
              <CourseTimeChart courses={courses} sessions={sessions} range={range} />
              <StreakHeatmap sessions={sessions} now={now} />
            </>
          )}
          {(hasGradesOrAssessments || showEmptyCharts) && (
            <>
              <GradeBullets courses={courses} assessments={assessments} />
              <ReadinessChart assessments={assessments} courses={courses} />
            </>
          )}
          {(hasTopics || showEmptyCharts) && <WeaknessChart courses={courses} />}
        </div>
      )}

      {(hasSessions && (!hasTopics || !hasGradesOrAssessments) && !showEmptyCharts) || showEmptyCharts ? (
        <div className="flex justify-center">
          <Button size="sm" variant="ghost" onClick={() => setShowEmptyCharts((v) => !v)}>
            {showEmptyCharts ? 'Ocultar gráficos sem dados' : 'Mostrar também gráficos por preencher'}
          </Button>
        </div>
      ) : null}

      {/* Diário & Check-ins do Uni (Pós-aula, Fim do dia, Domingos e Modo Teste) */}
      <Card
        title="Diário & Alinhamento do Uni"
        action={
          <Button
            size="sm"
            variant="primary"
            onClick={() => openUniCheckIn({ kind: logFilter === 'all' ? 'day' : logFilter })}
          >
            <Plus size={14} /> Novo registo
          </Button>
        }
      >
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: 'all', label: `Todos (${studyLogs.length})` },
                { id: 'class', label: 'Pós-aula' },
                { id: 'day', label: 'Fim do dia' },
                { id: 'week', label: 'Domingos' },
                { id: 'exam_prep', label: 'Modo Teste' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setLogFilter(f.id)}
                className={cx(
                  'min-h-[38px] rounded-full border px-3 py-1 text-xs font-semibold transition',
                  logFilter === f.id
                    ? 'border-accent bg-accent text-accent-fg'
                    : 'border-line bg-surface-2/60 text-muted hover:text-fg',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {(() => {
            const visibleLogs =
              logFilter === 'all' ? studyLogs : studyLogs.filter((l) => l.kind === logFilter);
            if (visibleLogs.length === 0) {
              return (
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line p-5 text-center">
                  <BookOpenCheck size={20} className="text-muted" />
                  <p className="text-xs text-muted">
                    Ainda não tens registos neste filtro. Regista como correu a última aula, o dia de estudo ou o alinhamento de um teste.
                  </p>
                </div>
              );
            }
            const kindBadges: Record<StudyLogKind, string> = {
              class: 'Pós-aula',
              day: 'Fim do dia',
              week: 'Domingo',
              exam_prep: 'Modo Teste',
            };
            return (
              <ul className="space-y-2.5">
                {visibleLogs.slice(0, 20).map((log) => {
                  const course = log.courseId ? courses.find((c) => c.id === log.courseId) : undefined;
                  const topicNames =
                    course && log.topicIds && log.topicIds.length > 0
                      ? course.topics.filter((t) => log.topicIds!.includes(t.id)).map((t) => t.title)
                      : [];
                  return (
                    <li
                      key={log.id}
                      className="flex items-start justify-between gap-3 rounded-2xl border border-line bg-surface-2/40 p-3.5"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge tone={log.kind === 'exam_prep' ? 'warn' : 'accent'}>
                            {kindBadges[log.kind]}
                          </Badge>
                          {course && <Badge tone="neutral">{course.shortName}</Badge>}
                          <span className="text-xs font-medium text-muted">{log.date}</span>
                          <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-fg">
                            {log.feeling}
                            {log.rating ? ` · ${log.rating}/5` : ''}
                          </span>
                        </div>
                        {log.topicTitle && (
                          <p className="text-xs text-fg">
                            <strong className="font-semibold">Matéria:</strong> {log.topicTitle}
                          </p>
                        )}
                        {topicNames.length > 0 && (
                          <p className="text-xs text-fg">
                            <strong className="font-semibold">Tópicos alinhados:</strong>{' '}
                            {topicNames.join(', ')}
                          </p>
                        )}
                        {log.studiedSummary && (
                          <p className="text-xs text-muted">{log.studiedSummary}</p>
                        )}
                        {log.difficulties && (
                          <p className="text-xs text-coral">Dúvidas: {log.difficulties}</p>
                        )}
                        {log.notes && <p className="text-xs text-muted">{log.notes}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          removeStudyLog(log.id);
                          showToast('Registo removido do diário.', 'neutral');
                        }}
                        aria-label="Apagar registo do diário"
                        className="grid size-9 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface hover:text-danger"
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            );
          })()}
        </div>
      </Card>

      <UniCollectiblesModal open={collectiblesOpen} onClose={() => setCollectiblesOpen(false)} />
    </AnimatedPage>
  );
}
