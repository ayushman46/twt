import {
  Archive,
  BookOpen,
  Brain,
  ChartColumn,
  ChevronRight,
  FileText,
  Film,
  Gift,
  Heart,
  House,
  Images,
  Inbox,
  Layers,
  Library,
  Link2,
  ListTree,
  LoaderCircle,
  MessagesSquare,
  Moon,
  Plus,
  Search,
  Settings,
  Star,
  Sun,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { catName, useT } from '@/i18n';
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
import { CategoryGlyph } from './CategoryGlyph';
import { LastSynced, SyncButton } from './SyncControl';
import { Tip } from './ui/overlays';
import { Kbd, cn } from './ui/primitives';

function NavItem({ icon, label, count, active, onClick, onIntent }: { icon: ReactNode; label: ReactNode; count?: number; active?: boolean; onClick: () => void; onIntent?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerEnter={onIntent}
      onFocus={onIntent}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] transition-colors duration-150',
        active ? 'bg-accent-soft font-medium text-fg' : 'text-fg-2 hover:bg-panel-2 hover:text-fg',
      )}
    >
      <span className={cn('grid size-4 shrink-0 place-items-center text-[16px] leading-none [&_svg]:size-4', active ? 'text-accent' : 'text-muted group-hover:text-fg-2')}>
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      {count ? <span className={cn('tabular text-[12px]', active ? 'text-fg-2' : 'text-muted')}>{fmtCompact(count)}</span> : null}
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
    <div className="pt-5">
      <div className="group/sec flex h-6 items-center justify-between px-2.5">
        <button type="button" onClick={toggle} className="flex items-center gap-1 rounded text-[12px] font-medium text-muted hover:text-fg" aria-expanded={!collapsed}>
          <ChevronRight className={cn('size-3.5 transition-transform duration-200', !collapsed && 'rotate-90')} />
          {title}
        </button>
        <span className="opacity-0 transition-opacity group-hover/sec:opacity-100 focus-within:opacity-100">{action}</span>
      </div>
      {!collapsed ? <div className="animate-fade-in space-y-0.5 pt-1">{children}</div> : null}
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
      <button type="button" onClick={onClick} className="grid size-6 place-items-center rounded-md text-muted hover:bg-panel-2 hover:text-fg [&_svg]:size-3.5" aria-label={label}>
        {icon}
      </button>
    </Tip>
  );
}

export function Sidebar({ route, onNavigate }: { route: Route; onNavigate?: () => void }) {
  const t = useT();
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
      <div className="flex h-14 items-center gap-2.5 px-4">
        <Logo className="size-7" />
        <Wordmark className="text-[16px]" />
        <span className={cn('ml-auto rounded-full px-2 py-0.5 text-[11.5px] font-medium ring-1 ring-line', isPro ? 'bg-accent-soft text-accent' : 'bg-panel text-muted')}>
          {isPro ? 'Pro' : t('common.free')}
        </span>
      </div>

      <div className="px-3 pb-1">
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="flex h-9 w-full items-center gap-2 rounded-lg border border-line bg-panel px-3 text-[13px] text-muted transition-colors hover:border-line-strong hover:text-fg"
        >
          <Search className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-left text-faint">{t('sidebar.searchOrJump')}</span>
          <Kbd>{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}</Kbd>
          <Kbd>K</Kbd>
        </button>
      </div>

      <nav className="scroll-area flex-1 px-3 pb-4">
        {lib.partial ? (
          <div className="flex items-center gap-2 px-2.5 pt-2 text-[12px] text-muted">
            <LoaderCircle className="size-3.5 animate-spin" /> {t('sidebar.loading')}
          </div>
        ) : null}
        <div className="space-y-0.5 pt-2">
          <NavItem icon={<House />} label={t('nav.home')} active={route.page === 'home'} onClick={() => go('#/home')} />
          <NavItem icon={<Layers />} label={t('nav.all')} count={n(lib.counts.all)} active={isScope({ kind: 'all' })} onClick={() => go('#/library/all')} />
          <NavItem icon={<Inbox />} label={t('nav.unread')} count={n(lib.counts.unread)} active={isScope({ kind: 'unread' })} onClick={() => go('#/library/unread')} />
          <NavItem icon={<Star />} label={t('nav.starred')} count={n(lib.counts.starred)} active={isScope({ kind: 'starred' })} onClick={() => go('#/library/starred')} />
          {lib.counts.likes ? <NavItem icon={<Heart />} label={t('nav.likes')} count={n(lib.counts.likes)} active={isScope({ kind: 'likes' })} onClick={() => go('#/library/likes')} /> : null}
          <NavItem icon={<Archive />} label={t('nav.archive')} count={n(lib.counts.archived)} active={isScope({ kind: 'archived' })} onClick={() => go('#/library/archived')} />
          <NavItem icon={<ChartColumn />} label={t('nav.insights')} active={route.page === 'insights'} onClick={() => go('#/insights')} onIntent={() => void loadInsights()} />
        </div>

        <Section id="discover" title={t('sidebar.discover')}>
          <NavItem icon={<Brain />} label={t('nav.recall')} active={route.page === 'recall'} onClick={() => go('#/recall')} onIntent={() => void loadRecall()} />
          <NavItem icon={<Library />} label={t('nav.shelf')} active={route.page === 'shelf'} onClick={() => go('#/shelf')} onIntent={() => void loadShelf()} />
          <NavItem icon={<MessagesSquare />} label={t('nav.ask')} active={route.page === 'ask'} onClick={() => go('#/ask')} onIntent={() => void loadAsk()} />
          <NavItem icon={<Gift />} label={t('nav.wrapped')} active={route.page === 'wrapped'} onClick={() => go('#/wrapped')} onIntent={() => void loadWrapped()} />
        </Section>

        <Section id="categories" title={t('sidebar.categories')} action={<SectionAction label={t('sidebar.manageCategories')} onClick={() => go('#/settings/categories')} icon={<Settings />} />}>
          {shownCats.map((c) => (
            <NavItem
              key={c.id}
              icon={<CategoryGlyph category={c} />}
              label={catName(c)}
              count={n(lib.counts.categories.get(c.id))}
              active={isScope({ kind: 'category', value: c.id })}
              onClick={() => go(scopeHash({ kind: 'category', value: c.id }))}
            />
          ))}
          {empty.length && withCount.length ? (
            <button type="button" onClick={() => setShowEmpty((x) => !x)} className="flex h-7 w-full items-center gap-2 rounded-lg px-2.5 text-[12px] text-muted hover:text-fg">
              <ChevronRight className={cn('size-3.5 transition-transform', showEmpty && 'rotate-90')} />
              {showEmpty ? t('sidebar.hideEmpty') : t('sidebar.nEmpty', { count: empty.length })}
            </button>
          ) : null}
        </Section>

        <Section id="collections" title={t('common.collections')} action={<SectionAction label={t('sidebar.newCollection')} onClick={() => openCollectionDialog()} icon={<Plus />} />}>
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
              className="flex h-8 w-full items-center gap-2.5 rounded-lg border border-dashed border-line-strong px-2.5 text-[13px] text-muted transition-colors hover:border-accent/50 hover:text-fg"
            >
              <Plus className="size-3.5" /> {t('sidebar.createCollection')}
            </button>
          ) : null}
        </Section>

        {(Object.keys(FACET_ICONS) as Facet[]).some((f) => lib.counts.facets.get(f)) ? (
          <Section id="smart" title={t('sidebar.smartViews')}>
            {(Object.keys(FACET_ICONS) as Facet[]).map((f) =>
              lib.counts.facets.get(f) ? (
                <NavItem
                  key={f}
                  icon={FACET_ICONS[f]}
                  label={t(`facet.${f}`)}
                  count={n(lib.counts.facets.get(f))}
                  active={isScope({ kind: 'facet', value: f })}
                  onClick={() => go(scopeHash({ kind: 'facet', value: f }))}
                />
              ) : null,
            )}
          </Section>
        ) : null}

        {authors.length ? (
          <Section id="authors" title={t('sidebar.topAuthors')}>
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
              <button type="button" onClick={() => setShowAllAuthors((x) => !x)} className="flex h-7 w-full items-center gap-2 rounded-lg px-2.5 text-[12px] text-muted hover:text-fg">
                <ChevronRight className={cn('size-3.5 transition-transform', showAllAuthors && 'rotate-90')} />
                {showAllAuthors ? t('sidebar.showFewer') : t('sidebar.showMore')}
              </button>
            ) : null}
          </Section>
        ) : null}

        {lib.tags.length ? (
          <Section id="tags" title={t('common.tags')}>
            <div className="flex flex-wrap gap-1.5 px-1.5 pt-0.5">
              {lib.tags.slice(0, 16).map(([tag, n]) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => go(scopeHash({ kind: 'tag', value: tag }))}
                  className={cn(
                    'h-6 max-w-full truncate rounded-full border px-2 text-[12px] transition-colors',
                    isScope({ kind: 'tag', value: tag }) ? 'border-accent/40 bg-accent-soft text-accent' : 'border-line bg-panel-2 text-fg-2 hover:bg-panel-3',
                  )}
                  title={t('common.posts', { count: n })}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </Section>
        ) : null}
      </nav>

      <div className="space-y-3 border-t border-line p-3">
        {aiState.running ? (
          <div className="rounded-xl border border-line bg-panel p-3">
            <div className="flex items-center gap-2 text-[12.5px] font-medium text-fg">
              <LoaderCircle className="size-3.5 shrink-0 animate-spin text-accent" />
              <span className="min-w-0 flex-1 truncate">{t('sidebar.aiOrganizing')}</span>
              <span className="tabular text-[12px] font-normal text-muted">
                {aiState.done}/{aiState.total}
              </span>
            </div>
            <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-panel-3">
              <div className="bg-brand h-full rounded-full transition-[width] duration-500" style={{ width: `${aiState.total ? (aiState.done / aiState.total) * 100 : 0}%` }} />
            </div>
          </div>
        ) : !isPro ? (
          <button
            type="button"
            onClick={() => go('#/settings/plan')}
            className="group flex w-full items-center gap-2.5 rounded-lg border border-line bg-panel px-3 py-2 text-left transition-colors hover:border-line-strong hover:bg-panel-2"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-medium text-fg">{t('sidebar.unlockPro')}</span>
              <span className="block truncate text-[11.5px] text-muted">{t('sidebar.proPitch')}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-faint transition-colors group-hover:text-fg" />
          </button>
        ) : null}

        <div className="space-y-2 px-0.5">
          <LastSynced className="block truncate" />
          <SyncButton hasData={lib.counts.total > 0} className="w-full" />
        </div>

        <div className="flex items-center gap-1">
          <button type="button" onClick={() => go('#/settings/general')} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-panel-2">
            {viewer ? (
              <Avatar name={viewer.handle} handle={viewer.handle} size={24} />
            ) : (
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-panel-2 text-muted">
                <Settings className="size-3.5" />
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-[12.5px] font-medium text-fg">{viewer ? `@${viewer.handle}` : t('nav.settings')}</span>
              <span className="block truncate text-[11.5px] text-muted">{viewer ? t('sidebar.connected') : t('sidebar.prefsPlan')}</span>
            </span>
          </button>
          <Tip label={dark ? t('sidebar.lightMode') : t('sidebar.darkMode')}>
            <button
              type="button"
              onClick={() => void update({ theme: dark ? 'light' : 'dark' })}
              className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-panel-2 hover:text-fg"
              aria-label={t('sidebar.toggleTheme')}
            >
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
          </Tip>
          <Tip label={t('nav.settings')}>
            <button
              type="button"
              onClick={() => go('#/settings/general')}
              className={cn('grid size-8 place-items-center rounded-lg transition-colors hover:bg-panel-2 hover:text-fg', route.page === 'settings' ? 'text-accent' : 'text-muted')}
              aria-label={t('nav.settings')}
            >
              <Settings className="size-4" />
            </button>
          </Tip>
        </div>
      </div>
    </aside>
  );
}
