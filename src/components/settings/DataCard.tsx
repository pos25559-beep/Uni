import { format } from 'date-fns';
import { Database, Download, Trash2, Upload } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../../store/useStore';
import type {
  Assessment, CalendarEvent, ClassSlot, Course, Material, Settings, StudySession, Task,
} from '../../types';
import { Badge, Button, Card, Modal, cx } from '../ui';
import { errorMessage } from './shared';

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const hasId = (v: unknown) => isRecord(v) && typeof v.id === 'string' && v.id.length > 0;

/** Itens válidos (objetos com id) de uma coleção do ficheiro. */
const pickItems = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v.filter(hasId) as T[]) : []);

type Pending = 'demo' | 'clear' | null;

export default function DataCard() {
  const isDemo = useStore((s) => s.isDemo);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);

  const exportBackup = () => {
    setError(null);
    try {
      const s = useStore.getState();
      const payload = {
        app: 'unipedia',
        version: 1,
        exportedAt: new Date().toISOString(),
        collections: {
          courses: s.courses,
          assessments: s.assessments,
          classes: s.classes,
          sessions: s.sessions,
          tasks: s.tasks,
          materials: s.materials,
          events: s.events,
        },
        academicProfile: s.academicProfile,
        weeklyCheckIns: s.weeklyCheckIns,
        // A chave Gemini nunca sai no ficheiro.
        settings: { ...s.settings, geminiApiKey: '' },
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `unipedia-copia-${format(new Date(), 'yyyy-MM-dd')}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('Cópia de segurança exportada.');
    } catch (e) {
      setError(errorMessage(e, 'Não foi possível exportar os dados.'));
    }
  };

  const importBackup = async (file: File) => {
    setMessage(null);
    setError(null);
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isRecord(parsed) || !isRecord(parsed.collections)) {
        throw new Error('Ficheiro inválido: falta o objeto «collections».');
      }
      const cols = parsed.collections;
      const known = ['courses', 'assessments', 'classes', 'sessions', 'tasks', 'materials', 'events'];
      if (!known.some((k) => Array.isArray(cols[k]))) {
        throw new Error('Ficheiro inválido: não encontrei nenhuma coleção conhecida.');
      }

      const st = useStore.getState();
      const courses = pickItems<Course>(cols.courses);
      const assessments = pickItems<Assessment>(cols.assessments);
      const classes = pickItems<ClassSlot>(cols.classes);
      const sessions = pickItems<StudySession>(cols.sessions);
      const tasks = pickItems<Task>(cols.tasks);
      const materials = pickItems<Material>(cols.materials);
      const events = pickItems<CalendarEvent>(cols.events);

      st.upsertMany('courses', courses);
      st.upsertMany('assessments', assessments);
      st.upsertMany('classes', classes);
      st.upsertMany('sessions', sessions);
      st.upsertMany('tasks', tasks);
      st.upsertMany('materials', materials);
      st.upsertMany('events', events);

      if (isRecord(parsed.settings)) {
        // Ignora a chave Gemini do ficheiro para não apagar a do utilizador.
        const incoming = Object.fromEntries(
          Object.entries(parsed.settings).filter(([k]) => k !== 'geminiApiKey'),
        );
        st.updateSettings(incoming as Partial<Settings>);
      }

      const total = courses.length + assessments.length + classes.length + sessions.length
        + tasks.length + materials.length + events.length;
      setMessage(`Importados ${total} registos.`);
    } catch (e) {
      setError(errorMessage(e, 'Não foi possível importar o ficheiro.'));
    }
  };

  const confirmPending = () => {
    if (pending === 'demo') {
      useStore.getState().loadDemo();
      setMessage('Dados de demonstração carregados.');
    } else if (pending === 'clear') {
      useStore.getState().clearAll();
      setMessage('Dados apagados. As definições mantêm-se.');
    }
    setError(null);
    setPending(null);
  };

  return (
    <Card title="Dados" action={isDemo ? <Badge tone="accent">Modo demonstração</Badge> : undefined}>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium">Cópia de segurança</h3>
            <p className="mt-0.5 text-xs text-muted">
              Guarda tudo num ficheiro JSON. A chave da Gemini não é incluída.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={exportBackup}>
              <Download size={16} />
              Exportar cópia de segurança
            </Button>
            <label className={cx(
              'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-surface-2 px-4 text-sm font-medium text-fg transition hover:border-muted/50',
            )}>
              <Upload size={16} />
              Importar cópia
              <input
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void importBackup(file);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
          <p className="text-xs text-muted">
            A importação junta os registos aos que já existem (os de mesmo id são atualizados).
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium">Dados de exemplo e reposição</h3>
            <p className="mt-0.5 text-xs text-muted">
              Estes botões substituem os dados atuais deste navegador.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setPending('demo')}>
              <Database size={16} />
              Carregar cadeiras e horário do Pedro (LEMc)
            </Button>
            <Button variant="danger" onClick={() => setPending('clear')}>
              <Trash2 size={16} />
              Apagar tudo
            </Button>
          </div>
        </div>
      </div>

      {message && <p className="mt-4 text-sm text-ok">{message}</p>}
      {error && <p className="mt-4 break-words text-sm text-danger">{error}</p>}

      <Modal
        open={pending !== null}
        onClose={() => setPending(null)}
        title={pending === 'clear' ? 'Apagar todos os dados?' : 'Carregar horário do Pedro (LEMc)?'}
        footer={
          <>
            <Button onClick={() => setPending(null)}>Cancelar</Button>
            <Button variant={pending === 'clear' ? 'danger' : 'primary'} onClick={confirmPending}>
              {pending === 'clear' ? 'Apagar tudo' : 'Carregar horário LEMc'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          {pending === 'clear'
            ? 'Remove cadeiras, avaliações, aulas, sessões, tarefas, materiais e eventos deste navegador. Não se pode desfazer: exporta uma cópia antes, se precisares. As definições mantêm-se.'
            : 'Substitui os dados atuais pelas 6 cadeiras, horários e datas de testes reais do teu 1.º Semestre de LEMc (CLIP).'}
        </p>
      </Modal>
    </Card>
  );
}
