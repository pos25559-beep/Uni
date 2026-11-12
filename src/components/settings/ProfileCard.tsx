import { Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { fmtMinutes } from '../../lib/selectors';
import { weekdayShort } from '../../lib/colors';
import { Button, Card, Field, Input, cx } from '../ui';

// Segunda primeiro; o valor é o índice de Date.getDay().
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function ProfileCard() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const [minutesText, setMinutesText] = useState(String(settings.dailyStudyMinutes));

  const endBeforeStart = settings.semesterEnd < settings.semesterStart;

  const onMinutes = (text: string) => {
    setMinutesText(text);
    const v = Number(text);
    if (text.trim() !== '' && Number.isFinite(v) && v >= 0 && v <= 1440) {
      updateSettings({ dailyStudyMinutes: Math.round(v) });
    }
  };

  const toggleDay = (day: number) => {
    const on = settings.studyDays.includes(day);
    const next = on ? settings.studyDays.filter((d) => d !== day) : [...settings.studyDays, day];
    updateSettings({ studyDays: [...next].sort((a, b) => a - b) });
  };

  return (
    <Card title="Perfil e semestre">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome">
          <Input
            value={settings.userName}
            placeholder="Como te devemos chamar?"
            onChange={(e) => updateSettings({ userName: e.target.value })}
          />
        </Field>
        <Field label="Nome do semestre">
          <Input
            value={settings.semesterName}
            onChange={(e) => updateSettings({ semesterName: e.target.value })}
          />
        </Field>
        <Field label="Início do semestre">
          <Input
            type="date"
            value={settings.semesterStart}
            onChange={(e) => e.target.value && updateSettings({ semesterStart: e.target.value })}
          />
        </Field>
        <Field
          label="Fim do semestre"
          hint={endBeforeStart ? <span className="text-warn">O fim é anterior ao início.</span> : undefined}
        >
          <Input
            type="date"
            value={settings.semesterEnd}
            onChange={(e) => e.target.value && updateSettings({ semesterEnd: e.target.value })}
          />
        </Field>
        <Field
          label="Tempo de estudo por dia (minutos)"
          hint={`Equivale a ${fmtMinutes(settings.dailyStudyMinutes)} por dia.`}
        >
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            max={1440}
            step={15}
            value={minutesText}
            onChange={(e) => onMinutes(e.target.value)}
          />
        </Field>
        <div>
          <span className="mb-1.5 block text-xs font-medium text-muted">Dias de estudo</span>
          <div className="flex flex-wrap gap-1.5">
            {DAY_ORDER.map((day) => {
              const on = settings.studyDays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleDay(day)}
                  className={cx(
                    'h-10 min-w-11 flex-1 rounded-xl border text-xs font-medium transition sm:flex-none sm:px-3',
                    on
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-line bg-surface-2 text-muted hover:text-fg',
                  )}
                >
                  {weekdayShort[day]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <span className="text-xs font-medium text-muted">Tema</span>
        <div className="inline-flex rounded-xl border border-line bg-surface-2 p-1">
          {([
            ['dark', 'Escuro', Moon],
            ['light', 'Claro', Sun],
          ] as const).map(([value, label, Icon]) => (
            <Button
              key={value}
              size="sm"
              variant={settings.theme === value ? 'primary' : 'ghost'}
              aria-pressed={settings.theme === value}
              onClick={() => updateSettings({ theme: value })}
            >
              <Icon size={14} />
              {label}
            </Button>
          ))}
        </div>
      </div>
    </Card>
  );
}
