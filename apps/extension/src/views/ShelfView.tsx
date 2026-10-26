import { format } from 'date-fns';
import { ArrowRight, ArrowUpDown, Copy, Download, ExternalLink, LayoutGrid, Library, List, Search, SearchX, X } from 'lucide-react';
import { memo, useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
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
import { TYPE_ICON, useShelf } from '@/components/ShelfWidget';
import { SyncButton } from '@/components/SyncControl';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger, Popover, PopoverContent, PopoverTrigger, Tip } from '@/components/ui/overlays';
import { Button, EmptyState, Input, Kbd, cn } from '@/components/ui/primitives';

type Filter = ResourceType | 'all';
type ShelfLayout = 'grid' | 'list';

const DAY = 86_400_000;
const GRID_ROW = 184;
const LIST_ROW = 44;
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

function Faces({ sharers, size = 18 }: { sharers: Sharer[]; size?: number }) {
  if (!sharers.length) return null;
  const names = sharers.slice(0, 8).map((s) => `@${s.handle}`).join(', ') + (sharers.length > 8 ? ` +${sharers.length - 8} more` : '');
  return (
    <span className="flex shrink-0 -space-x-1" title={`Shared by ${names}`}>
      {sharers.slice(0, 3).map((s) => (
        <Avatar key={s.handle} src={s.avatar} name={s.name} handle={s.handle} size={size} className="ring-2 ring-panel" />
      ))}
    </span>
  );
}

function Thumb({ src, className }: { src: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} className={cn('shrink-0 rounded-lg bg-panel-2 object-cover ring-1 ring-line', className)} />;
}

/** The type's line icon, muted. Type is never colour-coded. */
function TypeIcon({ type, className }: { type: ResourceType; className?: string }) {
  const Icon = TYPE_ICON[type];
  return <Icon aria-hidden strokeWidth={1.75} className={cn('size-4 shrink-0 text-muted', className)} />;
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
      <div className="px-2.5 pt-1.5 pb-2 text-[12px] text-muted">Saved in {plural(r.count, 'post')}</div>
      <div className="max-h-[320px] overflow-y-auto">
        {posts.map((b) => (
          <button key={b.id} type="button" onClick={() => onPick(b.id)} className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left outline-none transition-colors duration-150 hover:bg-panel-2 focus-visible:bg-panel-2 active:bg-panel-3">
            <Avatar src={b.author.avatar} name={b.author.name} handle={b.author.handle} size={24} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] text-muted">
                <span className="font-medium text-fg">{b.author.name || b.author.handle}</span> · saved {fmtShortDate(b.savedAt)}
              </span>
              <span className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-fg-2">{b.text || b.card?.title || b.article?.title || 'Media post'}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="mt-1 border-t border-line pt-1">
        <button type="button" onClick={onFind} className="flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[13px] font-medium text-fg-2 outline-none transition-colors duration-150 hover:bg-panel-2 hover:text-fg focus-visible:bg-panel-2">
          {r.count > posts.length ? `See all ${fmtNumber(r.count)} in Library` : 'Find these in Library'}
          <ArrowRight className="ml-auto size-4 text-muted" strokeWidth={1.75} />
        </button>
      </div>
    </PopoverContent>
  );
}

function PostsButton({ r, actions, className, compact }: { r: Resource; actions: CardActions; className?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const label = compact ? `×${fmtNumber(r.count)}` : `in ${plural(r.count, 'post')}`;
  const cls = cn('relative z-10 rounded-md whitespace-nowrap text-muted underline-offset-[3px] outline-none transition-colors duration-150 hover:text-fg hover:underline focus-visible:ring-2 focus-visible:ring-[var(--ring)]', className);
  if (r.count === 1) {
    return (
      <button type="button" className={cls} onClick={() => actions.onOpenPost(r, r.postIds[0])}>
        {label}
        <span className="sr-only">: open the post that shared {r.title}</span>
      </button>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={cls}>
          {label}
          <span className="sr-only">: show the posts that shared {r.title}</span>
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
  const btn = 'grid size-7 place-items-center rounded-lg text-muted outline-none transition-colors duration-150 hover:bg-panel-2 hover:text-fg active:bg-panel-3 focus-visible:ring-2 focus-visible:ring-[var(--ring)]';
  return (
    <div className={cn('relative z-10 flex items-center gap-0.5 transition-opacity duration-150 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100', className)}>
      <Tip label="Copy link">
        <button type="button" onClick={() => void copyText(r.url)} aria-label={`Copy link to ${r.title}`} className={btn}>
          <Copy className="size-3.5" strokeWidth={1.75} />
        </button>
      </Tip>
      <Tip label="Open in new tab">
        <a href={r.url} target="_blank" rel="noreferrer noopener" aria-label={`Open ${r.title} in a new tab`} className={btn}>
          <ExternalLink className="size-3.5" strokeWidth={1.75} />
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

function SiteButton({ domain, actions, className }: { domain: string; actions: CardActions; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => actions.onSite(domain)}
      className={cn('relative z-10 min-w-0 truncate rounded text-left text-muted outline-none transition-colors duration-150 hover:text-fg hover:underline focus-visible:underline', className)}
      title={`More from ${domain}`}
    >
      {domain}
    </button>
  );
}

const ResourceCard = memo(function ResourceCard({ r, actions }: { r: Resource; actions: CardActions }) {
  return (
    <article className="group relative isolate flex h-full flex-col overflow-hidden rounded-xl border border-line bg-panel p-4 transition-[border-color,background-color] duration-150 ease-out hover:border-line-strong has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-[var(--ring)]">
      <div className="flex min-h-7 items-center gap-2 text-[12px]">
        <TypeIcon type={r.type} />
        <span className="shrink-0 text-muted">{r.kind}</span>
        <span aria-hidden className="text-faint">·</span>
        <SiteButton domain={r.domain} actions={actions} />
        <HoverActions r={r} className="-my-1 ml-auto" />
      </div>
      <div className="mt-2.5 flex min-h-0 flex-1 gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-2 text-[14.5px] leading-[1.4] font-semibold tracking-[-0.01em] text-fg">
            <TitleLink r={r} />
          </h2>
          {r.description ? <p className="mt-1 line-clamp-2 text-[13px] leading-[1.5] text-muted">{r.description}</p> : null}
        </div>
        {r.image ? <Thumb src={r.image} className="size-14" /> : null}
      </div>
      <div className="mt-3 flex min-h-5 items-center gap-2 text-[12px] text-muted">
        <Faces sharers={r.sharers} />
        <PostsButton r={r} actions={actions} />
        <time dateTime={new Date(r.lastSavedAt).toISOString()} title={`Last saved ${fmtLongDate(r.lastSavedAt)}`} className="ml-auto shrink-0 tabular-nums">
          {fmtShortDate(r.lastSavedAt)}
        </time>
      </div>
    </article>
  );
});

const ResourceRow = memo(function ResourceRow({ r, actions, first }: { r: Resource; actions: CardActions; first: boolean }) {
  return (
    <div
      className={cn(
        'group relative flex h-full items-center gap-3 px-3 text-[13px] transition-colors duration-150 hover:bg-panel-2 has-[a:focus-visible]:bg-panel-2 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-[var(--ring)] has-[a:focus-visible]:ring-inset',
        !first && 'border-t border-line',
      )}
    >
      <Tip label={r.kind}>
        <span className="relative z-10 grid size-5 shrink-0 place-items-center">
          <TypeIcon type={r.type} />
        </span>
      </Tip>
      <div className="min-w-0 flex-1 truncate font-medium text-fg">
        <TitleLink r={r} />
      </div>
      <SiteButton domain={r.domain} actions={actions} className="hidden w-[168px] shrink-0 text-[12.5px] md:block" />
      <div className="hidden w-[132px] shrink-0 items-center gap-2 text-[12px] lg:flex">
        <Faces sharers={r.sharers} size={16} />
        <PostsButton r={r} actions={actions} />
      </div>
      <PostsButton r={r} actions={actions} compact className="shrink-0 rounded-full bg-panel-2 px-2 py-0.5 text-[11.5px] no-underline tabular-nums lg:hidden" />
      <time dateTime={new Date(r.lastSavedAt).toISOString()} title={`Last saved ${fmtLongDate(r.lastSavedAt)}`} className="hidden w-14 shrink-0 text-right text-[12px] text-muted tabular-nums sm:block">
        {fmtShortDate(r.lastSavedAt)}
      </time>
      <HoverActions r={r} className="hidden sm:flex" />
    </div>
  );
});

function Segment({ id, label, count, active, onSelect, onKeyDown }: { id: Filter; label: string; count: number; active: boolean; onSelect: () => void; onKeyDown: (e: ReactKeyboardEvent<HTMLButtonElement>) => void }) {
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
        'inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium whitespace-nowrap outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[var(--ring)] active:scale-[0.98]',
        active ? 'bg-accent-soft text-accent' : 'text-fg-2 hover:bg-panel-2 hover:text-fg',
      )}
    >
      {label}
      <span className={cn('text-[12px] font-normal tabular-nums', active ? 'text-accent' : 'text-muted')}>{fmtNumber(count)}</span>
    </button>
  );
}

function ShelfSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pt-8 pb-16 sm:px-8" aria-busy="true" aria-label="Loading your shelf">
      <div className="skeleton h-8 w-28 rounded-lg" />
      <div className="skeleton mt-3 h-4 w-full max-w-[520px] rounded" />
      <div className="skeleton mt-2 h-3.5 w-64 rounded" />
      <div className="mt-6 flex h-9 gap-1 overflow-hidden rounded-lg border border-line bg-panel p-1">
        {[56, 72, 76, 70, 82, 64, 68].map((w, i) => (
          <div key={i} className="skeleton h-7 shrink-0 rounded-md" style={{ width: w }} />
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <div className="skeleton h-9 flex-1 rounded-lg" />
        <div className="skeleton h-9 w-28 rounded-lg" />
        <div className="skeleton h-9 w-[72px] rounded-lg" />
        <div className="skeleton h-9 w-24 rounded-lg" />
      </div>
      <div className="mt-7 grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr))]">
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} className="flex flex-col rounded-xl border border-line bg-panel p-4" style={{ height: GRID_ROW }}>
            <div className="flex items-center gap-2">
              <div className="skeleton size-4 rounded" />
              <div className="skeleton h-3 w-32 rounded" />
            </div>
            <div className="mt-4 space-y-2">
              <div className="skeleton h-3.5 w-11/12 rounded" />
              <div className="skeleton h-3.5 w-2/3 rounded" />
              <div className="skeleton mt-3 h-3 w-full rounded" />
            </div>
            <div className="mt-auto flex items-center gap-2">
              <div className="skeleton size-[18px] rounded-full" />
              <div className="skeleton h-3 w-20 rounded" />
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

  // Keep the selected segment in view when the control scrolls (narrow screens).
  useEffect(() => {
    const group = pillsRef.current;
    const scroller = group?.parentElement;
    const el = group?.querySelector<HTMLElement>(`[data-filter="${filter}"]`);
    if (!scroller || !el || scroller.scrollWidth <= scroller.clientWidth) return;
    const left = el.offsetLeft - group.offsetLeft;
    if (left < scroller.scrollLeft || left + el.offsetWidth > scroller.scrollLeft + scroller.clientWidth) scroller.scrollLeft = Math.max(0, left - 24);
  }, [filter, pills.length]);

  const exportList = (list: readonly Resource[], scope?: string, slug?: string) => {
    if (!list.length) return;
    downloadText(`twtdash-shelf${slug ? '-' + slug : ''}-${format(Date.now(), 'yyyy-MM-dd')}.md`, shelfToMarkdown(list, { scope }));
    toast.success(`Exported ${plural(list.length, 'resource')}`, { description: 'Markdown file, grouped by type.' });
  };

  const renderCard = useCallback((r: Resource) => <ResourceCard r={r} actions={actions} />, [actions]);
  const renderRow = useCallback((r: Resource, i: number) => <ResourceRow r={r} actions={actions} first={i === 0} />, [actions]);

  usePaintMark('route:shelf:painted', !!shelf);

  if (!ready || (!shelf && lib.counts.total > 0)) return <ShelfSkeleton />;

  if (!lib.counts.total) {
    return (
      <EmptyState icon={<Library strokeWidth={1.75} />} title="Your shelf is empty" action={<SyncButton hasData={false} size="lg" />}>
        Sync your X bookmarks and every repo, paper, video and tool they link to will be collected here, on this device.
      </EmptyState>
    );
  }

  const s = shelf!;
  const filtering = !!query || filter !== 'all';
  const filterLabel = filter === 'all' ? 'resources' : RESOURCE_META[filter].label.toLowerCase();
  const scopeText = [filter !== 'all' ? RESOURCE_META[filter].label : '', query ? `matching “${query}”` : ''].filter(Boolean).join(' ');
  const facts: Array<[string, string]> = [
    [fmtNumber(s.posts), s.posts === 1 ? 'post with links' : 'posts with links'],
    ...(stats && stats.multi ? ([[fmtNumber(stats.multi), 'saved more than once']] as Array<[string, string]>) : []),
    ...(stats && stats.fresh ? ([[`+${fmtNumber(stats.fresh)}`, 'this week']] as Array<[string, string]>) : []),
  ];

  return (
    <div className="relative [&_svg.lucide]:stroke-[1.75]">
      <div className="mx-auto w-full max-w-[1200px] px-4 pt-8 pb-16 sm:px-8">
        <header className="animate-fade-in">
          <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.02em] text-fg">Shelf</h1>
          <p className="mt-1.5 max-w-[620px] text-[14px] leading-relaxed text-muted">
            The repos, papers, videos, courses and tools inside your saved posts. Found, deduplicated and organised on this device.
          </p>
          {s.total ? (
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
              {([[fmtNumber(s.total), s.total === 1 ? 'resource' : 'resources'], ...facts] as Array<[string, string]>).map(([v, label]) => (
                <span key={label} className="whitespace-nowrap">
                  <span className="font-medium text-fg tabular-nums">{v}</span> {label}
                </span>
              ))}
            </p>
          ) : null}
        </header>

        {!s.total ? (
          <EmptyState
            icon={<Library strokeWidth={1.75} />}
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
            <div className="mt-6 max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div ref={pillsRef} role="radiogroup" aria-label="Filter by type" className="inline-flex gap-0.5 rounded-lg border border-line bg-panel p-[3px]">
                {pills.map((f) => (
                  <Segment
                    key={f}
                    id={f}
                    label={f === 'all' ? 'All' : RESOURCE_META[f].label}
                    count={f === 'all' ? matches.length : (matchCounts.get(f) ?? 0)}
                    active={filter === f}
                    onSelect={() => selectFilter(f)}
                    onKeyDown={onPillKey}
                  />
                ))}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="relative min-w-[min(100%,240px)] flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
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
                  placeholder="Search titles, sites, people. Try site:github.com"
                  aria-label="Search your shelf"
                  spellCheck={false}
                  className="h-9 rounded-lg border-line bg-panel pr-10 pl-9 text-[13.5px] shadow-none [&::-webkit-search-cancel-button]:hidden"
                />
                <div className="absolute top-1/2 right-2 -translate-y-1/2">
                  {search ? (
                    <button type="button" onClick={() => (setSearch(''), searchRef.current?.focus())} className="grid size-6 place-items-center rounded-md text-muted transition-colors duration-150 hover:bg-panel-2 hover:text-fg" aria-label="Clear search">
                      <X className="size-3.5" />
                    </button>
                  ) : (
                    <Kbd>/</Kbd>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Menu>
                  <MenuTrigger asChild>
                    <Button size="md" variant="ghost" className="h-9 rounded-lg px-2.5 text-fg-2" aria-label={`Sort: ${SHELF_SORT_LABELS[sort]}`}>
                      <ArrowUpDown className="text-muted" /> <span className="hidden sm:inline">{SHELF_SORT_LABELS[sort]}</span>
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

                <div className="flex h-9 items-center gap-0.5 rounded-lg border border-line bg-panel p-[3px]" role="group" aria-label="Layout">
                  {(
                    [
                      ['grid', 'Cards', <LayoutGrid key="g" strokeWidth={1.75} />],
                      ['list', 'List', <List key="l" strokeWidth={1.75} />],
                    ] as const
                  ).map(([id, label, icon]) => (
                    <Tip key={id} label={label}>
                      <button
                        type="button"
                        onClick={() => setLayout(id)}
                        aria-label={`${label} layout`}
                        aria-pressed={layout === id}
                        className={cn(
                          'grid h-full w-8 place-items-center rounded-md transition-colors duration-150 active:scale-[0.96] [&_svg]:size-4',
                          layout === id ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-panel-2 hover:text-fg',
                        )}
                      >
                        {icon}
                      </button>
                    </Tip>
                  ))}
                </div>

                <Menu>
                  <MenuTrigger asChild>
                    <Button size="md" variant="outline" className="h-9 rounded-lg shadow-none" aria-label="Export shelf">
                      <Download className="text-muted" /> <span className="hidden sm:inline">Export</span>
                    </Button>
                  </MenuTrigger>
                  <MenuContent className="w-60">
                    <MenuLabel>Markdown (.md)</MenuLabel>
                    {filtering ? (
                      <MenuItem disabled={!items.length} onSelect={() => exportList(items, scopeText, filter !== 'all' ? RESOURCE_META[filter].slug : undefined)}>
                        This view <span className="ml-auto pl-4 text-[11.5px] text-muted tabular-nums">{fmtNumber(items.length)}</span>
                      </MenuItem>
                    ) : null}
                    <MenuItem onSelect={() => exportList(sorted)}>
                      Entire shelf <span className="ml-auto pl-4 text-[11.5px] text-muted tabular-nums">{fmtNumber(s.total)}</span>
                    </MenuItem>
                    <MenuSeparator />
                    <div className="px-2.5 pt-1 pb-1.5 text-[12px] leading-snug text-muted">Grouped by type, with who shared each link and how often you saved it.</div>
                  </MenuContent>
                </Menu>
              </div>
            </div>

            <div className="mt-6 mb-3 flex min-h-6 items-center justify-between gap-3 text-[13px] text-muted" aria-live="polite">
              <span className="truncate">
                {query ? (
                  <>
                    <span className="font-medium text-fg tabular-nums">{fmtNumber(items.length)}</span> {items.length === 1 ? 'match' : 'matches'} for “{query}”
                    {filter !== 'all' ? <> in {RESOURCE_META[filter].label}</> : null}
                  </>
                ) : (
                  <>
                    <span className="font-medium text-fg tabular-nums">{fmtNumber(items.length)}</span> {items.length === 1 && filter !== 'all' ? RESOURCE_META[filter].one.toLowerCase() : filterLabel} · {SHELF_SORT_LABELS[sort].toLowerCase()}
                  </>
                )}
              </span>
              {filtering ? (
                <button type="button" onClick={() => (setSearch(''), selectFilter('all'))} className="shrink-0 rounded-md px-1.5 py-0.5 text-[12.5px] font-medium text-fg-2 transition-colors duration-150 hover:bg-panel-2 hover:text-fg">
                  Clear filters
                </button>
              ) : null}
            </div>

            {!items.length ? (
              <EmptyState
                icon={<SearchX strokeWidth={1.75} />}
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
              <VirtualRows key="grid" items={items} getKey={getKey} render={renderCard} minColWidth={300} maxCols={4} rowHeight={GRID_ROW} gap={12} label="Resources" />
            ) : (
              <div className="overflow-hidden rounded-xl border border-line bg-panel">
                <VirtualRows key="list" items={items} getKey={getKey} render={renderRow} minColWidth={10_000} maxCols={1} rowHeight={LIST_ROW} gap={0} label="Resources" />
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
