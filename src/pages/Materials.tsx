import { useCallback, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, FileUp, FolderOpen, HardDrive, Link2, Loader2, Pin, Plus, Search, Sparkles, X } from 'lucide-react';
import { AnimatedPage } from '../components/motion/Primitives';
import { TabGuideBanner, TabGuideHelpButton } from '../components/onboarding/TabGuideBanner';
import { ActionSheet, Button, CourseChip, EmptyState, Input, PageHeader, Select, cx } from '../components/ui';
import { useStore } from '../store/useStore';
import { providerLabel } from '../lib/colors';
import type { Material, MaterialProvider } from '../types';
import AddLinkModal from '../components/materials/AddLinkModal';
import FileUploadModal from '../components/materials/FileUploadModal';
import DeviceImportModal from '../components/materials/DeviceImportModal';
import CloudPicker, { DRIVE_SOURCE } from '../components/materials/CloudPicker';
import type { CloudSource } from '../components/materials/CloudPicker';
import MaterialRow from '../components/materials/MaterialRow';
import NotebookLMCard from '../components/materials/NotebookLMCard';
import MaterialViewerModal from '../components/materials/MaterialViewerModal';
import { useDriveAutoScan } from '../hooks/useGoogleData';

type ProviderFilter = MaterialProvider | 'all';
const providerFilters: ProviderFilter[] = ['all', 'upload', 'gdrive', 'notebooklm', 'clip', 'link'];
const chipLabel: Record<ProviderFilter, string> = { ...providerLabel, all: 'Todos' };

const byTitle = (a: Material, b: Material) => a.title.localeCompare(b.title, 'pt');

export default function Materials() {
  const materials = useStore((s) => s.materials);
  const courses = useStore((s) => s.courses);
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

  const filtersActive = query.trim() !== '' || courseFilter !== 'all' || providerFilter !== 'all';

  const resetFilters = () => {
    setQuery('');
    setCourseFilter('all');
    setProviderFilter('all');
  };

  const exampleFolders = useMemo(() => {
    if (courses.length === 0) return 'Calculo/, Fisica/, Economia/';
    return courses
      .slice(0, 3)
      .map((c) => `${c.shortName || c.name}/`)
      .join(', ');
  }, [courses]);

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

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          {/* Bloco Caderno Vivo: Varredura automática (HD pessoal & Google Drive) */}
          <section
            className={cx(
              'space-y-3.5 p-5 shadow-card transition',
              isMinimal
                ? 'rounded-[22px] border border-line bg-surface text-fg'
                : 'rounded-[26px] bg-pastel-mint/70 text-[#141312] dark:bg-surface-2 dark:text-[#FAF6EC]',
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] opacity-75">
                  <Sparkles size={13} className="text-accent-ink dark:text-accent" />
                  Varredura automática · Pastas locais & Drive
                </p>
                <p className="font-display text-base font-bold sm:text-lg">
                  Organiza tudo num clique por cadeira
                </p>
                <p className="text-xs leading-relaxed opacity-85">
                  Guarda apontamentos ou ficheiros do portal académico em{' '}
                  <strong>pastas com o nome/sigla da cadeira</strong> (ex.:{' '}
                  <span className="font-mono font-semibold">{exampleFolders}</span>) — a varredura associa tudo lá dentro, mesmo sem a sigla no nome do PDF.
                </p>
              </div>
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
                {scanningDrive && (
                  <Button variant="ghost" size="sm" onClick={cancelScan}>
                    <X size={14} /> Cancelar
                  </Button>
                )}
              </div>
            </div>

            {scanningDrive && scanProgress && (
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/75 px-3.5 py-2.5 text-xs text-[#141312] dark:bg-black/25 dark:text-[#FAF6EC]">
                <span className="min-w-0 truncate font-medium">
                  {scanProgress.stage ? `${scanProgress.stage} · ` : ''}
                  {scanProgress.foldersScanned} pasta(s) · {scanProgress.filesFound} ficheiro(s) analisado(s)
                </span>
              </div>
            )}

            {scanFeedback && (
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/75 px-3.5 py-2.5 text-xs text-[#141312] dark:bg-black/25 dark:text-[#FAF6EC]">
                <span className="min-w-0 truncate font-medium">{scanFeedback}</span>
                <button
                  type="button"
                  onClick={clearFeedback}
                  aria-label="Fechar aviso"
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-full font-semibold opacity-70 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
                >
                  ✕
                </button>
              </div>
            )}
          </section>
          {materials.length > 0 && (
            <>
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
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
                <Select
                  aria-label="Filtrar por cadeira"
                  value={courseFilter}
                  onChange={(e) => setCourseFilter(e.target.value)}
                  className="sm:w-56"
                >
                  <option value="all">Todas as cadeiras</option>
                  {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  <option value="none">Sem cadeira</option>
                </Select>
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
                        const allExpanded = groups.every((g, idx) =>
                          g.key in groupOpenOverrides
                            ? groupOpenOverrides[g.key]
                            : idx === 0 && g.items.length <= 20,
                        );
                        const next: Record<string, boolean> = {};
                        for (const g of groups) next[g.key] = !allExpanded;
                        setGroupOpenOverrides(next);
                      }}
                      className="min-h-[36px] font-semibold text-accent-ink hover:underline dark:text-accent"
                    >
                      {groups.every((g, idx) =>
                        g.key in groupOpenOverrides
                          ? groupOpenOverrides[g.key]
                          : idx === 0 && g.items.length <= 20,
                      )
                        ? 'Recolher tudo'
                        : 'Expandir tudo'}
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
                const defaultOpen = filtersActive || groups.length === 1 || (index === 0 && g.items.length <= 20);
                const isGroupOpen =
                  filtersActive ||
                  (g.key in groupOpenOverrides ? groupOpenOverrides[g.key] : defaultOpen);
                const showAllRows = filtersActive || Boolean(expandedAllRows[g.key]);
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
                        {(hiddenCount > 0 || (showAllRows && !filtersActive && g.items.length > PREVIEW_LIMIT)) && (
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

        <aside className="min-w-0 space-y-4">
          <NotebookLMCard />
        </aside>
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
