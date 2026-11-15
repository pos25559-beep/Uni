import {
  CheckCircle,
  FileText,
  FolderOpen,
  HardDrive,
  Loader2,
  Search,
  Upload,
  X,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { Badge, Button, Input, Modal, Select } from '../ui';
import { cx, showToast } from '../../lib/uiHelpers';
import { formatBytes, saveFile } from '../../lib/fileStorage';
import { newId, useStore } from '../../store/useStore';
import type { Material, MaterialCategory } from '../../types';
import { parseFilenameToParsedItem, type ParsedFileItem } from '../../lib/courseAliases';

interface Props {
  initialCourseId?: string;
  onClose: () => void;
}

const categoryOptions: { value: MaterialCategory; label: string }[] = [
  { value: 'teste_antigo', label: 'Teste Antigo' },
  { value: 'exame_antigo', label: 'Exame Antigo' },
  { value: 'ficha', label: 'Ficha / Exercícios' },
  { value: 'slide_oficial', label: 'Slide / Teórica' },
  { value: 'sebenta', label: 'Sebenta / Resumo' },
  { value: 'relatorio', label: 'Relatório / Trabalho' },
  { value: 'outro', label: 'Outro' },
];

interface LocalCandidate extends ParsedFileItem {
  relPath: string;
  alreadyImported?: boolean;
}

interface DroppedFileWithRel {
  file: File;
  relPath: string;
}

interface FsEntryLike {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath?: string;
  file?: (cb: (f: File) => void, err?: (e: unknown) => void) => void;
  createReader?: () => { readEntries: (cb: (entries: FsEntryLike[]) => void, err?: (e: unknown) => void) => void };
}

async function readFsEntryRecursive(entry: FsEntryLike, prefix = ''): Promise<DroppedFileWithRel[]> {
  if (entry.isFile && entry.file) {
    return new Promise((resolve) => {
      entry.file!(
        (file) => resolve([{ file, relPath: prefix ? `${prefix}/${file.name}` : file.name }]),
        () => resolve([]),
      );
    });
  }
  if (entry.isDirectory && entry.createReader) {
    const reader = entry.createReader();
    const nextPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
    const allEntries: FsEntryLike[] = [];
    const readBatch = (): Promise<FsEntryLike[]> =>
      new Promise((resolve) => {
        reader.readEntries(
          (batch) => resolve(batch),
          () => resolve([]),
        );
      });
    // readEntries devolve blocos de ~100 entradas até devolver []
    while (true) {
      const batch = await readBatch();
      if (!batch.length) break;
      allEntries.push(...batch);
    }
    const nested = await Promise.all(allEntries.map((child) => readFsEntryRecursive(child, nextPrefix)));
    return nested.flat();
  }
  return [];
}

async function collectDroppedFilesWithPaths(dataTransfer: DataTransfer): Promise<DroppedFileWithRel[]> {
  const items = Array.from(dataTransfer.items ?? []);
  const entries = items
    .map((it) => (it as unknown as { webkitGetAsEntry?: () => FsEntryLike | null }).webkitGetAsEntry?.())
    .filter((e): e is FsEntryLike => Boolean(e));

  if (entries.length > 0 && entries.some((e) => e.isDirectory)) {
    const nested = await Promise.all(entries.map((entry) => readFsEntryRecursive(entry, '')));
    return nested.flat();
  }

  return Array.from(dataTransfer.files ?? []).map((file) => ({
    file,
    relPath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
  }));
}

interface DirHandleLike {
  kind: 'directory' | 'file';
  name: string;
  entries?: () => AsyncIterable<[string, DirHandleLike]>;
  getFile?: () => Promise<File>;
}

async function readDirectoryHandleRecursive(
  handle: DirHandleLike,
  prefix = '',
): Promise<DroppedFileWithRel[]> {
  if (handle.kind === 'file' && handle.getFile) {
    const file = await handle.getFile();
    return [{ file, relPath: prefix ? `${prefix}/${file.name}` : file.name }];
  }
  if (handle.kind === 'directory' && handle.entries) {
    const nextPrefix = prefix ? `${prefix}/${handle.name}` : handle.name;
    const out: DroppedFileWithRel[] = [];
    for await (const [, child] of handle.entries()) {
      const sub = await readDirectoryHandleRecursive(child, nextPrefix);
      out.push(...sub);
    }
    return out;
  }
  return [];
}

export default function DeviceImportModal({ initialCourseId, onClose }: Props) {
  const courses = useStore((s) => s.courses);
  const existingMaterials = useStore((s) => s.materials);
  const upsertMany = useStore((s) => s.upsertMany);

  const [items, setItems] = useState<LocalCandidate[]>([]);
  const [targetCourseId, setTargetCourseId] = useState(initialCourseId ?? '');
  const [filterQuery, setFilterQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const isMobileBrowser =
    typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const hasShowDirPicker =
    typeof window !== 'undefined' &&
    typeof (window as unknown as { showDirectoryPicker?: () => Promise<DirHandleLike> })
      .showDirectoryPicker === 'function';
  const supportsFolderScan = !isMobileBrowser || hasShowDirPicker;

  const existingLocalSigs = useMemo(
    () =>
      new Set(
        existingMaterials
          .filter((m) => m.provider === 'upload' && m.fileName)
          .map((m) => `${m.fileName!.toLowerCase()}|${m.fileSize ?? 0}`),
      ),
    [existingMaterials],
  );

  const processFileEntries = (entries: DroppedFileWithRel[]) => {
    // Ignora ficheiros de sistema e metadados (.DS_Store, Thumbs.db, ~$temp)
    const valid = entries.filter(
      ({ file }) =>
        !file.name.startsWith('.') &&
        !file.name.startsWith('~$') &&
        !file.name.startsWith('Thumbs.db'),
    );

    const parsed: LocalCandidate[] = valid.map(({ file, relPath }) => {
      const pathForScan = relPath || file.name;
      const fallbackCourse = targetCourseId || initialCourseId || undefined;
      const item = parseFilenameToParsedItem(
        pathForScan,
        courses,
        fallbackCourse,
        'upload',
        undefined,
        undefined,
        { allowImages: true },
      );
      const sig = `${file.name.toLowerCase()}|${file.size}`;
      const alreadyImported = existingLocalSigs.has(sig);
      return {
        ...item,
        file,
        fileSize: file.size,
        relPath: pathForScan,
        alreadyImported,
        selected: !alreadyImported && Boolean(item.courseId),
      };
    });

    setItems((prev) => {
      const seen = new Set(prev.map((p) => `${p.relPath}|${p.fileSize ?? 0}`));
      const fresh = parsed.filter((p) => !seen.has(`${p.relPath}|${p.fileSize ?? 0}`));
      return [...prev, ...fresh];
    });
  };

  const handleFolderScanClick = async () => {
    const picker = (window as unknown as { showDirectoryPicker?: () => Promise<DirHandleLike> })
      .showDirectoryPicker;
    if (picker) {
      try {
        const dirHandle = await picker();
        const collected = await readDirectoryHandleRecursive(dirHandle, '');
        if (collected.length > 0) {
          processFileEntries(collected);
        } else {
          showToast('A pasta escolhida está vazia.', 'neutral');
        }
        return;
      } catch (err) {
        const name = typeof err === 'object' && err && 'name' in err ? String((err as { name: unknown }).name) : '';
        if (name === 'AbortError') return;
        // Fallback para webkitdirectory se o browser bloquear showDirectoryPicker
      }
    }
    folderInputRef.current?.click();
  };

  const applyTargetCourseToAll = (courseId: string) => {
    setTargetCourseId(courseId);
    if (!courseId) return;
    setItems((prev) =>
      prev.map((it) => ({
        ...it,
        courseId: it.courseId || courseId,
        selected: !it.alreadyImported,
      })),
    );
  };

  const handleFilesChosen = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const entries = Array.from(e.target.files).map((file) => ({
        file,
        relPath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
      }));
      processFileEntries(entries);
    }
    e.target.value = '';
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const collected = await collectDroppedFilesWithPaths(e.dataTransfer);
    if (collected.length > 0) {
      processFileEntries(collected);
    }
  };

  const toggleAll = (checked: boolean) => {
    setItems((prev) => prev.map((it) => ({ ...it, selected: checked })));
  };

  const toggleItem = (id: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, selected: !it.selected } : it)),
    );
  };

  const updateItemCourse = (id: string, courseId: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, courseId } : it)),
    );
  };

  const updateItemCategory = (id: string, category: MaterialCategory) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, category } : it)),
    );
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const selectedCount = items.filter((it) => it.selected).length;

  const handleSaveAll = async () => {
    const toSave = items.filter((it) => it.selected && it.file);
    if (toSave.length === 0) return;

    setSaving(true);
    setSaveProgress(0);

    const newMaterials: Material[] = [];

    try {
      for (let i = 0; i < toSave.length; i++) {
        const item = toSave[i];
        const file = item.file!;
        const id = newId();

        // Guarda o binário no IndexedDB local do dispositivo
        await saveFile(id, file);

        newMaterials.push({
          id,
          courseId: item.courseId || undefined,
          title: item.title,
          url: `blob:${id}`,
          provider: 'upload',
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
          category: item.category,
          year: item.year,
          epoch: item.epoch,
          hasSolution: item.hasSolution,
          modifiedAt: new Date().toISOString(),
        });

        setSaveProgress(Math.round(((i + 1) / toSave.length) * 100));
      }

      upsertMany('materials', newMaterials);
      onClose();
    } catch (err) {
      console.error('Erro ao guardar ficheiros no disco:', err);
      showToast('Ocorreu um erro ao guardar os ficheiros no armazenamento local.', 'danger');
    } finally {
      setSaving(false);
    }
  };

  const visibleItems = useMemo(() => {
    if (!filterQuery.trim()) return items;
    const q = filterQuery.toLowerCase();
    return items.filter(
      (it) =>
        it.name.toLowerCase().includes(q) ||
        it.title.toLowerCase().includes(q) ||
        (it.year && it.year.toLowerCase().includes(q)),
    );
  }, [items, filterQuery]);

  return (
    <Modal
      open
      onClose={saving ? () => {} : onClose}
      title="Importador do Disco / HD (Ficheiros & Pastas)"
    >
      <div className="space-y-4 max-h-[80vh] flex flex-col">
        {/* Orientação de organização por pastas */}
        <div className="rounded-2xl bg-pastel-mint/65 px-4 py-3 text-xs leading-relaxed text-[#141312] dark:bg-surface-2 dark:text-[#FAF6EC]">
          <p className="font-semibold">Dica para portal académico e HD pessoal: organiza em pastas por cadeira</p>
          <p className="mt-0.5 opacity-85">
            Cria subpastas com a sigla ou nome da cadeira (ex.:{' '}
            <span className="font-mono font-medium">
              {courses.length > 0
                ? courses
                    .slice(0, 3)
                    .map((c) => `${c.shortName || c.name}/`)
                    .join(', ')
                : 'Calculo/, Fisica/, Economia/'}
            </span>
            ). A varredura associa tudo o que estiver lá dentro — mesmo ficheiros com nomes genéricos como <span className="italic">1- Introducao.pdf</span> ou <span className="italic">Teste 1.pdf</span>.
          </p>
        </div>

        {/* Zona de seleção / Drag & Drop */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={(e) => void handleDrop(e)}
          className={cx(
            'flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition',
            isDragging
              ? 'border-accent bg-accent-soft'
              : 'border-line bg-surface-2/40 hover:border-muted/50',
          )}
        >
          <div className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent mb-3">
            <HardDrive size={24} />
          </div>

          <h4 className="text-sm font-semibold text-fg">
            {supportsFolderScan
              ? 'Varre uma pasta do teu computador (ou arrasta para aqui)'
              : 'Seleciona vários PDFs, fotos ou slides do telemóvel'}
          </h4>
          <p className="mt-1 text-xs text-muted max-w-sm">
            {supportsFolderScan
              ? 'PDFs, slides, fotografias de exames ou a pasta inteira do semestre (os ficheiros ficam guardados offline neste dispositivo).'
              : 'No Android/iOS o navegador não expõe o caminho das pastas — escolhe a cadeira abaixo e seleciona os vários ficheiros de uma só vez.'}
          </p>

          {courses.length > 0 && (
            <div className="mt-3 w-full max-w-xs text-left">
              <label className="mb-1 block text-xs font-medium text-muted">
                Cadeira por omissão (para ficheiros soltos)
              </label>
              <Select
                value={targetCourseId}
                onChange={(e) => applyTargetCourseToAll(e.target.value)}
                className="text-xs"
              >
                <option value="">Detetar automaticamente</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.shortName ? `${c.shortName} · ${c.name}` : c.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2 justify-center">
            {supportsFolderScan && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => void handleFolderScanClick()}
                disabled={saving}
              >
                <FolderOpen size={14} />
                Varrer Pasta Inteira (HD)
              </Button>
            )}

            <Button
              type="button"
              variant={supportsFolderScan ? 'secondary' : 'primary'}
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={saving}
            >
              <Upload size={14} />
              {supportsFolderScan ? 'Selecionar Ficheiros Soltos' : 'Selecionar Vários Ficheiros'}
            </Button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFilesChosen}
          />
          {/* Suporte a seleção de pasta inteira pelo explorador do sistema */}
          <input
            ref={folderInputRef}
            type="file"
            multiple
            // @ts-expect-error webkitdirectory é padrão em todos os navegadores modernos
            webkitdirectory=""
            directory=""
            className="hidden"
            onChange={handleFilesChosen}
          />
        </div>

        {/* Tabela de Pré-visualização e Categorização Autónoma */}
        {items.length > 0 && (
          <div className="flex-1 flex flex-col min-h-0 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-fg">
                  {items.length} {items.length === 1 ? 'ficheiro analisado' : 'ficheiros analisados'}
                </span>
                <span className="text-xs text-muted">({selectedCount} selecionados)</span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => toggleAll(true)}
                  className="text-xs h-7 px-2"
                >
                  Selecionar todos
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => toggleAll(false)}
                  className="text-xs h-7 px-2"
                >
                  Desmarcar
                </Button>
                <div className="relative w-44">
                  <Search
                    size={12}
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
                  />
                  <Input
                    placeholder="Filtrar lista..."
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    className="pl-7 text-xs h-7"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-y-auto max-h-60 rounded-xl border border-line bg-surface divide-y divide-line text-xs">
              {visibleItems.map((it) => (
                <div
                  key={it.id}
                  className="flex flex-col gap-2 p-2.5 hover:bg-surface-2/40 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <input
                      type="checkbox"
                      checked={it.selected}
                      onChange={() => toggleItem(it.id)}
                      className="size-4 shrink-0 rounded border-line text-accent focus:ring-accent"
                    />

                    <FileText size={16} className="shrink-0 text-muted" />

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-fg">{it.name}</p>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                        {it.relPath !== it.name && (
                          <span className="max-w-[180px] truncate rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs">
                            {it.relPath.slice(0, it.relPath.lastIndexOf('/'))}
                          </span>
                        )}
                        {it.matchSource === 'folder' && <Badge tone="ok">Por pasta</Badge>}
                        {it.alreadyImported && <Badge tone="neutral">Já guardada</Badge>}
                        {it.fileSize && <span>{formatBytes(it.fileSize)}</span>}
                        {it.year && <span className="font-mono">{it.year}</span>}
                        {it.epoch && <Badge tone="accent">{it.epoch}</Badge>}
                        {it.hasSolution && (
                          <span className="flex items-center gap-0.5 text-ok">
                            <CheckCircle size={10} /> Resolvido
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pl-6 sm:shrink-0 sm:pl-0">
                    <Select
                      aria-label="Cadeira associada"
                      value={it.courseId ?? ''}
                      onChange={(e) => updateItemCourse(it.id, e.target.value)}
                      className="h-8 min-w-[120px] flex-1 text-xs sm:w-36 sm:flex-none"
                    >
                      <option value="">Sem cadeira</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code || c.name}
                        </option>
                      ))}
                    </Select>

                    <Select
                      aria-label="Categoria"
                      value={it.category}
                      onChange={(e) =>
                        updateItemCategory(it.id, e.target.value as MaterialCategory)
                      }
                      className="h-8 min-w-[110px] flex-1 text-xs sm:w-32 sm:flex-none"
                    >
                      {categoryOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>

                    <button
                      type="button"
                      onClick={() => removeItem(it.id)}
                      className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:text-danger"
                      title="Remover da lista"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Barra de Progresso durante a gravação */}
        {saving && (
          <div className="space-y-1.5 p-3 rounded-xl bg-surface-2 border border-line">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="flex items-center gap-1.5 text-accent">
                <Loader2 size={13} className="animate-spin" />
                A guardar ficheiros no armazenamento local...
              </span>
              <span>{saveProgress}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-surface overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-200"
                style={{ width: `${saveProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Rodapé com Ações */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-line">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>

          <Button
            type="button"
            variant="primary"
            onClick={handleSaveAll}
            disabled={saving || selectedCount === 0}
            className="shrink-0"
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                A guardar...
              </>
            ) : (
              <>
                <HardDrive size={14} />
                <span>
                  Guardar {selectedCount} {selectedCount === 1 ? 'ficheiro' : 'ficheiros'}
                  <span className="hidden sm:inline"> na biblioteca</span>
                </span>
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
