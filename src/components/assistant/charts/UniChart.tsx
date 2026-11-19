// Desenha um gráfico do Uni (já validado e calculado por buildChart) em SVG, com as cores e o
// tema da app. Sem bibliotecas: escala linear, grelha, eixos, curvas, pontos, formas e legenda.
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { niceTicks, type ChartColor, type ChartModel } from '../../../lib/charts/spec';

const COLOR_VAR: Record<ChartColor, string> = {
  accent: 'var(--accent)',
  coral: 'var(--coral)',
  sky: '#3B82F6',
  amber: '#D97706',
  teal: '#0D9488',
  plum: '#BE185D',
  ink: 'var(--fg)',
  muted: 'var(--muted)',
};

const W = 360;
const M = { top: 12, right: 14, bottom: 36, left: 46 };

const fmtTick = (v: number) => {
  const a = Math.abs(v);
  if (a !== 0 && (a >= 1e5 || a < 1e-3)) return v.toExponential(0);
  return String(Number(v.toPrecision(4))).replace('.', ',');
};

export function UniChart({ model }: { model: ChartModel }) {
  const { t } = useTranslation('assistant');
  const uid = useId().replace(/:/g, '');
  const xspan = model.x.max - model.x.min;
  const yspan = model.y.max - model.y.min;
  const plotW = W - M.left - M.right;
  // Mesma escala nos dois eixos quando a geometria importa (círculos, elipses, hexágonos).
  const plotH = model.equalAspect
    ? Math.max(160, Math.min(440, (plotW * yspan) / xspan))
    : 230;
  const H = plotH + M.top + M.bottom;

  const sx = (x: number) => M.left + ((x - model.x.min) / xspan) * plotW;
  const sy = (y: number) => M.top + plotH - ((y - model.y.min) / yspan) * plotH;
  const pathOf = (pts: Array<[number, number]>) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p[0]).toFixed(1)} ${sy(p[1]).toFixed(1)}`).join(' ');

  const xTicks = niceTicks(model.x.min, model.x.max, 5);
  const yTicks = niceTicks(model.y.min, model.y.max, 5);
  const zeroX = model.x.min < 0 && model.x.max > 0 ? sx(0) : null;
  const zeroY = model.y.min < 0 && model.y.max > 0 ? sy(0) : null;
  const legend = model.items.filter((it) => it.label && it.type !== 'text');
  const clipId = `uc-clip-${uid}`;
  const arrowId = (c: ChartColor) => `uc-arrow-${uid}-${c}`;

  return (
    <figure className="my-2 w-full max-w-[480px] overflow-hidden rounded-2xl border border-line bg-surface p-3">
      {model.title && <figcaption className="mb-1 text-sm font-semibold text-fg">{model.title}</figcaption>}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={model.title ?? t('chart.aria')}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={M.left} y={M.top} width={plotW} height={plotH} />
          </clipPath>
          {[...new Set(model.items.filter((i) => i.type === 'arrow').map((i) => i.color))].map((c) => (
            <marker key={c} id={arrowId(c)} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill={COLOR_VAR[c]} />
            </marker>
          ))}
        </defs>

        {/* Grelha */}
        {model.grid && (
          <g stroke="var(--line)" strokeWidth={0.6}>
            {xTicks.map((v) => (
              <line key={`gx${v}`} x1={sx(v)} x2={sx(v)} y1={M.top} y2={M.top + plotH} />
            ))}
            {yTicks.map((v) => (
              <line key={`gy${v}`} x1={M.left} x2={M.left + plotW} y1={sy(v)} y2={sy(v)} />
            ))}
          </g>
        )}

        {/* Eixos que passam pela origem (quando visível) e moldura */}
        <rect x={M.left} y={M.top} width={plotW} height={plotH} fill="none" stroke="var(--line)" strokeWidth={0.8} />
        {zeroX !== null && <line x1={zeroX} x2={zeroX} y1={M.top} y2={M.top + plotH} stroke="var(--muted)" strokeWidth={1} />}
        {zeroY !== null && <line x1={M.left} x2={M.left + plotW} y1={zeroY} y2={zeroY} stroke="var(--muted)" strokeWidth={1} />}

        {/* Marcas */}
        <g fill="var(--muted)" fontSize={10} fontFamily="var(--font-mono)">
          {xTicks.map((v) => (
            <text key={`tx${v}`} x={sx(v)} y={M.top + plotH + 13} textAnchor="middle">
              {fmtTick(v)}
            </text>
          ))}
          {yTicks.map((v) => (
            <text key={`ty${v}`} x={M.left - 5} y={sy(v) + 3} textAnchor="end">
              {fmtTick(v)}
            </text>
          ))}
        </g>
        {model.x.label && (
          <text x={M.left + plotW / 2} y={H - 4} textAnchor="middle" fontSize={11} fill="var(--fg)">
            {model.x.label}
          </text>
        )}
        {model.y.label && (
          <text
            x={11}
            y={M.top + plotH / 2}
            textAnchor="middle"
            fontSize={11}
            fill="var(--fg)"
            transform={`rotate(-90 11 ${M.top + plotH / 2})`}
          >
            {model.y.label}
          </text>
        )}

        {/* Elementos */}
        <g clipPath={`url(#${clipId})`}>
          {model.items.map((it, idx) => {
            const color = COLOR_VAR[it.color];
            const dash = it.dashed ? '5 4' : undefined;
            switch (it.type) {
              case 'curve':
                return (
                  <g key={idx}>
                    {it.segments.map((seg, j) => (
                      <path
                        key={j}
                        d={pathOf(seg) + (it.fill ? ' Z' : '')}
                        fill={it.fill ? color : 'none'}
                        fillOpacity={it.fill ? 0.14 : undefined}
                        stroke={color}
                        strokeWidth={1.8}
                        strokeDasharray={dash}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    ))}
                  </g>
                );
              case 'circle':
                return (
                  <ellipse
                    key={idx}
                    cx={sx(it.center[0])}
                    cy={sy(it.center[1])}
                    rx={(it.r / xspan) * plotW}
                    ry={(it.r / yspan) * plotH}
                    fill={it.fill ? color : 'none'}
                    fillOpacity={it.fill ? 0.14 : undefined}
                    stroke={color}
                    strokeWidth={1.8}
                    strokeDasharray={dash}
                  />
                );
              case 'bars': {
                const autoW = it.bars.length > 1 ? (xspan / (it.bars.length + 1)) * 0.7 : xspan * 0.1;
                return (
                  <g key={idx} fill={color} fillOpacity={0.85}>
                    {it.bars.map((b, j) => {
                      const w = b.width > 0 ? b.width : autoW;
                      const y0 = sy(Math.max(Math.min(0, model.y.max), model.y.min));
                      const y1 = sy(b.y);
                      return (
                        <rect
                          key={j}
                          x={sx(b.x - w / 2)}
                          width={Math.max(1, (w / xspan) * plotW)}
                          y={Math.min(y0, y1)}
                          height={Math.abs(y1 - y0)}
                          rx={2}
                        />
                      );
                    })}
                  </g>
                );
              }
              case 'hline':
                return (
                  <line key={idx} x1={M.left} x2={M.left + plotW} y1={sy(it.y)} y2={sy(it.y)} stroke={color} strokeWidth={1.4} strokeDasharray={dash ?? '6 4'} />
                );
              case 'vline':
                return (
                  <line key={idx} x1={sx(it.x)} x2={sx(it.x)} y1={M.top} y2={M.top + plotH} stroke={color} strokeWidth={1.4} strokeDasharray={dash ?? '6 4'} />
                );
              case 'arrow':
                return (
                  <line
                    key={idx}
                    x1={sx(it.from[0])}
                    y1={sy(it.from[1])}
                    x2={sx(it.to[0])}
                    y2={sy(it.to[1])}
                    stroke={color}
                    strokeWidth={1.8}
                    strokeDasharray={dash}
                    markerEnd={`url(#${arrowId(it.color)})`}
                  />
                );
              default:
                return null;
            }
          })}
        </g>

        {/* Pontos e textos por cima (fora do recorte para os rótulos não cortarem) */}
        {model.items.map((it, idx) => {
          if (it.type === 'points') {
            return (
              <g key={`p${idx}`}>
                {it.points.map((p, j) => (
                  <g key={j}>
                    <circle cx={sx(p[0])} cy={sy(p[1])} r={3.6} fill={COLOR_VAR[it.color]} stroke="var(--surface)" strokeWidth={1.2} />
                    {it.pointLabels[j] && (
                      <text x={sx(p[0]) + 6} y={sy(p[1]) - 6} fontSize={11} fill="var(--fg)">
                        {it.pointLabels[j]}
                      </text>
                    )}
                  </g>
                ))}
              </g>
            );
          }
          if (it.type === 'text') {
            return (
              <text key={`t${idx}`} x={sx(it.at[0])} y={sy(it.at[1])} fontSize={11} fill={COLOR_VAR[it.color]} textAnchor="middle">
                {it.text}
              </text>
            );
          }
          return null;
        })}
      </svg>

      {legend.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {legend.map((it, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block w-4"
                style={{ borderTop: `2px ${it.dashed ? 'dashed' : 'solid'} ${COLOR_VAR[it.color]}` }}
              />
              {it.label}
            </li>
          ))}
        </ul>
      )}
      {model.caption && <p className="mt-1.5 text-xs leading-relaxed text-muted">{model.caption}</p>}
    </figure>
  );
}
