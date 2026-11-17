import { Check, Copy, ExternalLink, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { normalizeAppLanguage } from '../../../lib/grading';
import type { TopicSheetRecord, UniAgentRecord } from '../../../lib/localDb';
import { openInAppBrowser } from '../../../lib/nativeBridge';
import { buildStudyGuideExport, parseAndImportQuizResult } from '../../../lib/studyBridge';
import { showToast } from '../../../lib/uiHelpers';
import { useStore } from '../../../store/useStore';
import type { Course } from '../../../types';
import { Button, Field, Modal, SegmentedControl, Select, Textarea } from '../../ui';

export function StudyBridgeModal({
  open,
  onClose,
  course,
  agent,
  sheets,
  onAgentUpdated,
}: {
  open: boolean;
  onClose: () => void;
  course: Course;
  agent: UniAgentRecord;
  sheets: TopicSheetRecord[];
  onAgentUpdated: (next: UniAgentRecord) => Promise<void>;
}) {
  const { t, i18n } = useTranslation(['uni', 'common']);
  const appLang = normalizeAppLanguage(i18n.language);
  const sessions = useStore((s) => s.sessions);
  const assessments = useStore((s) => s.assessments);
  const gradingScale = useStore((s) => s.settings.gradingScale) ?? 'pt20';
  const upsert = useStore((s) => s.upsert);

  const [tab, setTab] = useState<'export' | 'import'>('export');
  const [selectedTopicId, setSelectedTopicId] = useState<string>(course.topics[0]?.id ?? '');
  const [copied, setCopied] = useState(false);
  const [rawQuizText, setRawQuizText] = useState('');
  const [importing, setImporting] = useState(false);

  const selectedTopic = course.topics.find((tp) => tp.id === selectedTopicId) ?? course.topics[0];
  const guideText = buildStudyGuideExport({
    course,
    topic: selectedTopic,
    sheets,
    agent,
    language: agent.language || appLang,
  });

  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(guideText);
      setCopied(true);
      showToast(t('uni:bridge.copied'), 'ok');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast(t('uni:bridge.copyFail'), 'danger');
    }
  };

  const handleImportQuiz = async () => {
    if (!rawQuizText.trim()) {
      showToast(t('uni:bridge.missingText'), 'neutral');
      return;
    }
    setImporting(true);
    try {
      const outcome = parseAndImportQuizResult({
        rawText: rawQuizText,
        course,
        topicId: selectedTopic?.id,
        agent,
        sessions,
        assessments,
        gradingScale,
      });
      upsert('courses', outcome.nextCourse);
      if (outcome.nextAgent) {
        await onAgentUpdated(outcome.nextAgent);
      }
      setRawQuizText('');
      showToast(t('uni:bridge.importedSuccess'), 'ok');
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('memory.quizErr'), 'danger');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('uni:bridge.title', { course: course.shortName })}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          {course.notebookUrl ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void openInAppBrowser(course.notebookUrl!)}
            >
              <ExternalLink size={14} /> {t('uni:bridge.openExternal')}
            </Button>
          ) : (
            <span />
          )}
          <Button size="sm" variant="primary" onClick={onClose}>
            {t('common:actions.done')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-xs leading-relaxed text-muted">{t('uni:bridge.subtitle')}</p>

        <SegmentedControl
          layoutId="study-bridge-tabs"
          value={tab}
          onChange={(v) => setTab(v as 'export' | 'import')}
          items={[
            { id: 'export', label: t('uni:bridge.tabExport') },
            { id: 'import', label: t('uni:bridge.tabImport') },
          ]}
        />

        {course.topics.length > 0 && (
          <Field label={t('uni:bridge.topicLabel')}>
            <Select
              value={selectedTopic?.id ?? ''}
              onChange={(e) => setSelectedTopicId(e.target.value)}
            >
              {course.topics.map((tp) => (
                <option key={tp.id} value={tp.id}>
                  {tp.title}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {tab === 'export' ? (
          <div className="space-y-2.5">
            <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-2xl border border-line bg-surface-2/60 p-3 text-xs leading-relaxed text-fg">
              {guideText}
            </pre>
            <Button size="sm" variant="primary" className="w-full" onClick={() => void handleCopy()}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? t('uni:bridge.copied') : t('uni:bridge.copyGuide')}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Field label={t('uni:bridge.importLabel')}>
              <Textarea
                value={rawQuizText}
                onChange={(e) => setRawQuizText(e.target.value)}
                placeholder={t('uni:bridge.importPlaceholder')}
                className="min-h-28"
              />
            </Field>
            <Button
              size="sm"
              variant="primary"
              className="w-full"
              loading={importing}
              onClick={() => void handleImportQuiz()}
            >
              <Sparkles size={14} /> {t('uni:bridge.importBtn')}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
