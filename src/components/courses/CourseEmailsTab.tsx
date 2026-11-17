import {
  AlertTriangle,
  CheckCircle2,
  GraduationCap,
  KeyRound,
  Mail,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Course } from '../../types';
import { Badge, Button, EmptyState, Input, Modal } from '../ui';
import { cx } from '../../lib/uiHelpers';
import { useAcademicEmails } from '../../hooks/useGoogleData';
import type { AcademicEmail } from '../../services/googleService';
import { matchesCourse } from '../../lib/courseAliases';
import { useStore, newId } from '../../store/useStore';
import { format, parseISO } from 'date-fns';
import { appDateLocale as pt, longDateTimePattern } from '../../lib/dateLocale';

interface Props {
  course: Course;
}

export default function CourseEmailsTab({ course }: Props) {
  const { t } = useTranslation('courses');
  const {
    emails,
    loading,
    connected,
    hasLiveToken,
    needsPermission,
    academicEmail,
    loadEmails,
    connect: handleConnect,
  } = useAcademicEmails(course.id);
  const [search, setSearch] = useState('');
  const [showAllFaculty, setShowAllFaculty] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<AcademicEmail | null>(null);
  const [taskAdded, setTaskAdded] = useState(false);
  const upsert = useStore((s) => s.upsert);

  const courseEmails = useMemo(() => {
    if (showAllFaculty) {
      if (!search.trim()) return emails;
      const q = search.toLowerCase();
      return emails.filter(
        (em) =>
          em.subject.toLowerCase().includes(q) ||
          em.snippet.toLowerCase().includes(q) ||
          em.from.toLowerCase().includes(q),
      );
    }

    return emails.filter((em) => {
      // 1. Cadeira já associada pelo backend / detector
      if (em.courseId === course.id) return true;
      if (em.courseId) {
        const idLower = em.courseId.toLowerCase().replace(/[^a-z0-9]/g, '');
        const codeLower = (course.code || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const shortLower = (course.shortName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (idLower === codeLower || idLower === shortLower) return true;
      }

      // 2. Correspondência inteligente com sinónimos (ex.: AM3 para Cálculo III D, fluidos para MdF)
      const combined = `${em.subject} ${em.snippet} ${em.from}`;
      if (matchesCourse(combined, course)) return true;

      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          em.subject.toLowerCase().includes(q) ||
          em.snippet.toLowerCase().includes(q) ||
          em.from.toLowerCase().includes(q)
        );
      }
      return false;
    });
  }, [emails, course, search, showAllFaculty]);

  const handleCreateTask = () => {
    if (!selectedEmail) return;
    upsert('tasks', {
      id: newId(),
      courseId: course.id,
      title: t('emails.taskTitle', { subject: selectedEmail.subject.slice(0, 60) }),
      due: format(new Date(), 'yyyy-MM-dd'),
      done: false,
      priority: 2,
    });
    setTaskAdded(true);
    setTimeout(() => setTaskAdded(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Mail size={18} className="text-muted" />
          <h2 className="text-sm font-semibold">{t('emails.title')}</h2>
          {connected && !needsPermission && (
            <div className="flex items-center gap-2">
              <Badge tone="accent">{t('emails.count', { count: courseEmails.length })}</Badge>
              {academicEmail && <span className="text-xs text-muted">({academicEmail})</span>}
            </div>
          )}
        </div>

        {connected && !needsPermission && (
          <div className="flex flex-wrap items-center gap-2">
            {emails.length > 0 && (
              <button
                type="button"
                onClick={() => setShowAllFaculty((v) => !v)}
                className={cx(
                  'min-h-11 rounded-xl border px-3.5 py-2 text-xs font-medium transition',
                  showAllFaculty
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-line bg-surface-2 text-muted hover:text-fg',
                )}
              >
                {showAllFaculty ? t('emails.showingAll') : t('emails.seeAll', { n: emails.length })}
              </button>
            )}
            <div className="relative sm:w-60">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <Input
                placeholder={t('emails.searchPh')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 text-xs"
              />
            </div>
            <Button variant="secondary" size="sm" onClick={() => loadEmails(true)} disabled={loading}>
              <RefreshCw size={13} className={cx(loading && 'animate-spin')} />
              {t('emails.refresh')}
            </Button>
          </div>
        )}
      </div>

      {/* Banner de permissão de Gmail em falta */}
      {needsPermission && (
        <div className="rounded-2xl border border-warn/30 bg-pastel-butter/45 p-5 dark:bg-surface-2">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="size-5 shrink-0 text-warn mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-fg">{t('emails.permTitle')}</h3>
                <p className="mt-1 text-xs text-muted leading-relaxed">
                  {t('emails.permBody', { name: course.name })}
                </p>
              </div>
            </div>
            <Button
              variant="primary"
              onClick={() => handleConnect(true)}
              className="shrink-0"
            >
              <KeyRound size={14} /> {t('emails.permBtn')}
            </Button>
          </div>
        </div>
      )}

      {!connected ? (
        <EmptyState
          icon={<Mail size={24} />}
          title={t('emails.notConnected')}
          hint={t('emails.notConnectedHint')}
          action={
            <Button variant="primary" onClick={() => handleConnect(false)}>
              <Mail size={14} /> {t('emails.connect')}
            </Button>
          }
        />
      ) : needsPermission ? null : courseEmails.length === 0 ? (
        <EmptyState
          icon={<Mail size={24} />}
          title={showAllFaculty ? t('emails.emptyAll') : t('emails.emptyCourse')}
          hint={
            emails.length > 0
              ? t('emails.emptyHintSome', { n: emails.length, name: course.name, code: course.code })
              : !hasLiveToken && academicEmail
                ? t('emails.emptyHintSaved', { email: academicEmail })
                : t('emails.emptyHintNone')
          }
          action={
            <div className="flex flex-wrap gap-2 justify-center">
              {emails.length > 0 && (
                <Button
                  variant="primary"
                  onClick={() => setShowAllFaculty((v) => !v)}
                >
                  <Mail size={14} />
                  {showAllFaculty ? t('emails.onlyCourse') : t('emails.allFaculty', { n: emails.length })}
                </Button>
              )}
              <Button variant="secondary" onClick={() => loadEmails(true)}>
                <RefreshCw size={14} /> {t('emails.refreshGoogle')}
              </Button>
            </div>
          }
        />
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {courseEmails.map((em) => (
            <button
              key={em.id}
              type="button"
              onClick={() => setSelectedEmail(em)}
              className="group flex w-full items-start justify-between gap-4 p-4 text-left transition hover:bg-surface-2/40"
            >
              <div className="flex min-w-0 items-start gap-3">
                <div
                  className={cx(
                    'mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg text-xs font-semibold',
                    em.isClipNotice
                      ? 'bg-pastel-butter text-[#141312] dark:bg-warn/15 dark:text-warn'
                      : 'bg-surface-2 text-muted',
                  )}
                >
                  {em.isClipNotice ? <GraduationCap size={15} /> : <Mail size={15} />}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-xs font-semibold text-fg">{em.fromName}</span>
                    {em.isClipNotice && <Badge tone="accent">{t('emails.notice')}</Badge>}
                    {em.unread && <span className="size-2 rounded-full bg-accent" />}
                  </div>

                  <p className="mt-0.5 truncate text-sm font-medium text-fg group-hover:text-accent">
                    {em.subject}
                  </p>

                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
                    {em.snippet}
                  </p>
                </div>
              </div>

              <span className="shrink-0 font-mono text-xs text-muted">
                {format(parseISO(em.date), 'd MMM, HH:mm', { locale: pt })}
              </span>
            </button>
          ))}
        </div>
      )}

      {selectedEmail && (
        <Modal
          open={true}
          onClose={() => setSelectedEmail(null)}
          title={selectedEmail.subject}
          footer={
            <div className="flex w-full items-center justify-between">
              <div>
                {taskAdded && (
                  <span className="flex items-center gap-1 text-xs text-ok">
                    <CheckCircle2 size={13} /> {t('emails.taskCreated')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={handleCreateTask}>
                  <CheckCircle2 size={14} /> {t('emails.createTask')}
                </Button>
                <Button onClick={() => setSelectedEmail(null)}>{t('emails.close')}</Button>
              </div>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            <div className="border-b border-line pb-2 text-muted">
              <p>
                <span className="font-semibold text-fg">{t('emails.from')}</span> {selectedEmail.from}
              </p>
              <p className="mt-1">
                <span className="font-semibold text-fg">{t('emails.date')}</span>{' '}
                {format(parseISO(selectedEmail.date), longDateTimePattern(), {
                  locale: pt,
                })}
              </p>
            </div>

            <div className="rounded-xl border border-line bg-surface-2/40 p-4 leading-relaxed text-fg">
              {selectedEmail.snippet}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
