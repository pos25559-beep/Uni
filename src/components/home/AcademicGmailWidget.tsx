import { CheckCircle2, ExternalLink, GraduationCap, KeyRound, Mail, RefreshCw, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button, Modal } from '../ui';
import { cx } from '../../lib/uiHelpers';
import { useAcademicEmails } from '../../hooks/useGoogleData';
import { parseEmlToAcademicEmail } from '../../integrations/gmail';
import type { AcademicEmail } from '../../services/googleService';
import { newId, useStore } from '../../store/useStore';
import { format, parseISO } from 'date-fns';
import { appDateLocale as pt, longDateTimePattern } from '../../lib/dateLocale';

export default function AcademicGmailWidget({ hideWhenEmpty = false }: { hideWhenEmpty?: boolean } = {}) {
  const { t } = useTranslation(['today', 'common']);
  const courses = useStore((s) => s.courses);
  const personalEmail = useStore((s) => s.settings.personalEmail);
  const savedAcademicEmail = useStore((s) => s.settings.academicEmail);
  const isMinimal = useStore((s) => (s.settings.appTone ?? 'vibrante') === 'serio');
  const updateSettings = useStore((s) => s.updateSettings);
  const upsert = useStore((s) => s.upsert);
  const {
    emails: allEmails,
    loading,
    connected,
    hasLiveToken,
    needsPermission,
    academicEmail,
    loadEmails,
    connect: handleConnect,
  } = useAcademicEmails();

  const [emailInput, setEmailInput] = useState(savedAcademicEmail || '');
  const [importedEmails, setImportedEmails] = useState<AcademicEmail[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<AcademicEmail | null>(null);
  const [taskAdded, setTaskAdded] = useState(false);
  const emlInputRef = useRef<HTMLInputElement>(null);

  const combinedEmails = [...importedEmails, ...allEmails].slice(0, 5);

  if (hideWhenEmpty && combinedEmails.length === 0 && !(connected && needsPermission)) {
    return null;
  }

  const handleImportEml = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseEmlToAcademicEmail(text, courses, `eml-${Date.now()}`);
      setImportedEmails((prev) => [parsed, ...prev]);
      setSelectedEmail(parsed);
    } finally {
      if (emlInputRef.current) emlInputRef.current.value = '';
    }
  };

  const handleCreateTask = () => {
    if (!selectedEmail) return;
    upsert('tasks', {
      id: newId(),
      courseId: selectedEmail.courseId,
      title: t('today:mail.taskPrefix', { subject: selectedEmail.subject.slice(0, 60) }),
      due: format(new Date(), 'yyyy-MM-dd'),
      done: false,
      priority: 2,
    });
    setTaskAdded(true);
    setTimeout(() => setTaskAdded(false), 2500);
  };

  return (
    <>
      {/* Cartão Postal Académico em pastel céu suave */}
      <section
        className={cx(
          'relative overflow-hidden border p-5 shadow-card',
          isMinimal
            ? 'rounded-2xl border-line bg-surface text-fg'
            : 'rounded-[26px] border-[#141312]/8 bg-[#E9F3FE] text-[#141312] dark:border-white/10 dark:bg-surface-2 dark:text-[#FAF6EC]',
        )}
      >
        <input
          ref={emlInputRef}
          type="file"
          accept=".eml,message/rfc822"
          className="hidden"
          onChange={(e) => void handleImportEml(e.target.files?.[0])}
        />

        {/* Selo postal decorativo no canto */}
        {!isMinimal && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-2 -right-2 size-16 rotate-6 rounded-2xl border-2 border-dashed border-[#E04F33]/35 bg-[#FAF8F2]/60 dark:border-coral/30 dark:bg-white/5"
          />
        )}

        <div className="relative z-10 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/75 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-accent-ink dark:bg-black/25 dark:text-accent">
              <Mail size={11} />
              {t('today:mail.badge')}
            </span>
            <h2 className="mt-1.5 font-display text-base font-bold leading-snug">
              {connected && academicEmail
                ? t('today:mail.titleConnected', { email: academicEmail })
                : t('today:mail.title')}
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            {connected && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void loadEmails(true)}
                disabled={loading}
                className="bg-white/80 dark:bg-surface"
              >
                <RefreshCw size={12} className={cx(loading && 'animate-spin')} />
                {t('today:mail.sync')}
              </Button>
            )}
          </div>
        </div>

        <div className="relative z-10 mt-3">
          {combinedEmails.length > 0 ? (
            <ul className="space-y-2 text-xs">
              {combinedEmails.map((em) => {
                const course = courses.find((c) => c.id === em.courseId);
                return (
                  <li key={em.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedEmail(em)}
                      className="group block min-h-11 w-full rounded-[18px] bg-white/80 px-3.5 py-2.5 text-left transition hover:bg-white dark:bg-black/25 dark:hover:bg-black/35"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1.5">
                          {em.isClipNotice ? (
                            <GraduationCap size={13} className="shrink-0 text-warn" />
                          ) : (
                            <Mail size={13} className="shrink-0 text-muted" />
                          )}
                          <span className="truncate font-semibold text-fg">{em.fromName}</span>
                          {course && (
                            <span className="shrink-0 whitespace-nowrap rounded-full bg-surface-2 px-2 py-0.5 font-mono text-xs text-accent-ink">
                              {course.shortName}
                            </span>
                          )}
                        </div>
                        <span className="shrink-0 font-mono text-xs text-muted">
                          {format(parseISO(em.date), 'd MMM', { locale: pt })}
                        </span>
                      </div>
                      <p className="mt-1 truncate font-medium text-fg group-hover:text-accent">
                        {em.subject}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted">{em.snippet}</p>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : !connected ? (
            <div className="space-y-3 text-xs">
              <p className="leading-relaxed opacity-85">
                {personalEmail
                  ? t('today:mail.personalHint', { email: personalEmail })
                  : t('today:mail.connectHint')}
                <code className="rounded bg-white/70 px-1 py-0.5 font-mono text-xs dark:bg-black/25">.eml</code>.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder={t('today:mail.emailPlaceholder')}
                  aria-label={t('today:mail.emailAria')}
                  className="min-h-11 w-full rounded-xl border border-black/15 bg-white/85 px-3 py-1.5 text-xs text-[#141312] placeholder:text-black/45 focus:border-accent focus:outline-none sm:min-w-[190px] sm:flex-1 dark:border-white/15 dark:bg-black/30 dark:text-[#FAF6EC] dark:placeholder:text-white/40"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      const trimmed = emailInput.trim();
                      if (trimmed) updateSettings({ academicEmail: trimmed });
                      void handleConnect(false, trimmed || undefined);
                    }}
                  >
                    <Mail size={13} />
                    {t('today:mail.connectBtn')}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => emlInputRef.current?.click()}
                    className="bg-white/85 text-[#141312] dark:bg-surface dark:text-fg"
                  >
                    <Upload size={13} />
                    {t('today:mail.importEml')}
                  </Button>
                </div>
              </div>
            </div>
          ) : needsPermission ? (
            <div className="space-y-2.5 text-xs">
              <p className="opacity-80">{t('today:mail.needsPermission')}</p>
              <Button size="sm" variant="primary" onClick={() => handleConnect(true)}>
                <KeyRound size={13} />
                {t('today:mail.authorizeBtn')}
              </Button>
            </div>
          ) : loading ? (
            <p className="py-2 text-xs opacity-75">{t('today:mail.loading')}</p>
          ) : (
            <div className="space-y-2.5 text-xs">
              <p className="opacity-80">
                {!hasLiveToken && academicEmail
                  ? t('today:mail.cachedHint', { email: academicEmail })
                  : t('today:mail.emptyInbox')}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => void loadEmails(true)} className="bg-white/80 dark:bg-surface">
                  <RefreshCw size={12} /> {!hasLiveToken ? t('today:mail.syncGmail') : t('today:mail.checkAgain')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => emlInputRef.current?.click()}>
                  <Upload size={12} /> {t('today:mail.importEmlPlain')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      {selectedEmail && (
        <Modal
          open={true}
          onClose={() => setSelectedEmail(null)}
          title={selectedEmail.subject}
          footer={
            <div className="flex w-full items-center justify-between gap-2">
              <div>
                {taskAdded && (
                  <span className="flex items-center gap-1 text-xs text-ok">
                    <CheckCircle2 size={13} /> {t('today:mail.taskCreated')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={handleCreateTask}>
                  <CheckCircle2 size={14} /> {t('today:mail.createTask')}
                </Button>
                <Button onClick={() => setSelectedEmail(null)}>{t('common:actions.close')}</Button>
              </div>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            <div className="border-b border-line pb-2 text-muted">
              <p><span className="font-semibold text-fg">{t('today:mail.fromLabel')}</span> {selectedEmail.from}</p>
              <p className="mt-1">
                <span className="font-semibold text-fg">{t('today:mail.dateLabel')}</span>{' '}
                {format(parseISO(selectedEmail.date), longDateTimePattern(true), { locale: pt })}
              </p>
            </div>

            <div className="rounded-xl border border-line bg-surface-2/40 p-4 leading-relaxed text-fg">
              {selectedEmail.snippet}
            </div>

            {selectedEmail.courseId && (
              <div className="flex items-center justify-between rounded-xl border border-line bg-surface p-3">
                <span className="text-muted">{t('today:mail.linkedCourse')}</span>
                <Link
                  to={`/cadeiras/${selectedEmail.courseId}`}
                  className="inline-flex min-h-11 items-center gap-1 font-semibold text-accent hover:underline"
                >
                  {t('today:mail.openCourse')}
                  <ExternalLink size={12} />
                </Link>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
