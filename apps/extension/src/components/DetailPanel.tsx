import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronUp,
  Circle,
  Copy,
  Ellipsis,
  ExternalLink,
  Plus,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useT, type MessageKey } from '@/i18n';
import { addTags, removeFromCollection, removeTag, setArchived, setNote, setRead, setStarred } from '@/lib/actions';
import { fmtCompact, fmtLongDate, fmtNumber, fmtShortDate } from '@/lib/format';
import type { Bookmark } from '@/lib/types';
import { useLibrary } from '@/hooks/library';
import { useUi } from '@/store/ui';
import { Avatar, Verified } from './Brand';
import { BookmarkMenu, CategoryMenuItems, CollectionMenuItems, copyText } from './BookmarkMenu';
import { MediaGrid } from './Media';
import { CategoryChip, Metrics } from './TweetCard';
import { ArticleCard, LinkPreview, PollView, QuotedPost } from './TweetParts';
import { TranslateButton } from './TranslateButton';
import { TweetText } from './TweetText';
import { Menu, MenuContent, MenuTrigger, Tip } from './ui/overlays';
import { Button, Textarea, cn } from './ui/primitives';

const SOURCE_LABEL: Record<Bookmark['categorySource'], MessageKey> = {
  rule: 'detail.source.rule',
  author: 'detail.source.author',
  ai: 'detail.source.ai',
  user: 'detail.source.user',
};

function TagEditor({ b }: { b: Bookmark }) {
  const t = useT();
  const { tags: allTags } = useLibrary();
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const suggestions = useMemo(() => {
    const v = value.trim().toLowerCase().replace(/^#/, '');
    return allTags
      .map(([t]) => t)
      .filter((t) => !b.tags.includes(t) && (!v || t.includes(v)))
      .slice(0, 6);
  }, [allTags, value, b.tags]);

  const commit = (tag: string) => {
    if (!tag.trim()) return;
    void addTags([b.id], tag.split(',').map((t) => t.trim()));
    setValue('');
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {b.tags.map((tag) => (
          <span key={tag} className="group/tag inline-flex h-7 items-center gap-1 rounded-full bg-panel-2 pr-1 pl-2.5 text-[12.5px] text-fg-2">
            #{tag}
            <button type="button" onClick={() => void removeTag([b.id], tag)} className="grid size-5 place-items-center rounded-full text-faint hover:bg-panel-3 hover:text-fg" aria-label={t('detail.removeTag', { tag })}>
              <X className="size-3" />
            </button>
          </span>
        ))}
        <div className="relative">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                commit(value);
              } else if (e.key === 'Backspace' && !value && b.tags.length) {
                void removeTag([b.id], b.tags[b.tags.length - 1]!);
              } else if (e.key === 'Escape') {
                (e.target as HTMLInputElement).blur();
              }
              e.stopPropagation();
            }}
            placeholder={b.tags.length ? t('detail.addTag') : t('detail.addTags')}
            className="h-7 w-28 rounded-full border border-dashed border-line-strong bg-transparent px-2.5 text-[12.5px] outline-none placeholder:text-faint focus:w-40 focus:border-accent/60 transition-[width]"
          />
          {open && suggestions.length ? (
            <div className="absolute top-8 left-0 z-10 w-48 rounded-xl border border-line bg-panel p-1 shadow-pop">
              {suggestions.map((s) => (
                <button key={s} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => commit(s)} className="flex h-7 w-full items-center rounded-lg px-2 text-left text-[12.5px] hover:bg-panel-2">
                  #{s}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function NoteEditor({ b }: { b: Bookmark }) {
  const t = useT();
  const [value, setValue] = useState(b.note);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => setValue(b.note), [b.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <Textarea
      value={value}
      rows={3}
      placeholder={t('detail.notePlaceholder')}
      onChange={(e) => {
        const v = e.target.value;
        setValue(v);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => void setNote(b.id, v), 400);
      }}
      onBlur={() => value !== b.note && void setNote(b.id, value)}
      onKeyDown={(e) => e.stopPropagation()}
    />
  );
}

function MiniRow({ b, onOpen }: { b: Bookmark; onOpen: (id: string) => void }) {
  const t = useT();
  return (
    <button type="button" onClick={() => onOpen(b.id)} className="flex w-full items-start gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-panel-2">
      <Avatar src={b.author.avatar} name={b.author.name} handle={b.author.handle} size={26} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] text-muted">
          <span className="font-semibold text-fg">{b.author.name}</span> · {fmtShortDate(b.createdAt)}
        </div>
        <div className="line-clamp-2 text-[13px] leading-snug text-fg-2">{b.text || b.card?.title || t('common.mediaPost')}</div>
      </div>
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">{label}</div>
      {children}
    </div>
  );
}

export function DetailPanel({ items, highlight, onSearch }: { items: Bookmark[]; highlight?: string[]; onSearch: (q: string) => void }) {
  const t = useT();
  const activeId = useUi((s) => s.activeId);
  const openDetail = useUi((s) => s.openDetail);
  const lib = useLibrary();
  const b = activeId ? lib.byId.get(activeId) : undefined;
  const index = b ? items.findIndex((x) => x.id === b.id) : -1;

  useEffect(() => {
    if (!b || b.read) return;
    const t = setTimeout(() => void setRead([b.id], true), 900);
    return () => clearTimeout(t);
  }, [b?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const related = useMemo(() => {
    if (!b) return { author: [], similar: [] };
    const author = lib.bookmarks.filter((x) => x.id !== b.id && x.author.handle === b.author.handle).sort((x, y) => y.savedAt - x.savedAt).slice(0, 3);
    const seen = new Set([b.id, ...author.map((a) => a.id)]);
    const similar = lib.bookmarks
      .filter((x) => !seen.has(x.id) && !x.archived && x.category === b.category)
      .map((x) => ({ x, s: x.tags.filter((t) => b.tags.includes(t)).length * 3 + x.savedAt / 1e13 }))
      .sort((p, q) => q.s - p.s)
      .slice(0, 4)
      .map((p) => p.x);
    return { author, similar };
  }, [b, lib.bookmarks]);

  const go = (d: number) => {
    const next = items[index + d];
    if (next) openDetail(next.id);
  };

  return (
    <>
      {b ? (
        <>
          <div className="fixed inset-0 z-40 animate-fade-in bg-black/25 lg:bg-black/10" onClick={() => openDetail(null)} />
          <aside role="dialog" aria-label={t('detail.label')} className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[540px] animate-slide-in flex-col border-l border-line bg-panel shadow-pop">
            <header className="flex h-14 shrink-0 items-center gap-1 border-b border-line px-3">
              <Tip label={t('common.previous')} shortcut="K">
                <Button size="icon-sm" variant="ghost" disabled={index <= 0} onClick={() => go(-1)} aria-label={t('common.previous')}>
                  <ChevronUp />
                </Button>
              </Tip>
              <Tip label={t('common.next')} shortcut="J">
                <Button size="icon-sm" variant="ghost" disabled={index < 0 || index >= items.length - 1} onClick={() => go(1)} aria-label={t('common.next')}>
                  <ChevronDown />
                </Button>
              </Tip>
              {index >= 0 ? <span className="ml-1 text-[12px] text-faint tabular-nums">{fmtNumber(index + 1)} / {fmtNumber(items.length)}</span> : null}
              <div className="ml-auto flex items-center gap-0.5">
                <Tip label={b.starred ? t('common.unstar') : t('common.star')} shortcut="S">
                  <Button size="icon-sm" variant="ghost" onClick={() => void setStarred([b.id], !b.starred)} aria-label={t('common.star')}>
                    <Star className={cn(b.starred && 'fill-amber-400 text-amber-400')} />
                  </Button>
                </Tip>
                <Tip label={b.read ? t('common.markUnread') : t('common.markRead')} shortcut="R">
                  <Button size="icon-sm" variant="ghost" onClick={() => void setRead([b.id], !b.read)} aria-label={t('common.toggleRead')}>
                    <Circle className={cn(!b.read && 'fill-accent text-accent')} />
                  </Button>
                </Tip>
                <Tip label={b.archived ? t('common.unarchive') : t('common.archive')} shortcut="E">
                  <Button size="icon-sm" variant="ghost" onClick={() => void setArchived([b.id], !b.archived)} aria-label={t('common.archive')}>
                    {b.archived ? <ArchiveRestore /> : <Archive />}
                  </Button>
                </Tip>
                <Tip label={t('common.copyLink')}>
                  <Button size="icon-sm" variant="ghost" onClick={() => void copyText(b.url, t('common.linkCopied'))} aria-label={t('common.copyLink')}>
                    <Copy />
                  </Button>
                </Tip>
                <BookmarkMenu b={b}>
                  <Button size="icon-sm" variant="ghost" aria-label={t('common.more')}>
                    <Ellipsis />
                  </Button>
                </BookmarkMenu>
                <Button size="sm" variant="outline" className="ml-1" onClick={() => window.open(b.url, '_blank', 'noopener')}>
                  <ExternalLink /> {t('common.openOnX')}
                </Button>
                <Button size="icon-sm" variant="ghost" onClick={() => openDetail(null)} aria-label={t('common.close')}>
                  <X />
                </Button>
              </div>
            </header>

            <div className="scroll-area flex-1">
              <div className="px-6 pt-5 pb-6">
                <div className="flex items-center gap-3">
                  <Avatar src={b.author.avatar} name={b.author.name} handle={b.author.handle} size={48} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="truncate text-[15.5px] font-semibold">{b.author.name}</span>
                      {b.author.verified ? <Verified /> : null}
                    </div>
                    <div className="text-[13px] text-muted">
                      <button type="button" className="hover:text-fg hover:underline" onClick={() => onSearch(`from:${b.author.handle}`)}>
                        @{b.author.handle}
                      </button>
                      {b.author.followers ? ` · ${t('detail.followers', { count: fmtCompact(b.author.followers) })}` : ''}
                    </div>
                  </div>
                </div>

                {b.summary ? (
                  <div className="mt-4 flex gap-2 rounded-xl bg-accent-soft px-3.5 py-2.5 text-[13px] leading-snug text-fg-2">
                    <Sparkles className="mt-0.5 size-3.5 shrink-0 text-accent" />
                    <span>{b.summary}</span>
                  </div>
                ) : null}

                {b.text ? <TweetText text={b.text} highlight={highlight} onHashtag={onSearch} onMention={(h) => onSearch(`from:${h}`)} className="mt-4 text-[16px] leading-[1.6]" /> : null}
                {b.text ? <TranslateButton key={b.id} text={b.text} postId={b.id} className="mt-3" /> : null}
                {b.article ? (
                  <div className="mt-4">
                    <ArticleCard article={b.article} url={b.url} />
                  </div>
                ) : null}
                {b.media.length ? <MediaGrid media={b.media} className="mt-4" /> : null}
                {b.poll ? (
                  <div className="mt-4">
                    <PollView poll={b.poll} />
                  </div>
                ) : null}
                {b.card ? <LinkPreview card={b.card} className="mt-4" /> : null}
                {b.quoted ? <QuotedPost q={b.quoted} highlight={highlight} className="mt-4" /> : null}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-4 text-[12.5px] text-muted">
                  <span>{fmtLongDate(b.createdAt)}</span>
                  <Metrics b={b} />
                </div>
                {b.partial ? (
                  <p className="mt-3 rounded-lg bg-panel-2 px-3 py-2 text-[12px] text-muted">{t('detail.partial')}</p>
                ) : null}

                <div className="mt-5 space-y-5">
                  <Field label={t('common.category')}>
                    <div className="flex items-center gap-2">
                      <Menu>
                        <MenuTrigger asChild>
                          <button type="button" className="inline-flex items-center gap-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent">
                            <CategoryChip category={lib.categoryMap.get(b.category)} className="h-7 text-[12.5px]" />
                            <ChevronDown className="size-3.5 text-muted" />
                          </button>
                        </MenuTrigger>
                        <MenuContent align="start" className="w-56">
                          <CategoryMenuItems ids={[b.id]} current={b.category} />
                        </MenuContent>
                      </Menu>
                      <span className="text-[12px] text-faint">{t(SOURCE_LABEL[b.categorySource])}</span>
                    </div>
                  </Field>

                  <Field label={t('common.collections')}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {b.collections.map((id) => {
                        const c = lib.collectionMap.get(id);
                        if (!c) return null;
                        return (
                          <span key={id} className="inline-flex h-7 items-center gap-1.5 rounded-full border border-line pr-1 pl-2.5 text-[12.5px]">
                            {c.emoji} {c.name}
                            <button type="button" onClick={() => void removeFromCollection([b.id], id)} className="grid size-5 place-items-center rounded-full text-faint hover:bg-panel-2 hover:text-fg" aria-label={t('detail.removeFrom', { name: c.name })}>
                              <X className="size-3" />
                            </button>
                          </span>
                        );
                      })}
                      <Menu>
                        <MenuTrigger asChild>
                          <button type="button" className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-line-strong px-2.5 text-[12.5px] text-muted hover:border-accent/50 hover:text-fg">
                            <Plus className="size-3.5" /> {t('common.add')}
                          </button>
                        </MenuTrigger>
                        <MenuContent align="start" className="w-56">
                          <CollectionMenuItems ids={[b.id]} current={b.collections} />
                        </MenuContent>
                      </Menu>
                    </div>
                  </Field>

                  <Field label={t('common.tags')}>
                    <TagEditor b={b} />
                  </Field>

                  <Field label={t('common.note')}>
                    <NoteEditor b={b} />
                  </Field>

                  <div className="text-[12px] leading-relaxed text-faint">
                    {t(b.sources.includes('like') ? (b.sources.includes('bookmark') ? 'detail.savedFromBoth' : 'detail.savedFromLikes') : 'detail.savedFromBookmarks', { date: fmtLongDate(b.savedAt) })}
                  </div>
                </div>

                {related.author.length ? (
                  <div className="mt-6">
                    <div className="mb-1 text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">{t('detail.moreFrom', { handle: b.author.handle })}</div>
                    {related.author.map((x) => (
                      <MiniRow key={x.id} b={x} onOpen={openDetail} />
                    ))}
                  </div>
                ) : null}
                {related.similar.length ? (
                  <div className="mt-5">
                    <div className="mb-1 text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">{t('detail.related')}</div>
                    {related.similar.map((x) => (
                      <MiniRow key={x.id} b={x} onOpen={openDetail} />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </>
  );
}
