import { useCallback, useMemo, useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight, ChevronUp, FileUp, FolderOpen, HardDrive, HelpCircle, Link2, Loader2, Pin, Plus, Search, Sparkles, X } from 'lucide-react';
import { AnimatedPage } from '../components/motion/Primitives';
import { TabGuideBanner, TabGuideHelpButton } from '../components/onboarding/TabGuideBanner';
import { ActionSheet, Button, CourseChip, EmptyState, Input, PageHeader, PillSelect } from '../components/ui';
import { cx, showToast } from '../lib/uiHelpers';
import { useStore } from '../store/useStore';
import { providerLabel } from '../lib/colors';
import { driveFolderIdFromUrl } from '../integrations/drive';
import type { Material, MaterialProvider } from '../types';
import AddLinkModal from '../components/materials/AddLinkModal';
import FileUploadModal from '../components/materials/FileUploadModal';
import DeviceImportModal from '../components/materials/DeviceImportModal';
import CloudPicker from '../components/materials/CloudPicker';
import { DRIVE_SOURCE, type CloudSource } from '../lib/cloudSources';
import MaterialRow from '../components/materials/MaterialRow';
import NotebookLMCard from '../components/materials/NotebookLMCard';
import MaterialViewerModal from '../components/materials/MaterialViewerModal';
import { useDriveAutoScan } from '../hooks/useGoogleData';

type ProviderFilter = MaterialProvider | 'all';
const providerFilters: ProviderFilter[] = ['all', 'upload', 'gdrive', 'notebooklm', 'clip', 'link'];
const chipLabel: Record<ProviderFilter, string> = { ...providerLabel, all: 'Todos' };

const EMPTY_URLS: string[] = [];
const byTitle = (a: Material, b: Material) => a.title.localeCompare(b.title, 'pt');

export default function Materials() {
  const materials = useStore((s) => s.materials);
  const courses = useStore((s) => s.courses);
  const sharedHubDriveUrls = useStore((s) => s.settings.sharedHubDriveUrls ?? EMPTY_URLS);
  const updateSettings = useStore((s) => s.updateSettings);
  const appTone = useStore((s) => s.settings.appTone ?? 'vibrante');
  const isMinimal = appTone === 'serio';

  const [query, setQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState('all');
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deviceImportOpen, setDeviceImportOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [picker, setPicker] = useState<CloudSource | null>(null);
  const [viewingMaterial, setViewingMaterial] = useState<Material | null>(null);
  const [groupOpenOverrides, setGroupOpenOverrides] = useState<Record<string, boolean>>({});
  const [expandedAllRows, setExpandedAllRows] = useState<Record<string, boolean>>({});
  const [rootFolderOpen, setRootFolderOpen] = useState(false);
  const [rootFolderInput, setRootFolderInput] = useState('');
  const [scanCardExpanded, setScanCardExpanded] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('uni-materials-scan-expanded-v1');
      if (saved === '1') return true;
      if (saved === '0') return false;
    } catch {
      // ignore storage errors
    }
    return useStore.getState().materials.length === 0;
  });

  const toggleScanCardExpanded = () => {
    setScanCardExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('uni-materials-scan-expanded-v1', next ? '1' : '0');
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const {
    scanning: scanningDrive,
    progress: scanProgress,
    feedback: scanFeedback,
    isDriveConnected: isGoogleConnected,
    runScan: handleAutoScanDrive,
    cancelScan,
    clearFeedback,
  } = useDriveAutoScan();

  const closeAdd = useCallback(() => setAddOpen(false), []);
  const closeUpload = useCallback(() => setUploadOpen(false), []);
  const closeDeviceImport = useCallback(() => setDeviceImportOpen(false), []);
  const closePicker = useCallback(() => setPicker(null), []);

  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);

  // Pesquisa + cadeira (base dos contadores dos separadores).
  const scoped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return materials.filter((m) => {
      if (q && !m.title.toLowerCase().includes(q)) return false;
      // Cadeira válida do material; 'none' inclui também cadeiras que já não existem.
      const key = m.courseId && courseById.has(m.courseId) ? m.courseId : 'none';
      return courseFilter === 'all' || key === courseFilter;
    });
  }, [materials, query, courseFilter, courseById]);

  const counts = useMemo(() => {
    const c: Record<ProviderFilter, number> = { all: scoped.length, upload: 0, gdrive: 0, onedrive: 0, notebooklm: 0, clip: 0, link: 0 };
    for (const m of scoped) {
      if (m.provider in c) c[m.provider] += 1;
    }
    return c;
  }, [scoped]);

  const visible = useMemo(
    () => (providerFilter === 'all' ? scoped : scoped.filter((m) => m.provider === providerFilter)),
    [scoped, providerFilter],
  );

  const pinned = useMemo(() => visible.filter((m) => m.pinned).sort(byTitle), [visible]);

  const groups = useMemo(() => {
    const map = new Map<string, Material[]>();
    for (const m of visible) {
      if (m.pinned) continue;
      const key = m.courseId && courseById.has(m.courseId) ? m.courseId : 'none';
      map.set(key, [...(map.get(key) ?? []), m]);
    }
    const order = [...courses.map((c) => c.id), 'none'];
    return order
      .filter((k) => map.has(k))
      .map((k) => ({
        key: k,
        course: courseById.get(k),
        items: (map.get(k) ?? []).sort(byTitle),
      }));
  }, [visible, courses, courseById]);

  const hasSearchQuery = query.trim() !== '' || courseFilter !== 'all';
  const filtersActive = hasSearchQuery || providerFilter !== 'all';

  const isGroupOpenFor = useCallback(
    (g: { key: string; items: Material[] }, idx: number) => {
      if (g.key in groupOpenOverrides) return groupOpenOverrides[g.key];
      if (hasSearchQuery || groups.length === 1) return true;
      return idx === 0 && g.items.length <= 20;
    },
    [groupOpenOverrides, hasSearchQuery, groups.length],
  );

  const allGroupsExpanded = useMemo(
    () => groups.length > 0 && groups.every((g, idx) => isGroupOpenFor(g, idx)),
    [groups, isGroupOpenFor],
  );

  const resetFilters = () => {
    setQuery('');
    setCourseFilter('all');
    setProviderFilter('all');
    setGroupOpenOverrides({});
  };

  const handleSaveRootFolder = () => {
    const trimmed = rootFolderInput.trim();
    if (!driveFolderIdFromUrl(trimmed)) {
      showToast('Cola um link ou ID válido de uma pasta do Google Drive.', 'danger');
      return;
    }
    if (!sharedHubDriveUrls.includes(trimmed)) {
      updateSettings({ sharedHubDriveUrls: [...sharedHubDriveUrls, trimmed] });
    }
    setRootFolderInput('');
    setRootFolderOpen(false);
    showToast('Pasta raiz associada à varredura!', 'ok');
  };

  const exampleFolders = useMemo(() => {
    if (courses.length === 0) return 'Calculo/, Fisica/, Economia/';
    return courses
      .slice(0, 3)
      .map((c) => `${c.shortName || c.name}/`)
      .join(', ');
  }, [courses]);

  const hasNotebooks = useMemo(
    () => materials.some((m) => m.provider === 'notebooklm') || courses.some((c) => Boolean(c.notebookUrl)),
    [materials, courses],
  );

  const courseFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'Todas as cadeiras' },
      ...courses.map((c) => ({ value: c.id, label: c.name })),
      { value: 'none', label: 'Sem cadeira' },
    ],
    [courses],
  );

  const renderRows = (list: Material[]) => (
    <ul className="divide-y divide-line/80">
      {list.map((m) => (
        <MaterialRow
          key={m.id}
          material={m}
          courses={courses}
          course={courseById.get(m.courseId ?? '')}
          onView={setViewingMaterial}
        />
      ))}
    </ul>
  );

  return (
    <AnimatedPage className="space-y-5">
      <PageHeader
        eyebrow="Biblioteca"
        title="Os teus"
        accentTitle="materiais"
        subtitle={`${materials.length} ${materials.length === 1 ? 'material' : 'materiais'} na biblioteca`}
        actions={
          <div className="flex items-center gap-2">
            <TabGuideHelpButton tabKey="materiais" />
            <Button variant="primary" onClick={() => setAddMenuOpen(true)}>
              <Plus size={16} /> Adicionar
            </Button>
          </div>
        }
      />

      <TabGuideBanner tabKey="materiais" />

      <div className={hasNotebooks ? 'grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]' : 'space-y-6'}>
        <div className="min-w-0 space-y-4">
          {/* Bloco Caderno Vivo: Varredura automática (minimizável no Desktop & Mobile) */}
          <section
            className={cx(
              'shadow-card transition',
              scanCardExpanded || rootFolderOpen || scanningDrive ? 'space-y-3 p-4 sm:p-5' : 'px-4 py-2',
              isMinimal
                ? 'rounded-[22px] border border-line bg-surface text-fg'
                : 'rounded-[24px] bg-pastel-mint/70 text-[#141312] dark:bg-surface-2 dark:text-[#FAF6EC]',
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={toggleScanCardExpanded}
                aria-expanded={scanCardExpanded}
                className="flex min-h-11 min-w-0 items-center gap-2 text-left"
              >
                <Sparkles size={15} className="shrink-0 text-accent-ink dark:text-accent" />
                <span className="truncate text-xs font-bold uppercase tracking-[0.08em]">
                  Varredura automática
                </span>
                {sharedHubDriveUrls.length > 0 && (
                  <span className="hidden rounded-full bg-white/75 px-2 py-0.5 text-xs font-semibold sm:inline dark:bg-black/25">
                    {sharedHubDriveUrls.length} pasta raiz
                  </span>
                )}
              </button>

              <div className="flex shrink-0 items-center gap-1.5">
                {scanningDrive && (
                  <Button variant="ghost" size="sm" onClick={cancelScan}>
                    <X size={14} /> Cancelar
                  </Button>
                )}
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('uni-open-tab-guide', { detail: 'materiais' }))}
                  aria-label="Como organizar pastas na varredura"
                  title="Ver guia de pastas e materiais (?)"
                  className="inline-flex size-11 items-center justify-center rounded-full opacity-75 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
                >
                  <HelpCircle size={16} />
                </button>
                <button
                  type="button"
                  onClick={toggleScanCardExpanded}
                  aria-expanded={scanCardExpanded}
                  className="inline-flex min-h-11 items-center gap-1 rounded-full bg-white/80 px-3.5 py-2 text-xs font-semibold transition hover:bg-white dark:bg-black/25 dark:hover:bg-black/40"
                >
                  <span>{scanCardExpanded ? 'Minimizar' : 'Expandir'}</span>
                  {scanCardExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>
            </div>

            {(scanCardExpanded || rootFolderOpen || scanningDrive) && (
              <div className="space-y-2.5 border-t border-black/10 pt-3 dark:border-white/10">
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setDeviceImportOpen(true)}>
                    <HardDrive size={14} /> Varrer HD / Pasta local
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleAutoScanDrive} disabled={scanningDrive}>
                    {scanningDrive ? <Loader2 size={14} className="animate-spin" /> : <FolderOpen size={14} />}
                    {scanningDrive
                      ? 'A varrer…'
                      : isGoogleConnected
                        ? 'Revarrer Google Drive'
                        : 'Ligar e varrer Drive'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRootFolderOpen((v) => !v)}
                    aria-expanded={rootFolderOpen}
                  >
                    <Link2 size={14} />
                    {sharedHubDriveUrls.length > 0
                      ? `Pasta raiz (${sharedHubDriveUrls.length})`
                      : 'Associar pasta raiz'}
                  </Button>
                </div>
                <p className="text-xs leading-relaxed opacity-90">
                  <strong className="font-semibold">Organiza por cadeira:</strong> guarda apontamentos em pastas com o nome/sigla (ex.:{' '}
                  <span className="font-mono font-semibold">{exampleFolders}</span>) — a varredura associa tudo lá dentro, mesmo sem a sigla no nome do PDF. Podes abrir o guia detalhado no botão <strong>?</strong> acima.
                </p>
              </div>
            )}

            {rootFolderOpen && (
              <div className="space-y-2.5 rounded-2xl bg-white/75 p-3 text-xs text-[#141312] dark:bg-black/25 dark:text-[#FAF6EC]">
                <p className="font-medium leading-relaxed">
                  Cola o link da pasta mãe no Google Drive (ex.: <span className="font-mono font-semibold">FCT2627</span>) para ir diretamente a todas as subpastas das tuas cadeiras:
                </p>
                <div className="flex flex-wrap gap-2">
                  <Input
                    value={rootFolderInput}
                    onChange={(e) => setRootFolderInput(e.target.value)}
                    placeholder="https://drive.google.com/drive/folders/…"
                    aria-label="Link da pasta raiz no Google Drive"
                    className="min-w-[220px] flex-1 bg-surface text-fg"
                  />
                  <Button size="sm" variant="primary" onClick={handleSaveRootFolder}>
                    Guardar pasta
                  </Button>
                </div>
                {sharedHubDriveUrls.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {sharedHubDriveUrls.map((url, idx) => (
                      <span
                        key={url}
                        className="inline-flex min-h-11 items-center gap-1 rounded-full bg-surface pl-3.5 pr-1 text-xs font-medium text-fg"
                      >
                        <span className="max-w-[180px] truncate">{url}</span>
                        <button
                          type="button"
                          onClick={() =>
                            updateSettings({
                              sharedHubDriveUrls: sharedHubDriveUrls.filter((_, i) => i !== idx),
                            })
                          }
                          aria-label="Remover pasta raiz"
                          className="grid size-10 place-items-center rounded-full text-muted hover:text-danger"
                        >
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {scanningDrive && scanProgress && (
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/75 px-3.5 py-2.5 text-xs text-[#141312] dark:bg-black/25 dark:text-[#FAF6EC]">
                <span className="min-w-0 truncate font-medium">
                  {scanProgress.stage ? `${scanProgress.stage} · ` : ''}
                  {scanProgress.foldersScanned} pasta(s) · {scanProgress.filesFound} ficheiro(s) analisado(s)
                </span>
              </div>
            )}

            {scanFeedback && (
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/75 px-3.5 py-2 text-xs text-[#141312] dark:bg-black/25 dark:text-[#FAF6EC]">
                <span className="min-w-0 truncate font-medium">{scanFeedback}</span>
                <button
                  type="button"
                  onClick={clearFeedback}
                  aria-label="Fechar aviso"
                  className="-mr-1.5 inline-flex size-11 shrink-0 items-center justify-center rounded-full font-semibold opacity-70 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
                >
                  ✕
                </button>
              </div>
            )}
          </section>
          {materials.length > 0 && (
            <>
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative min-w-0 flex-1">
                  <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
                  <Input
                    type="search"
                    placeholder="Procurar por título…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="Procurar materiais"
                    className="pl-10"
                  />
                </div>
                <PillSelect
                  ariaLabel="Filtrar por cadeira"
                  value={courseFilter}
                  options={courseFilterOptions}
                  onChange={setCourseFilter}
                  className="sm:w-56"
                />
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtrar por fornecedor">
                {providerFilters.map((p) => {
                  const active = providerFilter === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setProviderFilter(p)}
                      className={cx(
                        'inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium transition',
                        active
                          ? 'bg-ink-cta text-ink-cta-fg'
                          : 'bg-surface-2 text-muted hover:text-fg',
                      )}
                    >
                      {chipLabel[p]}
                      <span className="tabular opacity-75">{counts[p]}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {materials.length === 0 ? (
            <EmptyState
              icon={<FolderOpen size={24} />}
              title="A biblioteca está vazia"
              hint="Adiciona um link ou importa PDFs e apontamentos do teu dispositivo ou Google Drive."
              action={(
                <Button variant="primary" onClick={() => setAddMenuOpen(true)}>
                  <Plus size={16} /> Adicionar material
                </Button>
              )}
            />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<Search size={22} />}
              title="Nenhum material encontrado"
              hint="Experimenta outro termo ou ajusta os filtros."
              action={filtersActive ? <Button onClick={resetFilters}>Limpar filtros</Button> : undefined}
            />
          ) : (
            <div className="space-y-4">
              {groups.length > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted">
                  <span>
                    {groups.length} pastas · {visible.length}{' '}
                    {visible.length === 1 ? 'material visível' : 'materiais visíveis'}
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        const targetOpen = !allGroupsExpanded;
                        const next: Record<string, boolean> = {};
                        for (const g of groups) next[g.key] = targetOpen;
                        setGroupOpenOverrides(next);
                      }}
                      className="min-h-[36px] font-semibold text-accent-ink hover:underline dark:text-accent"
                    >
                      {allGroupsExpanded ? 'Recolher tudo' : 'Expandir tudo'}
                    </button>
                  </div>
                </div>
              )}

              {pinned.length > 0 && (
                <section
                  className={cx(
                    'overflow-hidden shadow-card',
                    isMinimal
                      ? 'rounded-[22px] border border-line bg-surface'
                      : 'rounded-[24px] border border-line/70 bg-surface',
                  )}
                >
                  <header className="flex items-center justify-between gap-3 border-b border-line/70 bg-pastel-butter/45 px-4 py-2.5 dark:bg-surface-2">
                    <h2 className="flex items-center gap-2 font-display text-sm font-bold text-fg">
                      <Pin size={14} className="text-accent-ink dark:text-accent" /> Fixados
                    </h2>
                    <span className="font-mono text-xs tabular text-muted">
                      {pinned.length} {pinned.length === 1 ? 'material' : 'materiais'}
                    </span>
                  </header>
                  {renderRows(pinned)}
                </section>
              )}

              {groups.map((g, index) => {
                const isGroupOpen = isGroupOpenFor(g, index);
                const showAllRows = hasSearchQuery || Boolean(expandedAllRows[g.key]);
                const PREVIEW_LIMIT = 6;
                const slicedItems = showAllRows ? g.items : g.items.slice(0, PREVIEW_LIMIT);
                const hiddenCount = g.items.length - slicedItems.length;

                return (
                  <section
                    key={g.key}
                    className={cx(
                      'overflow-hidden shadow-card',
                      isMinimal
                        ? 'rounded-[22px] border border-line bg-surface'
                        : 'rounded-[24px] border border-line/70 bg-surface',
                    )}
                  >
                    <button
                      type="button"
                      aria-expanded={isGroupOpen}
                      onClick={() =>
                        setGroupOpenOverrides((prev) => ({
                          ...prev,
                          [g.key]: !isGroupOpen,
                        }))
                      }
                      className={cx(
                        'flex min-h-[48px] w-full items-center justify-between gap-3 bg-surface-2/60 px-4 py-2.5 text-left transition hover:bg-surface-2',
                        isGroupOpen && 'border-b border-line/70',
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        {isGroupOpen ? (
                          <ChevronDown size={16} className="shrink-0 text-muted" />
                        ) : (
                          <ChevronRight size={16} className="shrink-0 text-muted" />
                        )}
                        {g.course ? (
                          <CourseChip course={g.course} />
                        ) : (
                          <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-semibold text-muted">
                            Sem cadeira
                          </span>
                        )}
                      </div>
                      <span className="shrink-0 font-mono text-xs tabular text-muted">
                        {g.items.length} {g.items.length === 1 ? 'material' : 'materiais'}
                      </span>
                    </button>

                    {isGroupOpen && (
                      <>
                        {renderRows(slicedItems)}
                        {(hiddenCount > 0 || (showAllRows && !hasSearchQuery && g.items.length > PREVIEW_LIMIT)) && (
                          <div className="flex items-center justify-center border-t border-line/70 bg-surface-2/35 px-4 py-2">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedAllRows((prev) => ({
                                  ...prev,
                                  [g.key]: !showAllRows,
                                }))
                              }
                              className="min-h-[40px] rounded-full px-4 text-xs font-semibold text-accent-ink transition hover:bg-accent-soft/50 dark:text-accent"
                            >
                              {hiddenCount > 0
                                ? `Mostrar mais ${hiddenCount} (${g.items.length} no total)`
                                : 'Mostrar apenas os primeiros 6'}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>

        {hasNotebooks ? (
          <aside className="min-w-0 space-y-4">
            <NotebookLMCard />
          </aside>
        ) : (
          <div
            className={cx(
              'flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs shadow-card',
              isMinimal
                ? 'rounded-2xl border border-line bg-surface text-fg'
                : 'rounded-[22px] bg-pastel-butter/60 text-[#141312] dark:bg-surface-2 dark:text-[#FAF6EC]',
            )}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <BookOpen size={16} className="shrink-0 text-accent-ink dark:text-accent" />
              <p className="min-w-0">
                <strong className="font-semibold">Gemini Notebook</strong>
                <span className="ml-1.5 opacity-80">
                  — ainda sem cadernos ligados. Cola o link para abrir daqui num toque.
                </span>
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => setAddOpen(true)}>
              <Link2 size={14} /> Guardar link
            </Button>
          </div>
        )}
      </div>

      <ActionSheet
        open={addMenuOpen}
        onClose={() => setAddMenuOpen(false)}
        title="Adicionar à biblioteca"
        actions={[
          {
            id: 'upload',
            label: 'Carregar ficheiro (PDF / Slides)',
            hint: 'Guarda um documento diretamente neste caderno',
            icon: <FileUp size={16} />,
            onSelect: () => setUploadOpen(true),
          },
          {
            id: 'device',
            label: 'Importar pasta do dispositivo',
            hint: 'Seleciona vários apontamentos locais de uma vez',
            icon: <HardDrive size={16} />,
            onSelect: () => setDeviceImportOpen(true),
          },
          {
            id: 'link',
            label: 'Guardar link web / vídeo',
            hint: 'Gemini Notebook, YouTube, apontamentos online…',
            icon: <Link2 size={16} />,
            onSelect: () => setAddOpen(true),
          },
          {
            id: 'drive-picker',
            label: 'Explorar pastas do Google Drive',
            hint: 'Escolhe manualmente ficheiros da tua cloud',
            icon: <FolderOpen size={16} />,
            onSelect: () => setPicker(DRIVE_SOURCE),
          },
          {
            id: 'drive-scan',
            label: scanningDrive ? 'A varrer Drive…' : 'Varrer Google Drive',
            hint: 'Procura PDFs e sebentas pelas tuas pastas',
            icon: <Sparkles size={16} />,
            onSelect: () => {
              void handleAutoScanDrive();
            },
          },
        ]}
      />

      {addOpen && <AddLinkModal onClose={closeAdd} />}
      {uploadOpen && <FileUploadModal onClose={closeUpload} />}
      {deviceImportOpen && <DeviceImportModal onClose={closeDeviceImport} />}
      {picker && <CloudPicker source={picker} onClose={closePicker} />}
      {viewingMaterial && (
        <MaterialViewerModal
          material={viewingMaterial}
          onClose={() => setViewingMaterial(null)}
        />
      )}
    </AnimatedPage>
  );
}
