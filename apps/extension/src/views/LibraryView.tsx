import {
  ArrowUpDown,
  CheckCheck,
  Ellipsis,
  ExternalLink,
  FileText,
  Film,
  Images,
  LayoutGrid,
  Link2,
  List,
  ListChecks,
  ListTree,
  Pencil,
  Search,
  SearchX,
  Sparkles,
  Table2,
  Trash,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { deleteTag, renameTag, setArchived, setRead, setStarred } from '@/lib/actions';
import { DEMO_PREFIX } from '@/lib/demo';
import { exportCsv, exportJson, exportMarkdown } from '@/lib/export';
import { FACET_LABELS } from '@/lib/facets';
import { fmtNumber, plural } from '@/lib/format';
import { applyOperators, matchesScope, OPERATOR_HELP, parseQuery, SORT_LABELS, type SortKey } from '@/lib/query';
import { usePaintMark } from '@/lib/perf';
import { searchIndex } from '@/lib/scan-search';
import type { Settings, ViewMode } from '@/lib/storage';
import type { Facet } from '@/lib/types';
import { useLibrary } from '@/hooks/library';
import { navigate, type Route } from '@/hooks/route';
import { useUi } from '@/store/ui';
import { Avatar } from '@/components/Brand';
import { BulkBar } from '@/components/BulkBar';
import { DetailPanel } from '@/components/DetailPanel';
import { GalleryLayout, ListLayout, MasonryGrid, TableLayout, virtualRegistry, type LayoutProps } from '@/components/Layouts';
import { SyncButton } from '@/components/SyncControl';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger, Popover, PopoverContent, PopoverTrigger, Tip } from '@/components/ui/overlays';
import { Button, EmptyState, Input, Kbd, cn } from '@/components/ui/primitives';

const VIEW_OPTIONS: Array<{ id: ViewMode; label: string; icon: ReactNode }> = [
  { id: 'grid', label: 'Grid', icon: <LayoutGrid /> },
  { id: 'list', label: 'List', icon: <List /> },
  { id: 'table', label: 'Table', icon: <Table2 /> },
  { id: 'gallery', label: 'Media', icon: <Images /> },
];

const QUICK_FILTERS: Array<{ op: string; label: string; icon: ReactNode }> = [
  { op: 'has:image', label: 'Images', icon: <Images /> },
  { op: 'has:video', label: 'Videos', icon: <Film /> },
  { op: 'has:link', label: 'Links', icon: <Link2 /> },
  { op: 'is:thread', label: 'Threads', icon: <ListTree /> },
  { op: 'is:long', label: 'Long reads', icon: <FileText /> },
];

function toggleOperator(query: string, op: string): string {
  const re = new RegExp(`(^|\\s)${op.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\s|$)`, 'i');
  if (re.test(query)) return query.replace(re, ' ').replace(/\s+/g, ' ').trim();
  return `${query.trim()} ${op}`.trim();
}

function ScopeHeader({ route, count }: { route: Route; count: number }) {
  const lib = useLibrary();
  const openCollectionDialog = useUi((s) => s.openCollectionDialog);
  const { scope } = route;
  let icon: ReactNode = null;
  let title = 'All bookmarks';
  let description: ReactNode = null;
  let actions: ReactNode = null;

  switch (scope.kind) {
    case 'unread':
      title = 'Unread';
      description = 'New saves you haven’t opened yet. Open a post to mark it read.';
      break;
    case 'starred':
      title = 'Starred';
      description = 'Your favorites — the best of the best.';
      break;
    case 'archived':
      title = 'Archive';
      description = 'Hidden from your library, never deleted.';
      break;
    case 'likes':
      title = 'Likes';
      description = 'Posts you’ve liked on X.';
      break;
    case 'category': {
      const c = lib.categoryMap.get(scope.value ?? '');
      icon = c ? (
        <span className="grid size-10 place-items-center rounded-xl text-xl" style={{ background: `color-mix(in oklab, ${c.color} 15%, transparent)` }}>
          {c.emoji}
        </span>
      ) : null;
      title = c?.name ?? 'Category';
      description = c?.description;
      break;
    }
    case 'collection': {
      const c = lib.collectionMap.get(scope.value ?? '');
      icon = c ? (
        <span className="grid size-10 place-items-center rounded-xl text-xl" style={{ background: `color-mix(in oklab, ${c.color} 16%, transparent)` }}>
          {c.emoji}
        </span>
      ) : null;
      title = c?.name ?? 'Collection';
      description = c?.description || (c?.xFolderId ? 'Synced from your X bookmark folder.' : null);
      actions = c ? (
        <Button size="sm" variant="ghost" onClick={() => openCollectionDialog({ editId: c.id })}>
          <Pencil /> Edit
        </Button>
      ) : null;
      break;
    }
    case 'tag': {
      const tag = scope.value ?? '';
      title = `#${tag}`;
      actions = (
        <Menu>
          <MenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label="Tag actions">
              <Ellipsis />
            </Button>
          </MenuTrigger>
          <MenuContent>
            <MenuItem
              onSelect={() => {
                const next = prompt('Rename tag', tag);
                if (next && next.trim() && next !== tag) void renameTag(tag, next).then(() => navigate(`#/library/tag/${encodeURIComponent(next.trim().toLowerCase())}`));
              }}
            >
              <Pencil /> Rename tag
            </MenuItem>
            <MenuItem
              danger
              onSelect={() => {
                void deleteTag(tag).then(() => {
                  toast(`Removed #${tag} from all posts`);
                  navigate('#/library/all');
                });
              }}
            >
              <Trash /> Delete tag
            </MenuItem>
          </MenuContent>
        </Menu>
      );
      break;
    }
    case 'author': {
      const a = lib.authors.find((x) => x.handle.toLowerCase() === (scope.value ?? '').toLowerCase());
      icon = <Avatar src={a?.avatar} name={a?.name ?? scope.value ?? ''} handle={scope.value ?? ''} size={40} />;
      title = a?.name ?? `@${scope.value}`;
      description = `@${scope.value}`;
      const isDemo = lib.bookmarks.some((b) => b.author.handle === scope.value && b.id.startsWith(DEMO_PREFIX));
      actions = isDemo ? null : (
        <Button size="sm" variant="ghost" onClick={() => window.open(`https://x.com/${scope.value}`, '_blank', 'noopener')}>
          <ExternalLink /> Profile
        </Button>
      );
      break;
    }
    case 'facet':
      title = FACET_LABELS[scope.value as Facet] ?? 'Smart view';
      break;
  }

  return (
    <div className="flex items-start gap-3.5">
      {icon}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-[30px] leading-tight font-semibold tracking-[-0.045em]">{title}</h1>
          <span className="tabular rounded-full bg-panel px-2.5 py-0.5 text-[12px] font-medium text-muted shadow-card ring-1 ring-line">{lib.partial ? '…' : fmtNumber(count)}</span>
          {actions}
        </div>
        {description ? <p className="mt-0.5 line-clamp-1 text-[13.5px] text-muted">{description}</p> : null}
      </div>
    </div>
  );
}

export function LibraryView({ route, settings, aiAvailable, onAi }: { route: Route; settings: Settings; aiAvailable: boolean; onAi: (ids?: string[]) => void }) {
  const lib = useLibrary();
  const query = useUi((s) => s.query);
  const setQuery = useUi((s) => s.setQuery);
  const sort = useUi((s) => s.sort);
  const setSort = useUi((s) => s.setSort);
  const viewState = useUi((s) => s.view);
  const setView = useUi((s) => s.setView);
  const selection = useUi((s) => s.selection);
  const toggleSelect = useUi((s) => s.toggleSelect);
  const clearSelection = useUi((s) => s.clearSelection);
  const focusId = useUi((s) => s.focusId);
  const setFocus = useUi((s) => s.setFocus);
  const openDetail = useUi((s) => s.openDetail);
  const activeId = useUi((s) => s.activeId);
  const [selectMode, setSelectMode] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const view = viewState ?? settings.defaultView;

  const pq = useMemo(() => parseQuery(query), [query]);
  const scoped = useMemo(() => lib.bookmarks.filter((b) => matchesScope(b, route.scope)), [lib.bookmarks, route.scope]);
  const filtered = useMemo(() => applyOperators(scoped, pq, { categories: lib.categories, collections: lib.collections }), [scoped, pq, lib.categories, lib.collections]);
  const scores = useMemo(() => (pq.text.trim() ? searchIndex.search(pq.text) : null), [pq.text, lib.bookmarks]); // eslint-disable-line react-hooks/exhaustive-deps
  const effectiveSort: SortKey = scores && sort === 'saved' ? 'relevance' : !scores && sort === 'relevance' ? 'saved' : sort;
  const items = useMemo(() => {
    const matched = scores ? filtered.filter((b) => scores.has(b.id)) : filtered;
    const arr = [...matched];
    switch (effectiveSort) {
      case 'relevance':
        return arr.sort((a, b) => (scores!.get(b.id) ?? 0) - (scores!.get(a.id) ?? 0) || b.savedAt - a.savedAt);
      case 'saved':
        return arr.sort((a, b) => b.savedAt - a.savedAt);
      case 'saved-asc':
        return arr.sort((a, b) => a.savedAt - b.savedAt);
      case 'newest':
        return arr.sort((a, b) => b.createdAt - a.createdAt);
      case 'oldest':
        return arr.sort((a, b) => a.createdAt - b.createdAt);
      case 'likes':
        return arr.sort((a, b) => b.metrics.likes - a.metrics.likes);
      case 'views':
        return arr.sort((a, b) => b.metrics.views - a.metrics.views);
    }
  }, [filtered, scores, effectiveSort]);

  const categoryBreakdown = useMemo(() => {
    if (route.scope.kind === 'category') return [];
    const counts = new Map<string, number>();
    for (const b of items) counts.set(b.category, (counts.get(b.category) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [items, route.scope.kind]);

  const highlight = pq.highlight;
  const routeKey = `${route.scope.kind}:${route.scope.value ?? ''}`;
  const resetKey = `${routeKey}|${query}|${effectiveSort}|${view}`;

  // Reset selection & focus when the view changes.
  useEffect(() => {
    clearSelection();
    setFocus(null);
    window.scrollTo({ top: 0 });
  }, [routeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, [contenteditable], [role="dialog"]:not([aria-label="Post details"]), [role="menu"]')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const idx = items.findIndex((b) => b.id === (activeId ?? focusId));
      const current = idx >= 0 ? items[idx] : undefined;
      const move = (d: number) => {
        const next = items[Math.max(0, Math.min(items.length - 1, (idx < 0 ? -1 : idx) + d))];
        if (!next) return;
        if (activeId) openDetail(next.id);
        setFocus(next.id);
        // Virtualized layouts may not have the item mounted yet.
        if (!virtualRegistry.scrollToKey?.(next.id)) requestAnimationFrame(() => document.querySelector(`[data-id="${next.id}"]`)?.scrollIntoView({ block: 'nearest' }));
      };
      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          if (e.key === 'ArrowDown' && !activeId && !focusId) return;
          e.preventDefault();
          move(1);
          break;
        case 'k':
        case 'ArrowUp':
          if (e.key === 'ArrowUp' && !activeId && !focusId) return;
          e.preventDefault();
          move(-1);
          break;
        case 'Enter':
          if (current && !activeId) {
            e.preventDefault();
            openDetail(current.id);
          }
          break;
        case 'o':
          if (current) window.open(current.url, '_blank', 'noopener');
          break;
        case 's':
          if (current) void setStarred([current.id], !current.starred);
          break;
        case 'r':
          if (current) void setRead([current.id], !current.read);
          break;
        case 'e':
          if (current) {
            void setArchived([current.id], !current.archived);
            move(1);
          }
          break;
        case 'x':
          if (current) toggleSelect(current.id);
          break;
        case 'Escape':
          if (activeId) openDetail(null);
          else if (selection.size) clearSelection();
          else if (query) setQuery('');
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items, activeId, focusId, selection.size, query]); // eslint-disable-line react-hooks/exhaustive-deps

  // "/" focuses search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || (e.target as HTMLElement).closest('input, textarea')) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Stable callbacks keep memoized cards from re-rendering on every state change.
  const onSearch = useCallback(
    (q: string) => {
      setQuery(q);
      openDetail(null);
      searchRef.current?.focus();
    },
    [setQuery, openDetail],
  );
  const onOpen = useCallback(
    (id: string) => {
      setFocus(id);
      openDetail(id);
    },
    [setFocus, openDetail],
  );

  const layoutProps: LayoutProps = {
    resetKey,
    items,
    categoryMap: lib.categoryMap,
    highlight,
    selection,
    focusId: focusId ?? activeId,
    selectMode: selectMode || selection.size > 0,
    showSummary: settings.showSummaries,
    showMetrics: settings.showMetrics,
    onOpen,
    onToggleSelect: toggleSelect,
    onSearch,
  };

  usePaintMark('route:library:painted', !lib.loading, routeKey);
  usePaintMark('search:painted', !lib.loading && !!query, query);

  const unreadInView = items.filter((b) => !b.read).length;
  const pendingAi = items.filter((b) => !b.aiAt && !b.partial).length;

  return (
    <div className="relative mx-auto w-full max-w-[1500px] px-5 pt-7 pb-28 sm:px-8">
      <div aria-hidden className="aurora pointer-events-none absolute inset-x-0 top-0 -z-0 h-[220px] opacity-70" />
      <div className="relative">
        <ScopeHeader route={route} count={items.length} />
      </div>

      <div className="sticky top-0 z-20 -mx-5 mt-5 bg-bg/80 px-5 py-3 backdrop-blur-xl backdrop-saturate-150 sm:-mx-8 sm:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint" />
            <Input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  if (query) setQuery('');
                  else (e.target as HTMLInputElement).blur();
                }
                if (e.key === 'Enter' || e.key === 'ArrowDown') {
                  const first = items[0];
                  if (first) {
                    setFocus(first.id);
                    (e.target as HTMLInputElement).blur();
                  }
                }
              }}
              placeholder="Search text, authors, notes…  try from:  has:video  cat:ai"
              className="h-11 rounded-[14px] pr-24 pl-10 text-[14px]"
              spellCheck={false}
            />
            <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
              {query ? (
                <button type="button" onClick={() => setQuery('')} className="grid size-6 place-items-center rounded-md text-muted hover:bg-panel-2 hover:text-fg" aria-label="Clear search">
                  <X className="size-3.5" />
                </button>
              ) : (
                <Kbd>/</Kbd>
              )}
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className="h-6 rounded-md px-1.5 text-[11.5px] font-medium text-muted hover:bg-panel-2 hover:text-fg">
                    Filters
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[360px] p-2">
                  <div className="px-2 pt-1 pb-2 text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">Search operators — click to add</div>
                  {OPERATOR_HELP.map((o) => (
                    <button
                      key={o.op}
                      type="button"
                      onClick={() => {
                        setQuery(`${query.trim()} ${o.example}`.trim());
                        searchRef.current?.focus();
                      }}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-panel-2"
                    >
                      <code className="w-36 shrink-0 truncate text-[12px] text-accent">{o.example}</code>
                      <span className="truncate text-[12.5px] text-muted">{o.description}</span>
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <Menu>
            <MenuTrigger asChild>
              <Button size="md" variant="outline" className="h-11 rounded-[14px]">
                <ArrowUpDown /> <span className="hidden sm:inline">{SORT_LABELS[effectiveSort]}</span>
              </Button>
            </MenuTrigger>
            <MenuContent className="w-48">
              <MenuLabel>Sort by</MenuLabel>
              <MenuRadioGroup value={effectiveSort} onValueChange={(v) => setSort(v as SortKey)}>
                {(Object.keys(SORT_LABELS) as SortKey[])
                  .filter((k) => k !== 'relevance' || scores)
                  .map((k) => (
                    <MenuRadioItem key={k} value={k}>
                      {SORT_LABELS[k]}
                    </MenuRadioItem>
                  ))}
              </MenuRadioGroup>
            </MenuContent>
          </Menu>

          <div className="flex h-11 items-center rounded-[14px] border border-line-strong bg-panel p-1 shadow-card">
            {VIEW_OPTIONS.map((v, i) => (
              <Tip key={v.id} label={v.label} shortcut={String(i + 1)}>
                <button
                  type="button"
                  onClick={() => setView(v.id)}
                  aria-label={`${v.label} view`}
                  aria-pressed={view === v.id}
                  className={cn('grid h-full w-9 place-items-center rounded-[10px] transition-all [&_svg]:size-4', view === v.id ? 'bg-panel-3 text-fg shadow-card' : 'text-muted hover:text-fg')}
                >
                  {v.icon}
                </button>
              </Tip>
            ))}
          </div>

          <Tip label={selectMode ? 'Done selecting' : 'Select posts'} shortcut="X">
            <Button size="icon" variant={selectMode ? 'soft' : 'outline'} className="h-11 w-11 rounded-[14px]" onClick={() => (selectMode ? (setSelectMode(false), clearSelection()) : setSelectMode(true))} aria-label="Select mode">
              <ListChecks />
            </Button>
          </Tip>

          <Menu>
            <MenuTrigger asChild>
              <Button size="icon" variant="outline" className="h-11 w-11 rounded-[14px]" aria-label="More">
                <Ellipsis />
              </Button>
            </MenuTrigger>
            <MenuContent className="w-60">
              <MenuItem disabled={!unreadInView} onSelect={() => void setRead(items.filter((b) => !b.read).map((b) => b.id), true).then(() => toast.success(`Marked ${plural(unreadInView, 'post')} as read`))}>
                <CheckCheck /> Mark all as read
              </MenuItem>
              {aiAvailable ? (
                <MenuItem disabled={!items.length} onSelect={() => onAi(items.map((b) => b.id))}>
                  <Sparkles /> Re-organize this view with AI
                </MenuItem>
              ) : null}
              <MenuSeparator />
              <MenuLabel>Export this view</MenuLabel>
              <MenuItem onSelect={() => void exportMarkdown(items)}>Markdown (.md)</MenuItem>
              <MenuItem onSelect={() => void exportCsv(items)}>Spreadsheet (.csv)</MenuItem>
              <MenuItem onSelect={() => void exportJson(items)}>Backup (.json)</MenuItem>
            </MenuContent>
          </Menu>
        </div>

        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
          {QUICK_FILTERS.map((f) => {
            const on = new RegExp(`(^|\\s)${f.op}(\\s|$)`, 'i').test(query);
            return (
              <button
                key={f.op}
                type="button"
                onClick={() => setQuery(toggleOperator(query, f.op))}
                className={cn(
                  'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] transition-colors [&_svg]:size-3.5',
                  on ? 'border-accent/50 bg-accent-soft text-accent' : 'border-line bg-panel text-fg-2 hover:border-line-strong',
                )}
              >
                {f.icon}
                {f.label}
              </button>
            );
          })}
          {categoryBreakdown.length > 1 ? <span className="mx-1 h-4 w-px shrink-0 bg-line-strong" /> : null}
          {categoryBreakdown.length > 1
            ? categoryBreakdown.slice(0, 10).map(([id, n]) => {
                const c = lib.categoryMap.get(id);
                if (!c) return null;
                const op = `cat:${id}`;
                const on = new RegExp(`(^|\\s)${op}(\\s|$)`).test(query);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setQuery(toggleOperator(query, op))}
                    className={cn('inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] transition-colors', on ? 'border-transparent text-fg' : 'border-line bg-panel text-fg-2 hover:border-line-strong')}
                    style={on ? { background: `color-mix(in oklab, ${c.color} 22%, transparent)` } : undefined}
                  >
                    <span>{c.emoji}</span>
                    {c.name}
                    <span className="text-faint tabular-nums">{n}</span>
                  </button>
                );
              })
            : null}
          {aiAvailable && pendingAi > 0 ? (
            <button
              type="button"
              onClick={() => onAi()}
              className="ml-auto inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-accent-soft px-3 text-[12.5px] font-medium text-accent hover:bg-accent/20"
            >
              <Sparkles className="size-3.5" /> Organize {fmtNumber(pendingAi)} with AI
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
        {lib.loading ? (
          <LoadingGrid />
        ) : !lib.counts.total ? (
          <EmptyState icon={<Sparkles />} title="Your library is empty" action={<SyncButton hasData={false} size="lg" />}>
            Sync your X bookmarks and twtdash will sort them into categories automatically.
          </EmptyState>
        ) : !items.length ? (
          <EmptyState
            icon={<SearchX />}
            title={query ? 'No matches' : 'Nothing here yet'}
            action={
              query ? (
                <Button variant="secondary" onClick={() => setQuery('')}>
                  Clear search
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => navigate('#/library/all')}>
                  View all bookmarks
                </Button>
              )
            }
          >
            {query ? 'Try fewer words or remove a filter.' : route.scope.kind === 'unread' ? 'You’re all caught up. ✨' : 'Posts you add here will show up in this view.'}
          </EmptyState>
        ) : view === 'grid' ? (
          <MasonryGrid {...layoutProps} />
        ) : view === 'list' ? (
          <ListLayout {...layoutProps} />
        ) : view === 'table' ? (
          <TableLayout {...layoutProps} />
        ) : (
          <GalleryLayout {...layoutProps} />
        )}
      </div>

      <DetailPanel items={items} highlight={highlight} onSearch={onSearch} />
      <BulkBar items={items} aiAvailable={aiAvailable} onAi={(ids) => onAi(ids)} />
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} className="rounded-2xl border border-line bg-panel p-4">
          <div className="flex gap-3">
            <div className="skeleton size-10 rounded-full" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="skeleton h-3 w-1/2 rounded" />
              <div className="skeleton h-3 w-1/3 rounded" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="skeleton h-3 rounded" />
            <div className="skeleton h-3 w-5/6 rounded" />
            <div className="skeleton h-3 w-2/3 rounded" />
          </div>
          {i % 3 === 0 ? <div className="skeleton mt-4 h-40 rounded-xl" /> : null}
        </div>
      ))}
    </div>
  );
}

