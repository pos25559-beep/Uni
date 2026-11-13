import { CheckCircle2, ExternalLink, GraduationCap, KeyRound, Mail, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Modal, cx } from '../ui';
import { useAcademicEmails } from '../../hooks/useGoogleData';
import type { AcademicEmail } from '../../services/googleService';
import { newId, useStore } from '../../store/useStore';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';

export default function AcademicGmailWidget() {
  const courses = useStore((s) => s.courses);
  const upsert = useStore((s) => s.upsert);
  const {
    emails: allEmails,
    loading,
    connected,
    needsPermission,
    academicEmail,
    loadEmails,
    connect: handleConnect,
  } = useAcademicEmails();

  const emails = allEmails.slice(0, 5);
  const [selectedEmail, setSelectedEmail] = useState<AcademicEmail | null>(null);
  const [taskAdded, setTaskAdded] = useState(false);

  const handleCreateTask = () => {
    if (!selectedEmail) return;
    upsert('tasks', {
      id: newId(),
      courseId: selectedEmail.courseId,
      title: `Aviso Gmail: ${selectedEmail.subject.slice(0, 60)}`,
      due: format(new Date(), 'yyyy-MM-dd'),
      done: false,
      priority: 2,
    });
    setTaskAdded(true);
    setTimeout(() => setTaskAdded(false), 2500);
  };

  return (
    <>
      <Card
        title={academicEmail ? `Correio Académico (${academicEmail})` : 'Correio Académico (Gmail)'}
        action={
          connected ? (
            <Button variant="ghost" size="sm" onClick={() => void loadEmails(true)} disabled={loading} className="gap-1 text-xs">
              <RefreshCw size={12} className={cx(loading && 'animate-spin')} />
              Sincronizar
            </Button>
          ) : undefined
        }
      >
        {!connected ? (
          <div className="py-2 text-xs text-muted">
            <p>Liga a tua conta Google da faculdade (@campus.fct.unl.pt) para leres os avisos reais dos professores.</p>
            <Button size="sm" variant="secondary" onClick={() => handleConnect(false)} className="mt-2.5">
              <Mail size={13} />
              Ligar Gmail da Faculdade
            </Button>
          </div>
        ) : needsPermission ? (
          <div className="py-2 text-xs text-muted">
            <p>A tua sessão Google precisa de autorização para ler o Gmail (@campus.fct.unl.pt).</p>
            <Button size="sm" variant="primary" onClick={() => handleConnect(true)} className="mt-2.5">
              <KeyRound size={13} />
              Autorizar Leitura do Gmail
            </Button>
          </div>
        ) : loading ? (
          <p className="py-2 text-xs text-muted">A consultar o teu correio institucional...</p>
        ) : emails.length === 0 ? (
          <div className="py-2 text-xs text-muted">
            <p>Nenhum email da faculdade encontrado recentemente na tua caixa de entrada.</p>
            <Button size="sm" variant="ghost" onClick={() => void loadEmails(true)} className="mt-2 text-xs">
              <RefreshCw size={12} /> Verificar novamente
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-line text-xs">
            {emails.map((em) => {
              const course = courses.find((c) => c.id === em.courseId);
              return (
                <li key={em.id} className="py-2.5 first:pt-0 last:pb-0">
                  <button
                    type="button"
                    onClick={() => setSelectedEmail(em)}
                    className="group block w-full text-left"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {em.isClipNotice ? (
                          <GraduationCap size={13} className="shrink-0 text-amber-500" />
                        ) : (
                          <Mail size={13} className="shrink-0 text-muted" />
                        )}
                        <span className="truncate font-semibold text-fg">{em.fromName}</span>
                        {course && (
                          <span className="rounded bg-surface-2 px-1 py-0.2 font-mono text-[10px] text-accent">
                            {course.shortName}
                          </span>
                        )}
                      </div>
                      <span className="shrink-0 font-mono text-[10px] text-muted">
                        {format(parseISO(em.date), 'd MMM', { locale: pt })}
                      </span>
                    </div>

                    <p className="mt-1 truncate font-medium text-fg group-hover:text-accent">
                      {em.subject}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-muted text-[11px]">
                      {em.snippet}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

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
                    <CheckCircle2 size={13} /> Tarefa criada!
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
              <p><span className="font-semibold text-fg">De:</span> {selectedEmail.from}</p>
              <p className="mt-1">
                <span className="font-semibold text-fg">Data:</span>{' '}
                {format(parseISO(selectedEmail.date), "EEEE, d 'de' MMMM 'às' HH:mm", { locale: pt })}
              </p>
            </div>

            <div className="rounded-xl border border-line bg-surface-2/40 p-4 leading-relaxed text-fg">
              {selectedEmail.snippet}
            </div>

            {selectedEmail.courseId && (
              <div className="flex items-center justify-between rounded-xl border border-line bg-surface p-3">
                <span className="text-muted">Cadeira associada:</span>
                <Link
                  to={`/cadeiras/${selectedEmail.courseId}`}
                  className="font-semibold text-accent hover:underline flex items-center gap-1"
                >
                  Abrir painel da cadeira
                  <ExternalLink size={12} />
                </Link>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
