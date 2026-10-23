import { addDays, addMonths, format, startOfMonth, startOfWeek } from 'date-fns';
import { ArrowDownRight, ArrowUpRight, ChartColumn, Check, Table2 } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { ColumnChart } from '@/components/ColumnChart';
import { FACET_LABELS } from '@/lib/facets';
import { usePaintMark } from '@/lib/perf';
import { fmtCompact, fmtNumber } from '@/lib/format';
import type { Bookmark, Facet } from '@/lib/types';
import { useLibrary } from '@/hooks/library';
import { navigate, scopeHash } from '@/hooks/route';
import { Avatar } from '@/components/Brand';
import { EmptyState, cn } from '@/components/ui/primitives';

type Range = '30d' | '90d' | '12m' | 'all';
const RANGES: Array<{ id: Range; label: string }> = [
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
  { id: '12m', label: 'Last 12 months' },
  { id: 'all', label: 'All time' },
];
const DAY = 86_400_000;

function rangeStart(r: Range): number {
  const now = Date.now();
  if (r === '30d') return now - 30 * DAY;
  if (r === '90d') return now - 90 * DAY;
  if (r === '12m') return now - 365 * DAY;
  return 0;
}

function Panel({ title, subtitle, children, action, className }: { title: string; subtitle?: string; children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-2xl border border-line bg-panel p-5 shadow-card', className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[14.5px] font-semibold tracking-tight">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-[12.5px] text-muted">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function StatTile({ label, value, delta, hint }: { label: string; value: string; delta?: { value: number; vs: string }; hint?: string }) {
  const up = (delta?.value ?? 0) >= 0;
  return (
    <div className="rounded-2xl border border-line bg-panel p-4 shadow-card">
      <div className="text-[12.5px] text-muted">{label}</div>
      <div className="mt-1.5 text-[26px] leading-none font-semibold tracking-tight">{value}</div>
      {delta && delta.value === 0 ? (
        <div className="mt-2 text-[12px] text-muted">Same as last week</div>
      ) : delta ? (
        <div className="mt-2 flex items-center gap-1 text-[12px] text-muted">
          <span className={cn('inline-flex items-center font-medium', up ? 'text-good' : 'text-fg-2')}>
            {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {up ? '+' : ''}
            {fmtNumber(delta.value)}
          </span>
          {delta.vs}
        </div>
      ) : hint ? (
        <div className="mt-2 truncate text-[12px] text-muted">{hint}</div>
      ) : null}
    </div>
  );
}

/** Horizontal bar list: one hue (identity is carried by the text label). */
function BarList({ rows, onSelect, max }: { rows: Array<{ key: string; label: ReactNode; value: number; title: string }>; onSelect?: (key: string) => void; max?: number }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.key}>
          <button
            type="button"
            onClick={() => onSelect?.(r.key)}
            disabled={!onSelect}
            title={`${r.title}: ${fmtNumber(r.value)}`}
            className="group grid w-full grid-cols-[minmax(0,180px)_1fr_auto] items-center gap-3 rounded-lg px-1.5 py-1 text-left hover:bg-panel-2 disabled:cursor-default disabled:hover:bg-transparent"
          >
            <span className="flex min-w-0 items-center gap-2 truncate text-[13px] text-fg-2">{r.label}</span>
            <span className="relative h-3.5">
              <span
                className="absolute inset-y-0 left-0 rounded-r-[4px] bg-accent transition-[filter] group-hover:brightness-110"
                style={{ width: `${Math.max(1.5, (r.value / top) * 100)}%`, opacity: 0.9 }}
              />
            </span>
            <span className="w-12 text-right text-[12.5px] font-medium text-fg tabular-nums">{fmtNumber(r.value)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

interface Bucket {
  key: string;
  label: string;
  full: string;
  count: number;
}

function buildTimeline(list: Bookmark[], range: Range): { buckets: Bucket[]; unit: 'week' | 'month' } {
  if (!list.length) return { buckets: [], unit: 'week' };
  const minSaved = Math.min(...list.map((b) => b.savedAt));
  const start = range === 'all' ? minSaved : rangeStart(range);
  const unit: 'week' | 'month' = range === '30d' || range === '90d' || Date.now() - start < 120 * DAY ? 'week' : 'month';
  const buckets: Bucket[] = [];
  const index = new Map<string, Bucket>();
  if (unit === 'week') {
    for (let d = startOfWeek(start, { weekStartsOn: 1 }); d.getTime() <= Date.now(); d = addDays(d, 7)) {
      const b: Bucket = { key: format(d, 'yyyy-MM-dd'), label: format(d, 'MMM d'), full: `Week of ${format(d, 'MMM d, yyyy')}`, count: 0 };
      buckets.push(b);
      index.set(b.key, b);
    }
    for (const x of list) {
      const b = index.get(format(startOfWeek(x.savedAt, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
      if (b) b.count++;
    }
  } else {
    for (let d = startOfMonth(start); d.getTime() <= Date.now(); d = addMonths(d, 1)) {
      const b: Bucket = { key: format(d, 'yyyy-MM'), label: format(d, "MMM ''yy"), full: format(d, 'MMMM yyyy'), count: 0 };
      buckets.push(b);
      index.set(b.key, b);
    }
    for (const x of list) {
      const b = index.get(format(x.savedAt, 'yyyy-MM'));
      if (b) b.count++;
    }
  }
  return { buckets, unit };
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const LEVELS = [0, 18, 36, 58, 80, 100];

function Heatmap({ list }: { list: Bookmark[] }) {
  const [hover, setHover] = useState<{ d: number; h: number } | null>(null);
  const grid = useMemo(() => {
    const g = Array.from({ length: 7 }, () => new Array(24).fill(0) as number[]);
    for (const b of list) {
      const dt = new Date(b.savedAt);
      g[(dt.getDay() + 6) % 7]![dt.getHours()]!++;
    }
    return g;
  }, [list]);
  const max = Math.max(1, ...grid.flat());
  const level = (v: number) => (v === 0 ? 0 : Math.min(5, 1 + Math.floor((v / max) * 4.999)));
  const cellColor = (lvl: number) => (lvl === 0 ? 'var(--panel-2)' : `color-mix(in oklab, var(--accent) ${LEVELS[lvl]}%, var(--panel-2))`);
  const peak = useMemo(() => {
    let best = { d: 0, h: 0, v: -1 };
    grid.forEach((row, d) => row.forEach((v, h) => v > best.v && (best = { d, h, v })));
    return best;
  }, [grid]);
  const hourLabel = (h: number) => format(new Date(2020, 0, 1, h), 'ha').toLowerCase();

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="inline-grid min-w-full grid-cols-[36px_repeat(24,minmax(14px,1fr))] gap-[3px]" role="grid" aria-label="Saves by day of week and hour">
          <span />
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} className="pb-1 text-center text-[10px] text-faint">
              {h % 6 === 0 ? hourLabel(h) : ''}
            </span>
          ))}
          {grid.map((row, d) => (
            <div key={d} className="contents" role="row">
              <span className="pr-1 text-[11px] leading-[18px] text-muted">{DAYS[d]}</span>
              {row.map((v, h) => (
                <span
                  key={h}
                  role="gridcell"
                  tabIndex={-1}
                  aria-label={`${DAYS[d]} ${hourLabel(h)}: ${v} saved`}
                  onPointerEnter={() => setHover({ d, h })}
                  onPointerLeave={() => setHover(null)}
                  className={cn('h-[18px] rounded-[4px] transition-transform', hover?.d === d && hover?.h === h && 'scale-110 ring-2 ring-fg/30')}
                  style={{ background: cellColor(level(v)) }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted">
        <span className="min-h-[18px]">
          {hover ? (
            <>
              <b className="font-semibold text-fg">{fmtNumber(grid[hover.d]![hover.h]!)} saved</b> · {DAYS[hover.d]} {hourLabel(hover.h)}–{hourLabel((hover.h + 1) % 24)}
            </>
          ) : peak.v > 0 ? (
            <>
              You save most on <b className="font-semibold text-fg">{DAYS[peak.d]}s around {hourLabel(peak.h)}</b>
            </>
          ) : null}
        </span>
        <span className="flex items-center gap-1.5">
          Less
          {[0, 1, 2, 3, 4, 5].map((l) => (
            <span key={l} className="size-3 rounded-[3px]" style={{ background: cellColor(l) }} />
          ))}
          More
        </span>
      </div>
    </div>
  );
}

export function InsightsView() {
  const lib = useLibrary();
  const [range, setRange] = useState<Range>('12m');
  const [showTable, setShowTable] = useState(false);

  const list = useMemo(() => {
    const start = rangeStart(range);
    return lib.bookmarks.filter((b) => b.savedAt >= start);
  }, [lib.bookmarks, range]);

  const { buckets, unit } = useMemo(() => buildTimeline(list, range), [list, range]);

  const stats = useMemo(() => {
    const now = Date.now();
    const thisWeek = lib.bookmarks.filter((b) => b.savedAt >= now - 7 * DAY).length;
    const lastWeek = lib.bookmarks.filter((b) => b.savedAt >= now - 14 * DAY && b.savedAt < now - 7 * DAY).length;
    const weeks = Math.max(1, buckets.length * (unit === 'month' ? 4.345 : 1));
    const categories = new Map<string, number>();
    const authors = new Map<string, { name: string; avatar: string; handle: string; count: number }>();
    const facets = new Map<Facet, number>();
    for (const b of list) {
      categories.set(b.category, (categories.get(b.category) ?? 0) + 1);
      const a = authors.get(b.author.handle) ?? { name: b.author.name, avatar: b.author.avatar, handle: b.author.handle, count: 0 };
      a.count++;
      authors.set(b.author.handle, a);
      for (const f of b.facets) facets.set(f, (facets.get(f) ?? 0) + 1);
    }
    const textOnly = list.filter((b) => !b.media.length && !b.links.length && !b.card && !b.quoted).length;
    return {
      thisWeek,
      lastWeek,
      perWeek: list.length / weeks,
      categories: [...categories.entries()].sort((a, b) => b[1] - a[1]),
      authors: [...authors.values()].sort((a, b) => b.count - a.count).slice(0, 8),
      facets: [...facets.entries()].filter(([f]) => f !== 'media' && f !== 'reply').sort((a, b) => b[1] - a[1]),
      textOnly,
      read: list.filter((b) => b.read).length,
      popular: [...list].sort((a, b) => b.metrics.likes - a.metrics.likes).slice(0, 5),
    };
  }, [list, lib.bookmarks, buckets.length, unit]);

  usePaintMark('route:insights:painted', !lib.loading && !lib.partial);

  if (lib.loading || lib.partial) {
    return (
      <div className="mx-auto w-full max-w-[1240px] px-5 pt-6 pb-16 sm:px-8">
        <div className="skeleton h-8 w-40 rounded-lg" />
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-[92px] rounded-2xl" />
          ))}
        </div>
        <div className="skeleton mt-4 h-[300px] rounded-2xl" />
      </div>
    );
  }

  if (!lib.counts.total) {
    return (
      <EmptyState icon={<ChartColumn />} title="No insights yet">
        Sync your bookmarks to see what you save, who you learn from and when.
      </EmptyState>
    );
  }

  const topCat = stats.categories[0] ? lib.categoryMap.get(stats.categories[0][0]) : undefined;
  const readPct = list.length ? Math.round((stats.read / list.length) * 100) : 0;

  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 pt-6 pb-16 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Insights</h1>
          <p className="mt-0.5 text-[13.5px] text-muted">What you save, who you learn from, and when.</p>
        </div>
        <div className="flex rounded-xl border border-line-strong bg-panel p-0.5" role="radiogroup" aria-label="Time range">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              role="radio"
              aria-checked={range === r.id}
              onClick={() => setRange(r.id)}
              className={cn('inline-flex h-8 items-center gap-1 rounded-[9px] px-3 text-[12.5px] font-medium transition-colors', range === r.id ? 'bg-panel-2 text-fg shadow-card' : 'text-muted hover:text-fg')}
            >
              {range === r.id ? <Check className="size-3.5" strokeWidth={3} /> : null}
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Saved in this period" value={fmtNumber(list.length)} hint={`${fmtNumber(lib.counts.total)} in your library`} />
        <StatTile label="Saved this week" value={fmtNumber(stats.thisWeek)} delta={{ value: stats.thisWeek - stats.lastWeek, vs: 'vs last week' }} />
        <StatTile label="Average per week" value={stats.perWeek >= 10 ? fmtCompact(Math.round(stats.perWeek)) : stats.perWeek.toFixed(1)} hint={`${readPct}% of these opened`} />
        <StatTile label="Top category" value={topCat ? `${topCat.emoji} ${topCat.name}` : '—'} hint={stats.categories[0] ? `${fmtNumber(stats.categories[0][1])} posts` : undefined} />
      </div>

      <Panel
        className="mt-4"
        title="Saved over time"
        subtitle={`Posts saved per ${unit}`}
        action={
          <button
            type="button"
            onClick={() => setShowTable((x) => !x)}
            aria-pressed={showTable}
            className={cn('inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium', showTable ? 'bg-panel-2 text-fg' : 'text-muted hover:bg-panel-2 hover:text-fg')}
          >
            <Table2 className="size-3.5" /> Table
          </button>
        }
      >
        {showTable ? (
          <div className="max-h-[260px] overflow-y-auto rounded-xl border border-line">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 bg-panel-2 text-left text-[11.5px] text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">{unit === 'week' ? 'Week' : 'Month'}</th>
                  <th className="px-3 py-2 text-right font-medium">Saved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[...buckets].reverse().map((b) => (
                  <tr key={b.key}>
                    <td className="px-3 py-1.5 text-fg-2">{b.full}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmtNumber(b.count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ColumnChart data={buckets.map((b) => ({ key: b.key, label: b.label, full: b.full, value: b.count }))} height={240} />
        )}
      </Panel>

      <div className="cv-auto mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Category mix" subtitle="Click a category to open it">
          <BarList
            rows={stats.categories.slice(0, 10).map(([id, n]) => {
              const c = lib.categoryMap.get(id);
              return { key: id, value: n, title: c?.name ?? id, label: <><span aria-hidden>{c?.emoji}</span><span className="truncate">{c?.name ?? id}</span></> };
            })}
            onSelect={(id) => navigate(scopeHash({ kind: 'category', value: id }))}
          />
        </Panel>
        <Panel title="Who you learn from" subtitle="Authors you save most">
          <BarList
            rows={stats.authors.map((a) => ({
              key: a.handle,
              value: a.count,
              title: `@${a.handle}`,
              label: (
                <>
                  <Avatar src={a.avatar} name={a.name} handle={a.handle} size={20} />
                  <span className="truncate">{a.name || a.handle}</span>
                </>
              ),
            }))}
            onSelect={(h) => navigate(scopeHash({ kind: 'author', value: h }))}
          />
        </Panel>
      </div>

      <div className="cv-auto mt-4 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <Panel title="When you save" subtitle="Saves by day of week and hour (your local time)">
          <Heatmap list={list} />
        </Panel>
        <Panel title="What you save" subtitle="Posts containing each type">
          <BarList
            max={list.length}
            rows={[
              ...stats.facets.map(([f, n]) => ({ key: f, value: n, title: FACET_LABELS[f], label: <span>{FACET_LABELS[f]}</span> })),
              { key: 'text', value: stats.textOnly, title: 'Text only', label: <span>Text only</span> },
            ]}
            onSelect={(k) => k !== 'text' && navigate(scopeHash({ kind: 'facet', value: k }))}
          />
        </Panel>
      </div>

      {stats.popular.length ? (
        <Panel className="cv-auto mt-4" title="Most popular posts you saved" subtitle="By likes on X">
          <ol className="divide-y divide-line">
            {stats.popular.map((b, i) => (
              <li key={b.id}>
                <a href={b.url} target="_blank" rel="noreferrer noopener" className="flex items-center gap-3 py-2.5 hover:opacity-90">
                  <span className="w-5 text-center text-[13px] font-semibold text-faint tabular-nums">{i + 1}</span>
                  <Avatar src={b.author.avatar} name={b.author.name} handle={b.author.handle} size={30} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] text-fg">{b.text || b.card?.title || 'Media post'}</div>
                    <div className="text-[12px] text-muted">@{b.author.handle}</div>
                  </div>
                  <span className="text-[12.5px] font-medium text-fg-2 tabular-nums">♥ {fmtCompact(b.metrics.likes)}</span>
                </a>
              </li>
            ))}
          </ol>
        </Panel>
      ) : null}
    </div>
  );
}
