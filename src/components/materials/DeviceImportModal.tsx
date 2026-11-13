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
import { Badge, Button, Input, Modal, Select, cx } from '../ui';
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

export default function DeviceImportModal({ initialCourseId, onClose }: Props) {
  const courses = useStore((s) => s.courses);
  const upsertMany = useStore((s) => s.upsertMany);

  const [items, setItems] = useState<ParsedFileItem[]>([]);
  const [filterQuery, setFilterQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const processFiles = (fileList: FileList | File[]) => {
    const rawFiles = Array.from(fileList);
    // Ignora ficheiros de sistema (.DS_Store, Thumbs.db, etc.)
    const validFiles = rawFiles.filter(
      (f) => !f.name.startsWith('.') && !f.name.startsWith('Thumbs.db'),
    );

    const parsed = validFiles.map((f) => {
      const item = parseFilenameToParsedItem(f.name, courses, initialCourseId, 'upload');
      item.file = f;
      item.fileSize = f.size;
      return item;
    });

    setItems((prev) => [...prev, ...parsed]);
  };

  const handleFilesChosen = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
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
      alert('Ocorreu um erro ao guardar os ficheiros no armazenamento local.');
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
        {/* Descrição */}
        <p className="text-xs text-muted leading-relaxed">
          Seleciona ficheiros ou uma pasta do teu computador (provas antigas, slides ou enunciados descarregados). O sistema lê os nomes de forma autónoma, categoriza e guarda os ficheiros no armazenamento local para abrires diretamente no site.
        </p>

        {/* Zona de seleção / Drag & Drop */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
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
            Arrasta ficheiros ou pastas do teu computador para aqui
          </h4>
          <p className="mt-1 text-xs text-muted max-w-sm">
            PDFs, apresentações PowerPoint, resoluções de testes ou pastas inteiras.
          </p>

          <div className="mt-4 flex flex-wrap gap-2 justify-center">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={saving}
            >
              <Upload size={14} />
              Selecionar Ficheiros
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => folderInputRef.current?.click()}
              disabled={saving}
            >
              <FolderOpen size={14} />
              Selecionar Pasta Inteira
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
                  className="flex items-center justify-between gap-3 p-2.5 hover:bg-surface-2/40"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <input
                      type="checkbox"
                      checked={it.selected}
                      onChange={() => toggleItem(it.id)}
                      className="size-4 rounded border-line text-accent focus:ring-accent"
                    />

                    <FileText size={16} className="shrink-0 text-muted" />

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-fg">{it.name}</p>
                      <div className="flex items-center gap-2 text-[11px] text-muted">
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

                  <div className="flex items-center gap-2 shrink-0">
                    <Select
                      aria-label="Cadeira associada"
                      value={it.courseId}
                      onChange={(e) => updateItemCourse(it.id, e.target.value)}
                      className="text-xs h-7 w-36"
                    >
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
                      className="text-xs h-7 w-32"
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
                      className="text-muted hover:text-danger p-1"
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
        <div className="flex items-center justify-between pt-2 border-t border-line">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>

          <Button
            type="button"
            variant="primary"
            onClick={handleSaveAll}
            disabled={saving || selectedCount === 0}
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                A guardar...
              </>
            ) : (
              <>
                <HardDrive size={14} />
                Guardar {selectedCount} {selectedCount === 1 ? 'ficheiro' : 'ficheiros'} no Sistema
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
