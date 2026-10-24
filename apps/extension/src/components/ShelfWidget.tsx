/**
 * Shelf building blocks shared by the Shelf screen and the Home widget:
 * type glyphs, the non-blocking `useShelf` hook and "New on your shelf".
 */
import { ArrowRight, BookOpen, Briefcase, Database, FileText, FolderGit2, GraduationCap, Link2, MonitorPlay, Newspaper, Podcast, ScrollText, Wrench, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { fmtNumber, fmtShortDate } from '@/lib/format';
import { perfStat } from '@/lib/perf';
import { peekShelf, prepareShelf, RESOURCE_META, RESOURCE_TYPES, type ResourceType, type Shelf } from '@/lib/resources';
import type { Bookmark } from '@/lib/types';
import { useLibrary } from '@/hooks/library';
import { navigate } from '@/hooks/route';
import { Button, cn } from './ui/primitives';

export const TYPE_ICON: Record<ResourceType, LucideIcon> = {
  repo: FolderGit2,
  paper: ScrollText,
  video: MonitorPlay,
  article: Newspaper,
  tool: Wrench,
  book: BookOpen,
  course: GraduationCap,
  podcast: Podcast,
  docs: FileText,
  dataset: Database,
  job: Briefcase,
  other: Link2,
};

/** Text color for a type label, tuned against the theme foreground. */
export const typeInk = (t: ResourceType) => `color-mix(in oklab, ${RESOURCE_META[t].color} 74%, var(--fg))`;
/** Soft background wash for a type. */
export const typeWash = (t: ResourceType, pct = 14) => `color-mix(in oklab, ${RESOURCE_META[t].color} ${pct}%, var(--panel))`;

export function TypeGlyph({ type, size = 32, className }: { type: ResourceType; size?: number; className?: string }) {
  const Icon = TYPE_ICON[type];
  const c = RESOURCE_META[type].color;
  const style: CSSProperties = {
    width: size,
    height: size,
    background: typeWash(type),
    color: typeInk(type),
    boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${c} 22%, transparent)`,
  };
  return (
    <span aria-hidden className={cn('grid shrink-0 place-items-center rounded-[10px]', className)} style={style}>
      <Icon style={{ width: Math.round(size * 0.5), height: Math.round(size * 0.5) }} strokeWidth={2} />
    </span>
  );
}

/**
 * The shelf for the current library. Built off the critical path in small
 * slices; while a rebuild is in flight the previous shelf stays on screen.
 * Returns null until the first build finishes (or while `ready` is false).
 */
export function useShelf(bookmarks: readonly Bookmark[], ready: boolean): Shelf | null {
  const [shelf, setShelf] = useState<Shelf | null>(() => (ready ? peekShelf(bookmarks) : null));
  useEffect(() => {
    if (!ready) return;
    const cached = peekShelf(bookmarks);
    if (cached) {
      setShelf(cached);
      return;
    }
    const ctrl = new AbortController();
    prepareShelf(bookmarks, { signal: ctrl.signal })
      .then((s) => {
        if (ctrl.signal.aborted) return;
        perfStat('shelf:extract', s.ms);
        setShelf(s);
      })
      .catch(() => undefined);
    return () => ctrl.abort();
  }, [bookmarks, ready]);
  return ready ? shelf : null;
}

/** "New on your shelf": the latest resources to appear in saved posts (Home). */
export function ShelfWidget({ limit = 5, className }: { limit?: number; className?: string }) {
  const lib = useLibrary();
  const shelf = useShelf(lib.bookmarks, !lib.loading && !lib.partial);

  const latest = useMemo(() => (shelf ? [...shelf.resources].sort((a, b) => b.firstSavedAt - a.firstSavedAt).slice(0, limit) : []), [shelf, limit]);
  const topTypes = useMemo(
    () =>
      shelf
        ? RESOURCE_TYPES.filter((t) => t !== 'other' && shelf.counts[t] > 0)
            .sort((a, b) => shelf.counts[b] - shelf.counts[a])
            .slice(0, 4)
        : [],
    [shelf],
  );

  if (shelf && !shelf.total) return null;

  return (
    <section className={className} aria-labelledby="shelf-widget-title">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id="shelf-widget-title" className="text-[20px] font-semibold tracking-[-0.03em]">
            New on your shelf
          </h2>
          <p className="mt-0.5 text-[13px] text-muted">Repos, papers and tools pulled from your latest saves.</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => navigate('#/shelf')}>
          Open shelf <ArrowRight />
        </Button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-line bg-panel shadow-card">
        {!shelf ? (
          <div className="divide-y divide-line" aria-busy="true" aria-label="Loading shelf">
            {Array.from({ length: limit }, (_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="skeleton size-8 rounded-[10px]" />
                <div className="flex-1 space-y-1.5">
                  <div className="skeleton h-3 w-3/4 rounded" />
                  <div className="skeleton h-2.5 w-1/3 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {latest.map((r) => (
              <li key={r.key}>
                <a href={r.url} target="_blank" rel="noreferrer noopener" className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-panel-2/60 focus-visible:bg-panel-2/60 focus-visible:outline-none">
                  <TypeGlyph type={r.type} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-medium text-fg">{r.title}</div>
                    <div className="truncate text-[12px] text-muted">
                      <span style={{ color: typeInk(r.type) }}>{r.kind}</span> · {r.domain}
                    </div>
                  </div>
                  <span className="shrink-0 text-[12px] text-faint tabular-nums">{fmtShortDate(r.firstSavedAt)}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
        {shelf && topTypes.length ? (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-line bg-panel-2/40 px-3 py-2.5">
            {topTypes.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => navigate(`#/shelf/${RESOURCE_META[t].slug}`)}
                className="inline-flex h-7 items-center gap-1.5 rounded-full border border-line bg-panel px-2.5 text-[12px] text-fg-2 transition-colors hover:border-line-strong hover:text-fg"
              >
                <TypeGlyph type={t} size={16} className="rounded-[5px]" />
                {RESOURCE_META[t].label}
                <span className="text-faint tabular-nums">{fmtNumber(shelf.counts[t])}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
