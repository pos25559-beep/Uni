import type { TooltipContentProps } from 'recharts';

export type ChartTooltipProps = TooltipContentProps & { format: (value: number) => string };

/** Tooltip próprio: superfície, borda de 1px, sem sombra, valores em mono com unidade. */
export function ChartTooltip({ active, payload, label, format }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const rows = payload.filter((p) => typeof p.value !== 'number' || p.value > 0);
  if (rows.length === 0) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs">
      {label !== undefined && label !== null && <p className="mb-1 text-muted">{String(label)}</p>}
      <ul className="space-y-1">
        {rows.map((p) => (
          <li key={String(p.dataKey ?? p.name)} className="flex items-center gap-2">
            <span className="size-2 shrink-0 rounded-full" style={{ background: p.color }} />
            <span className="text-fg">{String(p.name ?? '')}</span>
            <span className="ml-auto pl-3 tabular text-fg">
              {typeof p.value === 'number' ? format(p.value) : String(p.value ?? '')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
