import { Award, GraduationCap, Lock, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { formatGradeByScale } from '../../lib/grading';
import type { UniAgentRecord } from '../../lib/localDb';
import { inferAccessoryFromCourses } from '../../lib/uniAccessories';
import { saveUniAgent, useUniAgents } from '../../lib/uniAgents';
import type {
  computeUniCompanionState,
  getUniCollectibleStates,
  UniPetProgress,
} from '../../lib/uniCollectibles';
import {
  buildUniDiploma,
  canIssueDiploma,
  getStageInfo,
  transferMasteryWisdomToAgent,
} from '../../lib/uniMastery';
import { cx, showToast } from '../../lib/uiHelpers';
import { useStore } from '../../store/useStore';
import type { AppLanguage, UniPetId, UniSkinId } from '../../types';
import { UniBuddy, UniPetBuddy } from '../brand/UnipediaMarks';
import { Badge, Button, Modal, Progress } from '../ui';

interface UniShelfSectionProps {
  collectibles: ReturnType<typeof getUniCollectibleStates>;
  petStates: UniPetProgress[];
  unlockedCount: number;
  activeSkin: UniSkinId;
  activePet: UniPetId;
  companion: ReturnType<typeof computeUniCompanionState>;
  onSelectSkin: (skinId: UniSkinId) => void;
  onSelectPet: (petId: UniPetId) => void;
  onOpenCustomize: () => void;
}

export default function UniShelfSection({
  collectibles,
  petStates,
  unlockedCount,
  activeSkin,
  activePet,
  companion,
  onSelectSkin,
  onSelectPet,
  onOpenCustomize,
}: UniShelfSectionProps) {
  const { t, i18n } = useTranslation(['uni', 'common']);
  const appLang: AppLanguage = i18n.language?.startsWith('en') ? 'en' : 'pt-PT';
  const navigate = useNavigate();

  const courses = useStore((s) => s.courses);
  const assessments = useStore((s) => s.assessments);
  const gradingScale = useStore((s) => s.settings.gradingScale) ?? 'pt20';
  const agents = useUniAgents();

  const [shelfTab, setShelfTab] = useState<'unis' | 'looks'>('unis');
  const [inheritFrom, setInheritFrom] = useState<UniAgentRecord | null>(null);

  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);
  const unlockedPets = petStates.filter((p) => p.unlocked).length;
  const inheritSourceCourse = inheritFrom ? courseById.get(inheritFrom.courseId) : undefined;
  const inheritTargets = useMemo(
    () =>
      inheritFrom
        ? agents.filter((a) => a.courseId !== inheritFrom.courseId && courseById.has(a.courseId))
        : [],
    [agents, courseById, inheritFrom],
  );

  const handleIssueDiploma = async (agent: UniAgentRecord) => {
    const course = courseById.get(agent.courseId);
    if (!course) return;
    const diploma = buildUniDiploma(course, assessments, agent);
    await saveUniAgent({ ...agent, diploma, updatedAt: new Date().toISOString() });
    showToast(`${t('uni:card.diplomaIssued')} · ${course.shortName}!`);
  };

  const handleTransferWisdom = async (target: UniAgentRecord) => {
    if (!inheritFrom || !inheritSourceCourse) return;
    const targetCourse = courseById.get(target.courseId);
    const nextTarget = transferMasteryWisdomToAgent(
      inheritFrom,
      inheritSourceCourse.shortName,
      target,
    );
    await saveUniAgent(nextTarget);
    setInheritFrom(null);
    showToast(
      t('uni:shelf.inheritDone', {
        from: inheritFrom.name,
        to: targetCourse?.shortName ?? target.name,
      }),
    );
  };

  return (
    <>
      <section className="space-y-4 rounded-[26px] bg-pastel-butter/70 p-5 text-[#141312] shadow-card dark:bg-surface-2 dark:text-[#FAF6EC]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-[0.12em] opacity-70">
                {t('uni:shelf.eyebrow')} · {agents.length} Unis · {unlockedCount}/{collectibles.length} ·{' '}
                {unlockedPets}/{petStates.length} pets
              </p>
              <Badge tone="ok">
                {companion.stage.label} · ⚡ {companion.dailyEnergy}/{companion.dailyEnergyGoal}
              </Badge>
            </div>
          </div>
          <Button size="sm" variant="secondary" onClick={onOpenCustomize}>
            <Sparkles size={14} /> {t('common:actions.edit')}
          </Button>
        </div>

        <div
          role="tablist"
          aria-label={t('uni:shelf.eyebrow')}
          className="grid grid-cols-2 gap-1 rounded-2xl border border-black/10 bg-white/55 p-1 dark:border-white/10 dark:bg-black/25"
        >
          <button
            type="button"
            role="tab"
            aria-selected={shelfTab === 'unis'}
            onClick={() => setShelfTab('unis')}
            className={cx(
              'min-h-11 rounded-xl px-3 text-xs font-semibold transition',
              shelfTab === 'unis'
                ? 'bg-white text-[#141312] shadow-card dark:bg-surface dark:text-fg'
                : 'opacity-75 hover:opacity-100',
            )}
          >
            {t('uni:shelf.tabUnis')} ({agents.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={shelfTab === 'looks'}
            onClick={() => setShelfTab('looks')}
            className={cx(
              'min-h-11 rounded-xl px-3 text-xs font-semibold transition',
              shelfTab === 'looks'
                ? 'bg-white text-[#141312] shadow-card dark:bg-surface dark:text-fg'
                : 'opacity-75 hover:opacity-100',
            )}
          >
            {t('uni:shelf.tabLooks')} ({unlockedCount + unlockedPets})
          </button>
        </div>

        {shelfTab === 'unis' ? (
          agents.length === 0 ? (
            <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-black/15 bg-white/50 p-4 dark:border-white/15 dark:bg-black/20 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <UniBuddy form="nuvem" stage={0} size={42} interactive={false} />
                <div>
                  <p className="text-sm font-semibold">{t('uni:shelf.emptyUnisTitle')}</p>
                  <p className="text-xs opacity-75">{t('uni:shelf.emptyUnisHint')}</p>
                </div>
              </div>
              <Button size="sm" variant="primary" onClick={() => navigate('/cadeiras')}>
                {t('uni:shelf.goCourses')}
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {agents.map((agent) => {
                const course = courseById.get(agent.courseId);
                const stageInfo = getStageInfo(agent.stage, appLang);
                const accessory = course ? inferAccessoryFromCourses([course]) : 'default';
                const diplomaEligible = course ? canIssueDiploma(course, assessments, agent) : false;

                return (
                  <div
                    key={agent.courseId}
                    className="flex flex-col justify-between gap-3 rounded-[20px] border border-black/10 bg-white/70 p-3.5 dark:border-white/10 dark:bg-black/25"
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => navigate(`/cadeiras/${agent.courseId}`)}
                        aria-label={`${agent.name} · ${course?.shortName ?? ''}`}
                        className="grid size-14 shrink-0 place-items-center rounded-2xl border border-black/10 bg-white/80 dark:border-white/10 dark:bg-surface"
                      >
                        <UniBuddy
                          form={agent.formId}
                          stage={agent.stage}
                          accessory={accessory}
                          mood={agent.stage >= 3 ? 'happy' : 'calm'}
                          size={44}
                          interactive={false}
                        />
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-sm font-bold">{agent.name}</p>
                          <Badge tone={agent.stage >= 3 ? 'ok' : 'accent'}>
                            {t('uni:card.stageBadge', {
                              current: agent.stage + 1,
                              label: stageInfo.localizedLabel,
                            })}
                          </Badge>
                        </div>
                        <p className="mt-0.5 truncate text-xs opacity-75">
                          {course ? `${course.shortName} · ${course.name}` : agent.courseId}
                        </p>
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center justify-between text-xs tabular">
                            <span>{t('uni:card.realMastery', { course: course?.shortName ?? '' })}</span>
                            <span className="font-semibold">{agent.mastery}/100</span>
                          </div>
                          <Progress value={agent.mastery / 100} />
                        </div>
                      </div>
                    </div>

                    {agent.diploma && (
                      <div className="rounded-xl border border-ok/30 bg-ok-soft/80 px-3 py-2 text-xs text-ok-ink">
                        <p className="font-semibold">
                          {t('uni:shelf.diplomaTitle', {
                            course: course?.shortName ?? agent.courseId,
                          })}
                        </p>
                        <p className="mt-0.5 tabular">
                          {t('uni:shelf.diplomaTopics', {
                            mastered: agent.diploma.masteredTopicCount,
                            total: agent.diploma.totalTopicCount,
                          })}
                          {agent.diploma.finalGrade !== undefined &&
                            ` · ${t('uni:shelf.diplomaGrade', {
                              grade: formatGradeByScale(agent.diploma.finalGrade, gradingScale, appLang),
                            })}`}
                        </p>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {!agent.diploma && diplomaEligible && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => void handleIssueDiploma(agent)}
                        >
                          <Award size={14} /> {t('uni:card.issueDiploma')}
                        </Button>
                      )}
                      {(agent.stage >= 4 || Boolean(agent.diploma)) && (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => setInheritFrom(agent)}
                        >
                          <GraduationCap size={14} /> {t('uni:shelf.inheritBtn')}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {collectibles.map((item) => {
                const isEquipped = activeSkin === item.skin.id;
                return (
                  <button
                    key={item.skin.id}
                    type="button"
                    onClick={() => {
                      if (item.unlocked) {
                        onSelectSkin(item.skin.id);
                      } else {
                        onOpenCustomize();
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
                      <UniBuddy
                        size={36}
                        skin={item.skin.id}
                        mood={item.unlocked ? 'happy' : 'calm'}
                        interactive={false}
                      />
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

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {petStates.map(({ pet, unlocked, progressLabel }) => {
                const equipped = activePet === pet.id;
                return (
                  <button
                    key={pet.id}
                    type="button"
                    onClick={() => {
                      if (unlocked) {
                        onSelectPet(equipped ? 'none' : pet.id);
                      } else {
                        onOpenCustomize();
                      }
                    }}
                    className={cx(
                      'flex min-h-20 flex-col items-center justify-center gap-1 rounded-[18px] border px-2 py-2 text-center transition',
                      equipped
                        ? 'border-[#157F58] bg-white/95 shadow-card dark:border-accent dark:bg-surface'
                        : unlocked
                          ? 'border-black/10 bg-white/65 hover:bg-white dark:border-white/10 dark:bg-black/20'
                          : 'border-dashed border-black/15 bg-white/35 opacity-75 dark:border-white/15 dark:bg-black/10',
                    )}
                  >
                    <div className="relative">
                      <UniPetBuddy pet={pet.id} size={30} />
                      {!unlocked && (
                        <span className="absolute -right-1 -bottom-1 grid size-4 place-items-center rounded-full bg-[#141312] text-white">
                          <Lock size={9} />
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-semibold">{pet.name}</span>
                    <span className="line-clamp-1 text-xs opacity-75">
                      {unlocked ? (equipped ? '✓ Ativo' : progressLabel) : pet.unlockHint}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {inheritFrom && (
        <Modal
          open={Boolean(inheritFrom)}
          onClose={() => setInheritFrom(null)}
          title={t('uni:shelf.inheritModalTitle', {
            name: inheritFrom.name,
            course: inheritSourceCourse?.shortName ?? inheritFrom.courseId,
          })}
          footer={
            <Button size="sm" variant="secondary" onClick={() => setInheritFrom(null)}>
              {t('common:actions.close')}
            </Button>
          }
        >
          <div className="space-y-3">
            <p className="text-xs leading-relaxed text-muted">{t('uni:shelf.inheritModalHint')}</p>
            {inheritTargets.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line p-4 text-xs text-muted">
                {t('uni:shelf.inheritNoTarget')}
              </div>
            ) : (
              <div className="space-y-2">
                {inheritTargets.map((target) => {
                  const targetCourse = courseById.get(target.courseId);
                  return (
                    <button
                      key={target.courseId}
                      type="button"
                      onClick={() => void handleTransferWisdom(target)}
                      className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border border-line bg-surface-2/60 px-3.5 py-2.5 text-left transition hover:border-accent"
                    >
                      <div className="flex items-center gap-3">
                        <UniBuddy
                          form={target.formId}
                          stage={target.stage}
                          accessory={targetCourse ? inferAccessoryFromCourses([targetCourse]) : 'default'}
                          size={34}
                          interactive={false}
                        />
                        <div>
                          <p className="text-sm font-semibold text-fg">
                            {target.name} · {targetCourse?.shortName}
                          </p>
                          <p className="text-xs text-muted">{targetCourse?.name}</p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-accent-ink">
                        {t('uni:shelf.inheritBtn')}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
