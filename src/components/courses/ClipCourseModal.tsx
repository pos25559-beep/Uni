import { CheckCircle, Sparkles } from 'lucide-react';
import { useState } from 'react';
import type { Course, CourseRules } from '../../types';
import { Button, Input, Modal } from '../ui';
import { useStore } from '../../store/useStore';

interface Props {
  course: Course;
  onClose: () => void;
}

export default function ClipCourseModal({ course, onClose }: Props) {
  const patch = useStore((s) => s.patch);

  const [rawText, setRawText] = useState('');
  const [formula, setFormula] = useState(course.rules?.evaluationFormula ?? 'NF = 0.5 * T1 + 0.5 * T2');
  const [minGrade, setMinGrade] = useState(course.rules?.minimumGradeRule ?? 'Média dos testes >= 9.5; sem notas < 8.0.');
  const [attendance, setAttendance] = useState(course.rules?.attendanceRule ?? 'Presença em pelo menos 2/3 das aulas práticas.');
  const [clipUrl, setClipUrl] = useState(course.clipUrl ?? 'https://clip.fct.unl.pt');

  const handleParseClip = () => {
    const text = rawText.trim();
    if (!text) return;

    // Procura fórmulas comuns (ex: NF = ... ou Nota Final = ...)
    const formulaMatch = /(?:NF|Nota\s+Final|Classifica[çc][ãa]o)\s*=\s*([^\n.;]+)/i.exec(text);
    if (formulaMatch) {
      setFormula(formulaMatch[0].trim());
    }

    // Procura notas mínimas (ex: 8.0, 9.5 valores)
    const minMatch = /(?:m[íi]nimo|m[íi]nima|nota\s+m[íi]nima)\s*(?:de)?\s*([0-9.,]+\s*valores[^\n.;]*)/i.exec(text);
    if (minMatch) {
      setMinGrade(minMatch[0].trim());
    }

    // Procura menção de faltas / presenças
    const attMatch = /(?:presen[çc]a|assiduidade|faltas|frequ[êe]ncia)\s*([^\n.;]{10,80})/i.exec(text);
    if (attMatch) {
      setAttendance(attMatch[0].trim());
    }
  };

  const handleSave = () => {
    const updatedRules: CourseRules = {
      evaluationFormula: formula.trim(),
      minimumGradeRule: minGrade.trim(),
      examRule: course.rules?.examRule ?? 'Dispensa com média >= 9.5. Exame de Recurso para aprovação ou melhoria.',
      attendanceRule: attendance.trim(),
      officeHours: course.rules?.officeHours,
      professors: course.rules?.professors,
      syllabusSummary: course.rules?.syllabusSummary,
      clipFichaUrl: clipUrl.trim(),
    };

    patch('courses', course.id, {
      rules: updatedRules,
      clipUrl: clipUrl.trim(),
    });

    onClose();
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={`Atualizar Regras Oficiais do CLIP — ${course.name}`}
      footer={
        <div className="flex w-full items-center justify-between">
          <div className="text-xs text-muted">
            Regras de funcionamento e critérios de avaliação
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={onClose}>Cancelar</Button>
            <Button variant="primary" onClick={handleSave}>
              <CheckCircle size={14} /> Guardar Regras
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-line bg-surface-2/60 p-3 text-xs text-muted">
          <p className="leading-relaxed">
            Como o CLIP da FCT NOVA exige autenticação institucional, podes copiar e colar o texto da Ficha de Unidade Curricular ou regras publicadas pelo docente. O sistema extrai automaticamente a fórmula da nota e notas mínimas.
          </p>
        </div>

        {/* Leitor inteligente */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-semibold text-fg">Conteúdo copiado do CLIP (Regulamento / Ficha de UC):</label>
            <button
              type="button"
              onClick={handleParseClip}
              className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
            >
              <Sparkles size={12} /> Extrair regras
            </button>
          </div>
          <textarea
            rows={4}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Cola aqui o texto das regras de avaliação do CLIP..."
            className="w-full rounded-xl border border-line bg-surface p-3 font-sans text-xs leading-relaxed text-fg placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </div>

        {/* Campos estruturados */}
        <div className="space-y-3 border-t border-line pt-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-fg">Fórmula de Avaliação da Nota Final:</label>
            <Input
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              placeholder="Ex: NF = 0.5 * T1 + 0.5 * T2"
              className="font-mono text-xs"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-fg">Critérios de Nota Mínima e Dispensa de Exame:</label>
            <Input
              value={minGrade}
              onChange={(e) => setMinGrade(e.target.value)}
              placeholder="Ex: Média dos testes >= 9.5; nota mínima de 8.0 por teste."
              className="text-xs"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-fg">Regime de Presenças e Assiduidade:</label>
            <Input
              value={attendance}
              onChange={(e) => setAttendance(e.target.value)}
              placeholder="Ex: Frequência obrigatória em pelo menos 2/3 das aulas práticas."
              className="text-xs"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-fg">Link da Página da Cadeira no CLIP:</label>
            <Input
              value={clipUrl}
              onChange={(e) => setClipUrl(e.target.value)}
              placeholder="https://clip.fct.unl.pt/..."
              className="text-xs"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
