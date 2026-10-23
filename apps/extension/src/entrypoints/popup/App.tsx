import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowUpRight, Heart, Inbox, LayoutDashboard, RefreshCw, Search, Settings, Square, Star, Zap } from 'lucide-react';
import { useState } from 'react';
import { db } from '@/lib/db';
import { fmtNumber, fmtRelative } from '@/lib/format';
import { send } from '@/lib/messages';
import { usePaintMark } from '@/lib/perf';
import { isSyncActive, lastSyncItem, type SyncMode } from '@/lib/storage';
import type { Source } from '@/lib/types';
import { useSettings, useStorageItem, useSyncState, useThemeClass } from '@/hooks/data';
import { Logo, Wordmark } from '@/components/Brand';
import { Button, Kbd, cn } from '@/components/ui/primitives';

async function openDashboard(hash = '') {
  await send('open/dashboard', { hash }).catch(() => undefined);
  window.close();
}

export function PopupApp() {
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
    <div className="relative w-[372px] overflow-hidden bg-bg text-fg">
      <div aria-hidden className="aurora pointer-events-none absolute inset-x-0 top-0 h-48" />

      <header className="relative flex items-center gap-2.5 px-4 pt-4 pb-3">
        <Logo className="size-8 drop-shadow-[0_6px_14px_rgb(150_80_255/0.45)]" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Wordmark className="text-[16px]" />
            <span className={cn('rounded-full px-1.5 py-px text-[9.5px] font-semibold tracking-wider uppercase', isPro ? 'btn-brand' : 'bg-panel-2 text-muted ring-1 ring-line')}>
              {isPro ? 'Pro' : 'Free'}
            </span>
          </div>
          <div className="text-[11.5px] text-muted">{active ? 'Syncing in an X tab…' : last.bookmark ? `Synced ${fmtRelative(last.bookmark)}` : 'Not synced yet'}</div>
        </div>
        <button type="button" onClick={() => void openDashboard('#/settings/general')} className="grid size-8 place-items-center rounded-[10px] text-muted hover:bg-panel-2 hover:text-fg" aria-label="Settings">
          <Settings className="size-4" />
        </button>
      </header>

      <form
        className="relative px-4"
        onSubmit={(e) => {
          e.preventDefault();
          void openDashboard(q.trim() ? `#/library/all?q=${encodeURIComponent(q.trim())}` : '#/library/all');
        }}
      >
        <label className="relative block">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search your stash…"
            className="glass h-11 w-full rounded-[14px] border border-line pr-3 pl-10 text-[13.5px] shadow-card outline-none placeholder:text-faint focus:border-accent/60 focus:ring-4 focus:ring-accent/15"
          />
        </label>
      </form>

      <div className="relative grid grid-cols-3 gap-2 px-4 pt-3">
        {[
          { label: 'Stashed', value: data?.total, icon: <ArrowUpRight className="size-3.5 text-faint" />, hash: '#/library/all' },
          { label: 'Unread', value: data?.unread, icon: <Inbox className="size-3.5 text-accent" />, hash: '#/library/unread' },
          { label: 'Starred', value: data?.starred, icon: <Star className="size-3.5 fill-amber-400 text-amber-400" />, hash: '#/library/starred' },
        ].map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => void openDashboard(s.hash)}
            className="rounded-[14px] border border-line bg-panel px-3 py-2.5 text-left shadow-card transition-all hover:-translate-y-px hover:shadow-hover"
          >
            <div className="flex items-center justify-between text-[11.5px] text-muted">
              {s.label}
              {s.icon}
            </div>
            <div className="mt-1 text-[21px] leading-none font-semibold tracking-[-0.04em]">{s.value === undefined ? '–' : fmtNumber(s.value)}</div>
          </button>
        ))}
      </div>

      <div className="relative px-4 pt-3">
        {active ? (
          <div className="ring-brand rounded-[14px] bg-panel p-3.5 shadow-card">
            <div className="flex items-center gap-2 text-[13px] font-medium">
              <RefreshCw className="size-4 animate-spin text-accent" /> Syncing {sync.source === 'like' ? 'likes' : 'bookmarks'}…
            </div>
            <div className="mt-2 flex gap-4 text-[12px] text-muted">
              <span>
                <b className="tabular text-[15px] font-semibold text-fg">{fmtNumber(sync.found)}</b> found
              </span>
              <span>
                <b className="tabular text-[15px] font-semibold text-fg">{fmtNumber(sync.added)}</b> new
              </span>
            </div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-panel-2">
              <div className="bg-brand h-full w-1/3 animate-indeterminate rounded-full" />
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="secondary" className="flex-1" onClick={() => void start(sync.source, sync.mode)}>
                Show X tab
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void send('sync/stop', {})}>
                <Square className="!size-3 fill-current" /> Stop
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Button variant="primary" size="lg" className="h-11 w-full rounded-[14px]" onClick={() => void start('bookmark', data?.total ? 'quick' : 'full')}>
              {data?.total ? <Zap /> : <RefreshCw />} {data?.total ? 'Sync new bookmarks' : 'Sync my bookmarks'}
            </Button>
            <div className="flex gap-1.5">
              <Button size="sm" variant="ghost" className="flex-1" onClick={() => void start('bookmark', 'full')}>
                <RefreshCw /> Full sync
              </Button>
              <Button size="sm" variant="ghost" className="flex-1" onClick={() => void start('like', 'full')}>
                <Heart /> Import likes
              </Button>
            </div>
            {sync.status === 'error' && sync.message ? <p className="rounded-xl bg-bad/10 px-3 py-2 text-[12px] text-bad">{sync.message}</p> : null}
          </div>
        )}
      </div>

      {data?.top.length ? (
        <div className="relative px-4 pt-3">
          <div className="mb-1.5 text-[10.5px] font-semibold tracking-[0.12em] text-faint uppercase">Top categories</div>
          <div className="space-y-0.5">
            {data.top.map(({ c, n }) => (
              <button
                key={c.id}
                type="button"
                onClick={() => void openDashboard(`#/library/category/${c.id}`)}
                className="group grid w-full grid-cols-[24px_1fr_auto] items-center gap-2.5 rounded-[10px] px-1.5 py-1.5 text-left hover:bg-panel-2"
              >
                <span className="grid size-6 place-items-center rounded-lg text-[13px]" style={{ background: `color-mix(in oklab, ${c.color} 16%, var(--panel))` }}>
                  {c.emoji}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] text-fg-2 group-hover:text-fg">{c.name}</span>
                  <span className="mt-1 block h-1 overflow-hidden rounded-full bg-panel-2">
                    <span className="block h-full rounded-full" style={{ width: `${(n / max) * 100}%`, background: c.color }} />
                  </span>
                </span>
                <span className="tabular text-[12px] text-muted">{fmtNumber(n)}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <footer className="relative mt-4 border-t border-line px-4 py-3">
        <Button variant="outline" className="h-10 w-full rounded-[12px]" onClick={() => void openDashboard('#/home')}>
          <LayoutDashboard /> Open dashboard
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
