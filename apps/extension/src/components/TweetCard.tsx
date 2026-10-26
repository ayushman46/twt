import { Check, ExternalLink, Eye, Heart, MessageCircle, Ellipsis, Repeat2, Star, StickyNote } from 'lucide-react';
import { memo, useState } from 'react';
import { catName, useT, type MessageKey } from '@/i18n';
import { setStarred } from '@/lib/actions';
import { fmtCompact, fmtLongDate, fmtShortDate } from '@/lib/format';
import type { Bookmark, Category } from '@/lib/types';
import { Avatar, Verified } from './Brand';
import { BookmarkMenu } from './BookmarkMenu';
import { CategoryGlyph } from './CategoryGlyph';
import { MediaGrid } from './Media';
import { ArticleCard, LinkPreview, PollView, QuotedPost } from './TweetParts';
import { TweetText } from './TweetText';
import { LazyTip } from './ui/overlays';
import { cn } from './ui/primitives';

/** Body text is clamped to this many lines in grid cards (keep in sync with `line-clamp-[8]` below). */
export const CARD_LINES = 8;
const CLAMP_AT = 360;

export interface CardProps {
  b: Bookmark;
  /** Entrance animation (only for the first screen of cards). */
  animate?: boolean;
  category?: Category;
  highlight?: string[];
  selected?: boolean;
  focused?: boolean;
  selectMode?: boolean;
  showSummary?: boolean;
  showMetrics?: boolean;
  onOpen: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onSearch?: (q: string) => void;
}

/** Quiet category label: glyph and muted name, no background. */
export function CategoryChip({ category, className }: { category?: Category; className?: string }) {
  useT();
  if (!category) return null;
  return (
    <span className={cn('inline-flex h-6 max-w-[160px] shrink-0 items-center gap-1.5 text-[12px] text-muted', className)}>
      <CategoryGlyph category={category} className="text-[13px] text-muted" />
      <span className="truncate">{catName(category)}</span>
    </span>
  );
}

export function Metrics({ b, className }: { b: Bookmark; className?: string }) {
  const t = useT();
  const items: Array<{ icon: typeof Heart; v: number; label: MessageKey }> = [
    { icon: MessageCircle, v: b.metrics.replies, label: 'metric.replies' },
    { icon: Repeat2, v: b.metrics.retweets, label: 'metric.reposts' },
    { icon: Heart, v: b.metrics.likes, label: 'metric.likes' },
    { icon: Eye, v: b.metrics.views, label: 'metric.views' },
  ];
  return (
    <div className={cn('flex shrink-0 items-center gap-3 text-[12px] text-muted tabular-nums', className)}>
      {items.map(({ icon: Icon, v, label }) =>
        v ? (
          <span key={label} className="inline-flex items-center gap-1" title={t(label, { count: v })}>
            <Icon className="size-3.5" />
            {fmtCompact(v)}
          </span>
        ) : null,
      )}
    </div>
  );
}

export function SelectBox({ checked, onToggle, className }: { checked: boolean; onToggle: () => void; className?: string }) {
  const t = useT();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={checked ? t('common.deselect') : t('common.select')}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      // On phones the hit area grows to 36px; the visible box stays 20px and the layout doesn't move.
      className={cn('group/sel grid size-5 shrink-0 place-items-center rounded-md max-sm:-m-2 max-sm:size-9', className)}
    >
      <span
        className={cn(
          'grid size-5 place-items-center rounded-md border transition-colors',
          checked ? 'border-accent bg-accent text-accent-fg' : 'border-line-strong bg-panel text-transparent group-hover/sel:border-accent/70',
        )}
      >
        <Check className="size-3.5" strokeWidth={3} />
      </span>
    </button>
  );
}

export const TweetCard = memo(function TweetCard({ b, animate = true, category, highlight, selected, focused, selectMode, showSummary = true, showMetrics = true, onOpen, onToggleSelect, onSearch }: CardProps) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const long = b.text.length > CLAMP_AT || (b.text.match(/\n/g)?.length ?? 0) > 5;

  return (
    <article
      data-id={b.id}
      onClick={(e) => {
        if (selectMode || e.metaKey || e.ctrlKey || e.shiftKey) onToggleSelect(b.id);
        else onOpen(b.id);
      }}
      className={cn(
        animate && 'animate-fade-in',
        'group relative cursor-pointer rounded-xl border bg-panel p-4 transition-colors duration-150',
        selected ? 'border-accent bg-accent-soft' : focused ? 'border-accent/60' : 'border-line hover:border-line-strong',
      )}
    >
      <header className="flex items-start gap-3">
        <div className="relative shrink-0">
          <Avatar src={b.author.avatar} name={b.author.name} handle={b.author.handle} size={36} />
          <SelectBox
            checked={!!selected}
            onToggle={() => onToggleSelect(b.id)}
            className={cn('absolute -top-1 -left-1', selected || selectMode ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100')}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[14px] leading-5 font-semibold text-fg">{b.author.name || b.author.handle}</span>
            {b.author.verified ? <Verified className="size-3.5 shrink-0 fill-accent text-accent-fg" /> : null}
            {!b.read ? <span role="img" aria-label={t('card.unread')} title={t('card.unread')} className="size-1.5 shrink-0 rounded-full bg-accent" /> : null}
          </div>
          <div className="truncate text-[12px] leading-4 text-muted">
            <button
              type="button"
              className="hover:text-fg hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                onSearch?.(`from:${b.author.handle}`);
              }}
            >
              @{b.author.handle}
            </button>{' '}
            · <time title={fmtLongDate(b.createdAt)}>{fmtShortDate(b.createdAt)}</time>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <LazyTip label={b.starred ? t('common.unstar') : t('common.star')} shortcut="S">
            <button
              type="button"
              aria-pressed={!!b.starred}
              onClick={(e) => {
                e.stopPropagation();
                void setStarred([b.id], !b.starred);
              }}
              className={cn('grid size-7 place-items-center rounded-lg transition-colors hover:bg-panel-2 max-sm:size-9', b.starred ? 'text-amber-500' : 'text-muted hover:text-fg')}
              aria-label={t('common.star')}
            >
              <Star key={String(b.starred)} className={cn('size-4', b.starred && 'animate-pop fill-amber-400 text-amber-400')} />
            </button>
          </LazyTip>
          <LazyTip label={t('common.openOnX')} shortcut="O">
            <a
              href={b.url}
              target="_blank"
              rel="noreferrer noopener"
              onClick={(e) => e.stopPropagation()}
              className="grid size-7 place-items-center rounded-lg text-muted opacity-0 transition-[opacity,color,background-color] group-hover:opacity-100 hover:bg-panel-2 hover:text-fg focus-visible:opacity-100"
              aria-label={t('common.openOnX')}
            >
              <ExternalLink className="size-4" />
            </a>
          </LazyTip>
          <BookmarkMenu b={b}>
            <button type="button" onClick={(e) => e.stopPropagation()} className="grid size-7 place-items-center rounded-lg text-muted hover:bg-panel-2 hover:text-fg max-sm:size-9" aria-label={t('card.moreActions')}>
              <Ellipsis className="size-4" />
            </button>
          </BookmarkMenu>
        </div>
      </header>

      {showSummary && b.summary ? <p className="mt-3 rounded-lg bg-panel-2 px-3 py-2 text-[13px] leading-[1.5] text-fg-2">{b.summary}</p> : null}

      {b.text ? (
        <div className="mt-2.5">
          <TweetText
            text={b.text}
            highlight={highlight}
            onHashtag={(tag) => onSearch?.(tag)}
            onMention={(h) => onSearch?.(`from:${h}`)}
            className={cn('text-[14px] leading-[1.55] text-fg-2', long && !expanded && 'line-clamp-[8]')}
          />
          {long ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((x) => !x);
              }}
              className="mt-1 text-[12.5px] font-medium text-accent hover:underline"
            >
              {expanded ? t('card.showLess') : t('card.showMore')}
            </button>
          ) : null}
        </div>
      ) : null}

      {b.article ? (
        <div className="mt-3">
          <ArticleCard article={b.article} url={b.url} />
        </div>
      ) : null}
      {b.media.length ? <MediaGrid media={b.media} className="mt-3" /> : null}
      {b.poll ? (
        <div className="mt-3">
          <PollView poll={b.poll} />
        </div>
      ) : null}
      {!b.media.length && b.card ? <LinkPreview card={b.card} className="mt-3" /> : null}
      {b.quoted ? <QuotedPost q={b.quoted} highlight={highlight} className="mt-3" /> : null}

      {b.note.trim() ? (
        <div className="mt-3 flex gap-2 rounded-lg border border-line bg-panel-2 px-3 py-2 text-[13px] text-fg-2">
          <StickyNote className="mt-0.5 size-3.5 shrink-0 text-muted" />
          <span className="line-clamp-3 whitespace-pre-wrap">{b.note}</span>
        </div>
      ) : null}

      <footer className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <CategoryChip category={category} />
        {b.tags.slice(0, 3).map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSearch?.(`tag:"${tag}"`);
            }}
            className="max-w-[140px] truncate text-[12px] text-muted hover:text-fg hover:underline"
          >
            #{tag}
          </button>
        ))}
        {b.tags.length > 3 ? <span className="text-[12px] text-muted">+{b.tags.length - 3}</span> : null}
        {showMetrics ? <Metrics b={b} className="ml-auto" /> : null}
      </footer>
    </article>
  );
});
