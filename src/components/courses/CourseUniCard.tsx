import { addDays, format } from 'date-fns';
import { Award, BookOpen, Brain, Compass, Loader2, Settings2, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { generateUniExpeditionQuestions } from '../../integrations/gemini';
import { formatAppDate } from '../../lib/grading';
import {
  listTopicSheetsByCourse,
  type TopicSheetRecord,
  type UniAgentRecord,
  type UniFormId,
} from '../../lib/localDb';
import { daysUntil, todayStr, upcomingAssessments } from '../../lib/selectors';
import {
  getLocalizedPersonas,
  inferAccessoryFromCourses,
  type UniPersonaMode,
} from '../../lib/uniAccessories';
import { removeUniAgent, saveUniAgent, useUniAgent } from '../../lib/uniAgents';
import {
  buildUniDiploma,
  canIssueDiploma,
  computeCourseMastery,
  computeCourseMilestones,
  getStageInfo,
  pickExpeditionCandidateTopics,
  recomputeUniAgentProgression,
  retrieveRelevantSheets,
  stageFromMastery,
} from '../../lib/uniMastery';
import { showToast } from '../../lib/uiHelpers';
import { useStore } from '../../store/useStore';
import type { AppLanguage, Course } from '../../types';
import { UniBuddy } from '../brand/UnipediaMarks';
import { Badge, Button, Card, Progress } from '../ui';
import { AdoptUniModal, CourseSheetsModal, UniNotebookMemoryModal } from './CourseUniModals';

export default function CourseUniCard({ course }: { course: Course }) {
  const { t, i18n } = useTranslation('uni');
  const appLang: AppLanguage = i18n.language?.startsWith('en') ? 'en' : 'pt-PT';
  const navigate = useNavigate();
  const assessments = useStore((s) => s.assessments);
  const sessions = useStore((s) => s.sessions);
  const materials = useStore((s) => s.materials);
  const settings = useStore((s) => s.settings);
  const gradingScale = settings.gradingScale ?? 'pt20';
  const aiConsent = Boolean(settings.aiConsent);

  const { agent, loading } = useUniAgent(course.id);
  const [adoptOpen, setAdoptOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [sheetsOpen, setSheetsOpen] = useState(false);
  const [sheets, setSheets] = useState<TopicSheetRecord[]>([]);
  const [preparingExpedition, setPreparingExpedition] = useState(false);
  const [tomorrowStr] = useState(() => format(addDays(new Date(), 1), 'yyyy-MM-dd'));

  const accessory = useMemo(() => inferAccessoryFromCourses([course]), [course]);
  const courseMaterials = useMemo(
    () => materials.filter((m) => m.courseId === course.id),
    [materials, course.id],
  );
  const nextAssessment = useMemo(
    () => upcomingAssessments(assessments).find((a) => a.courseId === course.id) ?? null,
    [assessments, course.id],
  );

  const refreshSheets = useCallback(async () => {
    const list = await listTopicSheetsByCourse(course.id);
    setSheets(list);
  }, [course.id]);

  useEffect(() => {
    let active = true;
    void listTopicSheetsByCourse(course.id).then((list) => {
      if (active) setSheets(list);
    });
    return () => {
      active = false;
    };
  }, [course.id]);

  // Mantém mestria e estágio sincronizados com os dados reais da app (nunca pelo modelo)
  useEffect(() => {
    if (!agent) return;
    const { agent: recomputed, stageUpFrom } = recomputeUniAgentProgression(
      agent,
      course,
      sessions,
      assessments,
      todayStr(),
      gradingScale,
    );
    const changed =
      recomputed.mastery !== agent.mastery ||
      recomputed.stage !== agent.stage ||
      recomputed.milestones.length !== agent.milestones.length ||
      recomputed.items.length !== agent.items.length ||
      recomputed.notebook.nextAssessment?.date !== agent.notebook.nextAssessment?.date;

    if (changed) {
      void saveUniAgent(recomputed).then(() => {
        if (stageUpFrom !== null) {
          const info = getStageInfo(recomputed.stage, appLang);
          showToast(`${recomputed.name} → ${info.localizedLabel}!`);
        }
      });
    }
  }, [agent, course, sessions, assessments, gradingScale, appLang]);

  const handleSaveAdoption = async (payload: {
    name: string;
    formId: UniFormId;
    personaId: UniPersonaMode;
    language: AppLanguage;
    memoryEnabled: boolean;
    learningStyle?: 'exemplos' | 'teoria' | 'exercicios';
    goal?: string;
    firstDifficulty?: string;
  }) => {
    const now = new Date().toISOString();
    const mastery = computeCourseMastery(course, assessments, todayStr(), gradingScale);
    const stage = stageFromMastery(mastery);
    const { milestones, items } = computeCourseMilestones(
      course,
      sessions,
      assessments,
      agent?.milestones ?? [],
      now,
      gradingScale,
      payload.language,
    );

    const record: UniAgentRecord = agent
      ? {
          ...agent,
          name: payload.name,
          formId: payload.formId,
          personaId: payload.personaId,
          language: payload.language,
          memoryEnabled: payload.memoryEnabled,
          mastery,
          stage,
          milestones,
          items,
          updatedAt: now,
        }
      : {
          courseId: course.id,
          name: payload.name,
          formId: payload.formId,
          personaId: payload.personaId,
          language: payload.language,
          memoryEnabled: payload.memoryEnabled,
          stage,
          mastery,
          milestones,
          items,
          notebook: {
            goals: payload.goal ? [payload.goal] : [],
            ...(payload.learningStyle ? { learningStyle: payload.learningStyle } : {}),
            weakSpots: payload.firstDifficulty
              ? [{ topic: course.shortName || course.name, note: payload.firstDifficulty, seen: 1 }]
              : [],
            strengths: [],
            customNotes: [],
            ...(nextAssessment
              ? { nextAssessment: { title: nextAssessment.title, date: nextAssessment.date } }
              : {}),
            updatedAt: now,
          },
          createdAt: now,
          updatedAt: now,
        };

    await saveUniAgent(record);
    showToast(
      agent
        ? `${record.name} atualizado.`
        : `${record.name} adotado para ${course.shortName}!`,
    );
  };

  if (loading) return null;

  if (!agent) {
    return (
      <>
        <Card className="flex flex-col gap-4 border-dashed sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-surface-2">
              <UniBuddy form="nuvem" stage={0} accessory={accessory} size={46} interactive={false} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold text-fg sm:text-base">
                  {t('card.adoptTitle', { course: course.shortName })}
                </h2>
                <Badge tone="neutral">{t('card.optional')}</Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted">{t('card.adoptDesc')}</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="primary"
            onClick={() => setAdoptOpen(true)}
            className="shrink-0"
          >
            <Sparkles size={14} /> {t('card.adoptBtn', { course: course.shortName })}
          </Button>
        </Card>

        {adoptOpen && (
          <AdoptUniModal
            open={adoptOpen}
            onClose={() => setAdoptOpen(false)}
            course={course}
            accessory={accessory}
            onSave={handleSaveAdoption}
          />
        )}
      </>
    );
  }

  const stageInfo = getStageInfo(agent.stage, appLang);
  const personaMeta = getLocalizedPersonas(appLang).find((p) => p.id === agent.personaId);
  const needsReviewNotice = course.topics.some(
    (t) => t.status === 'review' || (t.nextReviewDate && daysUntil(t.nextReviewDate) < 0),
  );
  const expeditionReady =
    Boolean(agent.expedition && agent.expedition.questions.length > 0 && agent.expedition.forDate >= todayStr());
  const diplomaEligible = canIssueDiploma(course, assessments, agent);

  const handlePrepareExpedition = async () => {
    if (!aiConsent || preparingExpedition) return;
    setPreparingExpedition(true);
    try {
      const candidateTopics = pickExpeditionCandidateTopics(course, tomorrowStr);
      const relevant = retrieveRelevantSheets(
        candidateTopics.map((ct) => ct.title).join(' '),
        sheets,
        candidateTopics[0]?.id,
        4,
      );
      const expedition = await generateUniExpeditionQuestions({
        courseName: course.name,
        agent,
        candidateTopics,
        sheets: relevant,
        forDate: tomorrowStr,
      });
      await saveUniAgent({ ...agent, expedition, updatedAt: new Date().toISOString() });
      showToast(
        t('card.expeditionReady', {
          count: expedition.questions.length,
          date: formatAppDate(tomorrowStr, appLang),
        }),
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao preparar expedição', 'danger');
    } finally {
      setPreparingExpedition(false);
    }
  };

  const handleIssueDiploma = async () => {
    const diploma = buildUniDiploma(course, assessments, agent);
    await saveUniAgent({ ...agent, diploma, updatedAt: new Date().toISOString() });
    showToast(`${t('card.diplomaIssued')} · ${course.shortName}!`);
  };

  return (
    <>
      <Card className="space-y-4">
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-3.5">
            <div className="grid size-16 shrink-0 place-items-center rounded-2xl border border-line bg-surface-2/70">
              <UniBuddy
                form={agent.formId}
                stage={agent.stage}
                accessory={accessory}
                mood={agent.stage >= 2 ? 'happy' : 'calm'}
                size={54}
                interactive={false}
              />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h2 className="text-base font-semibold text-fg">{agent.name}</h2>
                <Badge tone={agent.stage >= 2 ? 'ok' : 'accent'}>
                  {t('card.stageBadge', { current: agent.stage + 1, label: stageInfo.localizedLabel })}
                </Badge>
                {personaMeta && <Badge tone="neutral">{personaMeta.label}</Badge>}
                {agent.stage >= 3 && <Badge tone="ok">{t('card.examModeUnlocked')}</Badge>}
                {agent.diploma && <Badge tone="ok">{t('card.diplomaIssued')}</Badge>}
              </div>
              <p className="mt-1 text-xs text-muted">{stageInfo.localizedHint}</p>
              {agent.items.length > 0 && (
                <p className="mt-1 text-xs font-medium text-ok-ink">
                  {t('card.areaItem', { item: agent.items.join(' · ') })}
                </p>
              )}
            </div>
          </div>

          <Button
            size="sm"
            variant="ghost"
            aria-label={`Personalizar ${agent.name}`}
            onClick={() => setAdoptOpen(true)}
            className="shrink-0"
          >
            <Settings2 size={15} />
            <span className="hidden sm:inline">{t('adoptModal.editTitle', { name: '', course: '' }).split(' ')[0]}</span>
          </Button>
        </div>

        <div className="space-y-1.5 rounded-2xl border border-line bg-surface-2/50 p-3">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-fg">{t('card.realMastery', { course: course.shortName })}</span>
            <span className="font-semibold text-accent-ink tabular">{agent.mastery}/100</span>
          </div>
          <Progress value={agent.mastery / 100} />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <span>
              {stageInfo.nextThreshold !== null
                ? t('card.nextThreshold', { score: stageInfo.nextThreshold })
                : t('card.milestonesCount', { count: agent.milestones.length })}
            </span>
            {nextAssessment ? (
              <span>
                {t('card.nextExam', {
                  title: nextAssessment.title,
                  date: formatAppDate(nextAssessment.date, appLang),
                })}
              </span>
            ) : needsReviewNotice ? (
              <span>{t('card.pendingReview', { name: agent.name })}</span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="primary"
            onClick={() => navigate(`/assistente?course=${encodeURIComponent(course.id)}`)}
          >
            <Sparkles size={14} /> {t('card.studyWith', { name: agent.name })}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setMemoryOpen(true)}>
            <Brain size={14} /> {t('card.whatKnows')}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setSheetsOpen(true)}>
            <BookOpen size={14} /> {t('card.sheets', { count: sheets.length })}
          </Button>
          {agent.stage >= 2 && aiConsent && (
            <Button
              size="sm"
              variant="secondary"
              disabled={preparingExpedition}
              onClick={() => void handlePrepareExpedition()}
            >
              {preparingExpedition ? <Loader2 size={14} className="animate-spin" /> : <Compass size={14} />}
              {preparingExpedition
                ? t('card.preparingExpedition')
                : expeditionReady && agent.expedition
                  ? t('card.expeditionReady', {
                      count: agent.expedition.questions.length,
                      date: formatAppDate(agent.expedition.forDate, appLang),
                    })
                  : t('card.prepareExpedition')}
            </Button>
          )}
          {diplomaEligible && !agent.diploma && (
            <Button size="sm" variant="secondary" onClick={() => void handleIssueDiploma()}>
              <Award size={14} /> {t('card.issueDiploma')}
            </Button>
          )}
        </div>
      </Card>

      {adoptOpen && (
        <AdoptUniModal
          open={adoptOpen}
          onClose={() => setAdoptOpen(false)}
          course={course}
          accessory={accessory}
          initialAgent={agent}
          onSave={handleSaveAdoption}
          onRemove={async () => {
            await removeUniAgent(course.id);
            showToast(`${agent.name} removido desta cadeira.`);
          }}
        />
      )}

      {memoryOpen && (
        <UniNotebookMemoryModal
          open={memoryOpen}
          onClose={() => setMemoryOpen(false)}
          agent={agent}
          courseName={course.shortName}
          onUpdateAgent={async (next) => {
            await saveUniAgent(next);
          }}
        />
      )}

      {sheetsOpen && (
        <CourseSheetsModal
          open={sheetsOpen}
          onClose={() => setSheetsOpen(false)}
          course={course}
          materials={courseMaterials}
          sheets={sheets}
          onRefreshSheets={refreshSheets}
          onOpenInTutor={() => {
            setSheetsOpen(false);
            navigate(`/assistente?course=${encodeURIComponent(course.id)}`);
          }}
        />
      )}
    </>
  );
}
