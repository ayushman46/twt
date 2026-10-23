import {
  Archive,
  BookOpen,
  Brain,
  Gift,
  Library,
  MessagesSquare,
  ChartColumn,
  ChevronRight,
  Crown,
  FileText,
  Film,
  Heart,
  House,
  Images,
  Inbox,
  Layers,
  Link2,
  ListTree,
  Moon,
  Plus,
  Search,
  Settings,
  Sparkles,
  Star,
  Sun,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { FACET_LABELS } from '@/lib/facets';
import { fmtCompact } from '@/lib/format';
import type { Scope } from '@/lib/query';
import { viewerItem } from '@/lib/storage';
import type { Facet } from '@/lib/types';
import { useSettings, useStorageItem } from '@/hooks/data';
import { loadAsk, loadInsights, loadRecall, loadShelf, loadWrapped } from '@/lazy-screens';
import { useLibrary } from '@/hooks/library';
import { navigate, sameScope, scopeHash, type Route } from '@/hooks/route';
import { useUi } from '@/store/ui';
import { Avatar, Logo, Wordmark } from './Brand';
import { LastSynced, SyncButton } from './SyncControl';
import { Tip } from './ui/overlays';
import { Kbd, cn } from './ui/primitives';

function NavItem({ icon, label, count, active, onClick, accent, onIntent }: { icon: ReactNode; label: ReactNode; count?: number; active?: boolean; onClick: () => void; accent?: string; onIntent?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerEnter={onIntent}
      onFocus={onIntent}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex h-8 w-full items-center gap-2.5 rounded-[9px] px-2.5 text-[13.5px] transition-colors duration-150',
        active ? 'bg-panel font-medium text-fg shadow-card ring-1 ring-line' : 'text-fg-2 hover:bg-panel-2/80 hover:text-fg',
      )}
    >
      {active ? <span aria-hidden className="bg-brand absolute top-1.5 bottom-1.5 -left-3 w-[3px] rounded-r-full" /> : null}
      <span
        className={cn('grid size-4 shrink-0 place-items-center text-[14px] leading-none [&_svg]:size-4', active ? 'text-accent' : 'text-muted group-hover:text-fg-2')}
        style={accent && active ? { color: accent } : undefined}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      {count ? <span className={cn('tabular text-[11.5px] animate-fade-in', active ? 'text-fg-2' : 'text-faint')}>{fmtCompact(count)}</span> : null}
    </button>
  );
}

const COLLAPSE_KEY = 'twtdash:sidebar-collapsed';

function readCollapsed(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(COLLAPSE_KEY) ?? '{}') as Record<string, boolean>;
  } catch {
    return {};
  }
}

function Section({ id, title, action, children }: { id: string; title: string; action?: ReactNode; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => !!readCollapsed()[id]);
  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_KEY, JSON.stringify({ ...readCollapsed(), [id]: next }));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  };
  return (
    <div className="pt-4">
      <div className="group/sec flex items-center justify-between px-2.5 pb-1.5">
        <button type="button" onClick={toggle} className="flex items-center gap-1 text-[10.5px] font-semibold tracking-[0.12em] text-faint uppercase hover:text-muted" aria-expanded={!collapsed}>
          <ChevronRight className={cn('size-3 transition-transform duration-200', !collapsed && 'rotate-90')} />
          {title}
        </button>
        <span className="opacity-0 transition-opacity group-hover/sec:opacity-100 focus-within:opacity-100">{action}</span>
      </div>
      {!collapsed ? <div className="animate-fade-in space-y-0.5">{children}</div> : null}
    </div>
  );
}

const FACET_ICONS: Partial<Record<Facet, ReactNode>> = {
  image: <Images />,
  video: <Film />,
  link: <Link2 />,
  thread: <ListTree />,
  long: <BookOpen />,
  article: <FileText />,
};

function SectionAction({ label, onClick, icon }: { label: string; onClick: () => void; icon: ReactNode }) {
  return (
    <Tip label={label}>
      <button type="button" onClick={onClick} className="grid size-5 place-items-center rounded-md text-faint hover:bg-panel-2 hover:text-fg [&_svg]:size-3.5" aria-label={label}>
        {icon}
      </button>
    </Tip>
  );
}

export function Sidebar({ route, onNavigate }: { route: Route; onNavigate?: () => void }) {
  const lib = useLibrary();
  const [settings, update] = useSettings();
  const viewer = useStorageItem(viewerItem, null);
  const setPaletteOpen = useUi((s) => s.setPaletteOpen);
  const openCollectionDialog = useUi((s) => s.openCollectionDialog);
  const aiState = useUi((s) => s.ai);
  const [showEmpty, setShowEmpty] = useState(false);
  const [showAllAuthors, setShowAllAuthors] = useState(false);
  const isPro = settings.license?.status === 'active';
  // While the library streams in, counts would be wrong — show them once complete.
  const n = (v?: number) => (lib.partial ? undefined : v);
  const dark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  const go = (hash: string) => {
    navigate(hash);
    onNavigate?.();
  };
  const isScope = (s: Scope) => route.page === 'library' && sameScope(route.scope, s);

  const cats = lib.categories.filter((c) => c.enabled);
  const withCount = cats.filter((c) => (lib.counts.categories.get(c.id) ?? 0) > 0);
  const empty = cats.filter((c) => !(lib.counts.categories.get(c.id) ?? 0));
  const shownCats = showEmpty || !withCount.length ? cats : withCount;
  const authors = lib.authors.slice(0, showAllAuthors ? 20 : 6);

  return (
    <aside className="flex h-full w-[272px] shrink-0 flex-col border-r border-line bg-sidebar">
      <div className="flex h-16 items-center gap-2.5 px-4">
        <Logo className="size-8 drop-shadow-[0_6px_14px_rgb(150_80_255/0.45)]" />
        <Wordmark className="text-[18px]" />
        <span
          className={cn(
            'ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase',
            isPro ? 'btn-brand' : 'bg-panel-2 text-muted ring-1 ring-line',
          )}
        >
          {isPro ? 'Pro' : 'Free'}
        </span>
      </div>

      <div className="px-3 pb-1">
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="flex h-9 w-full items-center gap-2 rounded-[10px] border border-line bg-panel px-3 text-[13px] text-faint shadow-card transition-colors hover:border-line-strong hover:text-muted"
        >
          <Search className="size-4" />
          <span className="flex-1 text-left">Search or jump to…</span>
          <Kbd>{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}</Kbd>
          <Kbd>K</Kbd>
        </button>
      </div>

      <nav className="scroll-area flex-1 px-3 pb-4">
        {lib.partial ? (
          <div className="flex items-center gap-2 px-2.5 pt-2 text-[11.5px] text-faint">
            <span className="bg-brand size-1.5 animate-pulse rounded-full" /> Loading your library…
          </div>
        ) : null}
        <div className="space-y-0.5 pt-2">
          <NavItem icon={<House />} label="Home" active={route.page === 'home'} onClick={() => go('#/home')} />
          <NavItem icon={<Layers />} label="All bookmarks" count={n(lib.counts.all)} active={isScope({ kind: 'all' })} onClick={() => go('#/library/all')} />
          <NavItem icon={<Inbox />} label="Unread" count={n(lib.counts.unread)} active={isScope({ kind: 'unread' })} onClick={() => go('#/library/unread')} />
          <NavItem icon={<Star />} label="Starred" count={n(lib.counts.starred)} active={isScope({ kind: 'starred' })} onClick={() => go('#/library/starred')} />
          {lib.counts.likes ? <NavItem icon={<Heart />} label="Likes" count={n(lib.counts.likes)} active={isScope({ kind: 'likes' })} onClick={() => go('#/library/likes')} /> : null}
          <NavItem icon={<Archive />} label="Archive" count={n(lib.counts.archived)} active={isScope({ kind: 'archived' })} onClick={() => go('#/library/archived')} />
          <NavItem icon={<ChartColumn />} label="Insights" active={route.page === 'insights'} onClick={() => go('#/insights')} onIntent={() => void loadInsights()} />
        </div>

        <Section id="discover" title="Discover">
          <NavItem icon={<Brain />} label="Recall" active={route.page === 'recall'} onClick={() => go('#/recall')} onIntent={() => void loadRecall()} />
          <NavItem icon={<Library />} label="Shelf" active={route.page === 'shelf'} onClick={() => go('#/shelf')} onIntent={() => void loadShelf()} />
          <NavItem icon={<MessagesSquare />} label="Ask your bookmarks" active={route.page === 'ask'} onClick={() => go('#/ask')} onIntent={() => void loadAsk()} />
          <NavItem icon={<Gift />} label="Wrapped" active={route.page === 'wrapped'} onClick={() => go('#/wrapped')} onIntent={() => void loadWrapped()} />
        </Section>

        <Section id="categories" title="Categories" action={<SectionAction label="Manage categories" onClick={() => go('#/settings/categories')} icon={<Settings />} />}>
          {shownCats.map((c) => (
            <NavItem
              key={c.id}
              icon={<span aria-hidden>{c.emoji}</span>}
              label={c.name}
              count={n(lib.counts.categories.get(c.id))}
              accent={c.color}
              active={isScope({ kind: 'category', value: c.id })}
              onClick={() => go(scopeHash({ kind: 'category', value: c.id }))}
            />
          ))}
          {empty.length && withCount.length ? (
            <button type="button" onClick={() => setShowEmpty((x) => !x)} className="flex h-7 w-full items-center gap-2 rounded-lg px-2.5 text-[12px] text-faint hover:text-muted">
              <ChevronRight className={cn('size-3.5 transition-transform', showEmpty && 'rotate-90')} />
              {showEmpty ? 'Hide empty' : `${empty.length} empty`}
            </button>
          ) : null}
        </Section>

        <Section id="collections" title="Collections" action={<SectionAction label="New collection" onClick={() => openCollectionDialog()} icon={<Plus />} />}>
          {lib.collections.map((c) => (
            <NavItem
              key={c.id}
              icon={<span aria-hidden>{c.emoji}</span>}
              label={c.name}
              count={n(lib.counts.collections.get(c.id))}
              active={isScope({ kind: 'collection', value: c.id })}
              onClick={() => go(scopeHash({ kind: 'collection', value: c.id }))}
            />
          ))}
          {!lib.collections.length ? (
            <button
              type="button"
              onClick={() => openCollectionDialog()}
              className="flex h-8 w-full items-center gap-2.5 rounded-[9px] border border-dashed border-line-strong px-2.5 text-[12.5px] text-muted transition-colors hover:border-accent/50 hover:text-fg"
            >
              <Plus className="size-3.5" /> Create a collection
            </button>
          ) : null}
        </Section>

        {(Object.keys(FACET_ICONS) as Facet[]).some((f) => lib.counts.facets.get(f)) ? (
          <Section id="smart" title="Smart views">
            {(Object.keys(FACET_ICONS) as Facet[]).map((f) =>
              lib.counts.facets.get(f) ? (
                <NavItem
                  key={f}
                  icon={FACET_ICONS[f]}
                  label={FACET_LABELS[f]}
                  count={n(lib.counts.facets.get(f))}
                  active={isScope({ kind: 'facet', value: f })}
                  onClick={() => go(scopeHash({ kind: 'facet', value: f }))}
                />
              ) : null,
            )}
          </Section>
        ) : null}

        {authors.length ? (
          <Section id="authors" title="Top authors">
            {authors.map((a) => (
              <NavItem
                key={a.handle}
                icon={<Avatar src={a.avatar} name={a.name} handle={a.handle} size={18} />}
                label={<span title={`@${a.handle}`}>{a.name || a.handle}</span>}
                count={n(a.count)}
                active={isScope({ kind: 'author', value: a.handle })}
                onClick={() => go(scopeHash({ kind: 'author', value: a.handle }))}
              />
            ))}
            {lib.authors.length > 6 ? (
              <button type="button" onClick={() => setShowAllAuthors((x) => !x)} className="flex h-7 w-full items-center gap-2 rounded-lg px-2.5 text-[12px] text-faint hover:text-muted">
                <ChevronRight className={cn('size-3.5 transition-transform', showAllAuthors && 'rotate-90')} />
                {showAllAuthors ? 'Show fewer' : 'Show more'}
              </button>
            ) : null}
          </Section>
        ) : null}

        {lib.tags.length ? (
          <Section id="tags" title="Tags">
            <div className="flex flex-wrap gap-1 px-1.5 pt-0.5">
              {lib.tags.slice(0, 16).map(([t, n]) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => go(scopeHash({ kind: 'tag', value: t }))}
                  className={cn(
                    'h-6 max-w-full truncate rounded-full px-2 text-[11.5px] transition-colors',
                    isScope({ kind: 'tag', value: t }) ? 'btn-brand' : 'bg-panel-2 text-fg-2 ring-1 ring-line hover:bg-panel-3',
                  )}
                  title={`${n} posts`}
                >
                  #{t}
                </button>
              ))}
            </div>
          </Section>
        ) : null}
      </nav>

      <div className="space-y-2.5 border-t border-line p-3">
        {aiState.running ? (
          <div className="rounded-xl bg-accent-soft px-3 py-2.5 ring-1 ring-accent/20">
            <div className="flex items-center gap-2 text-[12px] font-medium text-fg">
              <Sparkles className="size-3.5 animate-pulse text-accent" /> AI organizing… <span className="tabular ml-auto text-muted">{aiState.done}/{aiState.total}</span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-accent/15">
              <div className="bg-brand h-full rounded-full transition-[width] duration-500" style={{ width: `${aiState.total ? (aiState.done / aiState.total) * 100 : 0}%` }} />
            </div>
          </div>
        ) : !isPro ? (
          <button
            type="button"
            onClick={() => go('#/settings/plan')}
            className="ring-brand group relative w-full overflow-hidden rounded-xl bg-panel p-3 text-left shadow-card"
          >
            <span aria-hidden className="aurora absolute inset-0 opacity-80" />
            <span className="relative flex items-center gap-2 text-[12.5px] font-semibold">
              <Crown className="size-3.5 text-accent" /> Unlock twtdash Pro
            </span>
            <span className="relative mt-0.5 block text-[11.5px] leading-snug text-muted">AI sorting, auto-tags & one-line gists — no API key.</span>
          </button>
        ) : null}

        <div className="flex items-center justify-between gap-2 rounded-xl bg-panel-2/60 p-1.5 pl-3 ring-1 ring-line">
          <LastSynced className="truncate text-[11.5px]" />
          <SyncButton hasData={lib.counts.total > 0} />
        </div>

        <div className="flex items-center gap-1">
          <button type="button" onClick={() => go('#/settings/general')} className="flex min-w-0 flex-1 items-center gap-2 rounded-[9px] px-1.5 py-1 text-left hover:bg-panel-2">
            {viewer ? <Avatar name={viewer.handle} handle={viewer.handle} size={24} /> : <span className="grid size-6 place-items-center rounded-full bg-panel-3 text-muted"><Settings className="size-3.5" /></span>}
            <span className="min-w-0">
              <span className="block truncate text-[12.5px] font-medium text-fg">{viewer ? `@${viewer.handle}` : 'Settings'}</span>
              <span className="block truncate text-[11px] text-faint">{viewer ? 'Connected to X' : 'Preferences & plan'}</span>
            </span>
          </button>
          <Tip label={dark ? 'Light mode' : 'Dark mode'}>
            <button
              type="button"
              onClick={() => void update({ theme: dark ? 'light' : 'dark' })}
              className="grid size-8 place-items-center rounded-[9px] text-muted hover:bg-panel-2 hover:text-fg"
              aria-label="Toggle theme"
            >
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
          </Tip>
          <Tip label="Settings">
            <button type="button" onClick={() => go('#/settings/general')} className={cn('grid size-8 place-items-center rounded-[9px] hover:bg-panel-2 hover:text-fg', route.page === 'settings' ? 'text-accent' : 'text-muted')} aria-label="Settings">
              <Settings className="size-4" />
            </button>
          </Tip>
        </div>
      </div>
    </aside>
  );
}
