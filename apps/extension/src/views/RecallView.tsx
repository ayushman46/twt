import { format, formatDistanceStrict } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import { Brain, Check, CircleCheck, ExternalLink, FlaskConical, Pencil, RotateCcw, SkipForward, SlidersHorizontal, Star, StickyNote, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { setNote, setStarred } from '@/lib/actions';
import { db } from '@/lib/db';
import { loadDemoLibrary } from '@/lib/demo';
import { fmtLongDate, fmtNumber, fmtShortDate, mediaUrl, plural } from '@/lib/format';
import {
  CARDS_PER_DAY_OPTIONS,
  EMPTY_STATS,
  addDays,
  completeSession,
  computeStreak,
  dayKey,
  dayStart,
  ensureTodaySession,
  extendSession,
  filterKey,
  fmtCountdown,
  isNewerSession,
  isPlayable,
  nextDayStart,
  normalizePrefs,
  pendingIds,
  ratingHint,
  recallPrefsItem,
  recallReasons,
  recallSessionItem,
  recallStatsItem,
  resetRecall,
  review,
  sessionMatches,
  skipCard,
  undoReview,
  updateRecallPrefs,
  useClock,
  useStoredItem,
  type RecallRating,
  type RecallSession,
  type RecallStats,
  type ReviewResult,
  type StreakInfo,
} from '@/lib/recall';
import type { Bookmark, Category, RecallCard } from '@/lib/types';
import { catName } from '@/i18n';
import { useLibrary } from '@/hooks/library';
import { navigate } from '@/hooks/route';
import { useUi } from '@/store/ui';
import { Avatar, Verified } from '@/components/Brand';
import { CategoryGlyph } from '@/components/CategoryGlyph';
import { MediaGrid } from '@/components/Media';
import { startSync, SyncButton } from '@/components/SyncControl';
import { CategoryChip, Metrics } from '@/components/TweetCard';
import { ArticleCard, LinkPreview, PollView, QuotedPost } from '@/components/TweetParts';
import { TweetText } from '@/components/TweetText';
import { Dialog, Popover, PopoverContent, PopoverTrigger, Tip } from '@/components/ui/overlays';
import { Button, Kbd, Textarea, cn } from '@/components/ui/primitives';

/* ───────────────────────── Motion ───────────────────────── */

const EXIT_MS = 220;
const SWIPE_AT = 96;

type ExitDir = 'left' | 'right' | 'up' | 'down' | 'skip';
const EXIT_FOR: Record<RecallRating, ExitDir> = { again: 'left', good: 'right', mastered: 'up', notUseful: 'down' };

/** Scoped keyframes (globals.css belongs to the app shell). Short, ease-out, no bounce. The global reduced-motion rule still applies. */
const RECALL_CSS = `
@keyframes recall-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes recall-out-right { from { transform: translateX(var(--dx, 0px)); } to { opacity: 0; transform: translateX(calc(var(--dx, 0px) + 48px)); } }
@keyframes recall-out-left { from { transform: translateX(var(--dx, 0px)); } to { opacity: 0; transform: translateX(calc(var(--dx, 0px) - 48px)); } }
@keyframes recall-out-up { to { opacity: 0; transform: translateY(-24px); } }
@keyframes recall-out-down { to { opacity: 0; transform: translateY(16px); } }
@keyframes recall-out-skip { to { opacity: 0; transform: translateY(10px); } }
@keyframes recall-fade { from { opacity: 0; } to { opacity: 1; } }
.recall-in { animation: recall-in 220ms cubic-bezier(0.16, 1, 0.3, 1) both; }
.recall-out-right { animation: recall-out-right ${EXIT_MS}ms cubic-bezier(0.4, 0, 1, 1) forwards; }
.recall-out-left { animation: recall-out-left ${EXIT_MS}ms cubic-bezier(0.4, 0, 1, 1) forwards; }
.recall-out-up { animation: recall-out-up ${EXIT_MS}ms cubic-bezier(0.4, 0, 1, 1) forwards; }
.recall-out-down { animation: recall-out-down ${EXIT_MS}ms cubic-bezier(0.4, 0, 1, 1) forwards; }
.recall-out-skip { animation: recall-out-skip ${EXIT_MS}ms cubic-bezier(0.4, 0, 1, 1) forwards; }
.recall-fade { animation: recall-fade 300ms ease-out both; }
`;

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

/** Session state that ignores storage events older than what we already applied locally. */
function useSessionState(): [RecallSession | null | undefined, (s: RecallSession | null) => void] {
  const [value, setValue] = useState<RecallSession | null | undefined>(undefined);
  const accept = useCallback((next: RecallSession | null) => setValue((prev) => (isNewerSession(prev, next) ? next : prev)), []);
  useEffect(() => {
    let alive = true;
    void recallSessionItem.getValue().then((v) => alive && accept(v));
    const unwatch = recallSessionItem.watch((v) => accept(v));
    return () => {
      alive = false;
      unwatch();
    };
  }, [accept]);
  return [value, accept];
}

function isTyping(e: KeyboardEvent) {
  return !!(e.target as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable="true"]');
}

function savedAgo(savedAt: number, now: number): string {
  const days = Math.floor((now - savedAt) / 86_400_000);
  if (days < 1) return 'You saved this today';
  if (days < 2) return 'You saved this yesterday';
  return `You saved this ${formatDistanceStrict(savedAt, now, { roundingMethod: 'floor' })} ago`;
}

/* ───────────────────────── Ratings ───────────────────────── */

interface RatingDef {
  id: RecallRating;
  label: string;
  /** Label for narrow (phone) rating bars. */
  short: string;
  key: string;
}

const RATINGS: RatingDef[] = [
  { id: 'again', label: 'Again soon', short: 'Again', key: '1' },
  { id: 'good', label: 'Good', short: 'Good', key: '2' },
  { id: 'mastered', label: 'Mastered', short: 'Mastered', key: '3' },
  { id: 'notUseful', label: 'Not useful', short: 'Not useful', key: '4' },
];

const RATING_LABEL: Record<RecallRating, string> = { again: 'Again soon', good: 'Good', mastered: 'Mastered', notUseful: 'Not useful' };

/* ───────────────────────── Header pieces ───────────────────────── */

function StreakLabel({ streak }: { streak: StreakInfo }) {
  const lit = streak.todayCounts;
  const label = streak.current
    ? lit
      ? `${streak.current}-day streak — today is done. Longest: ${streak.longest} days.`
      : `${streak.current}-day streak — finish today’s Recall to keep it going.`
    : 'Finish a session to start a streak.';
  return (
    <Tip label={label}>
      <span tabIndex={0} aria-label={label} className="inline-flex h-8 items-center gap-2 rounded-lg px-2 text-[13px] text-muted outline-none">
        {streak.atRisk ? <span aria-hidden className="size-1.5 rounded-full bg-accent" /> : null}
        <span>
          <span className="font-medium text-fg tabular-nums">{fmtNumber(streak.current)}</span> {streak.current === 1 ? 'day streak' : 'day streak'}
        </span>
      </span>
    </Tip>
  );
}

function SettingsPopover({ prefs, categories, counts, onReset }: { prefs: ReturnType<typeof normalizePrefs>; categories: Category[]; counts: Map<string, number>; onReset: () => void }) {
  const [open, setOpen] = useState(false);
  const shown = categories.filter((c) => (counts.get(c.id) ?? 0) > 0 || prefs.categories.includes(c.id));
  const all = !prefs.categories.length;
  const included = (id: string) => all || prefs.categories.includes(id);
  const toggle = (id: string) => {
    const current = all ? shown.map((c) => c.id) : prefs.categories;
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    if (!next.length) return toast('Keep at least one category', { description: 'Recall needs somewhere to draw from.' });
    void updateRecallPrefs({ categories: shown.every((c) => next.includes(c.id)) ? [] : next });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tip label="Recall settings">
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8 rounded-lg text-muted hover:text-fg" aria-label="Recall settings">
            <SlidersHorizontal strokeWidth={1.75} />
          </Button>
        </PopoverTrigger>
      </Tip>
      <PopoverContent align="end" className="w-[min(320px,calc(100vw-24px))] p-0">
        <div className="p-4 pb-3">
          <div className="text-[13.5px] font-semibold text-fg">Cards per day</div>
          <p className="mt-0.5 text-[12px] text-muted">Reviews that are due come first, then fresh picks.</p>
          <div role="radiogroup" aria-label="Cards per day" className="mt-3 grid grid-cols-4 gap-0.5 rounded-lg border border-line bg-panel p-[3px]">
            {CARDS_PER_DAY_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={prefs.cardsPerDay === n}
                onClick={() => void updateRecallPrefs({ cardsPerDay: n })}
                className={cn(
                  'h-7 rounded-md text-[13px] font-medium tabular-nums transition-colors duration-150',
                  prefs.cardsPerDay === n ? 'bg-accent-soft text-accent' : 'text-fg-2 hover:bg-panel-2 hover:text-fg',
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="border-t border-line px-4 pt-3 pb-2">
          <div className="flex items-center justify-between">
            <div className="text-[13.5px] font-semibold text-fg">Categories</div>
            <button type="button" disabled={all} onClick={() => void updateRecallPrefs({ categories: [] })} className="text-[12px] font-medium text-accent hover:underline disabled:text-muted disabled:no-underline">
              {all ? 'All included' : 'Include all'}
            </button>
          </div>
          <div className="scroll-area -mx-2 mt-2 max-h-56 px-0.5 pb-1">
            {shown.map((c) => {
              const on = included(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggle(c.id)}
                  className="flex min-h-8 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[13px] transition-colors duration-150 hover:bg-panel-2"
                >
                  <span className={cn('grid size-4 shrink-0 place-items-center rounded-[4px] border transition-colors', on ? 'border-accent bg-accent text-accent-fg' : 'border-line-strong bg-panel')}>
                    {on ? <Check className="size-3" strokeWidth={2.5} /> : null}
                  </span>
                  <CategoryGlyph category={c} className="text-[14px] text-muted" />
                  <span className={cn('min-w-0 flex-1 truncate', on ? 'text-fg' : 'text-muted')}>{catName(c)}</span>
                  <span className="text-[12px] text-muted tabular-nums">{fmtNumber(counts.get(c.id) ?? 0)}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="border-t border-line p-2">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onReset();
            }}
            className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-[13px] text-fg-2 transition-colors duration-150 hover:bg-panel-2 hover:text-bad"
          >
            <RotateCcw className="size-3.5" strokeWidth={1.75} /> Reset Recall data…
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ───────────────────────── The card ───────────────────────── */

function NoteInline({ b, editing, setEditing }: { b: Bookmark; editing: boolean; setEditing: (v: boolean) => void }) {
  const [value, setValue] = useState(b.note);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!editing) setValue(b.note);
  }, [b.note, editing]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const close = () => {
    window.clearTimeout(timer.current);
    if (value !== b.note) void setNote(b.id, value.trim() ? value : '');
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="mt-5">
        <Textarea
          autoFocus
          rows={3}
          value={value}
          aria-label="Your note"
          placeholder="What’s worth remembering here? Add a private note…"
          onChange={(e) => {
            const v = e.target.value;
            setValue(v);
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => void setNote(b.id, v), 500);
          }}
          onBlur={close}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
              e.preventDefault();
              close();
            }
          }}
          className="rounded-lg border-line-strong text-[14px] focus:border-accent focus:ring-0 focus:shadow-[inset_0_0_0_1px_var(--accent)]"
        />
        <div className="mt-1.5 text-right text-[12px] text-muted">Saves as you type · Esc to close</div>
      </div>
    );
  }
  if (b.note.trim()) {
    return (
      <div className="group/note mt-5 flex gap-2.5 rounded-lg bg-panel-2 px-3.5 py-2.5 text-[14px] leading-relaxed text-fg-2">
        <StickyNote className="mt-[3px] size-4 shrink-0 text-muted" strokeWidth={1.75} />
        <span className="min-w-0 flex-1 whitespace-pre-wrap">{b.note}</span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="-my-0.5 grid size-7 shrink-0 place-items-center rounded-md text-muted transition-colors duration-150 hover:bg-panel-3 hover:text-fg [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/note:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100"
          aria-label="Edit note"
        >
          <Pencil className="size-3.5" strokeWidth={1.75} />
        </button>
      </div>
    );
  }
  return (
    <Button size="sm" variant="ghost" onClick={() => setEditing(true)} className="mt-4 -ml-3 text-muted hover:text-fg [&_svg]:stroke-[1.75]">
      <StickyNote /> Add a note
      <Kbd className="ml-0.5 hidden sm:inline-flex">N</Kbd>
    </Button>
  );
}

const CLAMP_AT = 640;

function PostCard({
  b,
  card,
  category,
  now,
  noteOpen,
  setNoteOpen,
  onOpen,
}: {
  b: Bookmark;
  card?: RecallCard;
  category?: Category;
  now: number;
  noteOpen: boolean;
  setNoteOpen: (v: boolean) => void;
  onOpen: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const reasons = useMemo(() => recallReasons(b, card, now), [b, card, now]);
  const long = b.text.length > CLAMP_AT;
  const fallbackText = !b.text && !b.media.length && !b.card && !b.article && !b.quoted && !b.poll;
  const iconBtn = 'grid size-8 place-items-center rounded-lg text-muted transition-colors duration-150 hover:bg-panel-2 hover:text-fg active:bg-panel-3';

  return (
    <div className="p-5 sm:px-8 sm:pt-6 sm:pb-6">
      <header className="flex items-start gap-3">
        <Avatar src={b.author.avatar} name={b.author.name} handle={b.author.handle} size={40} />
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex min-w-0 items-center gap-1">
            <span className="truncate text-[14.5px] font-semibold text-fg">{b.author.name || b.author.handle}</span>
            {b.author.verified ? <Verified /> : null}
          </div>
          <div className="truncate text-[13px] text-muted">
            @{b.author.handle} · <time title={fmtLongDate(b.createdAt)}>{fmtShortDate(b.createdAt)}</time>
          </div>
        </div>
        <div className="-mt-1 -mr-2 flex shrink-0 items-center gap-0.5">
          <Tip label={b.starred ? 'Unstar' : 'Star'}>
            <button type="button" onClick={() => void setStarred([b.id], !b.starred)} className={iconBtn} aria-label={b.starred ? 'Unstar' : 'Star'} aria-pressed={!!b.starred}>
              <Star key={b.starred} strokeWidth={1.75} className={cn('size-4', b.starred && 'fill-amber-400 text-amber-400')} />
            </button>
          </Tip>
          <Tip label="Open on X" shortcut="O">
            <button type="button" onClick={onOpen} className={iconBtn} aria-label="Open on X">
              <ExternalLink className="size-4" strokeWidth={1.75} />
            </button>
          </Tip>
        </div>
      </header>

      {b.summary ? <p className="mt-4 rounded-lg bg-panel-2 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-fg-2">{b.summary}</p> : null}

      {b.text ? (
        <div className="mt-4">
          <TweetText text={b.text} className={cn('text-[16px] leading-[1.65] text-fg', long && !expanded && 'line-clamp-[12]')} />
          {long ? (
            <button type="button" onClick={() => setExpanded((x) => !x)} className="mt-1.5 text-[13.5px] font-medium text-accent hover:underline">
              {expanded ? 'Show less' : 'Read more'}
            </button>
          ) : null}
        </div>
      ) : fallbackText ? (
        <p className="mt-4 text-[15px] text-muted">This post has no text we could capture. Open it on X to see it.</p>
      ) : null}

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
      {!b.media.length && b.card ? <LinkPreview card={b.card} className="mt-4" /> : null}
      {b.quoted ? <QuotedPost q={b.quoted} className="mt-4" /> : null}

      <NoteInline b={b} editing={noteOpen} setEditing={setNoteOpen} />

      <footer className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line pt-4 text-[12.5px] text-muted">
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span title={`Saved ${fmtLongDate(b.savedAt)}`}>{savedAgo(b.savedAt, now)}</span>
          {reasons.map((r) => (
            <span key={r} className="inline-flex items-center gap-2">
              <span aria-hidden className="text-faint">·</span>
              {r}
            </span>
          ))}
          {card?.reviews ? (
            <span className="inline-flex items-center gap-2">
              <span aria-hidden className="text-faint">·</span>
              seen {plural(card.reviews, 'time')}
            </span>
          ) : null}
          {category ? (
            <span className="inline-flex items-center gap-2">
              <span aria-hidden className="text-faint">·</span>
              <CategoryChip category={category} className="h-auto" />
            </span>
          ) : null}
        </span>
        <Metrics b={b} />
      </footer>
    </div>
  );
}

interface Row {
  id: string;
  b?: Bookmark;
  card?: RecallCard;
}

function RatingBar({ card, onRate, disabled }: { card?: RecallCard; onRate: (r: RecallRating) => void; disabled: boolean }) {
  return (
    // Sized by its own width: compact centred labels when narrow, label + interval + key hint when wide.
    <div className="@container">
      <div role="group" aria-label="Rate this post" className="grid grid-cols-4 gap-2">
        {RATINGS.map((r) => {
          const primary = r.id === 'good';
          return (
            <button
              key={r.id}
              type="button"
              disabled={disabled}
              onClick={() => onRate(r.id)}
              aria-keyshortcuts={r.key}
              className={cn(
                'group relative flex min-h-[52px] min-w-0 items-center justify-center gap-2 rounded-lg border px-2 py-2 text-center transition-[background-color,border-color,transform] duration-150 ease-out select-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 @lg:justify-between @lg:px-3.5 @lg:text-left',
                primary ? 'btn-brand border-transparent' : 'border-line bg-panel text-fg hover:border-line-strong hover:bg-panel-2 active:bg-panel-3',
              )}
            >
              <span className="min-w-0">
                <span className="block truncate text-[13px] leading-tight font-medium @lg:text-[13.5px]">
                  <span className="@md:hidden">{r.short}</span>
                  <span className="hidden @md:inline">{r.label}</span>
                </span>
                <span className={cn('mt-0.5 block truncate text-[11.5px] leading-tight tabular-nums', primary ? 'text-accent-fg' : 'text-muted')}>{ratingHint(card, r.id)}</span>
              </span>
              <Kbd className={cn('hidden shrink-0 @lg:inline-flex', primary && 'border-accent-fg/25 bg-accent-fg/15 text-accent-fg shadow-none')}>{r.key}</Kbd>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────────── Session complete ───────────────────────── */

function SessionComplete({
  celebrate,
  reduced,
  reviewed,
  streak,
  dueTomorrow,
  now,
  canExtend,
  extending,
  onExtend,
}: {
  celebrate: boolean;
  reduced: boolean;
  reviewed: number;
  streak: StreakInfo;
  dueTomorrow?: number;
  now: number;
  canExtend: boolean;
  extending: boolean;
  onExtend: () => void;
}) {
  const ctaRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (celebrate) ctaRef.current?.focus({ preventScroll: true });
  }, [celebrate]);
  const best = streak.current > 1 && streak.current >= streak.longest;
  const stats: Array<{ label: string; value: string; hint?: string }> = [
    { label: 'Reviewed today', value: fmtNumber(reviewed) },
    { label: 'Day streak', value: fmtNumber(streak.current), hint: `Best ${fmtNumber(streak.longest)}` },
    { label: 'Due tomorrow', value: dueTomorrow === undefined ? '—' : fmtNumber(dueTomorrow), hint: 'plus fresh picks' },
  ];
  return (
    <section aria-labelledby="recall-done-title" className={cn('mx-auto w-full max-w-[680px] rounded-xl border border-line bg-panel px-5 py-10 sm:px-10 sm:py-12', celebrate && !reduced && 'recall-fade')}>
      <CircleCheck className="size-6 text-muted" strokeWidth={1.75} aria-hidden />
      <h2 id="recall-done-title" className="mt-4 text-[22px] leading-tight font-semibold tracking-[-0.02em] text-fg">
        {celebrate ? 'Session complete' : 'Today’s Recall is done'}
      </h2>
      <p className="mt-2 max-w-md text-[14px] leading-relaxed text-muted">
        You revisited {plural(reviewed, 'post')} today.{' '}
        {best ? 'That’s your longest streak yet.' : streak.current === 1 ? 'Day one of a new streak.' : streak.current > 1 ? `${streak.current} days in a row.` : ''}
      </p>

      <dl className="mt-8 grid grid-cols-3 divide-x divide-line border-y border-line">
        {stats.map((s) => (
          <div key={s.label} className="min-w-0 px-3 py-4 first:pl-0 sm:px-5">
            <dt className="text-[12px] leading-snug text-muted">{s.label}</dt>
            <dd className="mt-1.5 text-[24px] leading-none font-semibold tracking-[-0.02em] text-fg tabular-nums">{s.value}</dd>
            {s.hint ? <dd className="mt-1.5 text-[12px] leading-snug text-muted">{s.hint}</dd> : null}
          </div>
        ))}
      </dl>

      <div className="mt-8 flex flex-wrap items-center gap-2 [&_svg]:stroke-[1.75]">
        <Button ref={ctaRef} variant="primary" onClick={() => navigate('#/library/all')}>
          Back to library
        </Button>
        <Button variant="ghost" disabled={!canExtend} loading={extending} onClick={onExtend}>
          Review 5 more
        </Button>
        <span className="ml-auto text-[12.5px] text-muted tabular-nums">Next session in {fmtCountdown(nextDayStart(now) - now)}</span>
      </div>
    </section>
  );
}

/* ───────────────────────── Empty states ───────────────────────── */

function Hero({ icon, title, children, actions }: { icon: ReactNode; title: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="mx-auto flex w-full max-w-[680px] animate-fade-in flex-col items-center rounded-xl border border-line bg-panel px-6 py-14 text-center sm:px-12">
      <div className="text-muted [&_svg]:size-6 [&_svg]:stroke-[1.75]">{icon}</div>
      <h2 className="mt-4 text-[17px] font-semibold tracking-[-0.01em] text-balance text-fg">{title}</h2>
      <div className="mt-1.5 max-w-sm text-[14px] leading-relaxed text-muted">{children}</div>
      {actions ? <div className="mt-6 flex flex-wrap justify-center gap-2 [&_svg]:stroke-[1.75]">{actions}</div> : null}
    </section>
  );
}

function NoLibrary() {
  const [loading, setLoading] = useState(false);
  return (
    <Hero
      icon={<Brain />}
      title="Recall starts with your bookmarks"
      actions={
        <>
          <SyncButton hasData={false} />
          <Button
            variant="ghost"
            loading={loading}
            onClick={async () => {
              setLoading(true);
              try {
                const n = await loadDemoLibrary();
                toast.success(`Loaded ${n} sample posts`, { description: 'Your first Recall session is ready.' });
              } finally {
                setLoading(false);
              }
            }}
          >
            <FlaskConical /> Try with sample data
          </Button>
        </>
      }
    >
      Sync your X bookmarks and twtdash will bring back a few of them every day, right before you’d forget them.
    </Hero>
  );
}

function CaughtUp({ now, filtered, onIncludeAll }: { now: number; filtered: boolean; onIncludeAll: () => void }) {
  return (
    <Hero
      icon={<Check />}
      title="All caught up"
      actions={
        filtered ? (
          <Button variant="outline" onClick={onIncludeAll}>
            Include all categories
          </Button>
        ) : (
          <Button variant="outline" onClick={() => void startSync('bookmark', 'quick')}>
            Sync new bookmarks
          </Button>
        )
      }
    >
      <p>
        Nothing to review right now. Next session in <span className="font-medium text-fg tabular-nums">{fmtCountdown(nextDayStart(now) - now)}</span>.
      </p>
      {filtered ? <p className="mt-1">You’re only drawing from some categories. Widen the filter for more.</p> : <p className="mt-1">Your streak is safe today.</p>}
    </Hero>
  );
}

/* ───────────────────────── Side rail ───────────────────────── */

function WeekStrip({ stats, today }: { stats: RecallStats; today: string }) {
  const active = new Set(stats.activeDays);
  const rest = new Set(stats.restDays);
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  return (
    <ol className="grid grid-cols-7 gap-1" aria-label="Last 7 days">
      {days.map((d) => {
        const isToday = d === today;
        const on = active.has(d);
        const label = format(dayStart(d), 'EEE');
        return (
          <li key={d} className="flex flex-col items-center gap-1.5" aria-label={`${format(dayStart(d), 'EEEE')}: ${on ? 'done' : rest.has(d) ? 'nothing due' : isToday ? 'not yet' : 'missed'}`}>
            <span className={cn('text-[11px]', isToday ? 'font-medium text-fg' : 'text-muted')}>{label.slice(0, 2)}</span>
            <span
              className={cn(
                'grid size-6 place-items-center rounded-full text-[11px]',
                on ? 'bg-accent-soft text-accent' : 'bg-panel-2 text-faint',
                isToday && !on && 'ring-1 ring-line-strong',
              )}
            >
              {on ? <Check className="size-3" strokeWidth={2.25} /> : rest.has(d) ? '–' : ''}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function RailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="px-4 py-4 [&+&]:border-t [&+&]:border-line">
      <h2 className="mb-3 text-[13px] font-semibold text-fg">{title}</h2>
      {children}
    </section>
  );
}

const SHORTCUTS: Array<[string[], string]> = [
  [['1'], 'Again soon'],
  [['2'], 'Good'],
  [['3'], 'Mastered'],
  [['4'], 'Not useful'],
  [['←', '→'], 'Again soon / Good'],
  [['S'], 'Skip for now'],
  [['O'], 'Open on X'],
  [['N'], 'Add a note'],
  [['Z'], 'Undo'],
];

function Rail({ stats, streak, today, outlook }: { stats: RecallStats; streak: StreakInfo; today: string; outlook?: Outlook }) {
  const rows: Array<[string, number | undefined]> = [
    ['Due tomorrow', outlook?.tomorrow],
    ['Due this week', outlook?.week],
    ['In rotation', outlook?.inRotation],
    ['Mastered', outlook?.mastered],
    ['Longest streak', streak.longest],
    ['Reviews, all time', stats.totalReviews],
  ];
  return (
    <aside className="hidden self-start rounded-xl border border-line bg-panel xl:block" aria-label="Recall overview">
      <RailSection title="This week">
        <WeekStrip stats={stats} today={today} />
      </RailSection>
      <RailSection title="Coming up">
        <dl className="space-y-2 text-[13px]">
          {rows.map(([label, v]) => (
            <div key={label} className="flex items-center justify-between gap-3">
              <dt className="text-muted">{label}</dt>
              <dd className="font-medium text-fg tabular-nums">{v === undefined ? '—' : fmtNumber(v)}</dd>
            </div>
          ))}
        </dl>
      </RailSection>
      <RailSection title="Keyboard">
        <ul className="space-y-0.5">
          {SHORTCUTS.map(([keys, label]) => (
            <li key={label} className="flex min-h-7 items-center justify-between gap-3 text-[12.5px]">
              <span className="text-fg-2">{label}</span>
              <span className="flex gap-1">
                {keys.map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </RailSection>
    </aside>
  );
}

interface Outlook {
  tomorrow: number;
  week: number;
  mastered: number;
  inRotation: number;
}

/* ───────────────────────── View ───────────────────────── */

interface Exiting {
  row: Row & { b: Bookmark };
  dir: ExitDir;
  dx: number;
}

type Op = { kind: 'done' | 'skip'; id: string; seq: number };

const NO_IDS: string[] = [];

export function RecallView() {
  const lib = useLibrary();
  const reduced = useReducedMotion();
  const [prefsRaw] = useStoredItem(recallPrefsItem);
  const prefs = useMemo(() => (prefsRaw ? normalizePrefs(prefsRaw) : undefined), [prefsRaw]);
  const [session, acceptSession] = useSessionState();
  const [statsRaw, setStats] = useStoredItem(recallStatsItem);
  const stats = statsRaw ?? EMPTY_STATS;
  const now = useClock(30_000);
  const today = dayKey(now);
  const streak = useMemo(() => computeStreak(stats, today), [stats, today]);

  const libReady = !lib.loading && !lib.partial;
  const fresh = !!prefs && !!session && sessionMatches(session, prefs, today, libReady ? lib.bookmarks.length : undefined);

  // Plan today's session once the library is in memory (reloads reuse the stored plan instantly).
  const planKey = useRef('');
  useEffect(() => {
    if (!prefs || session === undefined || fresh || !libReady || !lib.counts.total) return;
    const key = `${today}|${prefs.cardsPerDay}|${filterKey(prefs.categories)}|${lib.bookmarks.length}|${session?.rev ?? 0}`;
    if (planKey.current === key) return;
    planKey.current = key;
    void ensureTodaySession({ bookmarks: lib.bookmarks, byId: lib.byId })
      .then(acceptSession)
      .catch((err) => {
        console.error('[twtdash] recall planning failed', err);
        toast.error('Couldn’t prepare today’s Recall');
      });
  }, [prefs, session, fresh, libReady, today, lib.counts.total, lib.bookmarks, lib.byId, acceptSession]);

  // Live rows for today's plan (bookmark + schedule), straight from IndexedDB.
  const ids = fresh && session ? session.ids : NO_IDS;
  const idsKey = ids.join('|');
  const rows = useLiveQuery(async () => {
    const [bs, cs] = await Promise.all([db.bookmarks.bulkGet(ids), db.recall.bulkGet(ids)]);
    const map = new Map<string, Row>();
    ids.forEach((id, i) => map.set(id, { id, b: bs[i], card: cs[i] }));
    return { key: idsKey, map };
  }, [idsKey]);
  const rowsReady = rows?.key === idsKey;

  // Optimistic ops: the UI advances instantly; storage catches up a few ms later.
  const [ops, setOps] = useState<Op[]>([]);
  const seq = useRef(0);
  const order = useMemo(() => {
    if (!fresh || !session) return NO_IDS;
    let list = pendingIds(session);
    for (const op of ops) {
      list = list.filter((x) => x !== op.id);
      if (op.kind === 'skip') list.push(op.id);
    }
    return list;
  }, [fresh, session, ops]);
  const queue = useMemo(() => {
    const out: Array<Row & { b: Bookmark }> = [];
    for (const id of order) {
      const r = rows?.map.get(id);
      if (r && isPlayable(r.b, r.card)) out.push(r as Row & { b: Bookmark });
    }
    return out;
  }, [order, rows]);

  const reviewedCount = useMemo(() => {
    if (!fresh || !session) return 0;
    const set = new Set(session.reviewed);
    for (const op of ops) if (op.kind === 'done') set.add(op.id);
    return set.size;
  }, [fresh, session, ops]);
  const total = reviewedCount + queue.length;
  const current = queue[0];

  const [exiting, setExiting] = useState<Exiting | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [lastReview, setLastReview] = useState<ReviewResult | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [announce, setAnnounce] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [extending, setExtending] = useState(false);
  const [dx, setDx] = useState(0);
  const lastAction = useRef('');
  const exitTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(exitTimer.current), []);

  useEffect(() => setNoteOpen(false), [current?.id]);

  // Screen-reader progress.
  useEffect(() => {
    if (!current) return;
    const msg = `${lastAction.current}Card ${reviewedCount + 1} of ${total}: post by ${current.b.author.name || current.b.author.handle}.`;
    lastAction.current = '';
    setAnnounce(msg);
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Warm the next card's images so the transition never waits on the network.
  const upcoming = queue[1]?.b;
  useEffect(() => {
    if (!upcoming) return;
    const urls = [upcoming.media[0] && mediaUrl(upcoming.media[0].url, upcoming.media.length === 1 ? 'large' : 'medium'), upcoming.card?.image && mediaUrl(upcoming.card.image, 'medium')];
    for (const u of urls) if (u) new Image().src = u;
  }, [upcoming?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const startExit = useCallback(
    (row: Row & { b: Bookmark }, dir: ExitDir, fromDx = 0) => {
      window.clearTimeout(exitTimer.current);
      setDx(0);
      if (reduced) return setExiting(null);
      setExiting({ row, dir, dx: fromDx });
      exitTimer.current = window.setTimeout(() => setExiting(null), dir === 'up' ? EXIT_MS + 80 : EXIT_MS + 20);
    },
    [reduced],
  );

  const undo = useCallback(
    async (r?: ReviewResult | null) => {
      const target = r ?? lastReview;
      if (!target) return;
      setLastReview(null);
      setCelebrate(false);
      try {
        const res = await undoReview(target);
        acceptSession(res.session);
        setStats(res.stats);
        lastAction.current = `Undid “${RATING_LABEL[target.rating]}”. `;
        setAnnounce(`Undid “${RATING_LABEL[target.rating]}”.`);
      } catch {
        toast.error('Couldn’t undo that');
      }
    },
    [lastReview, acceptSession, setStats],
  );

  const rate = useCallback(
    (rating: RecallRating, fromDx = 0) => {
      const row = queue[0];
      if (!row || exiting) return;
      const n = ++seq.current;
      setOps((o) => [...o, { kind: 'done', id: row.id, seq: n }]);
      startExit(row, EXIT_FOR[rating], fromDx);
      if (queue.length === 1) setCelebrate(true);
      const hint = ratingHint(row.card, rating);
      lastAction.current = `Marked “${RATING_LABEL[rating]}”${rating === 'good' ? ` — back ${hint}` : rating === 'again' ? ' — back tomorrow' : ''}. `;
      if (queue.length === 1) setAnnounce(`${lastAction.current}Session complete.`);
      review(row.id, rating)
        .then((r) => {
          acceptSession(r.session);
          setStats(r.stats);
          setLastReview(r);
          if (rating === 'notUseful')
            toast('Archived', {
              description: 'It’s out of your library and won’t come back in Recall.',
              action: { label: 'Undo', onClick: () => void undo(r) },
            });
        })
        .catch((err) => {
          console.error('[twtdash] recall review failed', err);
          toast.error('Couldn’t save that rating');
          setCelebrate(false);
        })
        .finally(() => setOps((o) => o.filter((x) => x.seq !== n)));
    },
    [queue, exiting, startExit, acceptSession, setStats, undo],
  );

  const skip = useCallback(() => {
    const row = queue[0];
    if (!row || exiting || queue.length < 2) return;
    const n = ++seq.current;
    setOps((o) => [...o, { kind: 'skip', id: row.id, seq: n }]);
    startExit(row, 'skip');
    lastAction.current = 'Skipped for now. ';
    skipCard(row.id)
      .then((s) => acceptSession(s))
      .finally(() => setOps((o) => o.filter((x) => x.seq !== n)));
  }, [queue, exiting, startExit, acceptSession]);

  const openOnX = useCallback(() => {
    const b = queue[0]?.b;
    if (b) window.open(b.url, '_blank', 'noopener,noreferrer');
  }, [queue]);

  const keepGoing = useCallback(async () => {
    setExtending(true);
    try {
      const s = await extendSession({ bookmarks: lib.bookmarks, byId: lib.byId }, 5);
      acceptSession(s);
      setCelebrate(false);
      if (s && !pendingIds(s).length) toast('That’s everything for now', { description: 'Your whole library is scheduled — new saves will join tomorrow.' });
    } finally {
      setExtending(false);
    }
  }, [lib.bookmarks, lib.byId, acceptSession]);

  // Keyboard: 1–4 rate, ←/→, S skip, O open, N note, Z undo.
  const handlers = useRef({ rate, skip, openOnX, undo, note: () => setNoteOpen(true) });
  handlers.current = { rate, skip, openOnX, undo, note: () => setNoteOpen(true) };
  const active = !!current && !exiting;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey || e.altKey || isTyping(e)) return;
      const ui = useUi.getState();
      if (ui.paletteOpen || ui.shortcutsOpen) return;
      if (document.querySelector('[role="dialog"][data-state="open"], [role="menu"][data-state="open"]')) return;
      const h = handlers.current;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const rating = ({ '1': 'again', '2': 'good', '3': 'mastered', '4': 'notUseful', ArrowLeft: 'again', ArrowRight: 'good' } as Record<string, RecallRating>)[k];
      if (rating) h.rate(rating);
      else if (k === 's') h.skip();
      else if (k === 'o') h.openOnX();
      else if (k === 'n') h.note();
      else if (k === 'z' || k === 'u') void h.undo();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Touch swipe: right = Good, left = Again soon. Vertical scrolling stays native.
  const drag = useRef<{ x: number; y: number; id: number; on: boolean } | null>(null);
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' || !active) return;
    if ((e.target as HTMLElement).closest('a, button, textarea, input, video')) return;
    drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, on: false };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const mx = e.clientX - d.x;
    const my = e.clientY - d.y;
    if (!d.on) {
      if (Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my) * 1.3) {
        d.on = true;
        e.currentTarget.setPointerCapture(e.pointerId);
      } else if (Math.abs(my) > 12) {
        drag.current = null;
        return;
      } else return;
    }
    setDx(mx);
  };
  const onPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d?.on || d.id !== e.pointerId) return;
    const mx = e.clientX - d.x;
    if (Math.abs(mx) >= SWIPE_AT) rate(mx > 0 ? 'good' : 'again', mx);
    else setDx(0);
  };

  // A plan whose leftovers vanished (archived elsewhere) still earns the day.
  const credited = useRef('');
  const complete = fresh && rowsReady && !queue.length && reviewedCount > 0 && !exiting;
  useEffect(() => {
    if (!complete || !session || session.completedAt || ops.length || credited.current === session.day) return;
    credited.current = session.day;
    void completeSession().then((r) => {
      acceptSession(r.session);
      setStats(r.stats);
    });
  }, [complete, session, ops.length, acceptSession, setStats]);

  // Schedule outlook. Cards still waiting in today's session aren't "tomorrow" yet.
  const pendingKey = order.join('|');
  const outlook = useLiveQuery(async (): Promise<Outlook> => {
    const pending = new Set(pendingKey ? pendingKey.split('|') : []);
    const t2 = dayStart(addDays(today, 2));
    const t8 = dayStart(addDays(today, 8));
    const [soon, mastered, all] = await Promise.all([db.recall.where('due').below(t8).toArray(), db.recall.where('state').equals('done').count(), db.recall.count()]);
    let tomorrow = 0;
    let week = 0;
    for (const c of soon) {
      if (c.state === 'done' || pending.has(c.id)) continue;
      week++;
      if (c.due < t2) tomorrow++;
    }
    return { tomorrow, week, mastered, inRotation: all - mastered };
  }, [today, pendingKey]);

  /* ─────────── Render ─────────── */

  const loading = lib.loading || !prefs || session === undefined;
  const filtered = !!prefs?.categories.length;
  let body: ReactNode;

  if (loading) body = <CardSkeleton />;
  else if (!lib.counts.total) body = <NoLibrary />;
  else if (!fresh || (!rowsReady && !queue.length)) body = <CardSkeleton label={libReady ? 'Picking today’s cards…' : 'Loading your library…'} />;
  else if (!queue.length && !exiting) {
    body =
      reviewedCount > 0 ? (
        <SessionComplete
          celebrate={celebrate}
          reduced={reduced}
          reviewed={reviewedCount}
          streak={streak}
          dueTomorrow={outlook?.tomorrow}
          now={now}
          canExtend={libReady}
          extending={extending}
          onExtend={() => void keepGoing()}
        />
      ) : (
        <CaughtUp now={now} filtered={filtered} onIncludeAll={() => void updateRecallPrefs({ categories: [] })} />
      );
  } else {
    const shown = current ?? null;
    const position = Math.min(reviewedCount + 1, total);
    const swipeStyle: CSSProperties | undefined = dx ? { transform: `translateX(${dx}px)`, transition: 'none' } : undefined;
    body = (
      <div className="mx-auto w-full max-w-[680px]">
        <div className="flex items-center gap-3">
          <div
            role="progressbar"
            aria-label="Today’s progress"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={reviewedCount}
            className="h-[3px] flex-1 overflow-hidden rounded-full bg-panel-3"
          >
            <div className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out" style={{ width: `${total ? (reviewedCount / total) * 100 : 0}%` }} />
          </div>
          <span className="shrink-0 text-[12.5px] text-muted tabular-nums">
            {position} of {total}
          </span>
        </div>

        <div className="relative mt-4">
          {shown ? (
            <article
              key={shown.id}
              aria-roledescription="Recall card"
              aria-label={`Post by ${shown.b.author.name || shown.b.author.handle}`}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerEnd}
              onPointerCancel={onPointerEnd}
              style={swipeStyle}
              className={cn('relative overflow-hidden rounded-xl border border-line bg-panel [touch-action:pan-y] transition-transform duration-200 ease-out', !reduced && 'recall-in')}
            >
              {dx ? <SwipeLabels dx={dx} /> : null}
              <PostCard b={shown.b} card={shown.card} category={lib.categoryMap.get(shown.b.category)} now={now} noteOpen={noteOpen} setNoteOpen={setNoteOpen} onOpen={openOnX} />
            </article>
          ) : (
            <div className="h-[360px]" />
          )}

          {exiting ? (
            <article
              aria-hidden
              className={cn('pointer-events-none absolute inset-x-0 top-0 z-20 overflow-hidden rounded-xl border border-line bg-panel', `recall-out-${exiting.dir}`)}
              style={{ '--dx': `${exiting.dx}px` } as CSSProperties}
            >
              <PostCard b={exiting.row.b} card={exiting.row.card} category={lib.categoryMap.get(exiting.row.b.category)} now={now} noteOpen={false} setNoteOpen={() => undefined} onOpen={() => undefined} />
            </article>
          ) : null}
        </div>

        <div className="sticky bottom-0 z-30 -mx-4 mt-3 bg-bg px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:-mx-8 sm:px-8 lg:mx-0 lg:px-0 lg:pb-6 [&_svg]:stroke-[1.75]">
          <RatingBar card={shown?.card} onRate={(r) => rate(r)} disabled={!shown || !!exiting} />
          <div className="mt-2 flex min-h-8 items-center justify-between gap-2">
            <div className="-ml-3 flex items-center gap-0.5">
              <Button size="sm" variant="ghost" className="text-muted hover:text-fg" onClick={skip} disabled={!shown || queue.length < 2 || !!exiting} title={queue.length < 2 ? 'This is the last card' : undefined}>
                <SkipForward /> Skip <Kbd className="ml-0.5 hidden sm:inline-flex">S</Kbd>
              </Button>
              <Button size="sm" variant="ghost" onClick={openOnX} disabled={!shown} className="hidden text-muted hover:text-fg sm:inline-flex">
                <ExternalLink /> Open on X <Kbd className="ml-0.5">O</Kbd>
              </Button>
            </div>
            {lastReview ? (
              <Button size="sm" variant="ghost" className="-mr-3 animate-fade-in text-muted hover:text-fg" onClick={() => void undo()}>
                <Undo2 /> Undo “{RATING_LABEL[lastReview.rating]}” <Kbd className="ml-0.5 hidden sm:inline-flex">Z</Kbd>
              </Button>
            ) : (
              <span className="truncate text-[12px] text-muted sm:hidden">Swipe right for Good, left for Again</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  const showRail = !loading && !!lib.counts.total;
  // Reserve the rail column while loading so nothing shifts when it arrives.
  const wide = showRail || (loading && lib.counts.total !== 0);

  return (
    <div className="relative">
      <style>{RECALL_CSS}</style>

      <div className={cn('mx-auto w-full max-w-[744px] px-4 pt-8 pb-16 sm:px-8', wide && 'xl:max-w-[1032px]')}>
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.02em] text-fg">Recall</h1>
            <p className="mt-1.5 text-[14px] text-muted">
              <span className="text-fg-2">{format(now, 'EEEE, MMMM d')}</span>
              <span className="hidden sm:inline"> · A few saved posts a day, brought back before you forget them.</span>
            </p>
          </div>
          {showRail && prefs ? (
            <div className="-mr-2 flex items-center gap-1">
              <StreakLabel streak={streak} />
              <SettingsPopover prefs={prefs} categories={lib.categories} counts={lib.counts.categories} onReset={() => setResetOpen(true)} />
            </div>
          ) : null}
        </header>

        <div className={cn('mt-8 grid gap-8', wide && 'xl:grid-cols-[minmax(0,680px)_256px] xl:gap-8')}>
          <div className="min-w-0">{body}</div>
          {showRail ? <Rail stats={stats} streak={streak} today={today} outlook={outlook} /> : wide ? <RailSkeleton /> : null}
        </div>
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announce}
      </p>

      <Dialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset Recall?"
        description="This clears your review schedule, history and streaks. Your bookmarks, notes and archive stay exactly as they are."
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setResetOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              setResetOpen(false);
              await resetRecall();
              setOps([]);
              setLastReview(null);
              setCelebrate(false);
              planKey.current = '';
              credited.current = '';
              acceptSession(null);
              setStats(EMPTY_STATS);
              toast('Recall reset', { description: 'A fresh start. Today’s cards are being picked.' });
            }}
          >
            <RotateCcw strokeWidth={1.75} /> Reset Recall
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function SwipeLabels({ dx }: { dx: number }) {
  const o = Math.min(1, Math.abs(dx) / SWIPE_AT);
  const pill = 'absolute top-4 z-10 rounded-md border border-line bg-panel px-2 py-1 text-[12px] font-medium';
  return (
    <>
      <span aria-hidden className={cn(pill, 'right-4 text-accent')} style={{ opacity: dx > 0 ? o : 0 }}>
        Good
      </span>
      <span aria-hidden className={cn(pill, 'left-4 text-fg-2')} style={{ opacity: dx < 0 ? o : 0 }}>
        Again soon
      </span>
    </>
  );
}

function RailSkeleton() {
  return (
    <div aria-hidden className="hidden self-start rounded-xl border border-line bg-panel p-4 xl:block">
      <div className="skeleton h-3.5 w-20 rounded" />
      <div className="mt-4 grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="skeleton mx-auto size-6 rounded-full" />
        ))}
      </div>
      <div className="mt-6 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-3 rounded" />
        ))}
      </div>
    </div>
  );
}

function CardSkeleton({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="mx-auto w-full max-w-[680px]" aria-busy="true">
      <div className="flex items-center gap-3">
        <div className="skeleton h-[3px] flex-1 rounded-full" />
        <div className="skeleton h-3 w-12 rounded" />
      </div>
      <div className="mt-4 rounded-xl border border-line bg-panel p-5 sm:px-8 sm:py-6">
        <div className="flex items-center gap-3">
          <div className="skeleton size-10 rounded-full" />
          <div className="space-y-2">
            <div className="skeleton h-3.5 w-36 rounded" />
            <div className="skeleton h-3 w-24 rounded" />
          </div>
        </div>
        <div className="mt-5 space-y-2.5">
          <div className="skeleton h-4 w-full rounded" />
          <div className="skeleton h-4 w-[92%] rounded" />
          <div className="skeleton h-4 w-[70%] rounded" />
        </div>
        <div className="skeleton mt-5 h-48 rounded-lg" />
        <div className="mt-5 flex justify-between border-t border-line pt-4">
          <div className="skeleton h-3 w-40 rounded" />
          <div className="skeleton h-3 w-24 rounded" />
        </div>
      </div>
      <div className="mt-6 grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-[52px] rounded-lg" />
        ))}
      </div>
      <p className="mt-4 text-center text-[12.5px] text-muted">{label}</p>
    </div>
  );
}
