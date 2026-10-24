import { format } from 'date-fns';
import { ArrowRight, ArrowUpDown, Copy, Download, ExternalLink, LayoutGrid, Library, List, Search, SearchX, X } from 'lucide-react';
import { memo, useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { fmtLongDate, fmtNumber, fmtShortDate, plural } from '@/lib/format';
import { usePaintMark } from '@/lib/perf';
import { filterResources, libraryQuery, RESOURCE_META, RESOURCE_TYPES, SHELF_SORT_LABELS, shelfToMarkdown, sortResources, typeFromSlug, type Resource, type ResourceType, type Sharer, type ShelfSort } from '@/lib/resources';
import type { Bookmark } from '@/lib/types';
import { useLibrary } from '@/hooks/library';
import { navigate, type Route } from '@/hooks/route';
import { useUi } from '@/store/ui';
import { Avatar } from '@/components/Brand';
import { copyText } from '@/components/BookmarkMenu';
import { DetailPanel } from '@/components/DetailPanel';
import { TypeGlyph, typeInk, typeWash, useShelf } from '@/components/ShelfWidget';
import { SyncButton } from '@/components/SyncControl';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger, Popover, PopoverContent, PopoverTrigger, Tip } from '@/components/ui/overlays';
import { Button, EmptyState, Eyebrow, Input, Kbd, cn } from '@/components/ui/primitives';

type Filter = ResourceType | 'all';
type ShelfLayout = 'grid' | 'list';

const DAY = 86_400_000;
const GRID_ROW = 214;
const LIST_ROW = 66;
const SORTS: ShelfSort[] = ['shared', 'recent', 'az'];

/* ---------- small persistence helpers (per-viewer conveniences) ---------- */

function readPref<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

function downloadText(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const filterHash = (f: Filter) => (f === 'all' ? '#/shelf' : `#/shelf/${RESOURCE_META[f].slug}`);

/* ---------- windowed rows (fixed height, window scroll) ---------- */

function VirtualRows<T>({
  items,
  getKey,
  render,
  minColWidth,
  maxCols,
  rowHeight,
  gap,
  label,
}: {
  items: readonly T[];
  getKey: (item: T) => string;
  render: (item: T, index: number) => ReactNode;
  minColWidth: number;
  maxCols: number;
  rowHeight: number;
  gap: number;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [view, setView] = useState({ top: 0, bottom: typeof window !== 'undefined' ? window.innerHeight : 900 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cols = width ? Math.max(1, Math.min(maxCols, Math.floor((width + gap) / (minColWidth + gap)))) : 1;
  const rows = Math.ceil(items.length / cols);
  const stride = rowHeight + gap;
  const total = rows ? rows * stride - gap : 0;

  useEffect(() => {
    let raf = 0;
    const read = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const top = -el.getBoundingClientRect().top;
      const bottom = top + window.innerHeight;
      setView((v) => (Math.abs(v.top - top) < stride / 2 && Math.abs(v.bottom - bottom) < stride / 2 ? v : { top, bottom }));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [stride, total]);

  const overscan = Math.max(600, stride * 3);
  const first = Math.max(0, Math.floor((view.top - overscan) / stride));
  const last = Math.min(rows - 1, Math.floor((view.bottom + overscan) / stride));
  const out: ReactNode[] = [];
  if (width) {
    for (let r = first; r <= last; r++) {
      const cells: ReactNode[] = [];
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const item = items[i];
        if (item === undefined) break;
        cells.push(
          <div key={getKey(item)} role="listitem" aria-setsize={items.length} aria-posinset={i + 1} className="min-w-0">
            {render(item, i)}
          </div>,
        );
      }
      out.push(
        <div key={r} className="absolute inset-x-0 grid" style={{ top: r * stride, height: rowHeight, gap, gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {cells}
        </div>,
      );
    }
  }
  return (
    <div ref={ref} role="list" aria-label={label} className="relative" style={{ height: total }}>
      {out}
    </div>
  );
}

/* ---------- pieces ---------- */

function Faces({ sharers, size = 20 }: { sharers: Sharer[]; size?: number }) {
  if (!sharers.length) return null;
  const names = sharers.slice(0, 8).map((s) => `@${s.handle}`).join(', ') + (sharers.length > 8 ? ` +${sharers.length - 8} more` : '');
  return (
    <span className="flex shrink-0 -space-x-1.5" title={`Shared by ${names}`}>
      {sharers.slice(0, 3).map((s) => (
        <Avatar key={s.handle} src={s.avatar} name={s.name} handle={s.handle} size={size} className="ring-2 ring-panel" />
      ))}
    </span>
  );
}

function Thumb({ src, className }: { src: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} className={cn('shrink-0 rounded-xl object-cover ring-1 ring-line', className)} />;
}

interface CardActions {
  onOpenPost: (r: Resource, id?: string) => void;
  onFind: (r: Resource) => void;
  onSite: (domain: string) => void;
}

function PostsList({ r, onPick, onFind }: { r: Resource; onPick: (id: string) => void; onFind: () => void }) {
  const lib = useLibrary();
  const posts = useMemo(() => r.postIds.slice(0, 50).map((id) => lib.byId.get(id)).filter((b): b is Bookmark => !!b), [r, lib.byId]);
  return (
    <PopoverContent align="start" className="w-[min(360px,calc(100vw-24px))] p-1.5" onKeyDown={(e) => e.stopPropagation()}>
      <div className="px-2.5 pt-1.5 pb-2 text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">Saved in {plural(r.count, 'post')}</div>
      <div className="max-h-[320px] overflow-y-auto">
        {posts.map((b) => (
          <button key={b.id} type="button" onClick={() => onPick(b.id)} className="flex w-full items-start gap-2.5 rounded-xl px-2 py-2 text-left outline-none hover:bg-panel-2 focus-visible:bg-panel-2">
            <Avatar src={b.author.avatar} name={b.author.name} handle={b.author.handle} size={26} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] text-muted">
                <span className="font-semibold text-fg">{b.author.name}</span> · saved {fmtShortDate(b.savedAt)}
              </span>
              <span className="mt-0.5 line-clamp-2 block text-[13px] leading-snug text-fg-2">{b.text || b.card?.title || b.article?.title || 'Media post'}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="mt-1 border-t border-line pt-1">
        <button type="button" onClick={onFind} className="flex h-9 w-full items-center gap-2 rounded-xl px-2.5 text-left text-[13px] font-medium text-accent outline-none hover:bg-panel-2 focus-visible:bg-panel-2">
          {r.count > posts.length ? `See all ${fmtNumber(r.count)} in Library` : 'Find these in Library'}
          <ArrowRight className="ml-auto size-4" />
        </button>
      </div>
    </PopoverContent>
  );
}

function PostsButton({ r, actions, className, compact }: { r: Resource; actions: CardActions; className?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const label = compact ? `×${fmtNumber(r.count)}` : `in ${plural(r.count, 'post')}`;
  const cls = cn('relative z-10 rounded-md font-medium text-fg-2 underline-offset-2 outline-none hover:text-fg hover:underline focus-visible:ring-2 focus-visible:ring-[var(--ring)]', className);
  if (r.count === 1) {
    return (
      <button type="button" className={cls} onClick={() => actions.onOpenPost(r, r.postIds[0])} aria-label={`Open the post that shared ${r.title}`}>
        {label}
      </button>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={cls} aria-label={`Show the ${r.count} posts that shared ${r.title}`}>
          {label}
        </button>
      </PopoverTrigger>
      {open ? (
        <PostsList
          r={r}
          onPick={(id) => {
            setOpen(false);
            actions.onOpenPost(r, id);
          }}
          onFind={() => {
            setOpen(false);
            actions.onFind(r);
          }}
        />
      ) : null}
    </Popover>
  );
}

function HoverActions({ r, className }: { r: Resource; className?: string }) {
  return (
    <div className={cn('relative z-10 flex items-center gap-0.5 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100', className)}>
      <Tip label="Copy link">
        <button type="button" onClick={() => void copyText(r.url)} aria-label={`Copy link to ${r.title}`} className="grid size-7 place-items-center rounded-lg text-muted outline-none hover:bg-panel-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
          <Copy className="size-3.5" />
        </button>
      </Tip>
      <Tip label="Open in new tab">
        <a href={r.url} target="_blank" rel="noreferrer noopener" aria-label={`Open ${r.title} in a new tab`} className="grid size-7 place-items-center rounded-lg text-muted outline-none hover:bg-panel-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
          <ExternalLink className="size-3.5" />
        </a>
      </Tip>
    </div>
  );
}

/** Stretched title link: the whole card opens the resource; inner controls sit above it (z-10). */
function TitleLink({ r, className }: { r: Resource; className?: string }) {
  return (
    <a href={r.url} target="_blank" rel="noreferrer noopener" title={r.title} className={cn('outline-none after:absolute after:inset-0 after:content-[""]', className)}>
      {r.title}
    </a>
  );
}

const ResourceCard = memo(function ResourceCard({ r, actions }: { r: Resource; actions: CardActions }) {
  return (
    <article
      className="group relative isolate flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-panel p-4 shadow-card transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-hover has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-[var(--ring)]"
      style={{ '--type': RESOURCE_META[r.type].color } as CSSProperties}
    >
      <span aria-hidden className="pointer-events-none absolute -top-16 -right-16 -z-10 size-40 rounded-full opacity-[0.14] blur-2xl transition-opacity duration-300 group-hover:opacity-30" style={{ background: 'var(--type)' }} />
      <div className="flex items-center gap-2.5">
        <TypeGlyph type={r.type} size={32} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="text-[12px] font-semibold" style={{ color: typeInk(r.type) }}>
            {r.kind}
          </div>
          <button type="button" onClick={() => actions.onSite(r.domain)} className="relative z-10 max-w-full truncate text-[12px] text-muted outline-none hover:text-fg hover:underline focus-visible:underline" title={`More from ${r.domain}`}>
            {r.domain}
          </button>
        </div>
        <HoverActions r={r} />
      </div>
      <div className="mt-3 flex min-h-0 flex-1 gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-[15px] leading-[1.35] font-semibold tracking-[-0.015em] text-fg">
            <TitleLink r={r} />
          </h3>
          {r.description ? <p className="mt-1 line-clamp-2 text-[12.5px] leading-[1.5] text-muted">{r.description}</p> : null}
        </div>
        {r.image ? <Thumb src={r.image} className="size-[60px]" /> : null}
      </div>
      <div className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-[12px] text-muted">
        <Faces sharers={r.sharers} />
        <PostsButton r={r} actions={actions} />
        <span aria-hidden className="text-faint">·</span>
        <time dateTime={new Date(r.lastSavedAt).toISOString()} title={`Last saved ${fmtLongDate(r.lastSavedAt)}`} className="truncate tabular-nums">
          {fmtShortDate(r.lastSavedAt)}
        </time>
      </div>
    </article>
  );
});

const ResourceRow = memo(function ResourceRow({ r, actions }: { r: Resource; actions: CardActions }) {
  return (
    <div className="group relative flex h-full items-center gap-3 rounded-xl border border-transparent px-2.5 transition-colors hover:border-line hover:bg-panel has-[a:focus-visible]:border-line has-[a:focus-visible]:bg-panel has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-[var(--ring)]">
      <TypeGlyph type={r.type} size={36} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold tracking-[-0.01em] text-fg">
          <TitleLink r={r} />
        </div>
        <div className="truncate text-[12.5px] text-muted">
          <span className="font-medium" style={{ color: typeInk(r.type) }}>
            {r.kind}
          </span>{' '}
          · {r.domain}
          {r.description ? <span className="hidden sm:inline"> — {r.description}</span> : null}
        </div>
      </div>
      <div className="hidden shrink-0 items-center gap-2 text-[12px] md:flex">
        <Faces sharers={r.sharers} />
        <PostsButton r={r} actions={actions} className="text-muted" />
      </div>
      <PostsButton r={r} actions={actions} compact className="shrink-0 rounded-full bg-panel-2 px-2 py-0.5 text-[11.5px] text-muted no-underline md:hidden" />
      <time dateTime={new Date(r.lastSavedAt).toISOString()} title={`Last saved ${fmtLongDate(r.lastSavedAt)}`} className="hidden w-14 shrink-0 text-right text-[12px] text-faint tabular-nums sm:block">
        {fmtShortDate(r.lastSavedAt)}
      </time>
      <HoverActions r={r} className="hidden sm:flex" />
    </div>
  );
});

function TypePill({ id, label, count, active, onSelect, onKeyDown, glyph }: { id: Filter; label: string; count: number; active: boolean; onSelect: () => void; onKeyDown: (e: ReactKeyboardEvent<HTMLButtonElement>) => void; glyph: ReactNode }) {
  const color = id === 'all' ? 'var(--accent)' : RESOURCE_META[id].color;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      tabIndex={active ? 0 : -1}
      data-filter={id}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-2 rounded-full border pr-3 pl-1.5 text-[13px] font-medium transition-[background,border-color,color,box-shadow] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
        active ? 'text-fg shadow-card' : 'border-line bg-panel text-fg-2 hover:border-line-strong hover:text-fg',
      )}
      style={active ? { background: id === 'all' ? 'var(--accent-soft)' : typeWash(id, 16), borderColor: `color-mix(in oklab, ${color} 45%, transparent)` } : undefined}
    >
      {glyph}
      {label}
      <span className="tabular-nums" style={{ color: active ? (id === 'all' ? 'var(--accent)' : typeInk(id)) : 'var(--faint)' }}>
        {fmtNumber(count)}
      </span>
    </button>
  );
}

function StatChip({ value, label, tone }: { value: string; label: string; tone?: 'good' }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-line bg-panel/80 px-2.5 text-[12.5px] text-muted shadow-card backdrop-blur">
      <span className={cn('font-semibold text-fg tabular-nums', tone === 'good' && 'text-good')}>{value}</span>
      {label}
    </span>
  );
}

function ShelfSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 pt-8 pb-16 sm:px-8" aria-busy="true" aria-label="Loading your shelf">
      <div className="skeleton h-3 w-20 rounded" />
      <div className="skeleton mt-3 h-9 w-56 rounded-lg" />
      <div className="skeleton mt-3 h-4 w-full max-w-[560px] rounded" />
      <div className="mt-5 flex gap-2 overflow-hidden">
        {[96, 120, 110, 104, 128, 96].map((w, i) => (
          <div key={i} className="skeleton h-7 shrink-0 rounded-full" style={{ width: w }} />
        ))}
      </div>
      <div className="mt-6 flex gap-2 overflow-hidden">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="skeleton h-9 w-28 shrink-0 rounded-full" />
        ))}
      </div>
      <div className="skeleton mt-4 h-11 rounded-[14px]" />
      <div className="mt-5 grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr))]">
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} className="flex h-[214px] flex-col rounded-2xl border border-line bg-panel p-4">
            <div className="flex items-center gap-2.5">
              <div className="skeleton size-8 rounded-[10px]" />
              <div className="flex-1 space-y-1.5">
                <div className="skeleton h-2.5 w-16 rounded" />
                <div className="skeleton h-2.5 w-24 rounded" />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="skeleton h-3.5 w-11/12 rounded" />
              <div className="skeleton h-3.5 w-2/3 rounded" />
              <div className="skeleton mt-3 h-3 w-full rounded" />
            </div>
            <div className="mt-auto flex items-center gap-2 border-t border-line pt-3">
              <div className="skeleton size-5 rounded-full" />
              <div className="skeleton h-3 w-24 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- screen ---------- */

export function ShelfView({ route }: { route: Route }) {
  const lib = useLibrary();
  const openDetail = useUi((s) => s.openDetail);
  const ready = !lib.loading && !lib.partial;
  const shelf = useShelf(lib.bookmarks, ready);

  const filter: Filter = typeFromSlug(route.section) ?? 'all';
  const [search, setSearch] = useState(route.q ?? '');
  const [sort, setSortState] = useState<ShelfSort>(() => readPref('twtdash.shelf.sort', SORTS, 'shared'));
  const [layout, setLayoutState] = useState<ShelfLayout>(() => readPref('twtdash.shelf.layout', ['grid', 'list'] as const, 'grid'));
  const [detailIds, setDetailIds] = useState<string[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const pillsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (route.q !== undefined) setSearch(route.q);
  }, [route.q]);

  const setSort = (s: ShelfSort) => {
    setSortState(s);
    writePref('twtdash.shelf.sort', s);
  };
  const setLayout = (l: ShelfLayout) => {
    setLayoutState(l);
    writePref('twtdash.shelf.layout', l);
  };

  const query = useDeferredValue(search.trim());
  const sorted = useMemo(() => (shelf ? sortResources(shelf.resources, sort) : []), [shelf, sort]);
  const matches = useMemo(() => (query ? filterResources(sorted, query) : sorted), [sorted, query]);
  const matchCounts = useMemo(() => {
    const m = new Map<ResourceType, number>();
    for (const r of matches) m.set(r.type, (m.get(r.type) ?? 0) + 1);
    return m;
  }, [matches]);
  const items = useMemo(() => (filter === 'all' ? matches : matches.filter((r) => r.type === filter)), [matches, filter]);

  const stats = useMemo(() => {
    if (!shelf) return null;
    const weekAgo = Date.now() - 7 * DAY;
    let multi = 0;
    let fresh = 0;
    for (const r of shelf.resources) {
      if (r.count > 1) multi++;
      if (r.firstSavedAt >= weekAgo) fresh++;
    }
    return { multi, fresh };
  }, [shelf]);

  const pills = useMemo<Filter[]>(() => {
    if (!shelf) return [];
    const present = RESOURCE_TYPES.filter((t) => shelf.counts[t] > 0 || t === filter);
    return ['all', ...present];
  }, [shelf, filter]);

  const detailItems = useMemo(() => detailIds.map((id) => lib.byId.get(id)).filter((b): b is Bookmark => !!b), [detailIds, lib.byId]);

  const actions = useMemo<CardActions>(
    () => ({
      onOpenPost: (r, id) => {
        setDetailIds(r.postIds);
        openDetail(id ?? r.postIds[0] ?? null);
      },
      onFind: (r) => navigate(`#/library/all?q=${encodeURIComponent(libraryQuery(r))}`),
      onSite: (domain) => {
        setSearch(`site:${domain}`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
    }),
    [openDetail],
  );

  // Keyboard: "/" focuses search; Esc closes the post panel; J/K step through its posts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const ui = useUi.getState();
      if (ui.paletteOpen || ui.shortcutsOpen) return;
      if (e.key === 'Escape' && ui.activeId) {
        ui.openDetail(null);
        return;
      }
      if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable], [role="dialog"] button')) return;
      if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (ui.activeId && (e.key === 'j' || e.key === 'k')) {
        const i = detailItems.findIndex((b) => b.id === ui.activeId);
        const next = detailItems[i + (e.key === 'j' ? 1 : -1)];
        if (next) {
          e.preventDefault();
          ui.openDetail(next.id);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detailItems]);

  const selectFilter = useCallback((f: Filter) => navigate(filterHash(f)), []);
  const onPillKey = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const i = pills.indexOf(filter);
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? pills.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + pills.length) % pills.length;
    const f = pills[next]!;
    selectFilter(f);
    requestAnimationFrame(() => pillsRef.current?.querySelector<HTMLButtonElement>(`[data-filter="${f}"]`)?.focus());
  };

  const exportList = (list: readonly Resource[], scope?: string, slug?: string) => {
    if (!list.length) return;
    downloadText(`twtdash-shelf${slug ? '-' + slug : ''}-${format(Date.now(), 'yyyy-MM-dd')}.md`, shelfToMarkdown(list, { scope }));
    toast.success(`Exported ${plural(list.length, 'resource')}`, { description: 'Markdown file, grouped by type.' });
  };

  const renderCard = useCallback((r: Resource) => <ResourceCard r={r} actions={actions} />, [actions]);
  const renderRow = useCallback((r: Resource) => <ResourceRow r={r} actions={actions} />, [actions]);

  usePaintMark('route:shelf:painted', !!shelf);

  if (!ready || (!shelf && lib.counts.total > 0)) return <ShelfSkeleton />;

  if (!lib.counts.total) {
    return (
      <EmptyState icon={<Library />} title="Your shelf is empty" action={<SyncButton hasData={false} size="lg" />}>
        Sync your X bookmarks and every repo, paper, video and tool they link to will be collected here — automatically, on this device.
      </EmptyState>
    );
  }

  const s = shelf!;
  const filtering = !!query || filter !== 'all';
  const filterLabel = filter === 'all' ? 'resources' : RESOURCE_META[filter].label.toLowerCase();
  const scopeText = [filter !== 'all' ? RESOURCE_META[filter].label : '', query ? `matching “${query}”` : ''].filter(Boolean).join(' ');

  return (
    <div className="relative">
      <div aria-hidden className="aurora pointer-events-none absolute inset-x-0 top-0 h-[380px] opacity-80" />
      <div aria-hidden className="dot-grid pointer-events-none absolute inset-x-0 top-0 h-[300px] [mask-image:linear-gradient(to_bottom,black,transparent)] opacity-30" />

      <div className="relative mx-auto w-full max-w-[1240px] px-5 pt-8 pb-16 sm:px-8">
        <header className="animate-rise">
          <Eyebrow>Discover</Eyebrow>
          <h1 className="mt-2.5 text-[34px] leading-[1.05] font-semibold tracking-[-0.045em] sm:text-[40px]">
            Shelf <span className="serif-accent pr-1 text-[0.82em] text-muted">every link, unbundled</span>
          </h1>
          <p className="mt-2.5 max-w-[640px] text-[14.5px] leading-relaxed text-muted text-balance">
            The repos, papers, videos, courses and tools inside your saved posts — found, deduplicated and organized on this device. Nothing leaves your browser.
          </p>
          {s.total ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <StatChip value={fmtNumber(s.total)} label={s.total === 1 ? 'resource' : 'resources'} />
              <StatChip value={fmtNumber(s.posts)} label={s.posts === 1 ? 'post with links' : 'posts with links'} />
              {stats && stats.multi ? <StatChip value={fmtNumber(stats.multi)} label="saved more than once" /> : null}
              {stats && stats.fresh ? <StatChip value={`+${fmtNumber(stats.fresh)}`} label="this week" tone="good" /> : null}
            </div>
          ) : null}
        </header>

        {!s.total ? (
          <EmptyState
            icon={<Library />}
            title="No resources yet"
            action={
              <Button variant="secondary" onClick={() => navigate('#/library/all')}>
                Browse your library
              </Button>
            }
          >
            When your saved posts link to repos, papers, videos, courses or tools, they’ll be collected here automatically.
          </EmptyState>
        ) : (
          <>
            <div
              ref={pillsRef}
              role="radiogroup"
              aria-label="Filter by type"
              className="-mx-5 mt-6 flex animate-rise gap-2 overflow-x-auto px-5 pb-1 [animation-delay:60ms] [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
            >
              {pills.map((f) => (
                <TypePill
                  key={f}
                  id={f}
                  label={f === 'all' ? 'All' : RESOURCE_META[f].label}
                  count={f === 'all' ? matches.length : (matchCounts.get(f) ?? 0)}
                  active={filter === f}
                  onSelect={() => selectFilter(f)}
                  onKeyDown={onPillKey}
                  glyph={
                    f === 'all' ? (
                      <span aria-hidden className="grid size-6 place-items-center rounded-full bg-accent-soft text-accent">
                        <Library className="size-3.5" />
                      </span>
                    ) : (
                      <TypeGlyph type={f} size={24} className="rounded-full" />
                    )
                  }
                />
              ))}
            </div>

            <div className="mt-4 flex animate-rise flex-wrap items-center gap-2 [animation-delay:100ms]">
              <div className="relative min-w-[min(100%,260px)] flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
                <Input
                  ref={searchRef}
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      if (search) setSearch('');
                      else (e.target as HTMLInputElement).blur();
                    }
                  }}
                  placeholder="Search titles, sites, people…  try site:github.com or from:@handle"
                  aria-label="Search your shelf"
                  spellCheck={false}
                  className="h-11 rounded-[14px] pr-11 pl-10 text-[14px] [&::-webkit-search-cancel-button]:hidden"
                />
                <div className="absolute top-1/2 right-2.5 -translate-y-1/2">
                  {search ? (
                    <button type="button" onClick={() => (setSearch(''), searchRef.current?.focus())} className="grid size-6 place-items-center rounded-md text-muted hover:bg-panel-2 hover:text-fg" aria-label="Clear search">
                      <X className="size-3.5" />
                    </button>
                  ) : (
                    <Kbd>/</Kbd>
                  )}
                </div>
              </div>

              <Menu>
                <MenuTrigger asChild>
                  <Button size="md" variant="outline" className="h-11 rounded-[14px]" aria-label={`Sort: ${SHELF_SORT_LABELS[sort]}`}>
                    <ArrowUpDown /> <span className="hidden sm:inline">{SHELF_SORT_LABELS[sort]}</span>
                  </Button>
                </MenuTrigger>
                <MenuContent className="w-48">
                  <MenuLabel>Sort by</MenuLabel>
                  <MenuRadioGroup value={sort} onValueChange={(v) => setSort(v as ShelfSort)}>
                    {SORTS.map((k) => (
                      <MenuRadioItem key={k} value={k}>
                        {SHELF_SORT_LABELS[k]}
                      </MenuRadioItem>
                    ))}
                  </MenuRadioGroup>
                </MenuContent>
              </Menu>

              <div className="flex h-11 items-center rounded-[14px] border border-line-strong bg-panel p-1 shadow-card" role="group" aria-label="Layout">
                {(
                  [
                    ['grid', 'Cards', <LayoutGrid key="g" />],
                    ['list', 'List', <List key="l" />],
                  ] as const
                ).map(([id, label, icon]) => (
                  <Tip key={id} label={label}>
                    <button
                      type="button"
                      onClick={() => setLayout(id)}
                      aria-label={`${label} layout`}
                      aria-pressed={layout === id}
                      className={cn('grid h-full w-9 place-items-center rounded-[10px] transition-all [&_svg]:size-4', layout === id ? 'bg-panel-3 text-fg shadow-card' : 'text-muted hover:text-fg')}
                    >
                      {icon}
                    </button>
                  </Tip>
                ))}
              </div>

              <Menu>
                <MenuTrigger asChild>
                  <Button size="md" variant="outline" className="h-11 rounded-[14px]" aria-label="Export shelf">
                    <Download /> <span className="hidden sm:inline">Export</span>
                  </Button>
                </MenuTrigger>
                <MenuContent className="w-60">
                  <MenuLabel>Markdown (.md)</MenuLabel>
                  {filtering ? (
                    <MenuItem disabled={!items.length} onSelect={() => exportList(items, scopeText, filter !== 'all' ? RESOURCE_META[filter].slug : undefined)}>
                      This view <span className="ml-auto pl-4 text-[11px] text-faint tabular-nums">{fmtNumber(items.length)}</span>
                    </MenuItem>
                  ) : null}
                  <MenuItem onSelect={() => exportList(sorted)}>
                    Entire shelf <span className="ml-auto pl-4 text-[11px] text-faint tabular-nums">{fmtNumber(s.total)}</span>
                  </MenuItem>
                  <MenuSeparator />
                  <div className="px-2.5 pt-1 pb-1.5 text-[11.5px] leading-snug text-faint">Grouped by type, with who shared each link and how often you saved it.</div>
                </MenuContent>
              </Menu>
            </div>

            <div className="mt-5 mb-3 flex min-h-6 items-center justify-between gap-3 text-[13px] text-muted" aria-live="polite">
              <span className="truncate">
                {query ? (
                  <>
                    <span className="font-semibold text-fg tabular-nums">{fmtNumber(items.length)}</span> {items.length === 1 ? 'match' : 'matches'} for “{query}”
                    {filter !== 'all' ? <> in {RESOURCE_META[filter].label}</> : null}
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-fg tabular-nums">{fmtNumber(items.length)}</span> {items.length === 1 && filter !== 'all' ? RESOURCE_META[filter].one.toLowerCase() : filterLabel} · {SHELF_SORT_LABELS[sort].toLowerCase()}
                  </>
                )}
              </span>
              {filtering ? (
                <button type="button" onClick={() => (setSearch(''), selectFilter('all'))} className="shrink-0 rounded-md px-1.5 py-0.5 text-[12.5px] font-medium text-accent hover:bg-accent-soft">
                  Clear filters
                </button>
              ) : null}
            </div>

            {!items.length ? (
              <EmptyState
                icon={<SearchX />}
                title="Nothing matches"
                action={
                  <Button variant="secondary" onClick={() => (setSearch(''), selectFilter('all'))}>
                    Clear filters
                  </Button>
                }
              >
                {query ? 'Try fewer words, or search everything with “All”.' : `No ${filterLabel} on your shelf yet.`}
              </EmptyState>
            ) : layout === 'grid' ? (
              <VirtualRows key="grid" items={items} getKey={getKey} render={renderCard} minColWidth={300} maxCols={4} rowHeight={GRID_ROW} gap={16} label="Resources" />
            ) : (
              <div className="rounded-2xl border border-line bg-panel/60 p-1.5 shadow-card">
                <VirtualRows key="list" items={items} getKey={getKey} render={renderRow} minColWidth={10_000} maxCols={1} rowHeight={LIST_ROW} gap={2} label="Resources" />
              </div>
            )}
          </>
        )}
      </div>

      <DetailPanel items={detailItems} onSearch={(q) => (useUi.getState().setQuery(q), navigate('#/library/all'))} />
    </div>
  );
}

const getKey = (r: Resource) => r.key;
