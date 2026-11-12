// Modal reutilizável para importar ficheiros de uma nuvem (Google Drive ou OneDrive).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Folder, LoaderCircle, Settings as SettingsIcon } from 'lucide-react';
import { Badge, Button, EmptyState, Field, Input, Modal, Select, cx } from '../ui';
import { useStore } from '../../store/useStore';
import { listDriveFolder, listRecentDriveFiles, searchDriveFiles } from '../../integrations/drive';
import type { CloudFile } from '../../integrations/drive';
import { listOneDriveFolder, listRecentOneDriveFiles, searchOneDriveFiles } from '../../integrations/onedrive';
import type { Material } from '../../types';
import { materialIcon, relativeDate } from './meta';

type Tab = 'recent' | 'search' | 'folders';

/** Funções de uma nuvem que o seletor usa. Parametriza o componente por fornecedor. */
export interface CloudSource {
  provider: 'gdrive' | 'onedrive';
  integration: 'google' | 'microsoft';
  label: string;
  /** Campo das Definições com o Client ID. */
  clientIdKey: 'googleClientId' | 'msClientId';
  clientIdName: string;
  listFolder: (folderId?: string) => Promise<CloudFile[]>;
  search: (text: string) => Promise<CloudFile[]>;
  recent: () => Promise<CloudFile[]>;
}

export const DRIVE_SOURCE: CloudSource = {
  provider: 'gdrive',
  integration: 'google',
  label: 'Google Drive',
  clientIdKey: 'googleClientId',
  clientIdName: 'Google',
  listFolder: (folderId) => listDriveFolder(folderId),
  search: searchDriveFiles,
  recent: listRecentDriveFiles,
};

export const ONEDRIVE_SOURCE: CloudSource = {
  provider: 'onedrive',
  integration: 'microsoft',
  label: 'OneDrive',
  clientIdKey: 'msClientId',
  clientIdName: 'Microsoft',
  listFolder: (folderId) => listOneDriveFolder(folderId),
  search: searchOneDriveFiles,
  recent: listRecentOneDriveFiles,
};

const tabs: { id: Tab; label: string }[] = [
  { id: 'recent', label: 'Recentes' },
  { id: 'search', label: 'Procurar' },
  { id: 'folders', label: 'Pastas' },
];

export default function CloudPicker({ source, onClose }: { source: CloudSource; onClose: () => void }) {
  const clientId = useStore((s) => s.settings[source.clientIdKey]);
  const courses = useStore((s) => s.courses);
  const upsertMany = useStore((s) => s.upsertMany);
  const setIntegration = useStore((s) => s.setIntegration);

  const configured = clientId.trim() !== '';
  const [tab, setTab] = useState<Tab>('recent');
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [stack, setStack] = useState<{ id?: string; name: string }[]>([{ name: 'Raiz' }]);
  const [files, setFiles] = useState<CloudFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [selected, setSelected] = useState<Map<string, CloudFile>>(() => new Map());
  const [courseId, setCourseId] = useState('');

  const folderId = stack.at(-1)?.id;

  useEffect(() => {
    if (!configured) return;
    let run: Promise<CloudFile[]> | null = null;
    if (tab === 'recent') run = source.recent();
    else if (tab === 'search') run = submitted ? source.search(submitted) : null;
    else run = source.listFolder(folderId);

    if (!run) {
      setFiles([]);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    run.then(
      (list) => {
        if (cancelled) return;
        setFiles(list);
        setLoading(false);
        setIntegration(source.integration, { connected: true, lastSync: new Date().toISOString(), error: undefined });
      },
      (e: unknown) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : 'Erro desconhecido ao contactar o serviço.';
        setFiles([]);
        setLoading(false);
        setError(msg);
        setIntegration(source.integration, { error: msg });
      },
    );
    return () => { cancelled = true; };
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
          <Badge>Pasta</Badge>
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
        <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted">
          <LoaderCircle size={16} className="animate-spin" /> A carregar…
        </div>
      );
    }
    if (error) {
      return (
        <div className="space-y-3 px-4 py-6">
          <p className="text-sm text-danger">{error}</p>
          <Button size="sm" onClick={() => setReloadTick((t) => t + 1)}>Tentar novamente</Button>
        </div>
      );
    }
    if (tab === 'search' && !submitted) {
      return <p className="px-4 py-10 text-center text-sm text-muted">Escreve parte do nome e carrega em Enter.</p>;
    }
    if (files.length === 0) {
      const empty = tab === 'search'
        ? { title: 'Sem resultados', hint: 'Experimenta outras palavras.' }
        : tab === 'recent'
          ? { title: 'Sem ficheiros recentes', hint: 'Abre um ficheiro no serviço e volta a tentar.' }
          : { title: 'Pasta vazia', hint: 'Não há ficheiros nesta pasta.' };
      return <div className="p-4"><EmptyState title={empty.title} hint={empty.hint} /></div>;
    }
    return <ul className="divide-y divide-line">{files.map(renderRow)}</ul>;
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Importar do ${source.label}`}
      footer={configured ? (
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" disabled={n === 0} onClick={doImport}>
            {n === 0 ? 'Importar ficheiros' : `Importar ${n} ${n === 1 ? 'ficheiro' : 'ficheiros'}`}
          </Button>
        </>
      ) : undefined}
    >
      {!configured ? (
        <EmptyState
          icon={<SettingsIcon size={22} />}
          title={`Falta o Client ID da ${source.clientIdName}`}
          hint="Para importar ficheiros tens de configurar o Client ID nas Definições."
          action={(
            <Link
              to="/definicoes"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-accent px-4 text-sm font-medium text-accent-fg hover:opacity-90"
            >
              Abrir Definições
            </Link>
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
                  'flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition',
                  tab === t.id ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'search' && (
            <form onSubmit={(e) => { e.preventDefault(); setSubmitted(text.trim()); }}>
              <Input
                type="search"
                placeholder="Nome do ficheiro… (Enter para procurar)"
                value={text}
                onChange={(e) => setText(e.target.value)}
                aria-label="Procurar ficheiros"
              />
            </form>
          )}

          {tab === 'folders' && (
            <nav aria-label="Caminho" className="flex flex-wrap items-center gap-1 text-xs text-muted">
              {stack.map((s, i) => (
                <span key={`${i}-${s.name}`} className="inline-flex items-center gap-1">
                  {i > 0 && <ChevronRight size={12} />}
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    disabled={i === stack.length - 1}
                    className="rounded-md px-1.5 py-0.5 hover:bg-surface-2 hover:text-fg disabled:font-medium disabled:text-fg disabled:hover:bg-transparent"
                  >
                    {s.name}
                  </button>
                </span>
              ))}
            </nav>
          )}

          <div className="min-h-32 max-h-[40vh] overflow-y-auto rounded-xl border border-line">
            {renderList()}
          </div>

          <Field label="Cadeira dos ficheiros">
            <Select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">Sem cadeira</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        </>
      )}
    </Modal>
  );
}
