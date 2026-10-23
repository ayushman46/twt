import { FileText, Link2 } from 'lucide-react';
import { fmtCompact, fmtShortDate, mediaUrl } from '@/lib/format';
import type { Article, LinkCard, Poll, QuotedTweet } from '@/lib/types';
import { Avatar, Verified } from './Brand';
import { MediaGrid } from './Media';
import { TweetText } from './TweetText';
import { cn } from './ui/primitives';

export function QuotedPost({ q, highlight, className }: { q: QuotedTweet; highlight?: string[]; className?: string }) {
  return (
    <a
      href={q.url}
      target="_blank"
      rel="noreferrer noopener"
      onClick={(e) => e.stopPropagation()}
      className={cn('block rounded-xl border border-line p-3 transition-colors hover:bg-panel-2/60', className)}
    >
      <div className="flex min-w-0 items-center gap-1.5 text-[13px]">
        <Avatar src={q.author.avatar} name={q.author.name} handle={q.author.handle} size={18} />
        <span className="truncate font-semibold text-fg">{q.author.name}</span>
        {q.author.verified ? <Verified className="size-3.5" /> : null}
        <span className="truncate text-muted">
          @{q.author.handle} · {fmtShortDate(q.createdAt)}
        </span>
      </div>
      {q.text ? <TweetText text={q.text} highlight={highlight} className="mt-1.5 line-clamp-5 text-[13.5px] leading-[1.5] text-fg-2" /> : null}
      {q.media.length ? <MediaGrid media={q.media} compact className="mt-2" /> : null}
    </a>
  );
}

export function LinkPreview({ card, className }: { card: LinkCard; className?: string }) {
  const large = !!card.image;
  return (
    <a
      href={card.url}
      target="_blank"
      rel="noreferrer noopener"
      onClick={(e) => e.stopPropagation()}
      className={cn('group/link block overflow-hidden rounded-xl border border-line transition-colors hover:bg-panel-2/60', className)}
    >
      {large ? (
        <div className="aspect-[1.91/1] overflow-hidden border-b border-line bg-panel-2">
          <img src={mediaUrl(card.image!, 'medium')} alt="" loading="lazy" decoding="async" className="size-full object-cover transition-transform duration-500 group-hover/link:scale-[1.02]" />
        </div>
      ) : null}
      <div className="flex items-start gap-3 px-3 py-2.5">
        {!large ? (
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-panel-2 text-muted">
            <Link2 className="size-4" />
          </span>
        ) : null}
        <div className="min-w-0">
          <div className="truncate text-[12px] text-muted">{card.domain}</div>
          {card.title ? <div className="line-clamp-2 text-[13.5px] leading-snug font-medium text-fg">{card.title}</div> : null}
          {card.description && !large ? <div className="mt-0.5 line-clamp-1 text-[12.5px] text-muted">{card.description}</div> : null}
        </div>
      </div>
    </a>
  );
}

export function PollView({ poll }: { poll: Poll }) {
  const total = poll.options.reduce((s, o) => s + o.votes, 0) || 1;
  const max = Math.max(...poll.options.map((o) => o.votes));
  return (
    <div className="space-y-1.5">
      {poll.options.map((o) => {
        const pct = Math.round((o.votes / total) * 100);
        return (
          <div key={o.label} className="relative overflow-hidden rounded-lg bg-panel-2 px-3 py-1.5 text-[13px]">
            <div className={cn('absolute inset-y-0 left-0 rounded-lg', o.votes === max ? 'bg-accent/25' : 'bg-panel-3')} style={{ width: `${pct}%` }} />
            <div className="relative flex justify-between gap-3">
              <span className={cn('truncate', o.votes === max && 'font-semibold')}>{o.label}</span>
              <span className="text-muted tabular-nums">{pct}%</span>
            </div>
          </div>
        );
      })}
      <div className="text-[12px] text-muted">{fmtCompact(total)} votes</div>
    </div>
  );
}

export function ArticleCard({ article, url }: { article: Article; url: string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer noopener" onClick={(e) => e.stopPropagation()} className="block overflow-hidden rounded-xl border border-line hover:bg-panel-2/60">
      {article.cover ? <img src={article.cover} alt="" loading="lazy" className="aspect-[2.4/1] w-full border-b border-line object-cover" /> : null}
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-[11.5px] font-medium tracking-wide text-muted uppercase">
          <FileText className="size-3.5" /> Article
        </div>
        <div className="mt-0.5 line-clamp-2 text-[14px] leading-snug font-semibold">{article.title}</div>
        {article.preview ? <div className="mt-1 line-clamp-2 text-[12.5px] text-muted">{article.preview}</div> : null}
      </div>
    </a>
  );
}
