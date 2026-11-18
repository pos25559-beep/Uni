import type { OnboardingStep } from '@onboardjs/core';
import { OnboardingProvider } from '@onboardjs/react';
import { AnimatePresence, motion } from 'motion/react';
import { lazy, Suspense } from 'react';
import { auth } from '../../lib/firebase';
import { LEGAL_INFO } from '../../lib/legal';
import { cx } from '../../lib/uiHelpers';
import { requestAiConsent } from '../../store/useAiConsentStore';
import { useStore } from '../../store/useStore';
import type { SmartScheduleImportSummary } from '../courses/SmartScheduleImportModal';
import {
  ONBOARDING_STEPS,
  type OnboardingContextData,
  type OnboardingExperienceProps,
} from './onboardingMeta';
import { OnboardingLegalModal } from './OnboardingLegalModal';
import { OnboardingFooter, OnboardingHeader } from './OnboardingShellChrome';
import Step1Identity from './steps/Step1Identity';
import Step2Academic from './steps/Step2Academic';
import Step3Courses from './steps/Step3Courses';
import Step4RhythmPrivacy from './steps/Step4RhythmPrivacy';
import { useOnboardingState } from './useOnboardingState';

export type { OnboardingExperienceProps, OnboardingStepId } from './onboardingMeta';
export type { OnboardingStep };

const SmartScheduleImportModal = lazy(() => import('../courses/SmartScheduleImportModal'));

function OnboardingFlowBody({ onClose, fullScreen = true }: OnboardingExperienceProps) {
  const s = useOnboardingState({ onClose, fullScreen });

  return (
    <div
      className={cx(
        'relative flex flex-col overflow-hidden bg-bg text-fg',
        fullScreen ? 'h-[100dvh] w-full overflow-hidden' : 'w-full rounded-[22px]',
      )}
    >
      <AnimatePresence>
        {s.finishingWipe && (
          <motion.div
            aria-hidden="true"
            initial={{ clipPath: 'circle(0% at 86% 92%)' }}
            animate={{ clipPath: 'circle(155% at 86% 92%)' }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none fixed inset-0 z-[80] bg-accent"
          />
        )}
      </AnimatePresence>

      <OnboardingHeader
        stepIndex={s.stepIndex}
        canSkipDirectly={s.canSkipDirectly}
        onClose={onClose}
      />

      {/* Corpo em 4 passos curtos */}
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
        <motion.div
          key={s.activeStepId}
          initial={{ opacity: 0, x: s.direction * 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-5"
        >
          {s.activeStepId === 'identidade' && (
            <Step1Identity
              userName={s.userName}
              setUserName={s.setUserName}
              themePref={s.themePref}
              setThemePref={s.setThemePref}
              themePalette={s.themePalette}
              setThemePalette={s.setThemePalette}
              appTone={s.appTone}
              setAppTone={s.setAppTone}
              uniAccessory={s.uniAccessory}
              setUniAccessory={s.setUniAccessory}
              uniPersona={s.uniPersona}
              setUniPersona={s.setUniPersona}
              uniLiveCompanions={s.uniLiveCompanions}
              setUniLiveCompanions={s.setUniLiveCompanions}
            />
          )}

          {s.activeStepId === 'curso' && (
            <Step2Academic
              catalog={s.catalog}
              universityId={s.universityId}
              onUniversityChange={s.handleUniversityChange}
              customUniversity={s.customUniversity}
              setCustomUniversity={s.setCustomUniversity}
              degreeId={s.degreeId}
              onDegreeChange={s.handleDegreeChange}
              customDegree={s.customDegree}
              setCustomDegree={s.setCustomDegree}
              availableDegrees={s.availableDegrees}
              isSecondarySchool={s.isSecondarySchool}
              academicCycle={s.academicCycle}
              onCycleChange={s.handleCycleChange}
              yearChoices={s.yearChoices}
              activeYears={s.activeYears}
              onToggleYear={s.toggleYearPill}
              currentSemester={s.currentSemester}
              onSemesterChange={s.handleSemesterChange}
              entryYear={s.entryYear}
              setEntryYear={s.setEntryYear}
              targetTotalEcts={s.targetTotalEcts}
              onSelectEctsTarget={s.handleSelectEctsTarget}
              completedEcts={s.completedEcts}
              setCompletedEcts={s.setCompletedEcts}
              ectsStage={s.ectsStage}
              onApplyEctsStage={s.handleApplyEctsStage}
              learningChallenges={s.learningChallenges}
              onToggleChallenge={s.toggleLearningChallenge}
              extraActivities={s.extraActivities}
              onToggleExtraPreset={s.toggleExtraPreset}
              onRemoveExtra={(id) => s.setExtraActivities((prev) => prev.filter((a) => a.id !== id))}
              customExtraLabel={s.customExtraLabel}
              setCustomExtraLabel={s.setCustomExtraLabel}
              customExtraHours={s.customExtraHours}
              setCustomExtraHours={s.setCustomExtraHours}
              onAddCustomExtra={s.handleAddCustomExtra}
            />
          )}

          {s.activeStepId === 'cadeiras' && (
            <Step3Courses
              records={s.records}
              mainFilteredRecords={s.mainFilteredRecords}
              optionalAvailableRecords={s.optionalAvailableRecords}
              availableRecordYears={s.availableRecordYears}
              effectiveYearFilter={s.effectiveYearFilter}
              setYearFilter={s.setYearFilter}
              showOtherTermsHistory={s.showOtherTermsHistory}
              setShowOtherTermsHistory={s.setShowOtherTermsHistory}
              showOptionalCourses={s.showOptionalCourses}
              setShowOptionalCourses={s.setShowOptionalCourses}
              optionalSearch={s.optionalSearch}
              setOptionalSearch={s.setOptionalSearch}
              isSecondarySchool={s.isSecondarySchool}
              doingCount={s.doingCount}
              approvedCount={s.approvedCount}
              weightedAvg={s.weightedAvg}
              approvedEctsFromList={s.approvedEctsFromList}
              activeEctsFromList={s.activeEctsFromList}
              onUpdateStatus={s.updateRecordStatus}
              onUpdateGrade={s.updateRecordGrade}
              onRemoveRecord={s.removeRecord}
              onResetDefaults={s.resetRecordsToDegreeDefaults}
              replaceCoursesWithCurriculum={s.replaceCoursesWithCurriculum}
              setReplaceCoursesWithCurriculum={s.setReplaceCoursesWithCurriculum}
              hasExistingCourses={s.existingCourses.length > 0}
              newCourseCode={s.newCourseCode}
              setNewCourseCode={s.setNewCourseCode}
              newCourseName={s.newCourseName}
              setNewCourseName={s.setNewCourseName}
              newCourseYear={s.newCourseYear}
              setNewCourseYear={s.setNewCourseYear}
              newCourseEcts={s.newCourseEcts}
              setNewCourseEcts={s.setNewCourseEcts}
              onAddCustomRecord={s.addCustomRecord}
              yearChoices={s.yearChoices}
              onOpenScheduleImport={(mode) => {
                const st = useStore.getState();
                s.setScheduleImportBaseline({
                  courses: st.courses.length,
                  classes: st.classes.length,
                  assessments: st.assessments.length,
                });
                s.setScheduleImportMode(mode);
              }}
              onUploadScreenshot={(files) => void s.handleScreenshotUpload(files)}
              ocrBusy={s.ocrBusy}
              ocrFeedback={s.ocrFeedback}
              ocrError={s.ocrError}
              scheduleDoneInfo={s.scheduleDoneInfo}
              showPastePlan={s.showPastePlan}
              setShowPastePlan={s.setShowPastePlan}
              pastedPlanText={s.pastedPlanText}
              setPastedPlanText={s.setPastedPlanText}
              onApplyPasted={s.handleApplyPastedCurriculum}
              pendingAiConsentCount={s.pendingPrintFilesForConsent?.length ?? 0}
              onConfirmAiAndReadPrint={() => {
                const queued = s.pendingPrintFilesForConsent;
                requestAiConsent(() => {
                  s.setAiConsent(true);
                  s.setPendingPrintFilesForConsent(null);
                  if (queued && queued.length > 0) {
                    void s.handleScreenshotUpload(queued, true);
                  }
                });
              }}
              onCancelAiPrintConsent={() => s.setPendingPrintFilesForConsent(null)}
            />
          )}

          {s.activeStepId === 'ritmo' && (
            <Step4RhythmPrivacy
              dailyMinutes={s.dailyMinutes}
              setDailyMinutes={s.setDailyMinutes}
              studyDays={s.studyDays}
              onToggleStudyDay={s.toggleStudyDay}
              activeCandidates={s.activeCandidates}
              difficultKeys={s.difficultKeys}
              onToggleDifficult={s.toggleDifficult}
              difficultNotes={s.difficultNotes}
              setDifficultNotes={s.setDifficultNotes}
              academicMailConnected={s.academicMailConnected}
              academicEmail={s.academicEmail ?? undefined}
              academicHint={s.academicHint}
              setAcademicHint={s.setAcademicHint}
              academicBusy={s.academicBusy}
              onConnectAcademic={() => void s.handleConnectAcademic()}
              ageConfirmed={s.ageConfirmed}
              setAgeConfirmed={s.setAgeConfirmed}
              aiConsent={s.aiConsent}
              setAiConsent={(next) => {
                if (next) {
                  requestAiConsent(() => s.setAiConsent(true));
                  return;
                }
                s.setAiConsent(false);
                s.updateSettings({ aiConsent: false });
              }}
              cloudSyncConsent={s.cloudSyncConsent}
              setCloudSyncConsent={s.setCloudSyncConsent}
              isSignedIn={Boolean(auth.currentUser)}
              personalEmail={s.activePersonalEmail}
              submitAttempted={s.submitAttempted}
              onOpenLegal={s.setLegalPreview}
            />
          )}
        </motion.div>
      </main>

      <OnboardingFooter
        stepIndex={s.stepIndex}
        isLastStep={s.activeStepId === 'ritmo'}
        onPrev={() => void s.handleGoPrev()}
        onNext={() => void s.handleGoNext()}
        onFinish={s.handleFinish}
      />

      <OnboardingLegalModal
        legalPreview={s.legalPreview}
        onClose={() => s.setLegalPreview(null)}
      />

      {s.scheduleImportMode && (
        <Suspense fallback={null}>
          <SmartScheduleImportModal
            initialMode={s.scheduleImportMode}
            currentSemester={s.currentSemester}
            onImported={(summary: SmartScheduleImportSummary) => {
              s.applyScheduleScopeToRecords(
                [
                  ...summary.activeCourses.map((c) => ({
                    code: c.code,
                    name: c.name,
                    ects: c.ects ?? (s.isSecondarySchool ? 4 : 6),
                    semester: s.currentSemester,
                    status: 'a_fazer' as const,
                  })),
                  ...(summary.otherSemesterCourses ?? []).map((c) => ({
                    code: c.code,
                    name: c.name,
                    ects: c.ects ?? (s.isSecondarySchool ? 4 : 6),
                    semester: c.semester,
                    status: 'por_fazer' as const,
                  })),
                ],
                {
                  classesCount: summary.classesCount,
                  assessmentsCount: summary.assessmentsCount,
                  source: summary.source,
                  slotSummaries: summary.slotSummaries,
                },
              );
              s.setScheduleImportMode(null);
              s.setScheduleImportBaseline(null);
            }}
            onClose={() => {
              const closingMode = s.scheduleImportMode;
              s.setScheduleImportMode(null);
              const state = useStore.getState();
              const storeCourses = state.courses;
              const addedClasses = Math.max(
                0,
                state.classes.length - (s.scheduleImportBaseline?.classes ?? 0),
              );
              const addedAssessments = Math.max(
                0,
                state.assessments.length - (s.scheduleImportBaseline?.assessments ?? 0),
              );
              const addedCourses = Math.max(
                0,
                storeCourses.length - (s.scheduleImportBaseline?.courses ?? 0),
              );
              s.setScheduleImportBaseline(null);

              if (addedClasses > 0 || addedAssessments > 0 || addedCourses > 0) {
                s.applyScheduleScopeToRecords(
                  storeCourses.map((c) => ({
                    code: c.code,
                    name: c.name,
                    ects: c.ects,
                    status: 'a_fazer' as const,
                  })),
                  {
                    classesCount: addedClasses,
                    assessmentsCount: addedAssessments,
                    source: closingMode === 'gcal' ? 'gcal' : 'photo',
                  },
                );
              }
            }}
          />
        </Suspense>
      )}
    </div>
  );
}

export default function OnboardingExperience({
  onClose,
  fullScreen = true,
  initialStepId = 'curso',
}: OnboardingExperienceProps) {
  return (
    <OnboardingProvider<OnboardingContextData>
      steps={ONBOARDING_STEPS}
      initialStepId={initialStepId}
      initialContext={{ flowData: {}, flowVersion: LEGAL_INFO.policyVersion }}
    >
      <OnboardingFlowBody onClose={onClose} fullScreen={fullScreen} />
    </OnboardingProvider>
  );
}
