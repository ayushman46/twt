/**
 * Lightweight single-series column chart (replaces recharts for the one chart
 * we draw). Thin columns ≤24px with 4px rounded tops, hairline grid, compact
 * y ticks, sparse x labels, and a per-column hover/focus tooltip.
 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useT } from '@/i18n';
import { fmtCompact, fmtNumber } from '@/lib/format';

export interface ColumnDatum {
  key: string;
  label: string;
  full: string;
  value: number;
}

function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? pow * 10;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

/** `unit` (optional, already translated) replaces the default "{count} saved" wording. */
export function ColumnChart({ data, height = 240, unit }: { data: ColumnDatum[]; height?: number; unit?: string }) {
  const t = useT();
  const amount = (v: number) => (unit ? `${fmtNumber(v)} ${unit}` : t('chart.saved', { count: fmtNumber(v) }));
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const left = 36;
  const bottom = 22;
  const top = 8;
  const plotW = Math.max(0, width - left - 4);
  const plotH = height - top - bottom;
  const ticks = useMemo(() => niceTicks(Math.max(0, ...data.map((d) => d.value))), [data]);
  const yMax = ticks[ticks.length - 1] || 1;
  const band = data.length ? plotW / data.length : 0;
  const barW = Math.max(2, Math.min(24, band * 0.62));
  const labelEvery = Math.max(1, Math.ceil(64 / Math.max(band, 1)));
  const y = (v: number) => top + plotH - (v / yMax) * plotH;

  const hovered = hover !== null ? data[hover] : undefined;

  return (
    <div ref={ref} className="relative" style={{ height }}>
      {width ? (
        <svg width={width} height={height} role="img" aria-label={t('chart.aria')}>
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={left} x2={width - 4} y1={y(tick)} y2={y(tick)} stroke="var(--line)" strokeWidth={1} />
              <text x={left - 8} y={y(tick)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--faint)">
                {fmtCompact(tick)}
              </text>
            </g>
          ))}
          <line x1={left} x2={width - 4} y1={top + plotH} y2={top + plotH} stroke="var(--line-strong)" strokeWidth={1} />
          {data.map((d, i) => {
            const cx = left + band * i + band / 2;
            const h = Math.max(0, top + plotH - y(d.value));
            const x0 = cx - barW / 2;
            const y0 = top + plotH;
            const r = Math.min(4, barW / 2, h);
            const path = h > 0 ? `M${x0},${y0}V${y0 - h + r}Q${x0},${y0 - h} ${x0 + r},${y0 - h}H${x0 + barW - r}Q${x0 + barW},${y0 - h} ${x0 + barW},${y0 - h + r}V${y0}Z` : '';
            return (
              <g key={d.key}>
                {path ? <path d={path} fill={hover === i ? 'var(--accent-hover)' : 'var(--accent)'} /> : null}
                {i % labelEvery === 0 ? (
                  <text x={cx} y={height - 6} textAnchor="middle" fontSize={11} fill="var(--faint)">
                    {d.label}
                  </text>
                ) : null}
                {/* Hit target: the whole band, larger than the mark. */}
                <rect
                  x={left + band * i}
                  y={top}
                  width={band}
                  height={plotH}
                  fill={hover === i ? 'var(--accent-soft)' : 'transparent'}
                  tabIndex={0}
                  aria-label={`${d.full}: ${amount(d.value)}`}
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover((h0) => (h0 === i ? null : h0))}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  style={{ outline: 'none' }}
                />
              </g>
            );
          })}
        </svg>
      ) : null}
      {hovered && hover !== null ? (
        <div
          className="pointer-events-none absolute z-10 rounded-xl border border-line bg-panel px-3 py-2 shadow-pop"
          style={{ left: Math.min(Math.max(left + band * hover + band / 2 - 70, 0), Math.max(0, width - 150)), top: 0 }}
        >
          <div className="text-[15px] font-semibold text-fg">
            {amount(hovered.value)}
          </div>
          <div className="text-[12px] text-muted">{hovered.full}</div>
        </div>
      ) : null}
    </div>
  );
}
