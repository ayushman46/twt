import { ArrowRight, ArrowUpRight, Inbox, Search, Shuffle, Sparkles, Star } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { catName, rich, useT } from '@/i18n';
import { fmtCompact, fmtNumber, fmtRelative, fmtShortDate, fmtWeekdayDate, greeting } from '@/lib/format';
import { usePaintMark } from '@/lib/perf';
import { viewerItem, type Settings } from '@/lib/storage';
import type { Bookmark } from '@/lib/types';
import { useStorageItem } from '@/hooks/data';
import { useLibrary } from '@/hooks/library';
import { navigate, scopeHash } from '@/hooks/route';
import { useUi } from '@/store/ui';
import { Avatar } from '@/components/Brand';
import { DetailPanel } from '@/components/DetailPanel';
import { MediaGrid } from '@/components/Media';
import { RecallWidget } from '@/components/RecallWidget';
import { ShelfWidget } from '@/components/ShelfWidget';
import { LastSynced, SyncButton } from '@/components/SyncControl';
import { CategoryChip } from '@/components/TweetCard';
import { Button, Eyebrow, Kbd, cn } from '@/components/ui/primitives';
import { WelcomeView } from './WelcomeView';

const DAY = 86_400_000;

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const max = Math.max(1, ...values);
  const w = 120;
  const h = 34;
  const step = w / Math.max(1, values.length - 1);
  const pts = values.map((v, i) => [i * step, h - 3 - (v / max) * (h - 8)] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1]!;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn('h-[34px] w-[120px] overflow-visible', className)} aria-hidden>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill="var(--accent)" opacity={0.1} />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={3.5} fill="var(--accent)" stroke="var(--panel)" strokeWidth={2} />
    </svg>
  );
}

function StatTile({ label, value, icon, hint, onClick, children }: { label: string; value: string; icon?: ReactNode; hint?: ReactNode; onClick: () => void; children?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl border border-line bg-panel p-4 text-left shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-hover"
    >
      <div className="flex items-center justify-between text-[12.5px] text-muted">
        {label}
        {icon ?? <ArrowUpRight className="size-3.5 text-faint opacity-0 transition-opacity group-hover:opacity-100" />}
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div>
          {value === '…' ? <div className="skeleton h-[30px] w-16 rounded-lg" /> : <div className="text-[30px] leading-none font-semibold tracking-[-0.04em]">{value}</div>}
          {hint ? <div className="mt-1.5 text-[12px] text-muted">{hint}</div> : null}
        </div>
        {children}
      </div>
    </button>
  );
}

function ResurfaceCard({ b, onOpen, index }: { b: Bookmark; onOpen: (id: string) => void; index: number }) {
  const t = useT();
  const lib = useLibrary();
  return (
    <button
      type="button"
      onClick={() => onOpen(b.id)}
      style={{ animationDelay: `${index * 70}ms` }}
      className="group relative flex h-full animate-rise flex-col overflow-hidden rounded-2xl border border-line bg-panel p-5 text-left shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-hover"
    >
      <span aria-hidden className="bg-brand absolute inset-x-0 top-0 h-px opacity-60" />
      <Eyebrow className="text-[10.5px]">{t('home.savedWhen', { when: fmtRelative(b.savedAt) })}</Eyebrow>
      <div className="mt-3 flex items-center gap-2.5">
        <Avatar src={b.author.avatar} name={b.author.name} handle={b.author.handle} size={30} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold">{b.author.name}</div>
          <div className="truncate text-[12px] text-muted">@{b.author.handle}</div>
        </div>
      </div>
      {b.summary ? (
        <p className="mt-3 flex gap-1.5 text-[12.5px] font-medium text-accent">
          <Sparkles className="mt-0.5 size-3.5 shrink-0" /> {b.summary}
        </p>
      ) : null}
      <p className="mt-2.5 line-clamp-5 flex-1 text-[14px] leading-[1.6] text-fg-2">{b.text || b.card?.title || b.article?.title}</p>
      {b.media[0] ? <MediaGrid media={b.media.slice(0, 1)} compact className="mt-3 max-h-40" /> : null}
      <div className="mt-4 flex items-center justify-between">
        <CategoryChip category={lib.categoryMap.get(b.category)} />
        <span className="text-[12px] text-faint opacity-0 transition-opacity group-hover:opacity-100">{t('home.open')}</span>
      </div>
    </button>
  );
}

export function HomeView({ settings }: { settings: Settings }) {
  const t = useT();
  const lib = useLibrary();
  const openDetail = useUi((s) => s.openDetail);
  const setPaletteOpen = useUi((s) => s.setPaletteOpen);
  const viewer = useStorageItem(viewerItem, null);
  const [shuffle, setShuffle] = useState(0);
  const daySeed = Math.floor(Date.now() / DAY);

  const resurface = useMemo(() => {
    const cutoff = Date.now() - 14 * DAY;
    const pool = lib.bookmarks.filter((b) => !b.archived && b.savedAt < cutoff && (b.text.length > 60 || b.media.length));
    const source = pool.length >= 3 ? pool : lib.bookmarks.filter((b) => !b.archived);
    const rnd = seeded(daySeed * 31 + shuffle * 7919);
    const picks: Bookmark[] = [];
    const used = new Set<number>();
    while (picks.length < Math.min(3, source.length) && used.size < source.length) {
      const i = Math.floor(rnd() * source.length);
      if (used.has(i)) continue;
      used.add(i);
      picks.push(source[i]!);
    }
    return picks;
  }, [lib.bookmarks, daySeed, shuffle]);

  const recent = useMemo(() => [...lib.bookmarks].filter((b) => !b.archived).sort((a, b) => b.savedAt - a.savedAt).slice(0, 6), [lib.bookmarks]);

  const weekly = useMemo(() => {
    const now = Date.now();
    const weeks = new Array(10).fill(0) as number[];
    for (const b of lib.bookmarks) {
      const w = Math.floor((now - b.savedAt) / (7 * DAY));
      if (w >= 0 && w < 10) weeks[9 - w]!++;
    }
    return weeks;
  }, [lib.bookmarks]);

  const catCards = useMemo(() => {
    const byCat = new Map<string, Bookmark[]>();
    for (const b of lib.bookmarks) {
      if (b.archived) continue;
      const list = byCat.get(b.category) ?? [];
      if (list.length < 40) list.push(b);
      byCat.set(b.category, list);
    }
    return lib.categories
      .filter((c) => (lib.counts.categories.get(c.id) ?? 0) > 0)
      .map((c) => {
        const seen = new Set<string>();
        const faces = (byCat.get(c.id) ?? []).filter((b) => (seen.has(b.author.handle) ? false : (seen.add(b.author.handle), true))).slice(0, 3);
        return { c, count: lib.counts.categories.get(c.id) ?? 0, faces };
      })
      .sort((a, b) => b.count - a.count);
  }, [lib.bookmarks, lib.categories, lib.counts.categories]);

  usePaintMark('route:home:painted', !lib.loading);

  if (lib.loading) return <div className="p-10" />;
  if (!lib.counts.total) return <WelcomeView embedded settings={settings} />;

  const maxCat = Math.max(1, ...catCards.map((x) => x.count));
  const thisWeek = weekly[9] ?? 0;
  const lastWeek = weekly[8] ?? 0;
  const topCat = catCards[0];

  return (
    <div className="relative">
      <div aria-hidden className="aurora pointer-events-none absolute inset-x-0 top-0 h-[420px]" />
      <div aria-hidden className="dot-grid pointer-events-none absolute inset-x-0 top-0 h-[360px] [mask-image:linear-gradient(to_bottom,black,transparent)] opacity-40" />

      <div className="relative mx-auto w-full max-w-[1240px] px-5 pt-10 pb-16 sm:px-8">
        <header className="animate-rise">
          <Eyebrow>{fmtWeekdayDate(Date.now())}</Eyebrow>
          <h1 className="mt-3 text-[40px] leading-[1.05] font-semibold tracking-[-0.045em] text-balance sm:text-[46px]">
            {greeting()},{' '}
            <span className="serif-accent text-brand pr-1 text-[1.12em]">{viewer ? `@${viewer.handle}` : t('home.welcomeBack')}</span>
          </h1>
          <p className="mt-3 text-[15px] text-muted">
            {lib.partial ? t('home.loadingStash') : t('home.summary', { posts: lib.counts.all, cats: catCards.length })} · <LastSynced className="text-[15px]" />
          </p>
        </header>

        <div className="mt-7 flex animate-rise flex-wrap items-center gap-3 [animation-delay:60ms]">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="glass flex h-12 min-w-[280px] flex-1 items-center gap-3 rounded-2xl border border-line px-4 text-left text-[14.5px] text-faint shadow-card transition-all hover:border-line-strong hover:shadow-hover sm:max-w-[560px]"
          >
            <Search className="size-[18px] text-muted" />
            <span className="flex-1 truncate">{t('home.searchPlaceholder')}</span>
            <Kbd>{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}</Kbd>
            <Kbd>K</Kbd>
          </button>
          <SyncButton hasData size="lg" />
        </div>

        <div className="mt-8 grid animate-rise grid-cols-2 gap-3 [animation-delay:120ms] md:grid-cols-4">
          <StatTile label={t('home.inStash')} value={lib.partial ? '…' : fmtNumber(lib.counts.all)} onClick={() => navigate('#/library/all')} hint={t('home.archivedCount', { count: fmtNumber(lib.counts.archived) })} />
          <StatTile
            label={t('home.savedThisWeek')}
            value={lib.partial ? '…' : fmtNumber(thisWeek)}
            onClick={() => navigate('#/insights')}
            hint={thisWeek === lastWeek ? t('home.sameAsLastWeek') : t('home.vsLastWeek', { delta: `${thisWeek > lastWeek ? '+' : '−'}${fmtNumber(Math.abs(thisWeek - lastWeek))}` })}
          >
            <Sparkline values={weekly} className="hidden lg:block" />
          </StatTile>
          <StatTile label={t('nav.unread')} value={lib.partial ? '…' : fmtNumber(lib.counts.unread)} icon={<Inbox className="size-4 text-accent" />} onClick={() => navigate('#/library/unread')} hint={t('home.waiting')} />
          <StatTile
            label={t('home.topCategory')}
            value={lib.partial ? '…' : topCat ? topCat.c.emoji : '—'}
            icon={<Star className="size-4 fill-amber-400 text-amber-400" />}
            onClick={() => topCat && navigate(scopeHash({ kind: 'category', value: topCat.c.id }))}
            hint={topCat ? `${catName(topCat.c)} · ${fmtNumber(topCat.count)}` : undefined}
          />
        </div>

        <div className="mt-8 grid animate-rise gap-4 [animation-delay:150ms]">
          <RecallWidget />
          <ShelfWidget />
        </div>

        {resurface.length ? (
          <section className="mt-12">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-[20px] font-semibold tracking-[-0.03em]">
                  {t('home.rediscover')} <span className="serif-accent text-[22px] font-normal text-muted">{t('home.gems')}</span>
                </h2>
                <p className="mt-0.5 text-[13px] text-muted">{t('home.rediscoverDesc')}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setShuffle((x) => x + 1)}>
                <Shuffle /> {t('home.shuffle')}
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {resurface.map((b, i) => (
                <ResurfaceCard key={`${b.id}-${shuffle}`} b={b} index={i} onOpen={openDetail} />
              ))}
            </div>
          </section>
        ) : null}

        <div className="cv-auto mt-12 grid gap-8 lg:grid-cols-[1.45fr_1fr]">
          <section>
            <div className="mb-4 flex items-end justify-between">
              <h2 className="text-[20px] font-semibold tracking-[-0.03em]">{t('home.yourCategories')}</h2>
              <Button size="sm" variant="ghost" onClick={() => navigate('#/settings/categories')}>
                {t('home.manage')}
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {catCards.map(({ c, count, faces }, i) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => navigate(scopeHash({ kind: 'category', value: c.id }))}
                  style={{ animationDelay: `${i * 40}ms` }}
                  className="group relative animate-rise overflow-hidden rounded-2xl border border-line bg-panel p-4 text-left shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-hover"
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -top-12 -right-12 size-36 rounded-full opacity-25 blur-2xl transition-opacity duration-300 group-hover:opacity-50"
                    style={{ background: c.color }}
                  />
                  <div className="relative flex items-start justify-between gap-2">
                    <span className="grid size-11 place-items-center rounded-[14px] text-[22px] ring-1 ring-line" style={{ background: `color-mix(in oklab, ${c.color} 16%, var(--panel))` }}>
                      {c.emoji}
                    </span>
                    <div className="flex -space-x-2">
                      {faces.map((b) => (
                        <Avatar key={b.author.handle} src={b.author.avatar} name={b.author.name} handle={b.author.handle} size={24} className="ring-2 ring-panel" />
                      ))}
                    </div>
                  </div>
                  <div className="relative mt-4 text-[15px] font-semibold tracking-[-0.02em]">{catName(c)}</div>
                  <div className="relative flex items-center justify-between text-[12.5px] text-muted">
                    {t('common.posts', { count })}
                    <ArrowRight className="size-3.5 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                  </div>
                  <div className="relative mt-3 h-1 overflow-hidden rounded-full bg-panel-2">
                    <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${(count / maxCat) * 100}%`, background: c.color }} />
                  </div>
                </button>
              ))}
            </div>
          </section>

          <div className="space-y-8">
            <section>
              <div className="mb-4 flex items-end justify-between">
                <h2 className="text-[20px] font-semibold tracking-[-0.03em]">{t('home.recent')}</h2>
                <Button size="sm" variant="ghost" onClick={() => navigate('#/library/all')}>
                  {t('home.viewAll')} <ArrowRight />
                </Button>
              </div>
              <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel shadow-card">
                {recent.map((b) => (
                  <button key={b.id} type="button" onClick={() => openDetail(b.id)} className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-panel-2/60">
                    <Avatar src={b.author.avatar} name={b.author.name} handle={b.author.handle} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[12.5px]">
                        {!b.read ? <span className="bg-brand size-1.5 shrink-0 rounded-full" /> : null}
                        <span className="truncate font-semibold">{b.author.name}</span>
                        <span className="shrink-0 text-muted">· {fmtShortDate(b.savedAt)}</span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-fg-2">{b.text || b.card?.title || t('common.mediaPost')}</p>
                    </div>
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-panel-2 text-[14px]" title={(() => { const c = lib.categoryMap.get(b.category); return c ? catName(c) : undefined; })()}>
                      {lib.categoryMap.get(b.category)?.emoji}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            {lib.authors.length ? (
              <section>
                <h2 className="mb-4 text-[20px] font-semibold tracking-[-0.03em]">{t('home.learnFrom')}</h2>
                <div className="flex flex-wrap gap-2">
                  {lib.authors.slice(0, 10).map((a) => (
                    <button
                      key={a.handle}
                      type="button"
                      onClick={() => navigate(scopeHash({ kind: 'author', value: a.handle }))}
                      className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-panel pr-3 pl-1 text-[13px] shadow-card transition-all hover:-translate-y-px hover:border-line-strong"
                    >
                      <Avatar src={a.avatar} name={a.name} handle={a.handle} size={28} />
                      <span className="max-w-[120px] truncate font-medium">{a.name || a.handle}</span>
                      <span className="tabular text-faint">{fmtCompact(a.count)}</span>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="relative overflow-hidden rounded-2xl border border-line bg-panel p-5 text-[13px] text-muted shadow-card">
              <span aria-hidden className="aurora absolute inset-0 opacity-60" />
              <div className="relative">
                <div className="flex items-center gap-2 font-semibold text-fg">
                  <Sparkles className="size-4 text-accent" /> {t('home.powerSearch')}
                </div>
                <p className="mt-1.5 leading-relaxed">
                  {rich(t('home.powerSearchBody'), { c: (s) => <code className="text-accent">{s}</code>, k: (s) => <Kbd>{s}</Kbd> })}
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>

      <DetailPanel items={recent} onSearch={(q) => (useUi.getState().setQuery(q), navigate('#/library/all'))} />
    </div>
  );
}
