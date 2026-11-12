import { useCallback, useMemo, useState } from 'react';
import { Cloud, FolderOpen, HardDrive, Pin, Plus, Search } from 'lucide-react';
import { Button, CourseChip, EmptyState, Input, PageHeader, Select, cx } from '../components/ui';
import { useStore } from '../store/useStore';
import { providerLabel } from '../lib/colors';
import type { Material, MaterialProvider } from '../types';
import AddLinkModal from '../components/materials/AddLinkModal';
import CloudPicker, { DRIVE_SOURCE, ONEDRIVE_SOURCE } from '../components/materials/CloudPicker';
import type { CloudSource } from '../components/materials/CloudPicker';
import MaterialRow from '../components/materials/MaterialRow';
import NotebookLMCard from '../components/materials/NotebookLMCard';

type ProviderFilter = MaterialProvider | 'all';
const providerFilters: ProviderFilter[] = ['all', 'gdrive', 'onedrive', 'notebooklm', 'clip', 'link'];
const chipLabel: Record<ProviderFilter, string> = { ...providerLabel, all: 'Todos' };

const byTitle = (a: Material, b: Material) => a.title.localeCompare(b.title, 'pt');

export default function Materials() {
  const materials = useStore((s) => s.materials);
  const courses = useStore((s) => s.courses);

  const [query, setQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState('all');
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [picker, setPicker] = useState<CloudSource | null>(null);

  const closeAdd = useCallback(() => setAddOpen(false), []);
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
    const c: Record<ProviderFilter, number> = { all: scoped.length, gdrive: 0, onedrive: 0, notebooklm: 0, clip: 0, link: 0 };
    for (const m of scoped) c[m.provider] += 1;
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

  const renderRows = (list: Material[]) => (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
      {list.map((m) => (
        <MaterialRow key={m.id} material={m} courses={courses} course={courseById.get(m.courseId ?? '')} />
      ))}
    </ul>
  );

  return (
    <>
      <PageHeader
        title="Materiais"
        subtitle={`${materials.length} ${materials.length === 1 ? 'material' : 'materiais'} na biblioteca`}
        actions={(
          <>
            <Button variant="primary" onClick={() => setAddOpen(true)}>
              <Plus size={16} /> Adicionar link
            </Button>
            <Button onClick={() => setPicker(DRIVE_SOURCE)}>
              <HardDrive size={16} /> Importar do Drive
            </Button>
            <Button onClick={() => setPicker(ONEDRIVE_SOURCE)}>
              <Cloud size={16} /> Importar do OneDrive
            </Button>
          </>
        )}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <Input
                type="search"
                placeholder="Procurar por título…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Procurar materiais"
                className="pl-9"
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

          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por fornecedor">
            {providerFilters.map((p) => {
              const active = providerFilter === p;
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setProviderFilter(p)}
                  className={cx(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition',
                    active
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-line bg-surface text-muted hover:text-fg',
                  )}
                >
                  {chipLabel[p]}
                  <span className="tabular opacity-70">{counts[p]}</span>
                </button>
              );
            })}
          </div>

          {materials.length === 0 ? (
            <EmptyState
              icon={<FolderOpen size={24} />}
              title="A biblioteca está vazia"
              hint="Adiciona um link ou importa ficheiros do Google Drive ou do OneDrive para os teres sempre à mão."
              action={(
                <Button variant="primary" onClick={() => setAddOpen(true)}>
                  <Plus size={16} /> Adicionar link
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
            <div className="space-y-6">
              {pinned.length > 0 && (
                <section>
                  <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <Pin size={14} className="text-accent" /> Fixados
                  </h2>
                  {renderRows(pinned)}
                </section>
              )}

              {groups.map((g) => (
                <section key={g.key}>
                  <header className="mb-2 flex items-center justify-between gap-3">
                    {g.course ? <CourseChip course={g.course} /> : <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted">Sem cadeira</span>}
                    <span className="text-xs tabular text-muted">{g.items.length} {g.items.length === 1 ? 'material' : 'materiais'}</span>
                  </header>
                  {renderRows(g.items)}
                </section>
              ))}
            </div>
          )}
        </div>

        <aside className="min-w-0 space-y-4">
          <NotebookLMCard />
        </aside>
      </div>

      {addOpen && <AddLinkModal onClose={closeAdd} />}
      {picker && <CloudPicker source={picker} onClose={closePicker} />}
    </>
  );
}
