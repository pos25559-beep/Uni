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
import type { Course } from '../../types';
import { Badge, Button, EmptyState, Input, Modal, cx } from '../ui';
import { useAcademicEmails } from '../../hooks/useGoogleData';
import type { AcademicEmail } from '../../services/googleService';
import { matchesCourse } from '../../lib/courseAliases';
import { useStore, newId } from '../../store/useStore';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';

interface Props {
  course: Course;
}

export default function CourseEmailsTab({ course }: Props) {
  const {
    emails,
    loading,
    connected,
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
      title: `Aviso Gmail: ${selectedEmail.subject.slice(0, 60)}`,
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
          <h2 className="text-sm font-semibold">Avisos e Correio Académico</h2>
          {connected && !needsPermission && (
            <div className="flex items-center gap-2">
              <Badge tone="accent">{courseEmails.length} mensagens</Badge>
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
                  'rounded-xl border px-3 py-1.5 text-xs font-medium transition',
                  showAllFaculty
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-line bg-surface-2 text-muted hover:text-fg',
                )}
              >
                {showAllFaculty ? 'A mostrar todos os emails' : `Ver todos (${emails.length})`}
              </button>
            )}
            <div className="relative sm:w-60">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <Input
                placeholder="Procurar nos emails..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 text-xs"
              />
            </div>
            <Button variant="secondary" size="sm" onClick={() => loadEmails(true)} disabled={loading}>
              <RefreshCw size={13} className={cx(loading && 'animate-spin')} />
              Atualizar
            </Button>
          </div>
        )}
      </div>

      {/* Banner de permissão de Gmail em falta */}
      {needsPermission && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="size-5 shrink-0 text-amber-500 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-fg">Permissão de Leitura do Gmail Necessária</h3>
                <p className="mt-1 text-xs text-muted leading-relaxed">
                  A tua conta Google está ligada, mas o token anterior não incluía a autorização de leitura da caixa de entrada do Gmail. Para ler os avisos reais dos professores de {course.name}, clica em autorizar.
                </p>
              </div>
            </div>
            <Button
              variant="primary"
              onClick={() => handleConnect(true)}
              className="shrink-0"
            >
              <KeyRound size={14} /> Autorizar Permissão de Gmail
            </Button>
          </div>
        </div>
      )}

      {!connected ? (
        <EmptyState
          icon={<Mail size={24} />}
          title="Email Académico não ligado"
          hint="Os teus emails pessoais ficam separados por privacidade. Para ler avisos reais dos docentes nesta cadeira, liga a tua conta institucional Google ou importa um ficheiro .eml."
          action={
            <Button variant="primary" onClick={() => handleConnect(false)}>
              <Mail size={14} /> Ligar Email Académico
            </Button>
          }
        />
      ) : needsPermission ? null : courseEmails.length === 0 ? (
        <EmptyState
          icon={<Mail size={24} />}
          title={showAllFaculty ? 'Nenhum email encontrado' : 'Nenhum email específico para esta cadeira'}
          hint={
            emails.length > 0
              ? `Tens ${emails.length} mensagens sincronizadas da faculdade, mas nenhuma menciona "${course.name}" ou a sigla "${course.code}". Podes ver todos os avisos clicando abaixo.`
              : 'Não encontrámos mensagens com avisos de testes, enunciados ou da sigla desta cadeira na tua caixa de correio.'
          }
          action={
            <div className="flex flex-wrap gap-2 justify-center">
              {emails.length > 0 && (
                <Button
                  variant="primary"
                  onClick={() => setShowAllFaculty((v) => !v)}
                >
                  <Mail size={14} />
                  {showAllFaculty ? 'Ver só desta cadeira' : `Ver todos os avisos da faculdade (${emails.length})`}
                </Button>
              )}
              <Button variant="secondary" onClick={() => loadEmails(true)}>
                <RefreshCw size={14} /> Atualizar da Google
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
                    em.isClipNotice ? 'bg-amber-500/10 text-amber-500' : 'bg-surface-2 text-muted',
                  )}
                >
                  {em.isClipNotice ? <GraduationCap size={15} /> : <Mail size={15} />}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-xs font-semibold text-fg">{em.fromName}</span>
                    {em.isClipNotice && <Badge tone="accent">Aviso académico</Badge>}
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

              <span className="shrink-0 font-mono text-[11px] text-muted">
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
                    <CheckCircle2 size={13} /> Tarefa criada nas tuas tarefas!
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={handleCreateTask}>
                  <CheckCircle2 size={14} /> Criar Tarefa deste Email
                </Button>
                <Button onClick={() => setSelectedEmail(null)}>Fechar</Button>
              </div>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            <div className="border-b border-line pb-2 text-muted">
              <p>
                <span className="font-semibold text-fg">De:</span> {selectedEmail.from}
              </p>
              <p className="mt-1">
                <span className="font-semibold text-fg">Data:</span>{' '}
                {format(parseISO(selectedEmail.date), "EEEE, d 'de' MMMM 'às' HH:mm", {
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
