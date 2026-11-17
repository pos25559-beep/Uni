import { Award } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getUniAgent } from '../../../lib/localDb';
import type { UniAgentRecord } from '../../../lib/localDb';
import { transferMasteryToNextCourse } from '../../../lib/studyBridge';
import { saveUniAgent } from '../../../lib/uniAgents';
import { showToast } from '../../../lib/uiHelpers';
import { useStore } from '../../../store/useStore';
import type { Course } from '../../../types';
import { Button, Modal, Select } from '../../ui';

export function MasterMentorshipModal({
  open,
  onClose,
  sourceCourse,
  sourceAgent,
}: {
  open: boolean;
  onClose: () => void;
  sourceCourse: Course;
  sourceAgent: UniAgentRecord;
}) {
  const { t } = useTranslation(['uni', 'common']);
  const courses = useStore((s) => s.courses);
  const candidates = courses.filter((c) => c.id !== sourceCourse.id);
  const [targetCourseId, setTargetCourseId] = useState<string>(candidates[0]?.id ?? '');
  const [saving, setSaving] = useState(false);

  const handleTransfer = async () => {
    const targetCourse = candidates.find((c) => c.id === targetCourseId);
    if (!targetCourse) return;
    setSaving(true);
    try {
      const existingTargetAgent = await getUniAgent(targetCourse.id);
      const nextTargetAgent = transferMasteryToNextCourse({
        sourceCourse,
        sourceAgent,
        targetCourse,
        targetAgent: existingTargetAgent,
      });
      await saveUniAgent(nextTargetAgent);
      showToast(
        t('uni:shelf.inheritDone', {
          from: sourceAgent.name,
          to: targetCourse.shortName || targetCourse.name,
        }),
        'ok',
      );
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('memory.mentorErr'), 'danger');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('uni:shelf.inheritModalTitle', {
        name: sourceAgent.name,
        course: sourceCourse.shortName,
      })}
      footer={
        <>
          <Button size="sm" variant="secondary" onClick={onClose}>
            {t('common:actions.cancel')}
          </Button>
          {candidates.length > 0 && (
            <Button size="sm" variant="primary" loading={saving} onClick={() => void handleTransfer()}>
              <Award size={14} /> {t('uni:shelf.inheritBtn')}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-xs leading-relaxed text-muted">{t('uni:shelf.inheritModalHint')}</p>
        {candidates.length === 0 ? (
          <p className="rounded-2xl bg-surface-2 px-3.5 py-3 text-xs text-muted">
            {t('uni:shelf.inheritNoTarget')}
          </p>
        ) : (
          <Select value={targetCourseId} onChange={(e) => setTargetCourseId(e.target.value)}>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.shortName} · {c.name}
              </option>
            ))}
          </Select>
        )}
      </div>
    </Modal>
  );
}
