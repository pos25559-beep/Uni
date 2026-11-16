import { CheckCircle, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Course, CourseRules } from '../../types';
import { Button, Input, Modal } from '../ui';
import { useStore } from '../../store/useStore';

interface Props {
  course: Course;
  onClose: () => void;
}

export default function ClipCourseModal({ course, onClose }: Props) {
  const { t } = useTranslation('courses');
  const patch = useStore((s) => s.patch);

  const [rawText, setRawText] = useState('');
  const [formula, setFormula] = useState(course.rules?.evaluationFormula ?? '');
  const [minGrade, setMinGrade] = useState(course.rules?.minimumGradeRule ?? '');
  const [attendance, setAttendance] = useState(course.rules?.attendanceRule ?? '');
  const [clipUrl, setClipUrl] = useState(course.clipUrl ?? '');

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
      examRule: course.rules?.examRule ?? '',
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
      title={t('rulesModal.title', { name: course.name })}
      footer={
        <div className="flex w-full items-center justify-between">
          <div className="text-xs text-muted">
            {t('rulesModal.subtitle')}
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={onClose}>{t('rulesModal.cancel')}</Button>
            <Button variant="primary" onClick={handleSave}>
              <CheckCircle size={14} /> {t('rulesModal.save')}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-line bg-surface-2/60 p-3 text-xs text-muted">
          <p className="leading-relaxed">
            {t('rulesModal.intro')}
          </p>
        </div>

        {/* Leitor inteligente */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-semibold text-fg">{t('rulesModal.rawLabel')}</label>
            <button
              type="button"
              onClick={handleParseClip}
              className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
            >
              <Sparkles size={12} /> {t('rulesModal.extract')}
            </button>
          </div>
          <textarea
            rows={4}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={t('rulesModal.rawPlaceholder')}
            className="w-full rounded-xl border border-line bg-surface p-3 font-sans text-xs leading-relaxed text-fg placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </div>

        {/* Campos estruturados */}
        <div className="space-y-3 border-t border-line pt-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-fg">{t('rulesModal.formula')}</label>
            <Input
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              placeholder={t('rulesModal.formulaPh')}
              className="font-mono text-xs"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-fg">{t('rulesModal.minGrade')}</label>
            <Input
              value={minGrade}
              onChange={(e) => setMinGrade(e.target.value)}
              placeholder={t('rulesModal.minGradePh')}
              className="text-xs"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-fg">{t('rulesModal.attendance')}</label>
            <Input
              value={attendance}
              onChange={(e) => setAttendance(e.target.value)}
              placeholder={t('rulesModal.attendancePh')}
              className="text-xs"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-fg">{t('rulesModal.link')}</label>
            <Input
              value={clipUrl}
              onChange={(e) => setClipUrl(e.target.value)}
              placeholder="https://..."
              className="text-xs"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
