import {
  CheckCircle,
  ExternalLink,
  FileCheck2,
  FileText,
  FileUp,
  FolderOpen,
  HardDrive,
  Loader2,
  Pin,
  PinOff,
  Plus,
  Search,
  Sparkles,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { Assessment, Course, Material } from '../../types';
import { Badge, Button, EmptyState, Input, cx } from '../ui';
import { newId, useStore } from '../../store/useStore';
import { matchesCourse, isNonAcademicDocument } from '../../lib/courseAliases';
import { courseColors, providerLabel } from '../../lib/colors';
import { daysUntil } from '../../lib/selectors';
import { formatBytes } from '../../lib/fileStorage';
import { useDriveAutoScan } from '../../hooks/useGoogleData';
import { DeleteButton } from './ConfirmModal';
import { fmtShortDate, normalizeUrl } from './helpers';
import MaterialViewerModal from '../materials/MaterialViewerModal';
import DeviceImportModal from '../materials/DeviceImportModal';

interface Props {
  course: Course;
  assessments: Assessment[];
  onUploadFile: () => void;
}

type CategoryFilter =
  | 'all'
  | 'provas'
  | 'ficha'
  | 'slide_oficial'
  | 'sebenta'
  | 'relatorio'
  | 'outro';

const categoryLabels: Record<CategoryFilter, string> = {
  all: 'Todos os Materiais',
  provas: 'Testes & Exames Antigos',
  ficha: 'Fichas & Exercícios',
  slide_oficial: 'Slides & Teórica',
  sebenta: 'Sebentas & Resumos',
  relatorio: 'Relatórios & Projetos',
  outro: 'Outros Ficheiros',
};

export default function CourseRepositoryTab({
  course,
  assessments,
  onUploadFile,
}: Props) {
  const materials = useStore((s) => s.materials);
  const upsert = useStore((s) => s.upsert);
  const patch = useStore((s) => s.patch);
  const remove = useStore((s) => s.remove);

  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [search, setSearch] = useState('');
  const [quickLinkTitle, setQuickLinkTitle] = useState('');
  const [quickLinkUrl, setQuickLinkUrl] = useState('');
  const [showAddLinkForm, setShowAddLinkForm] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [viewingMaterial, setViewingMaterial] = useState<Material | null>(null);
  const [showDeviceImport, setShowDeviceImport] = useState(false);

  const {
    scanning: scanningDrive,
    feedback: scanFeedback,
    runScan: handleAutoScanDrive,
    clearFeedback,
  } = useDriveAutoScan();

  const colors = (course && course.color && courseColors[course.color])
    ? courseColors[course.color]
    : courseColors.violet;

  // Filtra por cadeira com correspondência flexível (ID, código, sigla e termos no título)
  const allMaterials = useMemo(() => {
    if (!Array.isArray(materials)) return [];
    const courseIdLower = (course.id || '').toLowerCase();
    const codeLower = (course.code || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const shortLower = (course.shortName || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    return materials.filter((m) => {
      if (!m.courseId) return false;
      // Rejeita documentos pessoais / faturas mesmo que tenham sido associados no passado
      if (isNonAcademicDocument(m.title) || (m.fileName && isNonAcademicDocument(m.fileName))) return false;

      const mCourseId = m.courseId.toLowerCase().replace(/[^a-z0-9]/g, '');
      const isDirectMatch =
        mCourseId === courseIdLower ||
        (codeLower && mCourseId === codeLower) ||
        (shortLower && mCourseId === shortLower);

      if (isDirectMatch) {
        // Para Cálculo 3D, certifica-se de que não são conteúdos de AM1/AM2 ou ficheiros aleatórios
        if (course.id === 'c3d') {
          return matchesCourse(m.title || '', course) || (m.fileName ? matchesCourse(m.fileName, course) : true);
        }
        return true;
      }

      if (matchesCourse(m.title || '', course)) return true;
      if (m.fileName && matchesCourse(m.fileName, course)) return true;
      return false;
    });
  }, [materials, course]);

  // Ordena: fixados primeiro, depois mais recentes
  const sortedMaterials = useMemo(() => {
    return [...allMaterials].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
  }, [allMaterials]);

  // Identifica a próxima avaliação desta cadeira de forma segura
  const nextAssessment = useMemo(() => {
    if (!assessments || !Array.isArray(assessments)) return undefined;
    const upcoming = assessments
      .filter((a) => a.courseId === course.id && a.date && daysUntil(a.date) >= 0)
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    return upcoming[0];
  }, [assessments, course.id]);

  // Ficheiros filtrados
  const filtered = useMemo(() => {
    return sortedMaterials.filter((m) => {
      const cat = m.category ?? 'outro';
      if (filter === 'provas') {
        if (cat !== 'teste_antigo' && cat !== 'exame_antigo') return false;
      } else if (filter !== 'all') {
        if (cat !== filter) return false;
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = (m.title || '').toLowerCase().includes(q);
        const matchYear = (m.year || '').toLowerCase().includes(q);
        const matchFile = (m.fileName || '').toLowerCase().includes(q);
        if (!matchTitle && !matchYear && !matchFile) return false;
      }
      return true;
    });
  }, [sortedMaterials, filter, search]);

  // Contadores por categoria de forma segura
  const counts = useMemo(() => {
    const c: Record<CategoryFilter, number> = {
      all: sortedMaterials.length,
      provas: 0,
      ficha: 0,
      slide_oficial: 0,
      sebenta: 0,
      relatorio: 0,
      outro: 0,
    };
    for (const m of sortedMaterials) {
      const cat = m.category;
      if (cat === 'teste_antigo' || cat === 'exame_antigo') {
        c.provas++;
      } else if (cat === 'ficha') {
        c.ficha++;
      } else if (cat === 'slide_oficial') {
        c.slide_oficial++;
      } else if (cat === 'sebenta') {
        c.sebenta++;
      } else if (cat === 'relatorio') {
        c.relatorio++;
      } else {
        c.outro++;
      }
    }
    return c;
  }, [sortedMaterials]);

  // Provas recomendadas para o próximo teste
  const recommendedItems = useMemo(() => {
    if (!nextAssessment) return [];
    const isFirstTest =
      nextAssessment.title.toLowerCase().includes('1') ||
      nextAssessment.title.toLowerCase().includes('1.º');
    const targetEpoch = isFirstTest ? '1T' : '2T';

    return sortedMaterials
      .filter((m) => {
        if (m.category === 'teste_antigo' && (m.epoch === targetEpoch || !m.epoch)) return true;
        if (m.category === 'ficha') return true;
        return false;
      })
      .slice(0, 4);
  }, [sortedMaterials, nextAssessment]);

  // Abertura embutida ou segura de ficheiros no próprio site
  const handleOpenFile = (item: Material) => {
    let url = item.url?.trim();
    // Se o URL contiver caminhos antigos inválidos (que davam Google 400)
    if (!url || url.includes('folders/shared-lemc') || url.includes('id=shared-lemc')) {
      if (course.sharedDriveUrl) {
        url = course.sharedDriveUrl;
      } else {
        url = `https://drive.google.com/drive/u/0/my-drive`;
      }
    }

    setViewingMaterial({ ...item, url });
  };

  const handleAddLink = (e: FormEvent) => {
    e.preventDefault();
    if (!quickLinkTitle.trim()) return setLinkError('Indica um título.');
    const link = normalizeUrl(quickLinkUrl);
    if (!link) return setLinkError('Indica um link válido.');
    setLinkError(null);

    const item: Material = {
      id: newId(),
      courseId: course.id,
      title: quickLinkTitle.trim(),
      url: link,
      provider: 'link',
      category: 'outro',
    };
    upsert('materials', item);
    setQuickLinkTitle('');
    setQuickLinkUrl('');
    setShowAddLinkForm(false);
  };

  return (
    <div className="space-y-6">
      {/* Guia de Estudo Inteligente para a próxima avaliação */}
      {nextAssessment && (
        <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
                <Sparkles size={14} className="text-accent" />
                Guia Inteligente para a Próxima Avaliação
              </div>
              <h2 className="mt-1 text-base font-semibold text-fg">
                Preparação para o {nextAssessment.title}
              </h2>
              <p className="mt-1 text-xs text-muted">
                Em {daysUntil(nextAssessment.date)} dias • Peso de {nextAssessment.weight}% na nota
                final. Resolve prioritariamente os testes de anos anteriores com resolução passo a
                passo.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {course.sharedDriveUrl && (
                <button
                  type="button"
                  onClick={() =>
                    setViewingMaterial({
                      id: `drive-folder-${course.id}`,
                      courseId: course.id,
                      title: `Google Drive LEMc — ${course.name}`,
                      url: course.sharedDriveUrl!,
                      provider: 'gdrive',
                      category: 'outro',
                    })
                  }
                  className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-accent/40 bg-accent-soft px-3 text-xs font-semibold text-accent hover:border-accent hover:bg-accent/15 transition"
                >
                  <HardDrive size={13} />
                  Explorar Drive no Site
                </button>
              )}
              {course.sharedDriveUrl && (
                <a
                  href={course.sharedDriveUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-3 text-xs font-medium text-fg hover:border-muted/50 transition"
                >
                  <HardDrive size={13} className="text-muted" />
                  Abrir no Google
                  <ExternalLink size={12} className="text-muted" />
                </a>
              )}
              <button
                type="button"
                onClick={() => setShowDeviceImport(true)}
                className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-3 text-xs font-medium text-fg hover:border-accent hover:text-accent transition"
              >
                <HardDrive size={13} className="text-muted" />
                Importar do Disco (HD)
              </button>
            </div>
          </div>

          {/* Lista de provas recomendadas */}
          {recommendedItems.length > 0 && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {recommendedItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleOpenFile(item)}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-2/60 p-3 text-left text-xs transition hover:border-accent hover:bg-surface-2"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <FileCheck2 size={16} className={cx('shrink-0', colors.text)} />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-fg">{item.title}</p>
                      <div className="flex items-center gap-1.5 text-muted">
                        <span>{item.year ?? 'Anos Anteriores'}</span>
                        {item.hasSolution && (
                          <span className="flex items-center gap-0.5 text-ok">
                            <CheckCircle size={10} /> Resolvido
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ExternalLink size={12} className="shrink-0 text-muted" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Barra de Ações do Repositório */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 sm:max-w-72">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <Input
            placeholder="Filtrar por nome, teste, ano ou slide..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={() => setShowDeviceImport(true)}>
            <HardDrive size={14} />
            Importar do Disco / HD
          </Button>
          <Button
            variant="secondary"
            onClick={handleAutoScanDrive}
            disabled={scanningDrive}
          >
            {scanningDrive ? (
              <>
                <Loader2 size={14} className="animate-spin text-accent" />
                A Varrer Google Drive...
              </>
            ) : (
              <>
                <Sparkles size={14} className="text-accent" />
                Varrer Google Drive
              </>
            )}
          </Button>
          <Button variant="secondary" onClick={onUploadFile}>
            <FileUp size={14} />
            Ficheiro Único
          </Button>
          <Button
            variant="ghost"
            onClick={() => setShowAddLinkForm((v) => !v)}
          >
            <Plus size={14} />
            Adicionar Link
          </Button>
        </div>
      </div>

      {scanFeedback && (
        <div className="rounded-xl border border-accent/30 bg-accent-soft p-3 text-xs text-fg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-accent" />
            <span>{scanFeedback}</span>
          </div>
          <button
            type="button"
            onClick={clearFeedback}
            className="text-muted hover:text-fg text-xs font-semibold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Formulário rápido para adicionar link */}
      {showAddLinkForm && (
        <form
          onSubmit={handleAddLink}
          className="rounded-2xl border border-line bg-surface p-4 text-xs space-y-3"
        >
          <h4 className="font-semibold text-fg">Adicionar Novo Link de Material</h4>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Título (ex: Sebenta Cap. 3, Formulário)"
              value={quickLinkTitle}
              onChange={(e) => setQuickLinkTitle(e.target.value)}
              className="sm:max-w-64 text-xs"
            />
            <Input
              placeholder="URL (https://...)"
              value={quickLinkUrl}
              onChange={(e) => setQuickLinkUrl(e.target.value)}
              className="flex-1 text-xs"
            />
            <Button type="submit" variant="primary" size="sm">
              Guardar Link
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowAddLinkForm(false)}
            >
              Cancelar
            </Button>
          </div>
          {linkError && <p className="text-danger text-xs">{linkError}</p>}
        </form>
      )}

      {/* Separadores de Categoria (Filter Pills) */}
      <div className="flex flex-wrap gap-2">
        {(
          ['all', 'provas', 'ficha', 'slide_oficial', 'sebenta', 'relatorio', 'outro'] as CategoryFilter[]
        ).map((cat) => {
          const count = counts[cat] ?? 0;
          if (cat !== 'all' && count === 0) return null;
          const active = filter === cat;

          return (
            <button
              key={cat}
              type="button"
              onClick={() => setFilter(cat)}
              className={cx(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition',
                active
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-line bg-surface text-muted hover:text-fg',
              )}
            >
              <span>{categoryLabels[cat]}</span>
              <span className="font-mono text-xs opacity-75">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Lista de Ficheiros do Repositório */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<FolderOpen size={24} />}
          title={
            sortedMaterials.length === 0
              ? 'Nenhum material associado a esta cadeira'
              : 'Nenhum ficheiro encontrado com este filtro'
          }
          hint="Importa ficheiros ou pastas inteiras do teu Computador (HD) ou faz uma varredura autónoma no Google Drive para associar os materiais do curso."
          action={
            <div className="flex flex-wrap gap-2 justify-center">
              <Button variant="primary" onClick={() => setShowDeviceImport(true)}>
                <HardDrive size={14} />
                Importar do Computador (HD)
              </Button>
              <Button
                variant="secondary"
                onClick={handleAutoScanDrive}
                disabled={scanningDrive}
              >
                {scanningDrive ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Varrer Google Drive
              </Button>
            </div>
          }
        />
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 p-4 hover:bg-surface-2/40"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className={cx('grid size-9 shrink-0 place-items-center rounded-xl', colors.soft)}>
                  <FileText size={16} />
                </div>
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => handleOpenFile(item)}
                    className="group inline-flex items-center gap-1.5 font-medium text-fg hover:text-accent text-left"
                  >
                    <span className="truncate text-sm">{item.title}</span>
                    <ExternalLink
                      size={12}
                      className="shrink-0 text-muted opacity-0 group-hover:opacity-100"
                    />
                  </button>

                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <Badge>{providerLabel[item.provider] ?? 'Material'}</Badge>
                    {item.fileName && <span className="text-fg/75 font-mono">{item.fileName}</span>}
                    {item.fileSize && <span>({formatBytes(item.fileSize)})</span>}
                    {item.year && <span className="font-mono">{item.year}</span>}
                    {item.epoch && <Badge tone="accent">{item.epoch}</Badge>}
                    {item.hasSolution && (
                      <span className="inline-flex items-center gap-1 text-ok">
                        <CheckCircle size={11} /> Com Solução
                      </span>
                    )}
                    {item.modifiedAt && (
                      <span className="text-muted/70 tabular">
                        • {fmtShortDate(item.modifiedAt)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={item.pinned ? 'Desafixar' : 'Fixar'}
                  title={item.pinned ? 'Desafixar' : 'Fixar'}
                  onClick={() => patch('materials', item.id, { pinned: !item.pinned })}
                >
                  {item.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                </Button>
                <button
                  type="button"
                  onClick={() => handleOpenFile(item)}
                  className="rounded-xl border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-fg hover:border-muted/50"
                >
                  Abrir
                </button>
                <DeleteButton
                  message={`Remover "${item.title}" do repositório?`}
                  onConfirm={() => remove('materials', item.id)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {showDeviceImport && (
        <DeviceImportModal
          initialCourseId={course.id}
          onClose={() => setShowDeviceImport(false)}
        />
      )}

      {viewingMaterial && (
        <MaterialViewerModal
          material={viewingMaterial}
          onClose={() => setViewingMaterial(null)}
        />
      )}
    </div>
  );
}
