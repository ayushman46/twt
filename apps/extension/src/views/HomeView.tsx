import { ArrowRight, Search, Shuffle } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { catName, rich, useT } from '@/i18n';
import { fmtCompact, fmtNumber, fmtRelative, fmtShortDate } from '@/lib/format';
import { usePaintMark } from '@/lib/perf';
import type { Settings } from '@/lib/storage';
import type { Bookmark } from '@/lib/types';
import { useLibrary } from '@/hooks/library';
import { navigate, scopeHash } from '@/hooks/route';
import { useUi } from '@/store/ui';
import { Avatar } from '@/components/Brand';
import { CategoryGlyph } from '@/components/CategoryGlyph';
import { DetailPanel } from '@/components/DetailPanel';
import { MediaGrid } from '@/components/Media';
import { RecallWidget } from '@/components/RecallWidget';
import { ShelfWidget } from '@/components/ShelfWidget';
import { LastSynced, SyncButton } from '@/components/SyncControl';
import { Button, Kbd } from '@/components/ui/primitives';
import { WelcomeView } from './WelcomeView';

const DAY = 86_400_000;

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const SECTION_TITLE = 'text-[15px] font-semibold tracking-[-0.01em]';

/** One cell of the stats strip: muted label, tabular value, one note line. */
function StatCell({ label, value, note, loading, onClick }: { label: string; value: ReactNode; note?: ReactNode; loading?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-w-0 flex-col bg-panel p-4 text-left transition-colors hover:bg-panel-2">
      <span className="text-[12px] text-muted">{label}</span>
      <span className="mt-2 flex min-w-0 items-center gap-2 text-[26px] leading-tight font-semibold tracking-[-0.02em] tabular-nums">
        {loading ? <span className="skeleton h-[26px] w-14 rounded-md" aria-hidden /> : value}
      </span>
      {note ? <span className="mt-1.5 truncate text-[12px] text-muted">{note}</span> : null}
    </button>
  );
}

function ResurfaceCard({ b, onOpen }: { b: Bookmark; onOpen: (id: string) => void }) {
  const t = useT();
  const lib = useLibrary();
  const cat = lib.categoryMap.get(b.category);
  return (
    <div className="group flex h-full flex-col rounded-xl border border-line bg-panel transition-colors hover:bg-panel-2">
      <button type="button" data-resurface onClick={() => onOpen(b.id)} className="flex flex-1 flex-col rounded-t-xl p-4 text-left">
      <div className="flex items-center gap-2.5">
        <Avatar src={b.author.avatar} name={b.author.name} handle={b.author.handle} size={28} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold">{b.author.name}</div>
          <div className="truncate text-[12px] text-muted">@{b.author.handle}</div>
        </div>
      </div>
      {b.summary ? <p className="mt-3 text-[13px] font-medium text-fg">{b.summary}</p> : null}
      <p className={`${b.summary ? 'mt-1.5' : 'mt-3'} line-clamp-4 flex-1 text-[13.5px] leading-[1.6] text-fg-2`}>{b.text || b.card?.title || b.article?.title}</p>
      </button>
      {b.media[0] ? (
        <div className="mt-3 px-4">
          <MediaGrid media={b.media.slice(0, 1)} compact className="max-h-40" />
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-4 text-[12px] text-muted">
        {cat ? (
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <CategoryGlyph category={cat} className="text-muted" />
            <span className="truncate">{catName(cat)}</span>
          </span>
        ) : (
          <span />
        )}
        <span className="flex shrink-0 items-center gap-3">
          <span>{t('home.savedWhen', { when: fmtRelative(b.savedAt) })}</span>
          <span className="text-faint opacity-0 transition-opacity group-hover:opacity-100">{t('home.open')}</span>
        </span>
      </div>
    </div>
  );
}

export function HomeView({ settings }: { settings: Settings }) {
  const t = useT();
  const lib = useLibrary();
  const openDetail = useUi((s) => s.openDetail);
  const setPaletteOpen = useUi((s) => s.setPaletteOpen);
  const [shuffle, setShuffle] = useState(0);
  const [allCats, setAllCats] = useState(false);
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
      <div className="mx-auto w-full max-w-[1240px] px-5 pt-8 pb-16 sm:px-8">
        <header>
          <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.02em]">{t('nav.home')}</h1>
          <p className="mt-1 text-[13px] text-muted">
            {lib.partial ? t('home.loadingStash') : t('home.summary', { posts: lib.counts.all, cats: catCards.length })}
            {' · '}
            <LastSynced />
          </p>
        </header>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex h-9 min-w-0 flex-1 basis-full items-center gap-2.5 rounded-lg border border-line bg-panel px-3 text-left text-[14px] text-faint transition-colors hover:bg-panel-2 sm:basis-auto sm:max-w-[560px]"
          >
            <Search className="size-4 shrink-0 text-muted" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{t('home.searchPlaceholder')}</span>
            <Kbd>{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}</Kbd>
            <Kbd>K</Kbd>
          </button>
          <SyncButton hasData size="lg" />
        </div>

        <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-4">
          <StatCell
            label={t('home.inStash')}
            value={fmtNumber(lib.counts.all)}
            loading={lib.partial}
            onClick={() => navigate('#/library/all')}
            note={t('home.archivedCount', { count: fmtNumber(lib.counts.archived) })}
          />
          <StatCell
            label={t('home.savedThisWeek')}
            value={fmtNumber(thisWeek)}
            loading={lib.partial}
            onClick={() => navigate('#/insights')}
            note={thisWeek === lastWeek ? t('home.sameAsLastWeek') : t('home.vsLastWeek', { delta: `${thisWeek > lastWeek ? '+' : '−'}${fmtNumber(Math.abs(thisWeek - lastWeek))}` })}
          />
          <StatCell label={t('nav.unread')} value={fmtNumber(lib.counts.unread)} loading={lib.partial} onClick={() => navigate('#/library/unread')} note={t('home.waiting')} />
          <StatCell
            label={t('home.topCategory')}
            loading={lib.partial}
            value={
              topCat ? (
                <>
                  <CategoryGlyph category={topCat.c} className="size-5 shrink-0 text-muted" />
                  <span className="min-w-0 truncate tracking-[-0.02em]" title={catName(topCat.c)}>
                    {catName(topCat.c)}
                  </span>
                </>
              ) : (
                '—'
              )
            }
            onClick={() => topCat && navigate(scopeHash({ kind: 'category', value: topCat.c.id }))}
            note={topCat ? t('common.posts', { count: topCat.count }) : undefined}
          />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8">
          <RecallWidget />
          <ShelfWidget />
        </div>

        {resurface.length ? (
          <section className="mt-12">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <h2 className={SECTION_TITLE}>
                  {t('home.rediscover')}
                </h2>
                <p className="mt-0.5 text-[13px] text-muted">{t('home.rediscoverDesc')}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setShuffle((x) => x + 1)}>
                <Shuffle /> {t('home.shuffle')}
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {resurface.map((b) => (
                <ResurfaceCard key={`${b.id}-${shuffle}`} b={b} onOpen={openDetail} />
              ))}
            </div>
          </section>
        ) : null}

        <div className="cv-auto mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[1.45fr_1fr]">
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className={SECTION_TITLE}>{t('home.yourCategories')}</h2>
              <Button size="sm" variant="ghost" onClick={() => navigate('#/settings/categories')}>
                {t('home.manage')}
              </Button>
            </div>
            <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
              {(allCats ? catCards : catCards.slice(0, 8)).map(({ c, count }) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => navigate(scopeHash({ kind: 'category', value: c.id }))}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-panel-2"
                >
                  <CategoryGlyph category={c} className="size-4 text-muted" />
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-fg">{catName(c)}</span>
                  <span className="hidden h-[3px] w-28 overflow-hidden rounded-full bg-panel-2 sm:block" aria-hidden>
                    <span className="block h-full rounded-full bg-fg/25" style={{ width: `${(count / maxCat) * 100}%` }} />
                  </span>
                  <span className="w-10 text-right text-[12.5px] text-muted tabular-nums">{fmtNumber(count)}</span>
                </button>
              ))}
            </div>
            {catCards.length > 8 ? (
              <button type="button" onClick={() => setAllCats((x) => !x)} className="mt-2 rounded-md px-1 text-[12.5px] text-muted transition-colors hover:text-fg">
                {allCats ? t('card.showLess') : t('sidebar.showMore')}
              </button>
            ) : null}
          </section>

          <div className="space-y-10">
            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className={SECTION_TITLE}>{t('home.recent')}</h2>
                <Button size="sm" variant="ghost" onClick={() => navigate('#/library/all')}>
                  {t('home.viewAll')} <ArrowRight />
                </Button>
              </div>
              <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
                {recent.map((b) => {
                  const cat = lib.categoryMap.get(b.category);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => openDetail(b.id)}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-panel-2"
                    >
                      <Avatar src={b.author.avatar} name={b.author.name} handle={b.author.handle} size={28} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-[12.5px]">
                          {!b.read ? <span aria-hidden className="bg-accent size-1.5 shrink-0 rounded-full" /> : null}
                          <span className="truncate font-semibold">{b.author.name}</span>
                          <span className="shrink-0 text-muted">· {fmtShortDate(b.savedAt)}</span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-fg-2">{b.text || b.card?.title || t('common.mediaPost')}</p>
                      </div>
                      {cat ? (
                        <span role="img" aria-label={catName(cat)} title={catName(cat)} className="mt-0.5 shrink-0 text-muted">
                          <CategoryGlyph category={cat} className="size-4" />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>

            {lib.authors.length ? (
              <section>
                <h2 className={`mb-3 ${SECTION_TITLE}`}>{t('home.learnFrom')}</h2>
                <div className="flex flex-wrap gap-2">
                  {lib.authors.slice(0, 10).map((a) => (
                    <button
                      key={a.handle}
                      type="button"
                      onClick={() => navigate(scopeHash({ kind: 'author', value: a.handle }))}
                      className="inline-flex h-8 items-center gap-2 rounded-full border border-line bg-panel pr-3 pl-1 text-[13px] transition-colors hover:bg-panel-2"
                    >
                      <Avatar src={a.avatar} name={a.name} handle={a.handle} size={24} />
                      <span className="max-w-[120px] truncate font-medium">{a.name || a.handle}</span>
                      <span className="tabular-nums text-muted">{fmtCompact(a.count)}</span>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="rounded-xl border border-line bg-panel p-4">
              <h2 className={SECTION_TITLE}>{t('home.powerSearch')}</h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                {rich(t('home.powerSearchBody'), {
                  c: (s) => <code className="rounded bg-panel-2 px-1 py-px text-[12px] text-fg-2">{s}</code>,
                  k: (s) => <Kbd>{s}</Kbd>,
                })}
              </p>
            </section>
          </div>
        </div>
      </div>

      <DetailPanel items={recent} onSearch={(q) => (useUi.getState().setQuery(q), navigate('#/library/all'))} />
    </div>
  );
}
