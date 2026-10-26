import { useLiveQuery } from 'dexie-react-hooks';
import { LayoutDashboard, RefreshCw, Search, Settings, Square, Zap, Heart } from 'lucide-react';
import { useState } from 'react';
import { catName, rich, useT } from '@/i18n';
import { db } from '@/lib/db';
import { fmtNumber, fmtRelative } from '@/lib/format';
import { send } from '@/lib/messages';
import { usePaintMark } from '@/lib/perf';
import { isSyncActive, lastSyncItem, type SyncMode } from '@/lib/storage';
import type { Source } from '@/lib/types';
import { useSettings, useStorageItem, useSyncState, useThemeClass } from '@/hooks/data';
import { Logo, Wordmark } from '@/components/Brand';
import { CategoryGlyph } from '@/components/CategoryGlyph';
import { Button, Kbd, cn } from '@/components/ui/primitives';

async function openDashboard(hash = '') {
  await send('open/dashboard', { hash }).catch(() => undefined);
  window.close();
}

export function PopupApp() {
  const t = useT();
  const [settings] = useSettings();
  useThemeClass(settings.theme);
  const sync = useSyncState();
  const last = useStorageItem(lastSyncItem, { bookmark: null, like: null });
  const [q, setQ] = useState('');
  const active = isSyncActive(sync);
  const isPro = settings.license?.status === 'active';

  const data = useLiveQuery(async () => {
    const [total, unread, starred, categories] = await Promise.all([
      db.bookmarks.count(),
      db.bookmarks.where('read').equals(0).count(),
      db.bookmarks.where('starred').equals(1).count(),
      db.categories.toArray(),
    ]);
    // Index-only counts: no records are read or deserialized.
    const enabled = categories.filter((c) => c.enabled);
    const counts = await Promise.all(enabled.map((c) => db.bookmarks.where('[archived+category]').equals([0, c.id]).count()));
    const top = enabled
      .map((c, i) => ({ c, n: counts[i]! }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n)
      .slice(0, 5);
    return { total, unread, starred, top };
  }, []);

  const start = async (source: Source, mode: SyncMode) => {
    await send('sync/start', { source, mode }).catch(() => undefined);
    window.close();
  };

  usePaintMark('popup:painted', data !== undefined);
  const max = Math.max(1, ...(data?.top.map((t) => t.n) ?? [1]));

  return (
    <div className="w-[372px] bg-bg text-fg">
      <header className="flex items-center gap-2.5 px-4 pt-4 pb-3">
        <Logo className="size-7" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Wordmark className="text-[15px]" />
            <span className={cn('rounded-full px-1.5 py-px text-[11px] font-medium ring-1 ring-line', isPro ? 'bg-accent-soft text-accent' : 'bg-panel text-muted')}>
              {isPro ? 'Pro' : t('common.free')}
            </span>
          </div>
          <div className="truncate text-[12px] text-muted">{active ? t('sync.inXTab') : last.bookmark ? t('sync.synced', { when: fmtRelative(last.bookmark) }) : t('sync.never')}</div>
        </div>
        <button
          type="button"
          onClick={() => void openDashboard('#/settings/general')}
          className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-panel-2 hover:text-fg"
          aria-label={t('nav.settings')}
        >
          <Settings className="size-4" />
        </button>
      </header>

      <form
        className="px-4"
        onSubmit={(e) => {
          e.preventDefault();
          void openDashboard(q.trim() ? `#/library/all?q=${encodeURIComponent(q.trim())}` : '#/library/all');
        }}
      >
        <label className="relative block">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('popup.searchPlaceholder')}
            className="h-9 w-full rounded-lg border border-line-strong bg-panel pr-3 pl-9 text-[13.5px] text-fg outline-none transition-[border-color,box-shadow] placeholder:text-faint focus:border-accent focus:shadow-[inset_0_0_0_1px_var(--accent)]"
          />
        </label>
      </form>

      <div className="grid grid-cols-3 gap-2 px-4 pt-3">
        {[
          { label: t('popup.stashed'), value: data?.total, hash: '#/library/all' },
          { label: t('nav.unread'), value: data?.unread, hash: '#/library/unread' },
          { label: t('nav.starred'), value: data?.starred, hash: '#/library/starred' },
        ].map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => void openDashboard(s.hash)}
            className="rounded-xl border border-line bg-panel px-3 py-2.5 text-left transition-colors hover:bg-panel-2"
          >
            <div className="truncate text-[12px] text-muted">{s.label}</div>
            <div className="tabular mt-1.5 text-[20px] leading-none font-semibold tracking-[-0.02em]">{s.value === undefined ? '–' : fmtNumber(s.value)}</div>
          </button>
        ))}
      </div>

      <div className="px-4 pt-3">
        {active ? (
          <div className="rounded-xl border border-line bg-panel p-3">
            <div className="flex items-center gap-2 text-[13px] font-medium">
              <RefreshCw className="size-4 animate-spin text-accent" /> {sync.source === 'like' ? t('popup.syncingLikes') : t('popup.syncingBookmarks')}
            </div>
            <div className="mt-2 flex gap-4 text-[12px] text-muted">
              <span>{rich(t('popup.found', { count: fmtNumber(sync.found) }), { b: (s) => <b className="tabular font-semibold text-fg">{s}</b> })}</span>
              <span>{rich(t('popup.new', { count: fmtNumber(sync.added) }), { b: (s) => <b className="tabular font-semibold text-fg">{s}</b> })}</span>
            </div>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-panel-3">
              <div className="bg-brand h-full w-1/3 animate-indeterminate rounded-full" />
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="secondary" className="flex-1" onClick={() => void start(sync.source, sync.mode)}>
                {t('popup.showTab')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void send('sync/stop', {})}>
                <Square className="!size-3 fill-current" /> {t('popup.stop')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Button variant="primary" size="md" className="w-full" onClick={() => void start('bookmark', data?.total ? 'quick' : 'full')}>
              {data?.total ? <Zap /> : <RefreshCw />} {data?.total ? t('popup.syncNew') : t('popup.syncMine')}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" variant="secondary" onClick={() => void start('bookmark', 'full')}>
                <RefreshCw /> {t('sync.full')}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => void start('like', 'full')}>
                <Heart /> {t('sync.importLikes')}
              </Button>
            </div>
            {sync.status === 'error' && sync.message ? <p className="rounded-lg bg-bad/10 px-3 py-2 text-[12px] text-bad">{sync.message}</p> : null}
          </div>
        )}
      </div>

      {data?.top.length ? (
        <div className="px-4 pt-4">
          <div className="mb-1 text-[12px] font-medium text-muted">{t('popup.topCategories')}</div>
          <div className="-mx-1.5 space-y-0.5">
            {data.top.map(({ c, n }) => (
              <button
                key={c.id}
                type="button"
                onClick={() => void openDashboard(`#/library/category/${c.id}`)}
                className="group grid w-full grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-panel-2"
              >
                <CategoryGlyph category={c} className="size-4 text-muted group-hover:text-fg-2" />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] text-fg-2 group-hover:text-fg">{catName(c)}</span>
                  <span className="mt-1.5 block h-[3px] overflow-hidden rounded-full bg-panel-3">
                    <span className="block h-full rounded-full bg-fg/25" style={{ width: `${(n / max) * 100}%` }} />
                  </span>
                </span>
                <span className="tabular text-[12px] text-muted">{fmtNumber(n)}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <footer className="mt-4 border-t border-line p-4">
        <Button variant="secondary" size="md" className="w-full justify-start" onClick={() => void openDashboard('#/home')}>
          <LayoutDashboard /> <span className="min-w-0 truncate">{t('popup.openDashboard')}</span>
          <span className="ml-auto flex items-center gap-1">
            <Kbd>Alt</Kbd>
            <Kbd>⇧</Kbd>
            <Kbd>S</Kbd>
          </span>
        </Button>
      </footer>
    </div>
  );
}
