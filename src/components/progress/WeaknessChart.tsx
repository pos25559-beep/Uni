import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar, BarChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { Course } from '../../types';
import { ChartCard } from './ChartCard';
import { ChartTooltip } from './ChartTooltip';
import { animation, axisProps, cursorFill, legendStyle } from './chartStyle';
import { competenceRows, competenceScore, fmtDec, fmtPct, type CompetenceRow } from './data';

interface Props {
  courses: Course[];
}

/** "Onde estou mais fraco?" — radar por cadeira (3 ou mais); com menos, barras horizontais. */
export function WeaknessChart({ courses }: Props) {
  const rows = useMemo(() => competenceRows(courses), [courses]);
  const weakest = useMemo(
    () => rows.reduce<CompetenceRow | undefined>((w, r) => (!w || competenceScore(r) < competenceScore(w) ? r : w), undefined),
    [rows],
  );
  const radarData = useMemo(
    () => rows.map((r) => ({ subject: r.name, progresso: r.progress, confianca: r.confidencePct })),
    [rows],
  );

  return (
    <ChartCard
      title="Onde estou mais fraco?"
      isEmpty={rows.length === 0}
      emptyTitle="Ainda sem matéria para avaliar"
      emptyHint="Adiciona tópicos às cadeiras e indica o teu nível de confiança para ver onde estás mais fraco."
      emptyAction={<Link to="/cadeiras" className="text-sm font-medium text-accent">Ir para as cadeiras</Link>}
      takeaway={
        weakest && (
          <>
            Mais fraco: {weakest.name} — <span className="tabular">{fmtPct(weakest.progress)}</span> da matéria, confiança{' '}
            <span className="tabular">{fmtDec(weakest.confidence)}/5</span>
          </>
        )
      }
    >
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {rows.length >= 3 ? (
            <RadarChart data={radarData} outerRadius="70%">
              <PolarGrid stroke="var(--line)" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: 'var(--muted)', fontFamily: 'var(--font-mono)' }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              <Radar name="Matéria" dataKey="progresso" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.15} {...animation()} />
              <Radar name="Confiança" dataKey="confianca" stroke="var(--muted)" fill="var(--muted)" fillOpacity={0.15} {...animation()} />
              <Tooltip content={(p) => <ChartTooltip {...p} format={fmtPct} />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={legendStyle} />
            </RadarChart>
          ) : (
            <BarChart data={radarData} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }} barGap={2}>
              <XAxis type="number" domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} {...axisProps} />
              <YAxis type="category" dataKey="subject" width={84} {...axisProps} />
              <Tooltip cursor={cursorFill} content={(p) => <ChartTooltip {...p} format={fmtPct} />} />
              <Bar dataKey="progresso" name="Matéria" fill="var(--accent)" radius={[0, 3, 3, 0]} barSize={12} {...animation()} />
              <Bar dataKey="confianca" name="Confiança" fill="var(--muted)" fillOpacity={0.5} radius={[0, 3, 3, 0]} barSize={12} {...animation()} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={legendStyle} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
