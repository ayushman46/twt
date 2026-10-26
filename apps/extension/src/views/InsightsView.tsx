import { addDays, addMonths, startOfMonth, startOfWeek } from 'date-fns';
import { ArrowDownRight, ArrowUpRight, ChartColumn, Heart, Table2 } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { ColumnChart } from '@/components/ColumnChart';
import { CategoryGlyph } from '@/components/CategoryGlyph';
import { catName, getLocale, rich, t, useLocale, useT, type MessageKey } from '@/i18n';
import { usePaintMark } from '@/lib/perf';
import { fmtCompact, fmtDate, fmtMonthDay, fmtNumber } from '@/lib/format';
import type { Bookmark, Facet } from '@/lib/types';
import { useLibrary } from '@/hooks/library';
import { navigate, scopeHash } from '@/hooks/route';
import { Avatar } from '@/components/Brand';
import { EmptyState, cn } from '@/components/ui/primitives';

type Range = '30d' | '90d' | '12m' | 'all';
const RANGES: Array<{ id: Range; label: MessageKey }> = [
  { id: '30d', label: 'insights.range.30d' },
  { id: '90d', label: 'insights.range.90d' },
  { id: '12m', label: 'insights.range.12m' },
  { id: 'all', label: 'insights.range.all' },
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
    <section className={cn('rounded-xl border border-line bg-panel p-5', className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-[12.5px] text-muted">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function StatTile({ label, value, delta, hint }: { label: string; value: ReactNode; delta?: { value: number; vs: string }; hint?: string }) {
  const up = (delta?.value ?? 0) >= 0;
  return (
    <div className="min-w-0 rounded-xl border border-line bg-panel p-4">
      <div className="text-[12.5px] text-muted">{label}</div>
      <div className="mt-2 text-[26px] leading-none font-semibold tracking-tight tabular-nums">{value}</div>
      {delta && delta.value === 0 ? (
        <div className="mt-2 text-[12px] text-muted">{t('home.sameAsLastWeek')}</div>
      ) : delta ? (
        <div className="mt-2 flex items-center gap-1 text-[12px] text-muted">
          <span className={cn('inline-flex items-center font-medium tabular-nums', up ? 'text-good' : 'text-fg-2')}>
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

/** Horizontal bar list. Neutral bars: the value label carries the number, the bar carries the rank. */
function BarList({ rows, onSelect, max }: { rows: Array<{ key: string; label: ReactNode; value: number; title: string }>; onSelect?: (key: string) => void; max?: number }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-1">
      {rows.map((r) => (
        <li key={r.key}>
          <button
            type="button"
            onClick={() => onSelect?.(r.key)}
            disabled={!onSelect}
            title={`${r.title}: ${fmtNumber(r.value)}`}
            className="group grid w-full grid-cols-[minmax(0,180px)_1fr_auto] items-center gap-3 rounded-lg px-1.5 py-1.5 text-left hover:bg-panel-2 disabled:cursor-default disabled:hover:bg-transparent"
          >
            <span className="flex min-w-0 items-center gap-2 text-[13px] text-fg-2">{r.label}</span>
            <span className="relative h-2 rounded-full bg-panel-2">
              <span className="absolute inset-y-0 left-0 rounded-full bg-fg/25 transition-colors group-hover:bg-fg/40" style={{ width: `${Math.max(1.5, (r.value / top) * 100)}%` }} />
            </span>
            <span className="w-12 text-right text-[12.5px] font-medium text-fg tabular-nums">{fmtNumber(r.value)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ym = (d: Date | number) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}`;
};
/** "Oct '26" / "अक्तू॰ '26" */
const monthShortYear = (d: Date) => `${fmtDate(d, { month: 'short' })} '${String(d.getFullYear()).slice(2)}`;

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
      const b: Bucket = { key: ymd(d), label: fmtMonthDay(d), full: t('insights.weekOf', { date: fmtDate(d, { month: 'short', day: 'numeric', year: 'numeric' }) }), count: 0 };
      buckets.push(b);
      index.set(b.key, b);
    }
    for (const x of list) {
      const b = index.get(ymd(startOfWeek(x.savedAt, { weekStartsOn: 1 })));
      if (b) b.count++;
    }
  } else {
    for (let d = startOfMonth(start); d.getTime() <= Date.now(); d = addMonths(d, 1)) {
      const b: Bucket = { key: ym(d), label: monthShortYear(d), full: fmtDate(d, { month: 'long', year: 'numeric' }), count: 0 };
      buckets.push(b);
      index.set(b.key, b);
    }
    for (const x of list) {
      const b = index.get(ym(x.savedAt));
      if (b) b.count++;
    }
  }
  return { buckets, unit };
}

/** Monday-first weekday names in the active language (2024-01-01 was a Monday). */
const weekdays = (weekday: 'short' | 'long') => Array.from({ length: 7 }, (_, i) => fmtDate(new Date(2024, 0, 1 + i), { weekday }));
const LEVELS = [0, 18, 36, 58, 80, 100];

function Heatmap({ list }: { list: Bookmark[] }) {
  const locale = useLocale();
  const DAYS = useMemo(() => weekdays('short'), [locale]); // eslint-disable-line react-hooks/exhaustive-deps
  const LONG_DAYS = useMemo(() => weekdays('long'), [locale]); // eslint-disable-line react-hooks/exhaustive-deps
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
  const hourLabel = (h: number) => {
    const s = fmtDate(new Date(2020, 0, 1, h), { hour: 'numeric' });
    return getLocale() === 'en' ? s.toLowerCase().replace(/\s/g, '') : s;
  };

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="inline-grid min-w-full grid-cols-[36px_repeat(24,minmax(14px,1fr))] gap-[3px]" role="grid" aria-label={t('insights.heatmapAria')}>
          <span />
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} className="pb-1 text-center text-[10px] text-muted">
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
                  aria-label={`${DAYS[d]} ${hourLabel(h)}: ${t('chart.saved', { count: v })}`}
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
              <b className="font-semibold text-fg tabular-nums">{t('chart.saved', { count: fmtNumber(grid[hover.d]![hover.h]!) })}</b> · {DAYS[hover.d]} {hourLabel(hover.h)}–{hourLabel((hover.h + 1) % 24)}
            </>
          ) : peak.v > 0 ? (
            rich(t('insights.peak', { day: LONG_DAYS[peak.d], hour: hourLabel(peak.h) }), { b: (s) => <b className="font-semibold text-fg">{s}</b> })
          ) : null}
        </span>
        <span className="flex items-center gap-1.5">
          {t('insights.less')}
          {[0, 1, 2, 3, 4, 5].map((l) => (
            <span key={l} className="size-3 rounded-[3px]" style={{ background: cellColor(l) }} />
          ))}
          {t('insights.more')}
        </span>
      </div>
    </div>
  );
}

export function InsightsView() {
  const locale = useLocale();
  useT();
  const lib = useLibrary();
  const [range, setRange] = useState<Range>('12m');
  const [showTable, setShowTable] = useState(false);

  const list = useMemo(() => {
    const start = rangeStart(range);
    return lib.bookmarks.filter((b) => b.savedAt >= start);
  }, [lib.bookmarks, range]);

  const { buckets, unit } = useMemo(() => buildTimeline(list, range), [list, range, locale]); // eslint-disable-line react-hooks/exhaustive-deps

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
            <div key={i} className="skeleton h-[92px] rounded-xl" />
          ))}
        </div>
        <div className="skeleton mt-4 h-[300px] rounded-xl" />
      </div>
    );
  }

  if (!lib.counts.total) {
    return (
      <EmptyState icon={<ChartColumn />} title={t('insights.empty')}>
        {t('insights.emptyBody')}
      </EmptyState>
    );
  }

  const topCat = stats.categories[0] ? lib.categoryMap.get(stats.categories[0][0]) : undefined;
  const readPct = list.length ? Math.round((stats.read / list.length) * 100) : 0;

  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 pt-6 pb-16 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.02em]">{t('nav.insights')}</h1>
          <p className="mt-1 text-[13.5px] text-muted">{t('insights.subtitle')}</p>
        </div>
        <div className="inline-flex max-w-full overflow-x-auto rounded-lg border border-line-strong bg-panel p-0.5 [scrollbar-width:none]" role="radiogroup" aria-label={t('insights.timeRange')}>
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              role="radio"
              aria-checked={range === r.id}
              onClick={() => setRange(r.id)}
              className={cn('inline-flex h-7 shrink-0 items-center rounded-md px-3 text-[12.5px] font-medium whitespace-nowrap transition-colors', range === r.id ? 'bg-panel-3 text-fg' : 'text-muted hover:text-fg')}
            >
              {t(r.label)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={t('insights.savedInPeriod')} value={fmtNumber(list.length)} hint={t('insights.inLibrary', { count: fmtNumber(lib.counts.total) })} />
        <StatTile label={t('home.savedThisWeek')} value={fmtNumber(stats.thisWeek)} delta={{ value: stats.thisWeek - stats.lastWeek, vs: t('insights.vsLastWeek') }} />
        <StatTile label={t('insights.avgPerWeek')} value={stats.perWeek >= 10 ? fmtCompact(Math.round(stats.perWeek)) : stats.perWeek.toFixed(1)} hint={t('insights.opened', { pct: readPct })} />
        <StatTile
          label={t('home.topCategory')}
          value={
            topCat ? (
              <span className="flex min-w-0 items-center gap-2 text-[22px] leading-none">
                <CategoryGlyph category={topCat} className="size-4 text-muted" />
                <span className="truncate">{catName(topCat)}</span>
              </span>
            ) : (
              '—'
            )
          }
          hint={stats.categories[0] ? t('common.posts', { count: stats.categories[0][1] }) : undefined}
        />
      </div>

      <Panel
        className="mt-4"
        title={t('insights.overTime')}
        subtitle={unit === 'week' ? t('insights.perWeek') : t('insights.perMonth')}
        action={
          <button
            type="button"
            onClick={() => setShowTable((x) => !x)}
            aria-pressed={showTable}
            className={cn('inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium transition-colors', showTable ? 'bg-panel-3 text-fg' : 'text-muted hover:text-fg')}
          >
            <Table2 className="size-3.5" /> {t('insights.table')}
          </button>
        }
      >
        {showTable ? (
          <div className="max-h-[260px] overflow-y-auto rounded-lg border border-line">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 bg-panel-2 text-left text-[12px] text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">{unit === 'week' ? t('insights.week') : t('insights.month')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('layout.saved')}</th>
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
        <Panel title={t('insights.categoryMix')} subtitle={t('insights.categoryMixSub')}>
          <BarList
            rows={stats.categories.slice(0, 10).map(([id, n]) => {
              const c = lib.categoryMap.get(id);
              const name = c ? catName(c) : id;
              return {
                key: id,
                value: n,
                title: name,
                label: (
                  <>
                    {c ? <CategoryGlyph category={c} className="size-3.5 text-muted" /> : null}
                    <span className="truncate">{name}</span>
                  </>
                ),
              };
            })}
            onSelect={(id) => navigate(scopeHash({ kind: 'category', value: id }))}
          />
        </Panel>
        <Panel title={t('home.learnFrom')} subtitle={t('insights.authorsSub')}>
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
        <Panel title={t('insights.whenSave')} subtitle={t('insights.whenSaveSub')}>
          <Heatmap list={list} />
        </Panel>
        <Panel title={t('insights.whatSave')} subtitle={t('insights.whatSaveSub')}>
          <BarList
            max={list.length}
            rows={[
              ...stats.facets.map(([f, n]) => ({ key: f, value: n, title: t(`facet.${f}`), label: <span>{t(`facet.${f}`)}</span> })),
              { key: 'text', value: stats.textOnly, title: t('insights.textOnly'), label: <span>{t('insights.textOnly')}</span> },
            ]}
            onSelect={(k) => k !== 'text' && navigate(scopeHash({ kind: 'facet', value: k }))}
          />
        </Panel>
      </div>

      {stats.popular.length ? (
        <Panel className="cv-auto mt-4" title={t('insights.popular')} subtitle={t('insights.popularSub')}>
          <ol className="divide-y divide-line">
            {stats.popular.map((b, i) => (
              <li key={b.id}>
                <a href={b.url} target="_blank" rel="noreferrer noopener" className="flex items-center gap-3 py-3 hover:opacity-80">
                  <span className="w-5 text-center text-[12.5px] font-medium text-faint tabular-nums">{i + 1}</span>
                  <Avatar src={b.author.avatar} name={b.author.name} handle={b.author.handle} size={30} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] text-fg">{b.text || b.card?.title || t('common.mediaPost')}</div>
                    <div className="text-[12px] text-muted">@{b.author.handle}</div>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-fg-2 tabular-nums">
                    <Heart className="size-3.5 text-muted" aria-hidden />
                    {fmtCompact(b.metrics.likes)}
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </Panel>
      ) : null}
    </div>
  );
}
