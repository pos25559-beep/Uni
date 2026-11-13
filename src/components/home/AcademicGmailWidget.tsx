import { CheckCircle2, ExternalLink, GraduationCap, KeyRound, Mail, RefreshCw, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Modal, cx } from '../ui';
import { useAcademicEmails } from '../../hooks/useGoogleData';
import { parseEmlToAcademicEmail } from '../../integrations/gmail';
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

  const [importedEmails, setImportedEmails] = useState<AcademicEmail[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<AcademicEmail | null>(null);
  const [taskAdded, setTaskAdded] = useState(false);
  const emlInputRef = useRef<HTMLInputElement>(null);

  const combinedEmails = [...importedEmails, ...allEmails].slice(0, 5);

  const handleImportEml = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseEmlToAcademicEmail(text, courses, `eml-${Date.now()}`);
      setImportedEmails((prev) => [parsed, ...prev]);
      setSelectedEmail(parsed);
    } finally {
      if (emlInputRef.current) emlInputRef.current.value = '';
    }
  };

  const handleCreateTask = () => {
    if (!selectedEmail) return;
    upsert('tasks', {
      id: newId(),
      courseId: selectedEmail.courseId,
      title: `Aviso: ${selectedEmail.subject.slice(0, 60)}`,
      due: format(new Date(), 'yyyy-MM-dd'),
      done: false,
      priority: 2,
    });
    setTaskAdded(true);
    setTimeout(() => setTaskAdded(false), 2500);
  };

  return (
    <>
      {/* Cartão Postal Académico em pastel céu suave */}
      <section className="relative overflow-hidden rounded-[26px] border border-[#141312]/8 bg-[#E9F3FE] p-5 text-[#141312] shadow-card dark:border-white/10 dark:bg-surface-2 dark:text-[#FAF6EC]">
        <input
          ref={emlInputRef}
          type="file"
          accept=".eml,message/rfc822"
          className="hidden"
          onChange={(e) => void handleImportEml(e.target.files?.[0])}
        />

        {/* Selo postal decorativo no canto */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-2 -right-2 size-16 rotate-6 rounded-2xl border-2 border-dashed border-[#E04F33]/35 bg-[#FAF8F2]/60 dark:border-coral/30 dark:bg-white/5"
        />

        <div className="relative z-10 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/75 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#157F58] dark:bg-black/25 dark:text-accent">
              <Mail size={11} />
              Caixa Postal
            </span>
            <h2 className="mt-1.5 font-display text-base font-bold leading-snug">
              {connected && academicEmail ? `Correio (${academicEmail})` : 'Correio Académico'}
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            {connected && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void loadEmails(true)}
                disabled={loading}
                className="bg-white/80 dark:bg-surface"
              >
                <RefreshCw size={12} className={cx(loading && 'animate-spin')} />
                Sincronizar
              </Button>
            )}
          </div>
        </div>

        <div className="relative z-10 mt-3">
          {combinedEmails.length > 0 ? (
            <ul className="space-y-2 text-xs">
              {combinedEmails.map((em) => {
                const course = courses.find((c) => c.id === em.courseId);
                return (
                  <li key={em.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedEmail(em)}
                      className="group block w-full rounded-[18px] bg-white/80 px-3.5 py-2.5 text-left transition hover:bg-white dark:bg-black/25 dark:hover:bg-black/35"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1.5">
                          {em.isClipNotice ? (
                            <GraduationCap size={13} className="shrink-0 text-amber-600" />
                          ) : (
                            <Mail size={13} className="shrink-0 text-muted" />
                          )}
                          <span className="truncate font-semibold text-fg">{em.fromName}</span>
                          {course && (
                            <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-accent">
                              {course.shortName}
                            </span>
                          )}
                        </div>
                        <span className="shrink-0 font-mono text-[11px] text-muted">
                          {format(parseISO(em.date), 'd MMM', { locale: pt })}
                        </span>
                      </div>
                      <p className="mt-1 truncate font-medium text-fg group-hover:text-accent">
                        {em.subject}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted">{em.snippet}</p>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : !connected ? (
            <div className="space-y-3 text-xs">
              <p className="opacity-80 leading-relaxed">
                Acompanha avisos dos professores num só cartão ou testa já importando um email real (<code className="rounded bg-white/70 px-1 py-0.5 font-mono text-[11px] dark:bg-black/25">.eml</code>).
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="primary" onClick={() => handleConnect(false)}>
                  <Mail size={13} />
                  Ligar Email Académico
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => emlInputRef.current?.click()}
                  className="bg-white/85 text-[#141312] dark:bg-surface dark:text-fg"
                >
                  <Upload size={13} />
                  Importar aviso (.eml)
                </Button>
              </div>
            </div>
          ) : needsPermission ? (
            <div className="space-y-2.5 text-xs">
              <p className="opacity-80">A tua sessão Google precisa de autorização para ler o correio académico.</p>
              <Button size="sm" variant="primary" onClick={() => handleConnect(true)}>
                <KeyRound size={13} />
                Autorizar leitura
              </Button>
            </div>
          ) : loading ? (
            <p className="py-2 text-xs opacity-75">A consultar o teu correio académico...</p>
          ) : (
            <div className="space-y-2.5 text-xs">
              <p className="opacity-80">Nenhum aviso recente encontrado na tua caixa.</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => void loadEmails(true)} className="bg-white/80 dark:bg-surface">
                  <RefreshCw size={12} /> Verificar de novo
                </Button>
                <Button size="sm" variant="ghost" onClick={() => emlInputRef.current?.click()}>
                  <Upload size={12} /> Importar .eml
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      {selectedEmail && (
        <Modal
          open={true}
          onClose={() => setSelectedEmail(null)}
          title={selectedEmail.subject}
          footer={
            <div className="flex w-full items-center justify-between gap-2">
              <div>
                {taskAdded && (
                  <span className="flex items-center gap-1 text-xs text-ok">
                    <CheckCircle2 size={13} /> Tarefa criada!
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={handleCreateTask}>
                  <CheckCircle2 size={14} /> Criar Tarefa
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
                  className="flex items-center gap-1 font-semibold text-accent hover:underline"
                >
                  Abrir cadeira
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
