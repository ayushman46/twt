import { Check, ExternalLink, Eye, Heart, MessageCircle, Ellipsis, Repeat2, Sparkles, Star, StickyNote } from 'lucide-react';
import { memo, useState } from 'react';
import { setStarred } from '@/lib/actions';
import { fmtCompact, fmtShortDate } from '@/lib/format';
import type { Bookmark, Category } from '@/lib/types';
import { Avatar, Verified } from './Brand';
import { BookmarkMenu } from './BookmarkMenu';
import { MediaGrid } from './Media';
import { ArticleCard, LinkPreview, PollView, QuotedPost } from './TweetParts';
import { TweetText } from './TweetText';
import { LazyTip } from './ui/overlays';
import { cn } from './ui/primitives';

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

export function CategoryChip({ category, className }: { category?: Category; className?: string }) {
  if (!category) return null;
  return (
    <span
      className={cn('inline-flex h-6 max-w-[150px] shrink-0 items-center gap-1 rounded-full px-2 text-[11.5px] font-medium', className)}
      style={{ background: `color-mix(in oklab, ${category.color} 13%, transparent)`, color: `color-mix(in oklab, ${category.color} 70%, var(--fg))` }}
    >
      <span aria-hidden>{category.emoji}</span>
      <span className="truncate">{category.name}</span>
    </span>
  );
}

export function Metrics({ b, className }: { b: Bookmark; className?: string }) {
  const items = [
    { icon: MessageCircle, v: b.metrics.replies, label: 'replies' },
    { icon: Repeat2, v: b.metrics.retweets, label: 'reposts' },
    { icon: Heart, v: b.metrics.likes, label: 'likes' },
    { icon: Eye, v: b.metrics.views, label: 'views' },
  ];
  return (
    <div className={cn('flex items-center gap-3.5 text-[12px] text-faint tabular-nums', className)}>
      {items.map(({ icon: Icon, v, label }) =>
        v ? (
          <span key={label} className="inline-flex items-center gap-1" title={`${v.toLocaleString()} ${label}`}>
            <Icon className="size-3.5" />
            {fmtCompact(v)}
          </span>
        ) : null,
      )}
    </div>
  );
}

export function SelectBox({ checked, onToggle, className }: { checked: boolean; onToggle: () => void; className?: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={checked ? 'Deselect' : 'Select'}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        'grid size-5 place-items-center rounded-md border transition-all',
        checked ? 'border-accent bg-accent text-white' : 'border-line-strong bg-panel/90 text-transparent hover:border-accent/70',
        className,
      )}
    >
      <Check className="size-3.5" strokeWidth={3} />
    </button>
  );
}

const CLAMP_AT = 420;

export const TweetCard = memo(function TweetCard({ b, animate = true, category, highlight, selected, focused, selectMode, showSummary = true, showMetrics = true, onOpen, onToggleSelect, onSearch }: CardProps) {
  const [expanded, setExpanded] = useState(false);
  const long = b.text.length > CLAMP_AT;

  return (
    <article
      data-id={b.id}
      onClick={(e) => {
        if (selectMode || e.metaKey || e.ctrlKey || e.shiftKey) onToggleSelect(b.id);
        else onOpen(b.id);
      }}
      className={cn(
        animate && 'animate-rise',
        'group relative cursor-pointer rounded-[20px] border bg-panel p-[18px] shadow-card transition-[box-shadow,border-color,transform] duration-300 ease-out hover:-translate-y-0.5 hover:shadow-hover',
        selected ? 'ring-brand border-transparent shadow-[0_0_0_4px_var(--accent-soft)]' : focused ? 'border-accent/50' : 'border-line hover:border-line-strong',
      )}
    >
      {!b.read ? <span className="bg-brand absolute top-[26px] -left-[3px] size-1.5 rounded-full shadow-[0_0_8px_rgb(150_80_255/0.8)]" aria-label="Unread" /> : null}

      <header className="flex items-start gap-3">
        <div className="relative">
          <Avatar src={b.author.avatar} name={b.author.name} handle={b.author.handle} size={40} />
          <SelectBox
            checked={!!selected}
            onToggle={() => onToggleSelect(b.id)}
            className={cn('absolute -top-1 -left-1 shadow-sm', selected || selectMode ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}
          />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex min-w-0 items-center gap-1">
            <span className="truncate text-[14px] font-semibold text-fg">{b.author.name || b.author.handle}</span>
            {b.author.verified ? <Verified /> : null}
          </div>
          <div className="truncate text-[12.5px] text-muted">
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
            · <time title={new Date(b.createdAt).toLocaleString()}>{fmtShortDate(b.createdAt)}</time>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <LazyTip label={b.starred ? 'Unstar' : 'Star'} shortcut="S">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void setStarred([b.id], !b.starred);
                }}
                className="grid size-7 place-items-center rounded-lg text-muted hover:bg-panel-2 hover:text-fg"
                aria-label="Star"
              >
                <Star key={b.starred} className={cn('size-4', b.starred && 'animate-pop fill-amber-400 text-amber-400')} />
              </button>
            </LazyTip>
            <LazyTip label="Open on X" shortcut="O">
              <a
                href={b.url}
                target="_blank"
                rel="noreferrer noopener"
                onClick={(e) => e.stopPropagation()}
                className="grid size-7 place-items-center rounded-lg text-muted hover:bg-panel-2 hover:text-fg"
                aria-label="Open on X"
              >
                <ExternalLink className="size-4" />
              </a>
            </LazyTip>
          </div>
          {b.starred ? <Star className="size-3.5 fill-amber-400 text-amber-400 group-hover:hidden" /> : null}
          <BookmarkMenu b={b}>
            <button type="button" onClick={(e) => e.stopPropagation()} className="grid size-7 place-items-center rounded-lg text-muted hover:bg-panel-2 hover:text-fg" aria-label="More actions">
              <Ellipsis className="size-4" />
            </button>
          </BookmarkMenu>
        </div>
      </header>

      {showSummary && b.summary ? (
        <div className="mt-3 flex gap-2 rounded-xl bg-accent-soft px-3 py-2 text-[12.5px] leading-snug text-fg-2 ring-1 ring-accent/15">
          <Sparkles className="mt-px size-3.5 shrink-0 text-accent" />
          <span>{b.summary}</span>
        </div>
      ) : null}

      {b.text ? (
        <div className="mt-3">
          <TweetText
            text={b.text}
            highlight={highlight}
            onHashtag={(tag) => onSearch?.(tag)}
            onMention={(h) => onSearch?.(`from:${h}`)}
            className={cn('text-[14.75px] leading-[1.6] text-fg', long && !expanded && 'line-clamp-[9]')}
          />
          {long ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((x) => !x);
              }}
              className="mt-1 text-[13px] font-medium text-accent hover:underline"
            >
              {expanded ? 'Show less' : 'Show more'}
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
        <div className="mt-3 flex gap-2 rounded-xl border border-amber-400/25 bg-amber-400/8 px-3 py-2 text-[12.5px] text-fg-2">
          <StickyNote className="mt-px size-3.5 shrink-0 text-amber-500" />
          <span className="line-clamp-3 whitespace-pre-wrap">{b.note}</span>
        </div>
      ) : null}

      <footer className="mt-3.5 flex flex-wrap items-center gap-x-2 gap-y-2">
        <CategoryChip category={category} />
        {b.tags.slice(0, 3).map((t) => (
          <button
            key={t}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSearch?.(`tag:"${t}"`);
            }}
            className="h-6 max-w-[140px] truncate rounded-full bg-panel-2 px-2 text-[11.5px] text-fg-2 hover:bg-panel-3"
          >
            #{t}
          </button>
        ))}
        {b.tags.length > 3 ? <span className="text-[11.5px] text-faint">+{b.tags.length - 3}</span> : null}
        {showMetrics ? <Metrics b={b} className="ml-auto" /> : null}
      </footer>
    </article>
  );
});
