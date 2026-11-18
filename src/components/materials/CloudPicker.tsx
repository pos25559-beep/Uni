// Modal para navegar e importar ficheiros do Google Drive (pastas pessoais e pastas partilhadas).
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n/tr';
import { ChevronRight, Folder, HardDrive, LoaderCircle } from 'lucide-react';
import LoadingUnis from '../brand/LoadingUnis';
import { Badge, Button, EmptyState, Field, Input, Modal, Select, SkeletonList } from '../ui';
import { toFriendlyError } from '../../lib/errorMessages';
import { cx, showToast } from '../../lib/uiHelpers';
import { useStore } from '../../store/useStore';
import type { CloudSource } from '../../lib/cloudSources';
import { googleService, type CloudFile } from '../../services/googleService';
import type { Material } from '../../types';
import { materialIcon, relativeDate } from './meta';

type Tab = 'folders' | 'shared' | 'recent' | 'search';

const tabs: { id: Tab }[] = [{ id: 'folders' }, { id: 'shared' }, { id: 'recent' }, { id: 'search' }];

export default function CloudPicker({ source, onClose }: { source: CloudSource; onClose: () => void }) {
  const { t: tp } = useTranslation('courses');
  const clientId = useStore((s) => s.settings[source.clientIdKey]);
  const courses = useStore((s) => s.courses);
  const upsertMany = useStore((s) => s.upsertMany);
  const setIntegration = useStore((s) => s.setIntegration);

  const personal = googleService.getPersonalAccountStatus();
  const hasDriveToken = googleService.isDriveConnected();
  const configured = hasDriveToken || clientId.trim() !== '';
  const [tab, setTab] = useState<Tab>('folders');
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [stack, setStack] = useState<{ id?: string; name: string }[]>(() => [{ name: tp('cloud.root') }]);
  const [files, setFiles] = useState<CloudFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [selected, setSelected] = useState<Map<string, CloudFile>>(() => new Map());
  const [courseId, setCourseId] = useState('');

  const handleAuthorizeDrive = async (forceConsent = false) => {
    setAuthBusy(true);
    setAuthError(null);
    setError(null);
    try {
      await googleService.connectPersonalAccount(forceConsent, personal.email ?? undefined);
      if (!googleService.isDriveConnected() && !forceConsent) {
        await googleService.connectPersonalAccount(true, personal.email ?? undefined);
      }
      if (!googleService.isDriveConnected() && clientId.trim() === '') {
        setAuthError(tp('cloud.errNoScope'));
        return;
      }
      setReloadTick((t) => t + 1);
    } catch (err: unknown) {
      const code = typeof err === 'object' && err && 'code' in err ? String((err as { code: unknown }).code) : '';
      if (code === 'auth/popup-closed-by-user') return;
      if (code === 'auth/popup-blocked') {
        setAuthError(tp('cloud.errPopup'));
        return;
      }
      const msg = toFriendlyError(err, tp('cloud.errAuth'));
      setAuthError(msg);
      setError(msg);
    } finally {
      setAuthBusy(false);
    }
  };

  const folderId = stack.at(-1)?.id;

  useEffect(() => {
    if (!configured) return;
    let run: Promise<CloudFile[]> | null = null;
    if (tab === 'recent') run = source.recent();
    else if (tab === 'search') run = submitted ? source.search(submitted) : null;
    else if (tab === 'shared' && !folderId) run = source.shared();
    else run = source.listFolder(folderId);

    let cancelled = false;
    void (async () => {
      if (!run) {
        if (!cancelled) {
          setFiles([]);
          setLoading(false);
          setError(null);
        }
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const list = await run;
        if (cancelled) return;
        setFiles(list);
        setLoading(false);
        setIntegration(source.integration, {
          connected: true,
          lastSync: new Date().toISOString(),
          error: undefined,
        });
      } catch (e: unknown) {
        if (cancelled) return;
        const msg = toFriendlyError(e, tr('courses:cloud.errUnknown'));
        setFiles([]);
        setLoading(false);
        setError(msg);
        setIntegration(source.integration, { error: msg });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [configured, source, tab, submitted, folderId, reloadTick, setIntegration]);

  const toggle = (f: CloudFile) => setSelected((prev) => {
    const next = new Map(prev);
    if (next.has(f.id)) next.delete(f.id);
    else next.set(f.id, f);
    return next;
  });

  const enter = (f: CloudFile) => setStack((s) => [...s, { id: f.id, name: f.name }]);
  const goTo = (i: number) => setStack((s) => s.slice(0, i + 1));

  const doImport = () => {
    const chosen = [...selected.values()];
    if (chosen.length === 0) return;
    const pinned = new Set(useStore.getState().materials.filter((m) => m.pinned).map((m) => m.id));
    upsertMany('materials', chosen.map((f): Material => {
      const id = `${source.provider}:${f.id}`;
      return {
        id,
        title: f.name,
        url: f.url,
        provider: source.provider,
        mimeType: f.mimeType,
        modifiedAt: f.modifiedAt,
        courseId: courseId || undefined,
        pinned: pinned.has(id),
      };
    }));
    showToast(tp('toast.filesImported', { count: chosen.length }), {
      tone: 'ok',
      effect: 'celebrate',
    });
    onClose();
  };

  const n = selected.size;

  const renderRow = (f: CloudFile) => {
    if (f.isFolder) {
      if (tab === 'folders') {
        return (
          <li key={f.id}>
            <button
              type="button"
              onClick={() => enter(f)}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-2"
            >
              <Folder size={18} className="shrink-0 text-muted" />
              <span className="min-w-0 flex-1 truncate text-sm">{f.name}</span>
              <ChevronRight size={16} className="shrink-0 text-muted" />
            </button>
          </li>
        );
      }
      return (
        <li key={f.id} className="flex items-center gap-3 px-3 py-2.5 text-muted">
          <Folder size={18} className="shrink-0" />
          <span className="min-w-0 flex-1 truncate text-sm">{f.name}</span>
          <Badge>{tp('cloud.folder')}</Badge>
        </li>
      );
    }
    const Icon = materialIcon({ provider: source.provider, mimeType: f.mimeType });
    const checked = selected.has(f.id);
    return (
      <li key={f.id}>
        <label className={cx('flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-surface-2', checked && 'bg-accent-soft/50')}>
          <input
            type="checkbox"
            checked={checked}
            onChange={() => toggle(f)}
            className="size-4 shrink-0 accent-accent"
          />
          <Icon size={18} className="shrink-0 text-muted" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm">{f.name}</span>
            {relativeDate(f.modifiedAt) && <span className="block text-xs text-muted">{relativeDate(f.modifiedAt)}</span>}
          </span>
        </label>
      </li>
    );
  };

  const renderList = () => {
    if (loading) {
      return (
        <div>
          <div className="border-b border-line px-4 pt-2">
            <LoadingUnis variant="materials" compact label={tp('cloud.loading')} />
          </div>
          <SkeletonList rows={4} />
        </div>
      );
    }
    if (error) {
      return (
        <div className="space-y-3 px-4 py-6">
          <p className="text-sm text-danger">{error}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="primary"
              disabled={authBusy}
              onClick={() => void handleAuthorizeDrive(true)}
            >
              {authBusy ? <LoaderCircle size={13} className="animate-spin" /> : <HardDrive size={13} />}
              {tp('cloud.authorize')}
            </Button>
            <Button size="sm" onClick={() => setReloadTick((t) => t + 1)}>
              {tp('cloud.retry')}
            </Button>
          </div>
        </div>
      );
    }
    if (tab === 'search' && !submitted) {
      return <p className="px-4 py-10 text-center text-sm text-muted">{tp('cloud.searchHint')}</p>;
    }
    if (files.length === 0) {
      const empty = tab === 'search'
        ? { title: tp('cloud.noResults'), hint: tp('cloud.noResultsHint') }
        : tab === 'recent'
          ? { title: tp('cloud.noRecent'), hint: tp('cloud.noRecentHint') }
          : { title: tp('cloud.emptyFolder'), hint: tp('cloud.emptyFolderHint') };
      return <div className="p-4"><EmptyState title={empty.title} hint={empty.hint} /></div>;
    }
    return <ul className="divide-y divide-line">{files.map(renderRow)}</ul>;
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={tp('cloud.title', { source: source.label })}
      footer={configured ? (
        <>
          <Button onClick={onClose}>{tp('cloud.cancel')}</Button>
          <Button variant="primary" disabled={n === 0} onClick={doImport}>
            {n === 0 ? tp('cloud.importFiles') : tp('cloud.importN', { count: n })}
          </Button>
        </>
      ) : undefined}
    >
      {!configured ? (
        <EmptyState
          icon={<HardDrive size={24} />}
          title={personal.connected ? tp('cloud.authTitle') : tp('cloud.notConnected')}
          hint={
            authError ||
            (personal.connected
              ? tp('cloud.expired', { email: personal.email ?? 'Google' })
              : tp('cloud.signInHint'))
          }
          action={(
            <Button
              variant="primary"
              disabled={authBusy}
              onClick={() => void handleAuthorizeDrive(false)}
            >
              {authBusy ? <LoaderCircle size={14} className="animate-spin" /> : <HardDrive size={14} />}
              {personal.connected ? tp('cloud.authorize') : tp('cloud.signIn')}
            </Button>
          )}
        />
      ) : (
        <>
          <div role="tablist" className="flex gap-1 rounded-xl bg-surface-2 p-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cx(
                  'min-h-11 flex-1 rounded-lg px-3 py-2 text-xs font-medium transition',
                  tab === t.id ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg',
                )}
              >
                {tp(`cloud.tab.${t.id}`)}
              </button>
            ))}
          </div>

          {tab === 'search' && (
            <form onSubmit={(e) => { e.preventDefault(); setSubmitted(text.trim()); }}>
              <Input
                type="search"
                placeholder={tp('cloud.searchPh')}
                value={text}
                onChange={(e) => setText(e.target.value)}
                aria-label={tp('cloud.searchAria')}
              />
            </form>
          )}

          {tab === 'folders' && (
            <nav aria-label={tp('cloud.path')} className="flex flex-wrap items-center gap-1 text-xs text-muted">
              {stack.map((s, i) => (
                <span key={`${i}-${s.name}`} className="inline-flex items-center gap-1">
                  {i > 0 && <ChevronRight size={12} />}
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    disabled={i === stack.length - 1}
                    className="min-h-11 rounded-md px-2 py-1 hover:bg-surface-2 hover:text-fg disabled:font-medium disabled:text-fg disabled:hover:bg-transparent"
                  >
                    {i === 0 ? tp('cloud.root') : s.name}
                  </button>
                </span>
              ))}
            </nav>
          )}

          <div className="min-h-32 max-h-[40vh] overflow-y-auto rounded-xl border border-line">
            {renderList()}
          </div>

          <Field label={tp('cloud.course')}>
            <Select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">{tp('cloud.noCourse')}</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        </>
      )}
    </Modal>
  );
}
