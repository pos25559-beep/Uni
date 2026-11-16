import { GraduationCap, Upload } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { Button } from '../ui';
import ClipImportModal from './ClipImportModal';
import { HowTo, IntegrationCard } from './shared';

export default function ClipCard() {
  const { t } = useTranslation('settings');
  const status = useStore((s) => s.integrations.clip);
  const classCount = useStore((s) => s.classes.filter((c) => c.source === 'clip').length);
  const assessmentCount = useStore((s) => s.assessments.filter((a) => a.source === 'clip').length);
  const eventCount = useStore((s) => s.events.filter((e) => e.source === 'clip').length);
  const [open, setOpen] = useState(false);

  return (
    <>
      <IntegrationCard
        icon={<GraduationCap size={18} />}
        title={t('importSchedule.card.title')}
        description={t('importSchedule.card.desc')}
        status={status}
      >
        <p className="text-sm text-muted">
          {t('importSchedule.card.body')}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={() => setOpen(true)}>
            <Upload size={16} />
            {t('importSchedule.title')}
          </Button>
          {status.connected && (
            <span className="text-xs text-muted">
              {t('importSchedule.card.counts', { classes: classCount, assessments: assessmentCount, events: eventCount })}
            </span>
          )}
        </div>

        <HowTo
          steps={[
            t('importSchedule.card.how1'),
            t('importSchedule.card.how2'),
            t('importSchedule.card.how3'),
          ]}
        />
      </IntegrationCard>

      {open && <ClipImportModal onClose={() => setOpen(false)} />}
    </>
  );
}
