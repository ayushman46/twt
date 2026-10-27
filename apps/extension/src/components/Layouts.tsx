/** The four library layouts, all virtualized (only on-screen items are mounted). */
import { Heart, Play, Star } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '@/i18n';
import { fmtCompact, fmtShortDate, mediaUrl } from '@/lib/format';
import type { Bookmark, Category, Media } from '@/lib/types';
import { Avatar, Verified } from './Brand';
import { CARD_LINES, CategoryChip, SelectBox, TweetCard } from './TweetCard';
import { Highlight, highlightRegex } from './TweetText';
import { VirtualMasonry, virtualRegistry } from './VirtualMasonry';
import { cn } from './ui/primitives';

export interface LayoutProps {
  resetKey: string;
  items: Bookmark[];
  categoryMap: Map<string, Category>;
  highlight?: string[];
  selection: Set<string>;
  focusId: string | null;
  selectMode: boolean;
  showSummary: boolean;
  showMetrics: boolean;
  onOpen: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onSearch: (q: string) => void;
}

const getId = (b: Bookmark) => b.id;

/** Card height estimate; refined by measurement once rendered. */
function estimateCard(b: Bookmark, colWidth: number): number {
  const textW = colWidth - 32;
  const charsPerLine = Math.max(24, textW / 7.1);
  // Padding, header, footer. Body: 14px at line-height 1.55, clamped to CARD_LINES.
  let h = 116;
  if (b.text) {
    const lines = Math.min(CARD_LINES, Math.ceil(b.text.length / charsPerLine) + (b.text.match(/\n/g)?.length ?? 0) * 0.6);
    h += 10 + Math.max(1, lines) * 21.7;
    if (b.text.length > 360) h += 21; // "Show more"
  }
  if (b.summary) h += 60;
  const mediaW = textW;
  if (b.media.length) h += b.media.length === 1 ? Math.min(440, mediaW / Math.max(0.75, Math.min((b.media[0]!.width ?? 16) / (b.media[0]!.height ?? 9), 2))) + 12 : mediaW * (b.media.length === 2 ? 9 / 16 : 3 / 4) + 12;
  else if (b.card) h += b.card.image ? mediaW / 1.91 + 76 : 76;
  if (b.quoted) h += 86 + Math.min(5, Math.ceil(b.quoted.text.length / charsPerLine)) * 21 + (b.quoted.media.length ? 170 : 0);
  if (b.article) h += 160;
  if (b.poll) h += 40 * b.poll.options.length + 24;
  if (b.note) h += 58;
  return h;
}

export function MasonryGrid(p: LayoutProps) {
  const render = useCallback(
    (b: Bookmark, i: number) => (
      <TweetCard
        b={b}
        animate={i < 9}
        category={p.categoryMap.get(b.category)}
        highlight={p.highlight}
        selected={p.selection.has(b.id)}
        focused={p.focusId === b.id}
        selectMode={p.selectMode}
        showSummary={p.showSummary}
        showMetrics={p.showMetrics}
        onOpen={p.onOpen}
        onToggleSelect={p.onToggleSelect}
        onSearch={p.onSearch}
      />
    ),
    [p.categoryMap, p.highlight, p.selection, p.focusId, p.selectMode, p.showSummary, p.showMetrics, p.onOpen, p.onToggleSelect, p.onSearch],
  );
  return <VirtualMasonry items={p.items} getKey={getId} estimate={estimateCard} render={render} minColWidth={330} maxCols={5} gap={16} />;
}

const ListRow = memo(function ListRow({
  b,
  selected,
  focused,
  selectMode,
  showMetrics,
  category,
  re,
  onOpen,
  onToggleSelect,
}: {
  b: Bookmark;
  selected: boolean;
  focused: boolean;
  selectMode: boolean;
  showMetrics: boolean;
  category?: Category;
  re: RegExp | null;
  onOpen: (id: string) => void;
  onToggleSelect: (id: string) => void;
}) {
  const t = useT();
  const thumb = b.media[0]?.url ?? b.card?.image ?? b.quoted?.media[0]?.url;
  return (
    <div
      data-id={b.id}
      onClick={(e) => (selectMode || e.metaKey || e.ctrlKey || e.shiftKey ? onToggleSelect(b.id) : onOpen(b.id))}
      className={cn(
        'group relative flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition-colors',
        selected ? 'border-accent bg-accent-soft' : focused ? 'border-accent/60 bg-panel-2' : 'border-transparent hover:bg-panel-2',
      )}
    >
      <div className="relative shrink-0">
        <Avatar src={b.author.avatar} name={b.author.name} handle={b.author.handle} size={36} />
        <SelectBox checked={selected} onToggle={() => onToggleSelect(b.id)} className={cn('absolute -top-1 -left-1', selected || selectMode ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100')} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[14px] font-semibold text-fg">{b.author.name}</span>
          {b.author.verified ? <Verified className="size-3.5 shrink-0 fill-accent text-accent-fg" /> : null}
          {!b.read ? <span role="img" aria-label={t('card.unread')} title={t('card.unread')} className="size-1.5 shrink-0 rounded-full bg-accent" /> : null}
          <span className="truncate text-[12px] text-muted">
            @{b.author.handle} · {fmtShortDate(b.createdAt)}
          </span>
          {b.starred ? <Star className="ml-auto size-3.5 shrink-0 fill-amber-400 text-amber-400" /> : null}
        </div>
        <p className="mt-0.5 line-clamp-2 text-[14px] leading-[1.55] text-fg-2">
          <Highlight text={b.summary && !b.text ? b.summary : b.text || b.card?.title || b.article?.title || (b.media.length ? t('common.mediaPost') : '')} re={re} />
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <CategoryChip category={category} className="h-5" />
          {b.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="max-w-[140px] truncate text-[12px] text-muted">
              #{tag}
            </span>
          ))}
          {showMetrics && b.metrics.likes ? (
            <span className="ml-auto inline-flex items-center gap-1 text-[12px] text-muted tabular-nums">
              <Heart className="size-3.5" />
              {fmtCompact(b.metrics.likes)}
            </span>
          ) : null}
        </div>
      </div>
      {thumb ? (
        <div className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-line bg-panel-2">
          <img src={mediaUrl(thumb, 'small')} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
          {b.media[0] && b.media[0].type !== 'photo' ? (
            <span className="absolute inset-0 grid place-items-center bg-black/20">
              <Play className="size-4 fill-white text-white" />
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});

const estimateRow = (b: Bookmark) => (b.media.length || b.card?.image ? 98 : 92);

export function ListLayout(p: LayoutProps) {
  const re = useMemo(() => highlightRegex(p.highlight), [p.highlight]);
  const render = useCallback(
    (b: Bookmark) => (
      <ListRow
        b={b}
        selected={p.selection.has(b.id)}
        focused={(p.focusId ?? '') === b.id}
        selectMode={p.selectMode}
        showMetrics={p.showMetrics}
        category={p.categoryMap.get(b.category)}
        re={re}
        onOpen={p.onOpen}
        onToggleSelect={p.onToggleSelect}
      />
    ),
    [p.selection, p.focusId, p.selectMode, p.showMetrics, p.categoryMap, re, p.onOpen, p.onToggleSelect],
  );
  return (
    <div className="mx-auto max-w-3xl">
      <VirtualMasonry items={p.items} getKey={getId} estimate={estimateRow} render={render} minColWidth={1} maxCols={1} gap={2} overscan={1200} />
    </div>
  );
}

const ROW = 46;

/** Windowed table: fixed-height rows between two spacer rows. */
export function TableLayout(p: LayoutProps) {
  const t = useT();
  const re = useMemo(() => highlightRegex(p.highlight), [p.highlight]);
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  const [range, setRange] = useState({ start: 0, end: 40 });
  const allSelected = p.items.length > 0 && p.items.every((b) => p.selection.has(b.id));

  useEffect(() => {
    let raf = 0;
    const read = () => {
      raf = 0;
      const el = bodyRef.current;
      if (!el) return;
      const top = -el.getBoundingClientRect().top;
      const start = Math.max(0, Math.floor(top / ROW) - 15);
      const end = Math.min(p.items.length, Math.ceil((top + window.innerHeight) / ROW) + 15);
      setRange((r) => (r.start === start && r.end === end ? r : { start, end }));
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
  }, [p.items.length]);

  useEffect(() => {
    virtualRegistry.scrollToKey = (key) => {
      const i = p.items.findIndex((b) => b.id === key);
      const el = bodyRef.current;
      if (i < 0 || !el) return false;
      const abs = el.getBoundingClientRect().top + window.scrollY + i * ROW;
      if (abs < window.scrollY + 140 || abs + ROW > window.scrollY + window.innerHeight - 40) window.scrollTo({ top: abs - window.innerHeight / 2 });
      return true;
    };
    return () => {
      virtualRegistry.scrollToKey = undefined;
    };
  }, [p.items]);

  const rows = p.items.slice(range.start, range.end);
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-panel">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] table-fixed text-left text-[13px]">
          <colgroup>
            <col className="w-10" />
            <col />
            <col className="w-44" />
            <col className="w-44" />
            <col className="w-20" />
            <col className="w-20" />
            <col className="w-28" />
          </colgroup>
          <thead className="bg-panel-2/60 text-[12px] font-medium text-muted">
            <tr>
              <th className="px-3 py-2.5">
                <SelectBox
                  checked={allSelected}
                  onToggle={() => {
                    if (allSelected) for (const b of p.items) p.onToggleSelect(b.id);
                    else for (const b of p.items) if (!p.selection.has(b.id)) p.onToggleSelect(b.id);
                  }}
                />
              </th>
              <th className="px-2 py-2.5">{t('layout.post')}</th>
              <th className="px-2 py-2.5">{t('layout.author')}</th>
              <th className="px-2 py-2.5">{t('common.category')}</th>
              <th className="px-2 py-2.5 text-right">{t('layout.likes')}</th>
              <th className="px-2 py-2.5 text-right">{t('layout.views')}</th>
              <th className="px-3 py-2.5 text-right">{t('layout.saved')}</th>
            </tr>
          </thead>
          <tbody ref={bodyRef}>
            {range.start > 0 ? <tr style={{ height: range.start * ROW }} aria-hidden /> : null}
            {rows.map((b) => {
              const selected = p.selection.has(b.id);
              return (
                <tr
                  key={b.id}
                  data-id={b.id}
                  style={{ height: ROW }}
                  onClick={(e) => (p.selectMode || e.metaKey || e.ctrlKey || e.shiftKey ? p.onToggleSelect(b.id) : p.onOpen(b.id))}
                  className={cn('cursor-pointer border-t border-line transition-colors', selected ? 'bg-accent-soft' : p.focusId === b.id ? 'bg-panel-2' : 'hover:bg-panel-2/60')}
                >
                  <td className="px-3">
                    <SelectBox checked={selected} onToggle={() => p.onToggleSelect(b.id)} />
                  </td>
                  <td className="max-w-0 px-2">
                    <div className="flex items-center gap-2">
                      {!b.read ? <span className="size-1.5 shrink-0 rounded-full bg-accent" /> : null}
                      {b.starred ? <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" /> : null}
                      <span className="truncate text-fg">
                        <Highlight text={(b.text || b.card?.title || b.article?.title || t('common.mediaPost')).replace(/\s+/g, ' ')} re={re} />
                      </span>
                    </div>
                  </td>
                  <td className="px-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Avatar src={b.author.avatar} name={b.author.name} handle={b.author.handle} size={22} />
                      <span className="truncate text-fg-2">@{b.author.handle}</span>
                    </div>
                  </td>
                  <td className="px-2">
                    <CategoryChip category={p.categoryMap.get(b.category)} className="h-5 text-[11px]" />
                  </td>
                  <td className="tabular px-2 text-right text-muted">{fmtCompact(b.metrics.likes)}</td>
                  <td className="tabular px-2 text-right text-muted">{b.metrics.views ? fmtCompact(b.metrics.views) : '—'}</td>
                  <td className="px-3 text-right whitespace-nowrap text-muted">{fmtShortDate(b.savedAt)}</td>
                </tr>
              );
            })}
            {range.end < p.items.length ? <tr style={{ height: (p.items.length - range.end) * ROW }} aria-hidden /> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface Tile {
  b: Bookmark;
  m: Media;
  key: string;
}

const tileKey = (t: Tile) => t.key;
const tileEstimate = () => 200;

export function GalleryLayout(p: LayoutProps) {
  const t = useT();
  const tiles = useMemo(() => p.items.flatMap((b) => b.media.map((m, i): Tile => ({ b, m, key: `${b.id}:${i}` }))), [p.items]);
  const render = useCallback(
    ({ b, m }: Tile) => (
      <button
        type="button"
        onClick={() => p.onOpen(b.id)}
        className={cn('group relative block aspect-square w-full overflow-hidden rounded-xl border bg-panel-2', p.selection.has(b.id) ? 'border-accent' : 'border-line')}
      >
        <img src={mediaUrl(m.url, 'small')} alt={m.alt ?? ''} loading="lazy" decoding="async" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
        {m.type !== 'photo' ? (
          <span className="absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-black/55 text-white">
            <Play className="size-3.5 fill-white" />
          </span>
        ) : null}
        <span className="absolute inset-x-0 bottom-0 translate-y-2 bg-black/65 p-2.5 text-left opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
          <span className="flex items-center gap-1.5 text-[12px] font-semibold text-white">
            <Avatar src={b.author.avatar} name={b.author.name} handle={b.author.handle} size={18} />
            <span className="truncate">@{b.author.handle}</span>
          </span>
          {b.text ? <span className="mt-1 line-clamp-2 block text-[11.5px] leading-snug text-white/85">{b.text}</span> : null}
        </span>
      </button>
    ),
    [p.onOpen, p.selection],
  );
  if (!tiles.length) return <div className="py-20 text-center text-sm text-muted">{t('layout.noMedia')}</div>;
  return <VirtualMasonry items={tiles} getKey={tileKey} estimate={tileEstimate} render={render} minColWidth={190} maxCols={12} gap={10} squareRatio={1} />;
}
