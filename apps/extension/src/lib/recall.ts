/**
 * Recall — spaced resurfacing for saved posts.
 *
 * Everything that decides *what* to show and *when* is a pure function here
 * (scheduling, the daily queue, streaks, local-day maths) so it can be unit
 * tested across time zones. A thin layer persists state:
 *  - `db.recall`            one row per post that has entered Recall
 *  - `local:recallPrefs`    cards per day + category filter
 *  - `local:recallStats`    streak days, lifetime reviews
 *  - `local:recallSession`  today's planned queue, so reloads never reshuffle
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { storage, type WxtStorageItem } from 'wxt/utils/storage';
import { setArchived, setRead } from './actions';
import { db } from './db';
import type { Bookmark, RecallCard } from './types';

export type RecallRating = 'again' | 'good' | 'mastered' | 'notUseful';

export const DAY_MS = 86_400_000;
export const CARDS_PER_DAY_OPTIONS = [5, 10, 20, 30] as const;
export const DEFAULT_CARDS_PER_DAY = 10;
/** SM-2 starting ease; with the fixed ladder below it yields 1 → 3 → 7 → 16 → 35 → 77 days. */
export const DEFAULT_EASE = 2.2;
export const MIN_EASE = 1.3;
export const MAX_EASE = 3;
export const MAX_INTERVAL = 365;
/** Intervals (days) for the first consecutive "Good" ratings; later ones multiply by ease. */
export const GOOD_STEPS = [1, 3, 7, 16] as const;
/** A day keeps the streak alive with a finished session or at least this many reviews. */
export const STREAK_MIN_REVIEWS = 5;
/** `due` for cards that never come back (largest valid Date). */
export const NEVER = 8_640_000_000_000_000;
const TWO_WEEKS = 14 * DAY_MS;

/* ───────────────────────── Local-day maths ───────────────────────── */

const dtfCache = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    dtfCache.set(tz, f);
  }
  return f;
}

function zonedParts(ms: number, tz: string) {
  const p: Record<string, number> = {};
  for (const x of formatter(tz).formatToParts(ms)) if (x.type !== 'literal') p[x.type] = Number(x.value);
  return { y: p.year!, m: p.month!, d: p.day!, h: p.hour! % 24, min: p.minute!, s: p.second! };
}

/** Offset of `tz` from UTC at instant `ms`, in ms (IST → +19 800 000). */
function tzOffset(ms: number, tz: string): number {
  const p = zonedParts(ms, tz);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(ms / 1000) * 1000;
}

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

function splitKey(key: string): [number, number, number] {
  const [y, m, d] = key.split('-').map(Number);
  return [y!, m!, d!];
}

/** Local calendar day ("2026-10-24") of an instant — the device zone unless `tz` is given. */
export function dayKey(ms: number, tz?: string): string {
  if (!tz) {
    const d = new Date(ms);
    return ymd(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }
  const p = zonedParts(ms, tz);
  return ymd(p.y, p.m, p.d);
}

/** Instant of local midnight at the start of `key`. */
export function dayStart(key: string, tz?: string): number {
  const [y, m, d] = splitKey(key);
  if (!tz) return new Date(y, m - 1, d).getTime();
  const guess = Date.UTC(y, m - 1, d);
  const off = tzOffset(guess, tz);
  const t = guess - off;
  const off2 = tzOffset(t, tz);
  return off2 === off ? t : guess - off2;
}

/** Calendar arithmetic on day keys (no time zone involved). */
export function addDays(key: string, n: number): string {
  const [y, m, d] = splitKey(key);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** Whole days from `a` to `b` (b − a). */
export function diffDays(a: string, b: string): number {
  const [y1, m1, d1] = splitKey(a);
  const [y2, m2, d2] = splitKey(b);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DAY_MS);
}

/** Next local midnight after `ms`. */
export function nextDayStart(ms: number, tz?: string): number {
  return dayStart(addDays(dayKey(ms, tz), 1), tz);
}

/** "6h 12m", "12m", "under a minute". */
export function fmtCountdown(ms: number): string {
  const mins = Math.floor(Math.max(0, ms) / 60_000);
  if (mins < 1) return 'under a minute';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

/* ───────────────────────── Scheduling ───────────────────────── */

export function newCard(id: string, now: number): RecallCard {
  return { id, due: now, interval: 0, ease: DEFAULT_EASE, reps: 0, lapses: 0, state: 'new' };
}

/** Interval (days) a "Good" rating would give this card. */
export function goodInterval(card: RecallCard | undefined): number {
  const reps = (card?.reps ?? 0) + 1;
  const prev = card?.interval ?? 0;
  const raw = reps <= GOOD_STEPS.length ? GOOD_STEPS[reps - 1]! : Math.round(prev * (card?.ease ?? DEFAULT_EASE));
  // Always grow, never past a year.
  return Math.min(MAX_INTERVAL, Math.max(raw, prev + 1, 1));
}

/**
 * Apply a rating and return the card's next state (pure).
 * - again:     lapse → back tomorrow, ease −0.2 if it had graduated, ladder restarts
 * - good:      climb the ladder (1, 3, 7, 16 days) then × ease
 * - mastered / notUseful: retired, never resurfaces
 */
export function schedule(card: RecallCard | undefined, id: string, rating: RecallRating, now: number, tz?: string): RecallCard {
  const c = card ?? newCard(id, now);
  const base: RecallCard = {
    ...c,
    id,
    lastReviewedAt: now,
    lastRating: rating,
    firstReviewedAt: c.firstReviewedAt ?? now,
    reviews: (c.reviews ?? 0) + 1,
  };
  const at = (days: number) => dayStart(addDays(dayKey(now, tz), days), tz);
  switch (rating) {
    case 'again': {
      const graduated = c.state === 'review';
      const lapsed = c.state !== 'new' && c.reps > 0;
      return {
        ...base,
        state: 'learning',
        reps: 0,
        interval: 1,
        lapses: c.lapses + (lapsed ? 1 : 0),
        ease: graduated ? Math.max(MIN_EASE, +(c.ease - 0.2).toFixed(2)) : c.ease,
        due: at(1),
      };
    }
    case 'good': {
      const interval = goodInterval(c);
      return {
        ...base,
        state: interval >= 7 ? 'review' : 'learning',
        reps: c.reps + 1,
        interval,
        ease: Math.min(MAX_EASE, c.ease),
        due: at(interval),
      };
    }
    case 'mastered':
    case 'notUseful':
      return { ...base, state: 'done', reps: c.reps + 1, due: NEVER };
  }
}

/** "tomorrow", "in 3 days", "in 2 weeks", "in 5 months". */
export function fmtInterval(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 14) return `in ${days} days`;
  if (days < 60) return `in ${Math.round(days / 7)} weeks`;
  if (days < 365) return `in ${Math.round(days / 30)} months`;
  return 'in a year';
}

/** Short hint shown under each rating button. */
export function ratingHint(card: RecallCard | undefined, rating: RecallRating): string {
  if (rating === 'again') return 'tomorrow';
  if (rating === 'good') return fmtInterval(goodInterval(card));
  if (rating === 'mastered') return 'never again';
  return 'archive it';
}

/* ───────────────────────── Daily queue ───────────────────────── */

function engagement(b: Bookmark): number {
  const m = b.metrics;
  return m.likes + 2 * m.retweets + 2 * m.bookmarks + 2 * m.quotes;
}

/**
 * How much a post deserves a resurfacing slot (before daily jitter):
 * starred, never opened, substantial (threads, articles, long reads), popular,
 * annotated. Fresh saves and contentless posts are held back.
 */
export function recallPriority(b: Bookmark, now: number): number {
  let s = 0;
  if (b.starred) s += 3;
  if (!b.read) {
    s += 1.25;
    if (now - b.savedAt > TWO_WEEKS) s += 1.5;
  }
  const f = b.facets;
  if (f.includes('thread') || f.includes('article') || f.includes('long')) s += 1.5;
  else if (b.text.length > 280) s += 0.75;
  s += Math.min(2, Math.log10(engagement(b) + 1) / 2.5);
  if (b.note && /\S/.test(b.note)) s += 0.75;
  if (b.summary) s += 0.25;
  if (now - b.savedAt < 2 * DAY_MS) s -= 2;
  if (b.text.length < 40 && !b.media.length && !b.card && !b.article && !b.quoted && !b.poll) s -= 1;
  return s;
}

/** Why this post is in today's session — shown as small chips on the card. */
export function recallReasons(b: Bookmark, card: RecallCard | undefined, now: number): string[] {
  const out: string[] = [];
  if (card && card.state !== 'new' && card.reviews) out.push(card.lastRating === 'again' ? 'Again, as you asked' : 'Due for review');
  else out.push('New to Recall');
  if (b.starred) out.push('Starred');
  if (!b.read && now - b.savedAt > TWO_WEEKS) out.push('Never opened');
  if (b.facets.includes('thread')) out.push('Thread');
  else if (b.facets.includes('article')) out.push('Article');
  else if (b.facets.includes('long')) out.push('Long read');
  if (engagement(b) >= 10_000) out.push('Popular');
  return out.slice(0, 3);
}

/** 32-bit FNV-1a. */
function fnv1a(str: string, seed = 0x811c9dc5): number {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** murmur3 finalizer — spreads FNV's low-entropy outputs over [0, 2^32). */
function mix(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Deterministic per-day random number in [0, 1) for a post. */
export function dayRandom(day: string, id: string): number {
  return mix(fnv1a(id, fnv1a(day))) / 4294967296;
}

/** Daily jitter range: rotates picks between days without drowning out priority. */
const JITTER = 2;

interface Scored {
  id: string;
  s: number;
}

const cmpId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
/** Higher score first; id breaks ties so input order never matters. */
const cmpScored = (a: Scored, b: Scored) => b.s - a.s || cmpId(a.id, b.id);

function insertTopK(list: Scored[], id: string, s: number, k: number) {
  const n = list.length;
  if (n >= k) {
    const worst = list[n - 1]!;
    if (s < worst.s || (s === worst.s && id > worst.id)) return;
  }
  const item = { id, s };
  let i = n;
  while (i > 0 && cmpScored(item, list[i - 1]!) < 0) i--;
  list.splice(i, 0, item);
  if (list.length > k) list.pop();
}

export interface QueueInput {
  /** The whole library (archived and partial rows are skipped). */
  bookmarks: readonly Bookmark[];
  byId?: ReadonlyMap<string, Bookmark>;
  /** Recall rows with `due <= now` (rows in any state; retired ones are ignored). */
  dueCards: readonly RecallCard[];
  /** Every id that already has a Recall row — those are never "new". */
  knownIds: ReadonlySet<string>;
  /** Ids to leave out (already reviewed today / already planned). */
  exclude?: ReadonlySet<string>;
  /** How many cards to return. */
  limit: number;
  /** Category ids to draw from; empty or missing means all. */
  categories?: readonly string[];
  /** Local day key — seeds the daily shuffle. */
  day: string;
  now: number;
}

const NO_IDS: ReadonlySet<string> = new Set();

/**
 * Today's queue: due reviews first (oldest due first), then new picks.
 * New picks take the best-scoring posts per category (priority + seeded daily
 * jitter) and interleave categories round-robin so a session never turns into
 * ten posts about the same thing. Pure and deterministic; one O(n) pass.
 */
export function buildQueue(input: QueueInput): string[] {
  const { limit, now, day } = input;
  if (limit <= 0) return [];
  const exclude = input.exclude ?? NO_IDS;
  const cats = input.categories?.length ? new Set(input.categories) : null;
  const playable = (b: Bookmark | undefined): b is Bookmark => !!b && !b.archived && !b.partial && (!cats || cats.has(b.category));

  let due: string[] = [];
  if (input.dueCards.length) {
    let byId = input.byId;
    if (!byId) {
      const m = new Map<string, Bookmark>();
      for (const b of input.bookmarks) m.set(b.id, b);
      byId = m;
    }
    due = input.dueCards
      .filter((c) => c.state !== 'done' && c.due <= now && !exclude.has(c.id) && playable(byId.get(c.id)))
      .sort((a, b) => a.due - b.due || cmpId(a.id, b.id))
      .slice(0, limit)
      .map((c) => c.id);
  }
  const need = limit - due.length;
  if (need <= 0) return due;

  const taken = new Set(due);
  const known = input.knownIds.size ? input.knownIds : null;
  const skip = exclude.size ? exclude : null;
  const planned = taken.size ? taken : null;
  const seed = fnv1a(day);
  const buckets = new Map<string, Scored[]>();
  const list = input.bookmarks;
  for (let i = 0; i < list.length; i++) {
    const b = list[i]!;
    if (b.archived || b.partial || (cats && !cats.has(b.category))) continue;
    const id = b.id;
    if ((known && known.has(id)) || (skip && skip.has(id)) || (planned && planned.has(id))) continue;
    let bucket = buckets.get(b.category);
    if (!bucket) buckets.set(b.category, (bucket = []));
    const p = recallPriority(b, now);
    // Can't beat this category's worst pick even with maximum jitter: skip the hash.
    if (bucket.length >= need && p + JITTER < bucket[bucket.length - 1]!.s) continue;
    insertTopK(bucket, id, p + (mix(fnv1a(id, seed)) / 4294967296) * JITTER, need);
  }

  const lists = [...buckets.entries()]
    .filter((e) => e[1].length)
    .sort((a, b) => cmpScored(a[1][0]!, b[1][0]!) || cmpId(a[0], b[0]))
    .map((e) => e[1]);
  const picks: string[] = [];
  for (let round = 0; picks.length < need; round++) {
    let any = false;
    for (const list of lists) {
      const x = list[round];
      if (!x) continue;
      any = true;
      picks.push(x.id);
      if (picks.length >= need) break;
    }
    if (!any) break;
  }
  return due.concat(picks);
}

/* ───────────────────────── Streaks ───────────────────────── */

export interface RecallStats {
  totalReviews: number;
  longest: number;
  /** Local days that count toward the streak (sorted). */
  activeDays: string[];
  /** Days with nothing to review: they keep a streak alive without extending it. */
  restDays: string[];
  /** Reviews per local day (recent history). */
  daily: Record<string, number>;
}

export const EMPTY_STATS: RecallStats = { totalReviews: 0, longest: 0, activeDays: [], restDays: [], daily: {} };

export interface StreakInfo {
  current: number;
  longest: number;
  /** Today already counts toward the streak. */
  todayCounts: boolean;
  /** A streak is running but today hasn't been earned yet. */
  atRisk: boolean;
}

export function computeStreak(stats: RecallStats, today: string): StreakInfo {
  const active = new Set(stats.activeDays);
  const rest = new Set(stats.restDays);
  const todayCounts = active.has(today);
  let d = todayCounts || rest.has(today) ? today : addDays(today, -1);
  let current = 0;
  for (let guard = active.size + rest.size + 1; guard > 0; guard--) {
    if (active.has(d)) current++;
    else if (!rest.has(d)) break;
    d = addDays(d, -1);
  }
  return { current, longest: Math.max(stats.longest, current), todayCounts, atRisk: current > 0 && !todayCounts && !rest.has(today) };
}

const MAX_DAYS_KEPT = 1200;
const MAX_DAILY_KEPT = 400;

function withActiveDay(stats: RecallStats, day: string): RecallStats {
  if (stats.activeDays.includes(day)) return stats;
  const activeDays = [...stats.activeDays, day].sort().slice(-MAX_DAYS_KEPT);
  const next = { ...stats, activeDays, restDays: stats.restDays.filter((d) => d !== day) };
  return { ...next, longest: Math.max(next.longest, computeStreak(next, day).current) };
}

/** Count `count` reviews on `day`; the day joins the streak at STREAK_MIN_REVIEWS. */
export function recordReviews(stats: RecallStats, day: string, count = 1): RecallStats {
  const daily: Record<string, number> = { ...stats.daily, [day]: (stats.daily[day] ?? 0) + count };
  const keys = Object.keys(daily);
  if (keys.length > MAX_DAILY_KEPT) for (const k of keys.sort().slice(0, keys.length - MAX_DAILY_KEPT)) delete daily[k];
  const next = { ...stats, totalReviews: stats.totalReviews + count, daily };
  return daily[day]! >= STREAK_MIN_REVIEWS ? withActiveDay(next, day) : next;
}

/** A finished session always counts, however short. */
export function markDayComplete(stats: RecallStats, day: string): RecallStats {
  return withActiveDay(stats, day);
}

export function markRestDay(stats: RecallStats, day: string): RecallStats {
  if (stats.activeDays.includes(day) || stats.restDays.includes(day)) return stats;
  return { ...stats, restDays: [...stats.restDays, day].sort().slice(-MAX_DAYS_KEPT) };
}

/* ───────────────────────── Persistence ───────────────────────── */

export interface RecallPrefs {
  cardsPerDay: number;
  /** Category ids to include; empty means every category. */
  categories: string[];
}

export const DEFAULT_RECALL_PREFS: RecallPrefs = { cardsPerDay: DEFAULT_CARDS_PER_DAY, categories: [] };

export interface RecallSession {
  /** Local day this plan belongs to. */
  day: string;
  /** Planned queue in order (reviewed ids stay in place). */
  ids: string[];
  /** Ids rated today. */
  reviewed: string[];
  /** cardsPerDay and category filter the plan was built for. */
  limit: number;
  filter: string;
  /** Extra cards added with "Keep going". */
  bonus: number;
  /** Library size when planned — an empty plan is retried once the library changes. */
  libSize: number;
  completedAt?: number;
  /** Bumped on every write, so UIs can ignore storage events that arrive out of order. */
  rev?: number;
}

export const recallPrefsItem = storage.defineItem<RecallPrefs>('local:recallPrefs', { fallback: DEFAULT_RECALL_PREFS });
export const recallStatsItem = storage.defineItem<RecallStats>('local:recallStats', { fallback: EMPTY_STATS });
export const recallSessionItem = storage.defineItem<RecallSession | null>('local:recallSession', { fallback: null });

export function normalizePrefs(p: Partial<RecallPrefs> | null | undefined): RecallPrefs {
  const n = Number(p?.cardsPerDay);
  return {
    cardsPerDay: (CARDS_PER_DAY_OPTIONS as readonly number[]).includes(n) ? n : DEFAULT_CARDS_PER_DAY,
    categories: Array.isArray(p?.categories) ? [...new Set(p.categories.filter((c) => typeof c === 'string'))] : [],
  };
}

function normalizeStats(s: Partial<RecallStats> | null | undefined): RecallStats {
  return { ...EMPTY_STATS, ...s, activeDays: s?.activeDays ?? [], restDays: s?.restDays ?? [], daily: s?.daily ?? {} };
}

export async function getRecallPrefs(): Promise<RecallPrefs> {
  return normalizePrefs(await recallPrefsItem.getValue());
}

export async function updateRecallPrefs(patch: Partial<RecallPrefs>): Promise<RecallPrefs> {
  const next = normalizePrefs({ ...(await getRecallPrefs()), ...patch });
  await recallPrefsItem.setValue(next);
  return next;
}

export const filterKey = (categories: readonly string[]) => [...categories].sort().join(',');

const nextRev = (s: RecallSession | null | undefined) => (s?.rev ?? 0) + 1;

/** Is `next` at least as new as `prev`? (Storage events can land after a newer local write.) */
export function isNewerSession(prev: RecallSession | null | undefined, next: RecallSession | null): boolean {
  return !prev || !next || next.day !== prev.day || (next.rev ?? 0) >= (prev.rev ?? 0);
}

/** Does `session` still describe today's plan for these prefs? */
export function sessionMatches(session: RecallSession | null | undefined, prefs: RecallPrefs, today: string, libSize?: number): boolean {
  if (!session || session.day !== today || session.limit !== prefs.cardsPerDay || session.filter !== filterKey(prefs.categories)) return false;
  // An empty plan (nothing to review) is worth retrying when new posts arrive.
  if (!session.ids.length && libSize !== undefined && libSize !== session.libSize) return false;
  return true;
}

/** Planned ids not rated yet, in order. */
export function pendingIds(session: RecallSession | null | undefined): string[] {
  if (!session) return [];
  const done = new Set(session.reviewed);
  return session.ids.filter((id) => !done.has(id));
}

/** Can this post be shown in a session right now? */
export function isPlayable(b: Bookmark | undefined, card: RecallCard | undefined): b is Bookmark {
  return !!b && !b.archived && card?.state !== 'done';
}

// Every write goes through one queue so rapid ratings never interleave read-modify-write cycles.
let chain: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => undefined);
  return run;
}

interface TimeOpts {
  now?: number;
  tz?: string;
}

async function queueInputs(now: number) {
  const [dueCards, keys] = await Promise.all([db.recall.where('due').belowOrEqual(now).toArray(), db.recall.toCollection().primaryKeys()]);
  return { dueCards, knownIds: new Set(keys as string[]) };
}

export interface LibrarySource {
  bookmarks: readonly Bookmark[];
  byId?: ReadonlyMap<string, Bookmark>;
}

/**
 * Return today's plan, building (and persisting) it when the day, cards-per-day
 * or category filter changed. Ratings already given today are kept.
 */
export function ensureTodaySession(lib: LibrarySource, opts: TimeOpts = {}): Promise<RecallSession> {
  return serial(async () => {
    const now = opts.now ?? Date.now();
    const today = dayKey(now, opts.tz);
    const [prefs, current] = await Promise.all([getRecallPrefs(), recallSessionItem.getValue()]);
    if (current && sessionMatches(current, prefs, today, lib.bookmarks.length)) return current;
    const sameDay = current?.day === today;
    const reviewed = sameDay ? current.reviewed : [];
    const bonus = sameDay ? current.bonus : 0;
    const { dueCards, knownIds } = await queueInputs(now);
    const fill = buildQueue({
      bookmarks: lib.bookmarks,
      byId: lib.byId,
      dueCards,
      knownIds,
      exclude: new Set(reviewed),
      limit: Math.max(0, prefs.cardsPerDay + bonus - reviewed.length),
      categories: prefs.categories,
      day: today,
      now,
    });
    const session: RecallSession = {
      day: today,
      ids: [...reviewed, ...fill],
      reviewed,
      limit: prefs.cardsPerDay,
      filter: filterKey(prefs.categories),
      bonus,
      libSize: lib.bookmarks.length,
      completedAt: sameDay && !fill.length ? current.completedAt : undefined,
      rev: nextRev(current),
    };
    if (!session.ids.length && lib.bookmarks.length) await recallStatsItem.setValue(markRestDay(normalizeStats(await recallStatsItem.getValue()), today));
    await recallSessionItem.setValue(session);
    return session;
  });
}

/** "Keep going": append `count` more cards to today's plan. */
export function extendSession(lib: LibrarySource, count = 5, opts: TimeOpts = {}): Promise<RecallSession | null> {
  return serial(async () => {
    const now = opts.now ?? Date.now();
    const today = dayKey(now, opts.tz);
    const [prefs, session] = await Promise.all([getRecallPrefs(), recallSessionItem.getValue()]);
    if (!session || session.day !== today) return session;
    const { dueCards, knownIds } = await queueInputs(now);
    const fill = buildQueue({ bookmarks: lib.bookmarks, byId: lib.byId, dueCards, knownIds, exclude: new Set(session.ids), limit: count, categories: prefs.categories, day: today, now });
    const next: RecallSession = { ...session, ids: [...session.ids, ...fill], bonus: session.bonus + count, rev: nextRev(session) };
    await recallSessionItem.setValue(next);
    return next;
  });
}

export interface ReviewResult {
  id: string;
  rating: RecallRating;
  card: RecallCard;
  session: RecallSession | null;
  stats: RecallStats;
  /** This rating finished today's session. */
  completed: boolean;
  /** State needed to roll this review back. */
  undo: { prevCard?: RecallCard; prevSession: RecallSession | null; prevStats: RecallStats; prevRead?: 0 | 1; prevArchived?: 0 | 1 };
}

/**
 * Rate a card: reschedule it, mark the post read (or archive it for
 * "Not useful"), tick today's session and streak.
 */
export function review(id: string, rating: RecallRating, opts: TimeOpts = {}): Promise<ReviewResult> {
  return serial(async () => {
    const now = opts.now ?? Date.now();
    const today = dayKey(now, opts.tz);
    const [prevCard, bookmark, prevSession, rawStats] = await Promise.all([db.recall.get(id), db.bookmarks.get(id), recallSessionItem.getValue(), recallStatsItem.getValue()]);
    const prevStats = normalizeStats(rawStats);
    const card = schedule(prevCard, id, rating, now, opts.tz);
    await db.recall.put(card);
    if (rating === 'notUseful') {
      if (bookmark && !bookmark.archived) await setArchived([id], true);
    } else if (bookmark && !bookmark.read) {
      await setRead([id], true);
    }

    let session = prevSession;
    if (session && session.day === today) {
      if (!session.reviewed.includes(id)) session = { ...session, reviewed: [...session.reviewed, id], ids: session.ids.includes(id) ? session.ids : [...session.ids, id] };
    } else {
      // Rated outside today's plan (e.g. a tab left open past midnight): keep the
      // rating and force a re-plan on next load.
      session = { day: today, ids: [id], reviewed: [id], limit: -1, filter: '', bonus: 0, libSize: 0 };
    }
    session = { ...session, rev: nextRev(prevSession) };
    let stats = recordReviews(prevStats, today);
    let completed = false;
    if (session.limit !== -1 && !session.completedAt && !pendingIds(session).length) {
      session = { ...session, completedAt: now };
      stats = markDayComplete(stats, today);
      completed = true;
    }
    await Promise.all([recallSessionItem.setValue(session), recallStatsItem.setValue(stats)]);
    return { id, rating, card, session, stats, completed, undo: { prevCard, prevSession, prevStats, prevRead: bookmark?.read, prevArchived: bookmark?.archived } };
  });
}

/** Roll back the most recent review. */
export function undoReview(r: ReviewResult): Promise<{ session: RecallSession | null; stats: RecallStats }> {
  return serial(async () => {
    const { prevCard, prevSession, prevStats, prevRead, prevArchived } = r.undo;
    if (prevCard) await db.recall.put(prevCard);
    else await db.recall.delete(r.id);
    if (r.rating === 'notUseful' && prevArchived === 0) await setArchived([r.id], false);
    if (r.rating !== 'notUseful' && prevRead === 0) await setRead([r.id], false);
    const current = await recallSessionItem.getValue();
    const session = prevSession && { ...prevSession, rev: nextRev(current) };
    await Promise.all([recallSessionItem.setValue(session), recallStatsItem.setValue(prevStats)]);
    return { session, stats: prevStats };
  });
}

/** "Skip": no scheduling change, the card moves to the end of today's queue. */
export function skipCard(id: string): Promise<RecallSession | null> {
  return serial(async () => {
    const session = await recallSessionItem.getValue();
    if (!session || !session.ids.includes(id)) return session;
    const next = { ...session, ids: [...session.ids.filter((x) => x !== id), id], rev: nextRev(session) };
    await recallSessionItem.setValue(next);
    return next;
  });
}

/** Credit the day when the plan ran out without a final rating (e.g. leftovers were archived elsewhere). */
export function completeSession(opts: TimeOpts = {}): Promise<{ session: RecallSession | null; stats: RecallStats }> {
  return serial(async () => {
    const now = opts.now ?? Date.now();
    const today = dayKey(now, opts.tz);
    const [session, rawStats] = await Promise.all([recallSessionItem.getValue(), recallStatsItem.getValue()]);
    let stats = normalizeStats(rawStats);
    if (!session || session.day !== today || session.completedAt || !session.reviewed.length) return { session, stats };
    const next = { ...session, completedAt: now, rev: nextRev(session) };
    stats = markDayComplete(stats, today);
    await Promise.all([recallSessionItem.setValue(next), recallStatsItem.setValue(stats)]);
    return { session: next, stats };
  });
}

/** Forget all review history, schedules and streaks (bookmarks and prefs are untouched). */
export function resetRecall(): Promise<void> {
  return serial(async () => {
    await db.recall.clear();
    await Promise.all([recallSessionItem.removeValue(), recallStatsItem.removeValue()]);
  });
}

/* ───────────────────────── Summary (Home widget / sidebar badge) ───────────────────────── */

export interface RecallSummary {
  /** Cards left in today's session (an estimate until the session is planned). */
  dueToday: number;
  streak: number;
  /** Today's session is finished. */
  doneToday: boolean;
  reviewedToday: number;
  /** reviewedToday + dueToday */
  planned: number;
  longest: number;
  /** Today already counts toward the streak. */
  todayCounts: boolean;
  /** A streak is running and today hasn't been earned yet. */
  streakAtRisk: boolean;
}

/** Dexie-only part of the summary (safe inside liveQuery). */
export async function summarize(prefsIn: RecallPrefs, session: RecallSession | null, statsIn: RecallStats, now: number, tz?: string): Promise<RecallSummary> {
  const prefs = normalizePrefs(prefsIn);
  const stats = normalizeStats(statsIn);
  const today = dayKey(now, tz);
  const streak = computeStreak(stats, today);
  const reviewedToday = session?.day === today ? session.reviewed.length : 0;
  let dueToday: number;
  if (session && sessionMatches(session, prefs, today)) {
    const pending = pendingIds(session);
    if (pending.length) {
      const [bs, cs] = await Promise.all([db.bookmarks.bulkGet(pending), db.recall.bulkGet(pending)]);
      dueToday = pending.filter((_, i) => isPlayable(bs[i], cs[i])).length;
    } else dueToday = 0;
  } else {
    const slots = Math.max(0, prefs.cardsPerDay + (session?.day === today ? session.bonus : 0) - reviewedToday);
    if (!slots) dueToday = 0;
    else {
      const [due, pool, known] = await Promise.all([
        db.recall
          .where('due')
          .belowOrEqual(now)
          .filter((c) => c.state !== 'done')
          .count(),
        prefs.categories.length
          ? db.bookmarks
              .where('[archived+category]')
              .anyOf(prefs.categories.map((c) => [0, c]))
              .count()
          : db.bookmarks.where('archived').equals(0).count(),
        db.recall.count(),
      ]);
      dueToday = Math.min(slots, due + Math.max(0, pool - known));
    }
  }
  return {
    dueToday,
    streak: streak.current,
    doneToday: reviewedToday > 0 && dueToday === 0,
    reviewedToday,
    planned: reviewedToday + dueToday,
    longest: streak.longest,
    todayCounts: streak.todayCounts,
    streakAtRisk: streak.atRisk,
  };
}

export async function getRecallSummary(now = Date.now()): Promise<RecallSummary> {
  const [prefs, session, stats] = await Promise.all([recallPrefsItem.getValue(), recallSessionItem.getValue(), recallStatsItem.getValue()]);
  return summarize(prefs, session, stats, now);
}

/* ───────────────────────── React hooks ───────────────────────── */

/**
 * Storage item as React state: `undefined` until first read, then follows
 * changes from any tab. The setter only updates local state (for optimistic UI).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useStoredItem<T>(item: WxtStorageItem<T, any>): [T | undefined, (v: T) => void] {
  const [value, setValue] = useState<T | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    void item.getValue().then((v) => alive && setValue(v));
    const unwatch = item.watch((v) => setValue(v));
    return () => {
      alive = false;
      unwatch();
    };
  }, [item]);
  return [value, setValue];
}

/** `Date.now()` that refreshes at local midnight, on focus and every `everyMs` (if given). */
export function useClock(everyMs?: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const bump = () => setNow(Date.now());
    const midnight = window.setTimeout(bump, Math.min(nextDayStart(now) - Date.now() + 500, 2 ** 31 - 1));
    const interval = everyMs ? window.setInterval(bump, everyMs) : undefined;
    const onVisible = () => document.visibilityState === 'visible' && bump();
    window.addEventListener('focus', bump);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(midnight);
      window.clearInterval(interval);
      window.removeEventListener('focus', bump);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [now, everyMs]);
  return now;
}

/** Live Recall summary for a Home widget or sidebar badge. `undefined` while loading. */
export function useRecallSummary(): RecallSummary | undefined {
  const [prefs] = useStoredItem(recallPrefsItem);
  const [session] = useStoredItem(recallSessionItem);
  const [stats] = useStoredItem(recallStatsItem);
  const now = useClock();
  const day = dayKey(now);
  return useLiveQuery(
    () => (prefs && session !== undefined && stats ? summarize(prefs, session, stats, Date.now()) : undefined),
    [prefs, session, stats, day],
  );
}
