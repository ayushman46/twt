import { format, formatDistanceStrict } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Archive,
  ArrowRight,
  Brain,
  Check,
  ExternalLink,
  FlaskConical,
  Flame,
  GraduationCap,
  Pencil,
  RotateCcw,
  SkipForward,
  SlidersHorizontal,
  Sparkles,
  Star,
  StickyNote,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
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
import { useLibrary } from '@/hooks/library';
import { navigate } from '@/hooks/route';
import { useUi } from '@/store/ui';
import { Avatar, Verified } from '@/components/Brand';
import { MediaGrid } from '@/components/Media';
import { startSync, SyncButton } from '@/components/SyncControl';
import { CategoryChip, Metrics } from '@/components/TweetCard';
import { ArticleCard, LinkPreview, PollView, QuotedPost } from '@/components/TweetParts';
import { TweetText } from '@/components/TweetText';
import { Dialog, Popover, PopoverContent, PopoverTrigger, Tip } from '@/components/ui/overlays';
import { Button, Eyebrow, Kbd, Textarea, cn } from '@/components/ui/primitives';

/* ───────────────────────── Motion ───────────────────────── */

const EXIT_MS = 260;
const SWIPE_AT = 96;

type ExitDir = 'left' | 'right' | 'up' | 'down' | 'skip';
const EXIT_FOR: Record<RecallRating, ExitDir> = { again: 'left', good: 'right', mastered: 'up', notUseful: 'down' };

/** Scoped keyframes (globals.css belongs to the app shell). The global reduced-motion rule still applies. */
const RECALL_CSS = `
@keyframes recall-in { from { opacity: 0; transform: translateY(14px) scale(0.965); } to { opacity: 1; transform: none; } }
@keyframes recall-out-right { from { transform: translateX(var(--dx, 0px)) rotate(var(--rot, 0deg)); } to { opacity: 0; transform: translateX(calc(var(--dx, 0px) + 115%)) rotate(9deg); } }
@keyframes recall-out-left { from { transform: translateX(var(--dx, 0px)) rotate(var(--rot, 0deg)); } to { opacity: 0; transform: translateX(calc(var(--dx, 0px) - 115%)) rotate(-9deg); } }
@keyframes recall-out-up { 40% { opacity: 1; transform: translateY(-12px) scale(1.015); } to { opacity: 0; transform: translateY(-60%) scale(1.04); } }
@keyframes recall-out-down { to { opacity: 0; transform: translateY(26%) scale(0.94); filter: grayscale(1); } }
@keyframes recall-out-skip { to { opacity: 0; transform: translateY(22px) scale(0.93); } }
@keyframes recall-confetti { 0% { opacity: 0; transform: translate3d(0, -30px, 0) rotate(0deg); } 8% { opacity: 1; } 100% { opacity: 0; transform: translate3d(var(--drift), var(--fall), 0) rotate(var(--spin)); } }
@keyframes recall-flicker { 0%, 100% { transform: scale(1) rotate(-2deg); } 25% { transform: scale(1.06, 0.97) rotate(2deg); } 50% { transform: scale(0.97, 1.05) rotate(-1deg); } 75% { transform: scale(1.04) rotate(1.5deg); } }
@keyframes recall-glow { 0%, 100% { opacity: 0.55; transform: scale(1); } 50% { opacity: 0.9; transform: scale(1.12); } }
@keyframes recall-pop { 0% { transform: scale(0.6); opacity: 0; } 60% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); } }
.recall-in { animation: recall-in 0.42s cubic-bezier(0.16, 1, 0.3, 1) both; }
.recall-out-right { animation: recall-out-right ${EXIT_MS}ms cubic-bezier(0.4, 0, 1, 1) forwards; }
.recall-out-left { animation: recall-out-left ${EXIT_MS}ms cubic-bezier(0.4, 0, 1, 1) forwards; }
.recall-out-up { animation: recall-out-up ${EXIT_MS + 60}ms cubic-bezier(0.3, 0, 0.6, 1) forwards; }
.recall-out-down { animation: recall-out-down ${EXIT_MS}ms ease-in forwards; }
.recall-out-skip { animation: recall-out-skip ${EXIT_MS}ms ease-in forwards; }
.recall-flicker { animation: recall-flicker 1.8s ease-in-out infinite; transform-origin: 50% 85%; }
.recall-glow { animation: recall-glow 2.4s ease-in-out infinite; }
.recall-pop { animation: recall-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
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
  icon: LucideIcon;
  className: string;
  kbdClass: string;
}

const RATINGS: RatingDef[] = [
  {
    id: 'again',
    label: 'Again soon',
    short: 'Again',
    key: '1',
    icon: RotateCcw,
    className: 'border-amber-500/25 bg-amber-500/[0.07] text-amber-700 hover:border-amber-500/40 hover:bg-amber-500/[0.12] dark:text-amber-300',
    kbdClass: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  {
    id: 'good',
    label: 'Good',
    short: 'Good',
    key: '2',
    icon: Check,
    className: 'btn-brand border-transparent text-white',
    kbdClass: 'border-white/25 bg-white/15 text-white shadow-none',
  },
  {
    id: 'mastered',
    label: 'Mastered',
    short: 'Mastered',
    key: '3',
    icon: GraduationCap,
    className: 'border-emerald-500/25 bg-emerald-500/[0.07] text-emerald-700 hover:border-emerald-500/40 hover:bg-emerald-500/[0.12] dark:text-emerald-300',
    kbdClass: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  {
    id: 'notUseful',
    label: 'Not useful',
    short: 'Not useful',
    key: '4',
    icon: Archive,
    className: 'border-line-strong bg-panel text-fg-2 hover:bg-panel-2 hover:text-fg',
    kbdClass: '',
  },
];

const RATING_LABEL: Record<RecallRating, string> = { again: 'Again soon', good: 'Good', mastered: 'Mastered', notUseful: 'Not useful' };

/* ───────────────────────── Header pieces ───────────────────────── */

function ProgressRing({ done, total, size = 30 }: { done: number; total: number; size?: number }) {
  const r = (size - 5) / 2;
  const c = 2 * Math.PI * r;
  const pct = total ? Math.min(1, done / total) : 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--panel-3)" strokeWidth={4} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="url(#recall-brand)"
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct)}
        className="transition-[stroke-dashoffset] duration-700 ease-out"
        opacity={pct ? 1 : 0}
      />
    </svg>
  );
}

function TodayPill({ done, total }: { done: number; total: number }) {
  return (
    <div className="flex h-11 items-center gap-2.5 rounded-2xl border border-line bg-panel pr-3.5 pl-2 shadow-card" title={`${done} of ${total} reviewed today`}>
      <ProgressRing done={done} total={total} />
      <div className="leading-none">
        <div className="text-[14px] font-semibold tabular-nums">
          {done}
          <span className="text-faint">/{total}</span>
        </div>
        <div className="mt-1 text-[11px] text-muted">today</div>
      </div>
    </div>
  );
}

function StreakPill({ streak }: { streak: StreakInfo }) {
  const lit = streak.todayCounts;
  const label = streak.current
    ? lit
      ? `${streak.current}-day streak — today is done. Longest: ${streak.longest} days.`
      : `${streak.current}-day streak — finish today’s Recall to keep it going.`
    : 'Finish a session to start a streak.';
  return (
    <Tip label={label}>
      <div
        tabIndex={0}
        aria-label={label}
        className={cn(
          'relative flex h-11 items-center gap-2 rounded-2xl border pr-3.5 pl-2.5 shadow-card outline-none',
          lit ? 'border-orange-500/30 bg-orange-500/[0.08]' : streak.atRisk ? 'border-amber-500/30 bg-panel' : 'border-line bg-panel',
        )}
      >
        <span className="relative grid size-7 place-items-center">
          {lit ? <span aria-hidden className="recall-glow absolute inset-0 rounded-full bg-orange-500/30 blur-md" /> : null}
          <Flame
            className={cn('relative size-[22px]', lit ? 'recall-flicker text-orange-500' : streak.atRisk ? 'text-amber-500' : 'text-faint')}
            fill={lit ? 'url(#recall-flame)' : 'none'}
            strokeWidth={lit ? 1.6 : 2}
          />
        </span>
        <div className="leading-none">
          <div className="text-[14px] font-semibold tabular-nums">{streak.current}</div>
          <div className="mt-1 text-[11px] text-muted">{streak.current ? 'day streak' : 'start today'}</div>
        </div>
        {streak.atRisk ? <span aria-hidden className="absolute -top-1 -right-1 size-2.5 rounded-full bg-amber-500 ring-2 ring-bg" /> : null}
      </div>
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
          <Button variant="outline" size="icon" className="size-11 rounded-2xl" aria-label="Recall settings">
            <SlidersHorizontal />
          </Button>
        </PopoverTrigger>
      </Tip>
      <PopoverContent align="end" className="w-[min(320px,calc(100vw-24px))] p-0">
        <div className="p-4 pb-3">
          <div className="text-[13.5px] font-semibold">Cards per day</div>
          <p className="mt-0.5 text-[12px] text-muted">Reviews that are due come first, then fresh picks.</p>
          <div role="radiogroup" aria-label="Cards per day" className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-panel-2 p-1">
            {CARDS_PER_DAY_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={prefs.cardsPerDay === n}
                onClick={() => void updateRecallPrefs({ cardsPerDay: n })}
                className={cn(
                  'h-8 rounded-lg text-[13px] font-medium tabular-nums transition-all',
                  prefs.cardsPerDay === n ? 'bg-panel text-fg shadow-card ring-1 ring-line' : 'text-muted hover:text-fg',
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="border-t border-line px-4 pt-3 pb-2">
          <div className="flex items-center justify-between">
            <div className="text-[13.5px] font-semibold">Categories</div>
            <button type="button" disabled={all} onClick={() => void updateRecallPrefs({ categories: [] })} className="text-[12px] font-medium text-accent hover:underline disabled:text-faint disabled:no-underline">
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
                  className="flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[13px] hover:bg-panel-2"
                >
                  <span className={cn('grid size-[18px] shrink-0 place-items-center rounded-md border transition-colors', on ? 'border-accent bg-accent text-white' : 'border-line-strong bg-panel')}>
                    {on ? <Check className="size-3" strokeWidth={3} /> : null}
                  </span>
                  <span aria-hidden>{c.emoji}</span>
                  <span className={cn('min-w-0 flex-1 truncate', !on && 'text-muted')}>{c.name}</span>
                  <span className="text-[11.5px] text-faint tabular-nums">{fmtNumber(counts.get(c.id) ?? 0)}</span>
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
            className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-[13px] text-bad hover:bg-bad/10"
          >
            <RotateCcw className="size-3.5" /> Reset Recall data…
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
      <div className="mt-4">
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
          className="border-amber-400/40 bg-amber-400/[0.06] focus:border-amber-500/60 focus:ring-amber-400/20"
        />
        <div className="mt-1.5 text-right text-[11.5px] text-faint">Saves as you type · Esc to close</div>
      </div>
    );
  }
  if (b.note.trim()) {
    return (
      <div className="group/note mt-4 flex gap-2.5 rounded-xl border border-amber-400/25 bg-amber-400/[0.08] px-3.5 py-2.5 text-[13.5px] text-fg-2">
        <StickyNote className="mt-0.5 size-4 shrink-0 text-amber-500" />
        <span className="min-w-0 flex-1 whitespace-pre-wrap">{b.note}</span>
        <button type="button" onClick={() => setEditing(true)} className="grid size-6 shrink-0 place-items-center rounded-md text-muted opacity-60 hover:bg-amber-400/15 hover:text-fg group-hover/note:opacity-100" aria-label="Edit note">
          <Pencil className="size-3.5" />
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="mt-4 inline-flex h-8 items-center gap-2 rounded-full border border-dashed border-line-strong px-3 text-[12.5px] text-muted transition-colors hover:border-amber-500/50 hover:text-fg"
    >
      <StickyNote className="size-3.5 text-amber-500" /> Add a note
      <Kbd className="ml-0.5 hidden h-[18px] min-w-[18px] text-[10px] sm:inline-flex">N</Kbd>
    </button>
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

  return (
    <div className="relative p-5 sm:p-7">
      <div className="flex flex-wrap items-center gap-1.5 pr-16">
        {reasons.map((r, i) => (
          <span
            key={r}
            className={cn('inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11.5px] font-medium', i === 0 ? 'bg-accent-soft text-accent' : 'bg-panel-2 text-fg-2')}
          >
            {i === 0 ? <Sparkles className="size-3" /> : null}
            {r}
          </span>
        ))}
        <CategoryChip category={category} />
      </div>

      <div className="absolute top-4 right-4 flex items-center gap-0.5 sm:top-6 sm:right-6">
        <Tip label={b.starred ? 'Unstar' : 'Star'}>
          <button type="button" onClick={() => void setStarred([b.id], !b.starred)} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-panel-2 hover:text-fg" aria-label={b.starred ? 'Unstar' : 'Star'} aria-pressed={!!b.starred}>
            <Star key={b.starred} className={cn('size-4', b.starred && 'animate-pop fill-amber-400 text-amber-400')} />
          </button>
        </Tip>
        <Tip label="Open on X" shortcut="O">
          <button type="button" onClick={onOpen} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-panel-2 hover:text-fg" aria-label="Open on X">
            <ExternalLink className="size-4" />
          </button>
        </Tip>
      </div>

      <header className="mt-5 flex items-center gap-3">
        <Avatar src={b.author.avatar} name={b.author.name} handle={b.author.handle} size={46} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1">
            <span className="truncate text-[15.5px] font-semibold tracking-[-0.01em]">{b.author.name || b.author.handle}</span>
            {b.author.verified ? <Verified /> : null}
          </div>
          <div className="truncate text-[13px] text-muted">
            @{b.author.handle} · <time title={fmtLongDate(b.createdAt)}>{fmtShortDate(b.createdAt)}</time>
          </div>
        </div>
      </header>

      {b.summary ? (
        <div className="mt-4 flex gap-2 rounded-xl bg-accent-soft px-3.5 py-2.5 text-[13.5px] leading-snug text-fg-2 ring-1 ring-accent/15">
          <Sparkles className="mt-0.5 size-3.5 shrink-0 text-accent" />
          <span>{b.summary}</span>
        </div>
      ) : null}

      {b.text ? (
        <div className="mt-4">
          <TweetText text={b.text} className={cn('text-[16.5px] leading-[1.65] text-fg sm:text-[17.5px]', long && !expanded && 'line-clamp-[12]')} />
          {long ? (
            <button type="button" onClick={() => setExpanded((x) => !x)} className="mt-1.5 text-[13.5px] font-medium text-accent hover:underline">
              {expanded ? 'Show less' : 'Read more'}
            </button>
          ) : null}
        </div>
      ) : fallbackText ? (
        <p className="mt-4 text-[15px] text-muted italic">This post has no text we could capture — open it on X to see it.</p>
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

      <footer className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line pt-4 text-[12.5px]">
        <span className="font-medium text-fg-2" title={`Saved ${fmtLongDate(b.savedAt)}`}>
          {savedAgo(b.savedAt, now)}
          {card?.reviews ? <span className="font-normal text-faint"> · seen {plural(card.reviews, 'time')} in Recall</span> : null}
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
    // Sized by its own width: stacked labels when narrow, a roomy row with key hints when wide.
    <div className="@container">
      <div role="group" aria-label="Rate this post" className="grid grid-cols-4 gap-2 @2xl:gap-2.5">
        {RATINGS.map((r) => {
          const Icon = r.icon;
          return (
            <button
              key={r.id}
              type="button"
              disabled={disabled}
              onClick={() => onRate(r.id)}
              aria-keyshortcuts={r.key}
              className={cn(
                'group relative flex h-[70px] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl border px-1.5 text-center shadow-card transition-[transform,background,border-color,box-shadow] duration-150 select-none hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-60 @2xl:h-[74px] @2xl:flex-row @2xl:justify-start @2xl:gap-2.5 @2xl:px-3.5 @2xl:text-left',
                r.className,
              )}
            >
              <Icon className="size-[18px] shrink-0 @2xl:size-5" strokeWidth={2.2} />
              <span className="min-w-0 max-w-full @2xl:flex-1">
                <span className="block truncate text-[12.5px] leading-tight font-semibold @lg:text-[13.5px] @2xl:text-[14px]">
                  <span className="@md:hidden">{r.short}</span>
                  <span className="hidden @md:inline">{r.label}</span>
                </span>
                <span className="mt-0.5 block truncate text-[11px] leading-tight opacity-75 @2xl:text-[12px]">{ratingHint(card, r.id)}</span>
              </span>
              <Kbd className={cn('absolute top-1.5 right-1.5 hidden h-[18px] min-w-[18px] text-[10px] @lg:inline-flex @2xl:static', r.kbdClass)}>{r.key}</Kbd>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────────── Celebration ───────────────────────── */

const CONFETTI_COLORS = ['#7B61FF', '#B14CF2', '#FF5C9D', '#F59E0B', '#22D3EE', '#10B981', '#F97316'];

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 56 }, (_, i) => {
        const rnd = (n: number) => {
          const x = Math.sin((i + 1) * 9301 + n * 49297) * 233280;
          return x - Math.floor(x);
        };
        return {
          left: `${rnd(1) * 100}%`,
          delay: `${rnd(2) * 0.5}s`,
          duration: `${1.8 + rnd(3) * 1.6}s`,
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
          w: 5 + Math.round(rnd(4) * 5),
          h: rnd(5) > 0.5 ? 10 + Math.round(rnd(6) * 6) : 6,
          round: rnd(7) > 0.7,
          style: { '--drift': `${(rnd(8) - 0.5) * 240}px`, '--fall': `${380 + rnd(9) * 320}px`, '--spin': `${(rnd(10) - 0.5) * 1080}deg` } as CSSProperties,
        };
      }),
    [],
  );
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className={cn('absolute -top-3 block', p.round ? 'rounded-full' : 'rounded-[2px]')}
          style={{
            ...p.style,
            left: p.left,
            width: p.w,
            height: p.round ? p.w : p.h,
            background: p.color,
            animation: `recall-confetti ${p.duration} cubic-bezier(0.2, 0.6, 0.4, 1) ${p.delay} both`,
          }}
        />
      ))}
    </div>
  );
}

function FlameHero({ streak, animate }: { streak: number; animate: boolean }) {
  return (
    <div className={cn('relative mx-auto grid size-28 place-items-center', animate && 'recall-pop')}>
      <span aria-hidden className="recall-glow absolute inset-1 rounded-full bg-orange-500/35 blur-2xl" />
      <div className="relative grid size-[84px] place-items-center rounded-[28px] bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 shadow-[0_20px_44px_-14px_rgb(249_115_22/0.7),inset_0_1px_0_rgb(255_255_255/0.35)]">
        <Flame className="recall-flicker size-11 fill-white/95 text-white" strokeWidth={1.5} />
      </div>
      <span className="absolute right-0 bottom-0 grid h-9 min-w-9 place-items-center rounded-full bg-panel px-2 text-[16px] font-bold tracking-tight shadow-pop ring-1 ring-line tabular-nums">{streak}</span>
    </div>
  );
}

function StatBlock({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-panel/80 px-3 py-3.5 text-center shadow-card backdrop-blur sm:px-4">
      <div className="text-[26px] leading-none font-semibold tracking-[-0.04em] tabular-nums sm:text-[30px]">{value}</div>
      <div className="mt-1.5 text-[12px] text-muted">{label}</div>
      {hint ? <div className="mt-0.5 text-[11px] text-faint">{hint}</div> : null}
    </div>
  );
}

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
  return (
    <section aria-labelledby="recall-done-title" className="relative overflow-hidden rounded-[28px] border border-line bg-panel px-5 py-12 text-center shadow-card animate-rise sm:px-12 sm:py-14">
      <div aria-hidden className="aurora absolute inset-0 opacity-80" />
      <div aria-hidden className="dot-grid absolute inset-0 opacity-30 [mask-image:radial-gradient(60%_60%_at_50%_30%,black,transparent)]" />
      {celebrate && !reduced ? <Confetti /> : null}
      <div className="relative">
        <FlameHero streak={streak.current} animate={celebrate && !reduced} />
        <h2 id="recall-done-title" className="mt-7 text-[28px] leading-tight font-semibold tracking-[-0.04em] text-balance sm:text-[34px]">
          {celebrate ? 'Session complete' : 'Today’s Recall is done'}
          <span className="serif-accent text-brand block pr-1 text-[1.12em] sm:inline"> {celebrate ? '— nicely done.' : '— see you tomorrow.'}</span>
        </h2>
        <p className="mx-auto mt-3 max-w-md text-[14.5px] leading-relaxed text-muted">
          You revisited {plural(reviewed, 'post')} today.{' '}
          {best ? 'That’s your longest streak yet.' : streak.current === 1 ? 'Day one of a new streak.' : streak.current > 1 ? `${streak.current} days in a row.` : ''}
        </p>

        <dl className="mx-auto mt-8 grid max-w-xl grid-cols-3 gap-2.5 sm:gap-3">
          <StatBlock label="Reviewed today" value={fmtNumber(reviewed)} />
          <StatBlock label="Day streak" value={streak.current} hint={`Best ${streak.longest}`} />
          <StatBlock label="Due tomorrow" value={dueTomorrow === undefined ? '—' : fmtNumber(dueTomorrow)} hint="+ fresh picks" />
        </dl>

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <Button ref={ctaRef} variant="primary" size="lg" onClick={() => navigate('#/library/all')}>
            Back to library <ArrowRight />
          </Button>
          <Button variant="outline" size="lg" disabled={!canExtend} loading={extending} onClick={onExtend}>
            Keep going · 5 more
          </Button>
        </div>
        <p className="mt-6 text-[12.5px] text-faint">Next session in {fmtCountdown(nextDayStart(now) - now)}</p>
      </div>
    </section>
  );
}

/* ───────────────────────── Empty states ───────────────────────── */

function Hero({ icon, title, children, actions }: { icon: ReactNode; title: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="relative overflow-hidden rounded-[28px] border border-line bg-panel px-6 py-14 text-center shadow-card animate-rise sm:px-12">
      <div aria-hidden className="aurora absolute inset-0 opacity-70" />
      <div className="relative mx-auto max-w-md">
        <div className="bg-brand mx-auto grid size-16 place-items-center rounded-[22px] text-white shadow-[0_18px_40px_-14px_rgb(150_80_255/0.7)] [&_svg]:size-7">{icon}</div>
        <h2 className="mt-6 text-[24px] font-semibold tracking-[-0.035em] text-balance sm:text-[28px]">{title}</h2>
        <div className="mt-2.5 text-[14.5px] leading-relaxed text-muted">{children}</div>
        {actions ? <div className="mt-7 flex flex-wrap justify-center gap-2">{actions}</div> : null}
      </div>
    </section>
  );
}

function NoLibrary() {
  const [loading, setLoading] = useState(false);
  return (
    <Hero
      icon={<Brain />}
      title={
        <>
          Recall starts with <span className="serif-accent text-brand pr-1 text-[1.1em]">your bookmarks</span>
        </>
      }
      actions={
        <>
          <SyncButton hasData={false} size="lg" />
          <Button
            size="lg"
            variant="outline"
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
      Sync your X bookmarks and twtdash will bring back a few of them every day — right before you’d forget them.
    </Hero>
  );
}

function CaughtUp({ now, filtered, onIncludeAll }: { now: number; filtered: boolean; onIncludeAll: () => void }) {
  return (
    <Hero
      icon={<Check strokeWidth={2.6} />}
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
        Nothing to review right now. Next session in <b className="font-semibold text-fg tabular-nums">{fmtCountdown(nextDayStart(now) - now)}</b>.
      </p>
      {filtered ? <p className="mt-1.5">You’re only drawing from some categories — widen the filter for more.</p> : <p className="mt-1.5">Your streak is safe today.</p>}
    </Hero>
  );
}

/* ───────────────────────── Side rail ───────────────────────── */

function WeekStrip({ stats, today }: { stats: RecallStats; today: string }) {
  const active = new Set(stats.activeDays);
  const rest = new Set(stats.restDays);
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  return (
    <ol className="grid grid-cols-7 gap-1.5" aria-label="Last 7 days">
      {days.map((d) => {
        const isToday = d === today;
        const on = active.has(d);
        const label = format(dayStart(d), 'EEE');
        return (
          <li key={d} className="flex flex-col items-center gap-1.5" aria-label={`${format(dayStart(d), 'EEEE')}: ${on ? 'done' : rest.has(d) ? 'nothing due' : isToday ? 'not yet' : 'missed'}`}>
            <span className={cn('text-[10.5px] font-medium uppercase', isToday ? 'text-fg' : 'text-faint')}>{label.slice(0, 2)}</span>
            <span
              className={cn(
                'grid size-7 place-items-center rounded-full text-[11px]',
                on ? 'bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 text-white shadow-[0_6px_14px_-6px_rgb(249_115_22/0.8)]' : 'bg-panel-2 text-faint',
                isToday && !on && 'ring-2 ring-accent/50 ring-offset-2 ring-offset-panel',
              )}
            >
              {on ? <Flame className="size-3.5 fill-white/90" strokeWidth={1.6} /> : rest.has(d) ? '–' : ''}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function RailPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-panel p-4 shadow-card">
      <h2 className="mb-3 text-[11px] font-semibold tracking-[0.08em] text-faint uppercase">{title}</h2>
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
  return (
    <aside className="hidden space-y-3 xl:block" aria-label="Recall overview">
      <RailPanel title="This week">
        <WeekStrip stats={stats} today={today} />
        <div className="mt-4 grid grid-cols-2 gap-2 text-[12px]">
          <div className="rounded-xl bg-panel-2 px-3 py-2">
            <div className="text-[17px] font-semibold tabular-nums">{streak.longest}</div>
            <div className="text-muted">Longest streak</div>
          </div>
          <div className="rounded-xl bg-panel-2 px-3 py-2">
            <div className="text-[17px] font-semibold tabular-nums">{fmtNumber(stats.totalReviews)}</div>
            <div className="text-muted">Reviews, all time</div>
          </div>
        </div>
      </RailPanel>
      <RailPanel title="Coming up">
        <dl className="space-y-2 text-[13px]">
          {[
            ['Due tomorrow', outlook?.tomorrow],
            ['Due this week', outlook?.week],
            ['In rotation', outlook?.inRotation],
            ['Mastered', outlook?.mastered],
          ].map(([label, v]) => (
            <div key={label as string} className="flex items-center justify-between">
              <dt className="text-muted">{label}</dt>
              <dd className="font-medium tabular-nums">{v === undefined ? '—' : fmtNumber(v as number)}</dd>
            </div>
          ))}
        </dl>
      </RailPanel>
      <RailPanel title="Keyboard">
        <ul className="space-y-1">
          {SHORTCUTS.map(([keys, label]) => (
            <li key={label} className="flex h-7 items-center justify-between text-[12.5px]">
              <span className="text-fg-2">{label}</span>
              <span className="flex gap-1">
                {keys.map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </RailPanel>
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
    const swipeStyle: CSSProperties | undefined = dx ? { transform: `translateX(${dx}px) rotate(${dx / 26}deg)`, transition: 'none' } : undefined;
    body = (
      <div className="mx-auto w-full max-w-[700px]">
        <div className="flex items-center gap-3">
          <div
            role="progressbar"
            aria-label="Today’s progress"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={reviewedCount}
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-3 dark:bg-panel-2"
          >
            <div className="bg-brand h-full rounded-full transition-[width] duration-500 ease-out" style={{ width: `${total ? (reviewedCount / total) * 100 : 0}%` }} />
          </div>
          <span className="shrink-0 text-[12.5px] font-medium text-muted tabular-nums">
            {position} of {total}
          </span>
        </div>

        <div className="relative mt-4 pb-3 sm:mt-5">
          {queue.length > 2 ? <div aria-hidden className="absolute inset-x-6 top-3 bottom-0 rounded-[24px] border border-line bg-panel/60 shadow-card" /> : null}
          {queue.length > 1 ? <div aria-hidden className="absolute inset-x-3 top-1.5 bottom-1.5 rounded-[24px] border border-line bg-panel/80 shadow-card" /> : null}

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
              className={cn(
                'relative mb-3 overflow-hidden rounded-[24px] border border-line bg-panel shadow-hover [touch-action:pan-y] transition-transform duration-300 ease-out',
                !reduced && 'recall-in',
              )}
            >
              <span aria-hidden className="bg-brand absolute inset-x-0 top-0 h-[2px] opacity-70" />
              {dx ? <SwipeLabels dx={dx} /> : null}
              <PostCard b={shown.b} card={shown.card} category={lib.categoryMap.get(shown.b.category)} now={now} noteOpen={noteOpen} setNoteOpen={setNoteOpen} onOpen={openOnX} />
            </article>
          ) : (
            <div className="mb-3 h-[360px]" />
          )}

          {exiting ? (
            <article
              aria-hidden
              className={cn('pointer-events-none absolute inset-x-0 top-0 z-20 overflow-hidden rounded-[24px] border border-line bg-panel shadow-pop', `recall-out-${exiting.dir}`)}
              style={{ '--dx': `${exiting.dx}px`, '--rot': `${exiting.dx / 26}deg` } as CSSProperties}
            >
              <span aria-hidden className="bg-brand absolute inset-x-0 top-0 h-[2px] opacity-70" />
              <PostCard b={exiting.row.b} card={exiting.row.card} category={lib.categoryMap.get(exiting.row.b.category)} now={now} noteOpen={false} setNoteOpen={() => undefined} onOpen={() => undefined} />
            </article>
          ) : null}
        </div>

        <div className="sticky bottom-0 z-30 -mx-5 bg-[linear-gradient(to_top,var(--bg)_calc(100%-22px),transparent)] px-5 pt-6 pb-[max(10px,env(safe-area-inset-bottom))] sm:-mx-8 sm:px-8 sm:pt-7 lg:mx-0 lg:px-0 lg:pb-6">
          <RatingBar card={shown?.card} onRate={(r) => rate(r)} disabled={!shown || !!exiting} />
          <div className="mt-2 flex items-center justify-between gap-2 sm:mt-3">
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={skip} disabled={!shown || queue.length < 2 || !!exiting} title={queue.length < 2 ? 'This is the last card' : undefined}>
                <SkipForward /> Skip <Kbd className="ml-0.5 hidden sm:inline-flex">S</Kbd>
              </Button>
              <Button size="sm" variant="ghost" onClick={openOnX} disabled={!shown} className="hidden sm:inline-flex">
                <ExternalLink /> Open on X <Kbd className="ml-0.5">O</Kbd>
              </Button>
            </div>
            {lastReview ? (
              <Button size="sm" variant="ghost" className="animate-fade-in" onClick={() => void undo()}>
                <Undo2 /> Undo “{RATING_LABEL[lastReview.rating]}” <Kbd className="ml-0.5 hidden sm:inline-flex">Z</Kbd>
              </Button>
            ) : (
              <span className="truncate px-1 text-[12px] text-faint sm:hidden">Swipe → Good · ← Again</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  const showRail = !loading && !!lib.counts.total;

  return (
    <div className="relative">
      <style>{RECALL_CSS}</style>
      <svg aria-hidden width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="recall-brand" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#7B61FF" />
            <stop offset="0.55" stopColor="#B14CF2" />
            <stop offset="1" stopColor="#FF5C9D" />
          </linearGradient>
          <linearGradient id="recall-flame" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FBBF24" />
            <stop offset="0.6" stopColor="#F97316" />
            <stop offset="1" stopColor="#F43F5E" />
          </linearGradient>
        </defs>
      </svg>
      <div aria-hidden className="aurora pointer-events-none absolute inset-x-0 top-0 h-[360px] opacity-70" />

      <div className="relative mx-auto w-full max-w-[1240px] px-5 pt-6 pb-16 sm:px-8 sm:pt-8">
        <header className="flex animate-rise flex-wrap items-end justify-between gap-x-6 gap-y-4 sm:gap-y-5">
          <div className="min-w-0">
            <Eyebrow>Daily review · {format(now, 'EEEE, MMMM d')}</Eyebrow>
            <h1 className="mt-2.5 text-[32px] leading-[1.05] font-semibold tracking-[-0.045em] text-balance sm:text-[42px]">
              Recall <span className="serif-accent text-brand pr-1 text-[1.1em]">what you saved</span>
            </h1>
            <p className="mt-2 hidden max-w-xl text-[14.5px] text-muted sm:block">A few posts a day, resurfaced right before you’d forget them.</p>
          </div>
          {showRail && prefs ? (
            <div className="flex items-center gap-2">
              <TodayPill done={reviewedCount} total={fresh ? total : prefs.cardsPerDay} />
              <StreakPill streak={streak} />
              <SettingsPopover prefs={prefs} categories={lib.categories} counts={lib.counts.categories} onReset={() => setResetOpen(true)} />
            </div>
          ) : null}
        </header>

        <div className={cn('mt-6 grid gap-8 sm:mt-8', showRail && 'xl:grid-cols-[minmax(0,1fr)_272px] xl:gap-7')}>
          <div className="min-w-0">{body}</div>
          {showRail ? <Rail stats={stats} streak={streak} today={today} outlook={outlook} /> : null}
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
              toast('Recall reset', { description: 'A fresh start — today’s cards are being picked.' });
            }}
          >
            <RotateCcw /> Reset Recall
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function SwipeLabels({ dx }: { dx: number }) {
  const o = Math.min(1, Math.abs(dx) / SWIPE_AT);
  return (
    <>
      <span
        aria-hidden
        className="absolute top-5 right-5 z-10 rotate-6 rounded-xl border-2 border-current px-2.5 py-1 text-[13px] font-bold tracking-wide text-accent uppercase"
        style={{ opacity: dx > 0 ? o : 0 }}
      >
        Good
      </span>
      <span
        aria-hidden
        className="absolute top-5 left-5 z-10 -rotate-6 rounded-xl border-2 border-current px-2.5 py-1 text-[13px] font-bold tracking-wide text-amber-500 uppercase"
        style={{ opacity: dx < 0 ? o : 0 }}
      >
        Again soon
      </span>
    </>
  );
}

function CardSkeleton({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="mx-auto w-full max-w-[700px]" aria-busy="true">
      <div className="skeleton h-1.5 rounded-full" />
      <div className="mt-5 rounded-[24px] border border-line bg-panel p-5 shadow-card sm:p-7">
        <div className="flex gap-1.5">
          <div className="skeleton h-6 w-28 rounded-full" />
          <div className="skeleton h-6 w-20 rounded-full" />
        </div>
        <div className="mt-5 flex items-center gap-3">
          <div className="skeleton size-[46px] rounded-full" />
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
        <div className="skeleton mt-5 h-48 rounded-[14px]" />
      </div>
      <div className="mt-5 grid grid-cols-4 gap-2.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-[74px] rounded-2xl" />
        ))}
      </div>
      <p className="mt-4 text-center text-[12.5px] text-faint">{label}</p>
    </div>
  );
}
