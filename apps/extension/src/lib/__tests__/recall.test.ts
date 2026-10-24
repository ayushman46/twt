import 'fake-indexeddb/auto';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import {
  DAY_MS,
  EMPTY_STATS,
  NEVER,
  STREAK_MIN_REVIEWS,
  addDays,
  buildQueue,
  completeSession,
  computeStreak,
  dayKey,
  dayStart,
  diffDays,
  ensureTodaySession,
  extendSession,
  fmtCountdown,
  fmtInterval,
  getRecallSummary,
  markDayComplete,
  markRestDay,
  nextDayStart,
  pendingIds,
  recallSessionItem,
  recallStatsItem,
  recordReviews,
  resetRecall,
  review,
  schedule,
  skipCard,
  undoReview,
  updateRecallPrefs,
  type QueueInput,
  type RecallStats,
} from '../recall';
import type { Bookmark, RecallCard } from '../types';

const IST = 'Asia/Kolkata';
const UTC = 'UTC';
/** 2026-10-24 10:00 IST (04:30Z). */
const NOW = Date.parse('2026-10-24T04:30:00Z');
const CATS = ['ai', 'design', 'dev', 'startups', 'health'];

function mk(i: number, over: Partial<Bookmark> = {}): Bookmark {
  const id = `p${String(i).padStart(5, '0')}`;
  const savedAt = NOW - (30 + (i % 300)) * DAY_MS;
  return {
    id,
    url: `https://x.com/u/status/${id}`,
    text: `Post number ${i} with enough words to look like a real saved post about something useful.`,
    lang: 'en',
    createdAt: savedAt - DAY_MS,
    author: { id: String(i % 40), name: `Author ${i % 40}`, handle: `author${i % 40}`, avatar: '', verified: false },
    media: [],
    links: [],
    hashtags: [],
    mentions: [],
    metrics: { likes: i % 500, retweets: i % 50, replies: 0, quotes: 0, views: 0, bookmarks: i % 30 },
    isReply: false,
    isNote: false,
    sources: ['bookmark'],
    savedAt,
    capturedAt: savedAt,
    updatedAt: savedAt,
    category: CATS[i % CATS.length]!,
    categorySource: 'rule',
    tags: [],
    collections: [],
    starred: 0,
    archived: 0,
    read: 1,
    note: '',
    facets: [],
    ...over,
  };
}

const library = (n: number, f?: (i: number) => Partial<Bookmark>) => Array.from({ length: n }, (_, i) => mk(i, f?.(i)));

function input(bookmarks: Bookmark[], over: Partial<QueueInput> = {}): QueueInput {
  return { bookmarks, dueCards: [], knownIds: new Set(), limit: 10, day: '2026-10-24', now: NOW, ...over };
}

function card(id: string, over: Partial<RecallCard> = {}): RecallCard {
  return { id, due: NOW - DAY_MS, interval: 3, ease: 2.2, reps: 2, lapses: 0, state: 'learning', reviews: 2, ...over };
}

describe('local-day maths', () => {
  it('puts the same instant on different days in IST and UTC', () => {
    const lateUtc = Date.parse('2026-10-24T20:00:00Z'); // 01:30 on the 25th in India
    expect(dayKey(lateUtc, UTC)).toBe('2026-10-24');
    expect(dayKey(lateUtc, IST)).toBe('2026-10-25');
    expect(dayKey(Date.parse('2026-10-24T18:29:59Z'), IST)).toBe('2026-10-24');
    expect(dayKey(Date.parse('2026-10-24T18:30:00Z'), IST)).toBe('2026-10-25');
  });

  it('finds local midnight', () => {
    expect(new Date(dayStart('2026-10-25', IST)).toISOString()).toBe('2026-10-24T18:30:00.000Z');
    expect(new Date(dayStart('2026-10-25', UTC)).toISOString()).toBe('2026-10-25T00:00:00.000Z');
    expect(new Date(nextDayStart(NOW, IST)).toISOString()).toBe('2026-10-24T18:30:00.000Z');
    // DST zone: New York falls back on 2026-11-01.
    expect(new Date(dayStart('2026-11-01', 'America/New_York')).toISOString()).toBe('2026-11-01T04:00:00.000Z');
    expect(new Date(dayStart('2026-11-02', 'America/New_York')).toISOString()).toBe('2026-11-02T05:00:00.000Z');
  });

  it('does calendar arithmetic across month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
    expect(diffDays('2026-10-24', '2026-11-03')).toBe(10);
  });

  it('formats countdowns and intervals', () => {
    expect(fmtCountdown((6 * 60 + 12) * 60_000 + 30_000)).toBe('6h 12m');
    expect(fmtCountdown(5 * 60_000)).toBe('5m');
    expect(fmtCountdown(10_000)).toBe('under a minute');
    expect(fmtInterval(1)).toBe('tomorrow');
    expect(fmtInterval(3)).toBe('in 3 days');
    expect(fmtInterval(16)).toBe('in 2 weeks');
    expect(fmtInterval(77)).toBe('in 3 months');
  });
});

describe('schedule', () => {
  it('climbs 1 → 3 → 7 → 16 → 35 → 77 days on repeated "Good"', () => {
    let c: RecallCard | undefined;
    const seen: number[] = [];
    let t = NOW;
    for (let i = 0; i < 6; i++) {
      c = schedule(c, 'a', 'good', t, IST);
      seen.push(c.interval);
      t = c.due + 10 * 3_600_000;
    }
    expect(seen).toEqual([1, 3, 7, 16, 35, 77]);
    expect(c!.state).toBe('review');
    expect(c!.reviews).toBe(6);
  });

  it('schedules at local midnight, N days later', () => {
    const c = schedule(undefined, 'a', 'good', NOW, IST);
    expect(c.due).toBe(dayStart('2026-10-25', IST));
    expect(c.state).toBe('learning');
    expect(c.firstReviewedAt).toBe(NOW);
    const c2 = schedule(c, 'a', 'good', c.due + 3_600_000, IST);
    expect(dayKey(c2.due, IST)).toBe('2026-10-28');
  });

  it('"Again soon" brings a card back tomorrow and counts a lapse only once it was learned', () => {
    const fresh = schedule(undefined, 'a', 'again', NOW, IST);
    expect(fresh).toMatchObject({ state: 'learning', interval: 1, lapses: 0, reps: 0, ease: 2.2 });
    expect(dayKey(fresh.due, IST)).toBe('2026-10-25');

    const learned = card('a', { state: 'review', interval: 16, reps: 4, ease: 2.2 });
    const lapsed = schedule(learned, 'a', 'again', NOW, IST);
    expect(lapsed).toMatchObject({ state: 'learning', interval: 1, lapses: 1, reps: 0, ease: 2 });
    // The ladder restarts after a lapse.
    expect(schedule(lapsed, 'a', 'good', NOW + DAY_MS, IST).interval).toBe(2);
  });

  it('never lets ease fall below the floor or intervals exceed a year', () => {
    let c = card('a', { state: 'review', ease: 1.35, interval: 30, reps: 6 });
    c = schedule(c, 'a', 'again', NOW, IST);
    expect(c.ease).toBe(1.3);
    const long = schedule(card('a', { state: 'review', interval: 300, reps: 9, ease: 2.5 }), 'a', 'good', NOW, IST);
    expect(long.interval).toBe(365);
  });

  it('retires mastered and not-useful cards for good', () => {
    expect(schedule(undefined, 'a', 'mastered', NOW)).toMatchObject({ state: 'done', due: NEVER, lastRating: 'mastered' });
    expect(schedule(card('a'), 'a', 'notUseful', NOW)).toMatchObject({ state: 'done', due: NEVER, lastRating: 'notUseful' });
  });
});

describe('buildQueue', () => {
  const lib = library(500);

  it('puts due reviews first, oldest due first, then fills with new picks', () => {
    const due = [card(lib[3]!.id, { due: NOW - 2 * DAY_MS }), card(lib[9]!.id, { due: NOW - 5 * DAY_MS }), card(lib[12]!.id, { due: NOW + DAY_MS })];
    const q = buildQueue(input(lib, { dueCards: due, knownIds: new Set(due.map((c) => c.id)) }));
    expect(q).toHaveLength(10);
    expect(q.slice(0, 2)).toEqual([lib[9]!.id, lib[3]!.id]);
    expect(q).not.toContain(lib[12]!.id); // not due yet
  });

  it('caps the queue at the daily limit even when many reviews are due', () => {
    const due = lib.slice(0, 40).map((b, i) => card(b.id, { due: NOW - i * 1000 }));
    const q = buildQueue(input(lib, { dueCards: due, knownIds: new Set(due.map((c) => c.id)), limit: 5 }));
    expect(q).toEqual(due.slice(-5).reverse().map((c) => c.id));
  });

  it('is deterministic for a day, whatever the input order', () => {
    const a = buildQueue(input(lib));
    const b = buildQueue(input([...lib].reverse()));
    expect(a).toEqual(b);
    const tomorrow = buildQueue(input(lib, { day: '2026-10-25' }));
    expect(tomorrow).not.toEqual(a);
  });

  it('never repeats a post and skips archived, partial, retired and known posts', () => {
    const mixed = library(60, (i) => ({ archived: i % 4 === 0 ? 1 : 0, partial: i % 5 === 0 ? true : undefined }));
    const known = new Set(mixed.slice(1, 10).map((b) => b.id));
    const due = [card(mixed[0]!.id), card(mixed[1]!.id, { state: 'done', due: 0 })];
    const q = buildQueue(input(mixed, { dueCards: due, knownIds: known, limit: 30 }));
    expect(new Set(q).size).toBe(q.length);
    for (const id of q) {
      const b = mixed.find((x) => x.id === id)!;
      expect(b.archived).toBe(0);
      expect(b.partial).toBeFalsy();
      expect(known.has(id)).toBe(false);
    }
  });

  it('spreads new picks across categories (round-robin)', () => {
    const q = buildQueue(input(lib, { limit: 10 }));
    const cats = q.map((id) => lib.find((b) => b.id === id)!.category);
    expect(new Set(cats.slice(0, 5)).size).toBe(5);
    expect(new Set(cats.slice(5, 10)).size).toBe(5);
  });

  it('prefers starred, never-opened, substantial posts', () => {
    const boosted = library(400, (i) =>
      i % 37 === 0 ? { starred: 1, read: 0, facets: ['thread'], metrics: { likes: 40_000, retweets: 2000, replies: 0, quotes: 0, views: 0, bookmarks: 9000 } } : {},
    );
    const special = new Set(boosted.filter((b) => b.starred).map((b) => b.id));
    // 11 boosted posts spread over all 5 categories: every round-robin slot should go to one.
    const q = buildQueue(input(boosted, { limit: 10 }));
    expect(q.every((id) => special.has(id))).toBe(true);
  });

  it('honors the category filter and excluded ids', () => {
    const q = buildQueue(input(lib, { categories: ['design'], limit: 8 }));
    expect(q.every((id) => lib.find((b) => b.id === id)!.category === 'design')).toBe(true);
    const excluded = buildQueue(input(lib, { exclude: new Set(q), categories: ['design'], limit: 8 }));
    expect(excluded.some((id) => q.includes(id))).toBe(false);
  });

  // Timing test: opt in with PERF_TESTS=1 (load-sensitive under parallel test workers).
  it.skipIf(!process.env.PERF_TESTS)('stays fast on a 50k library', () => {
    const big = library(50_000, (i) => ({ read: i % 3 ? 1 : 0, starred: i % 97 === 0 ? 1 : 0, facets: i % 11 === 0 ? ['thread'] : [] }));
    const due = big.slice(0, 8).map((b, i) => card(b.id, { due: NOW - i * 60_000 })); // most of the 30 slots come from the full scan
    const known = new Set(big.slice(0, 2000).map((b) => b.id));
    const byId = new Map(big.map((b) => [b.id, b]));
    buildQueue(input(big, { byId, dueCards: due, knownIds: known, limit: 30 })); // warm-up (JIT)
    const median = (fn: (i: number) => void) => {
      const runs: number[] = [];
      for (let i = 0; i < 5; i++) {
        const t0 = performance.now();
        fn(i);
        runs.push(performance.now() - t0);
      }
      return runs.sort((a, b) => a - b)[2]!;
    };
    // Floor: one bare pass over the same objects (absorbs a slow or busy machine).
    let sink = 0;
    const floor = median(() => {
      for (const b of big) if (!b.archived && !known.has(b.id)) sink += b.savedAt + b.text.length;
    });
    const took = median((i) => {
      const q = buildQueue(input(big, { byId, dueCards: due, knownIds: known, limit: 30, day: `2026-10-${10 + i}` }));
      expect(q).toHaveLength(30);
    });
    console.info(`[recall] buildQueue over 50k: median ${took.toFixed(1)}ms (bare loop ${floor.toFixed(1)}ms)`, sink > 0);
    expect(took).toBeLessThan(Math.max(50, floor * 3));
  });
});

describe('streaks', () => {
  const days = (start: string, n: number) => Array.from({ length: n }, (_, i) => addDays(start, i));

  it('counts consecutive active days and keeps yesterday’s streak alive until today ends', () => {
    const stats: RecallStats = { ...EMPTY_STATS, activeDays: days('2026-10-20', 4) }; // 20..23
    expect(computeStreak(stats, '2026-10-23')).toMatchObject({ current: 4, todayCounts: true, atRisk: false });
    expect(computeStreak(stats, '2026-10-24')).toMatchObject({ current: 4, todayCounts: false, atRisk: true });
    expect(computeStreak(stats, '2026-10-25')).toMatchObject({ current: 0, atRisk: false });
  });

  it('needs a finished session or enough reviews for a day to count', () => {
    let s = EMPTY_STATS;
    for (let i = 0; i < STREAK_MIN_REVIEWS - 1; i++) s = recordReviews(s, '2026-10-24');
    expect(computeStreak(s, '2026-10-24').todayCounts).toBe(false);
    s = recordReviews(s, '2026-10-24');
    expect(computeStreak(s, '2026-10-24')).toMatchObject({ current: 1, todayCounts: true });
    expect(s.totalReviews).toBe(STREAK_MIN_REVIEWS);

    const short = markDayComplete(recordReviews(EMPTY_STATS, '2026-10-24'), '2026-10-24');
    expect(computeStreak(short, '2026-10-24').current).toBe(1);
  });

  it('bridges caught-up rest days without extending the streak', () => {
    let s: RecallStats = { ...EMPTY_STATS, activeDays: ['2026-10-20', '2026-10-21'] };
    s = markRestDay(s, '2026-10-22');
    s = markDayComplete(s, '2026-10-23');
    expect(computeStreak(s, '2026-10-23').current).toBe(3);
    expect(computeStreak(markRestDay(s, '2026-10-24'), '2026-10-24')).toMatchObject({ current: 3, atRisk: false });
  });

  it('tracks the longest streak after a break', () => {
    let s = EMPTY_STATS;
    for (const d of days('2026-09-01', 6)) s = markDayComplete(s, d);
    for (const d of days('2026-10-20', 2)) s = markDayComplete(s, d);
    expect(computeStreak(s, '2026-10-21')).toMatchObject({ current: 2, longest: 6 });
    expect(s.longest).toBe(6);
  });

  it('uses the user’s local day: an IST evening session and a UTC one can land on different days', () => {
    // Sessions at 23:00 IST on the 23rd and 00:30 IST on the 25th.
    const first = Date.parse('2026-10-23T17:30:00Z');
    const second = Date.parse('2026-10-24T19:00:00Z');
    const ist = [first, second].reduce((s, t) => markDayComplete(s, dayKey(t, IST)), EMPTY_STATS);
    const utc = [first, second].reduce((s, t) => markDayComplete(s, dayKey(t, UTC)), EMPTY_STATS);
    expect(ist.activeDays).toEqual(['2026-10-23', '2026-10-25']);
    expect(utc.activeDays).toEqual(['2026-10-23', '2026-10-24']);
    expect(computeStreak(ist, dayKey(second, IST)).current).toBe(1); // missed the 24th in India
    expect(computeStreak(utc, dayKey(second, UTC)).current).toBe(2);
  });
});

describe('sessions (IndexedDB + storage)', () => {
  const lib = library(200);
  const source = { bookmarks: lib, byId: new Map(lib.map((b) => [b.id, b])) };

  beforeEach(async () => {
    fakeBrowser.reset();
    await db.recall.clear();
    await db.bookmarks.clear();
    await db.bookmarks.bulkPut(lib.map((b) => ({ ...b })));
  });

  it('plans once per day and reloads the same queue', async () => {
    const s1 = await ensureTodaySession(source, { now: NOW, tz: IST });
    expect(s1.ids).toHaveLength(10);
    expect(s1.day).toBe('2026-10-24');
    const s2 = await ensureTodaySession(source, { now: NOW + 3 * 3_600_000, tz: IST });
    expect(s2.ids).toEqual(s1.ids);
    expect(await recallSessionItem.getValue()).toEqual(s1);
  });

  it('runs a full session: ratings persist, reviewed cards never come back, the day counts', async () => {
    const s = await ensureTodaySession(source, { now: NOW, tz: IST });
    const ratings = ['good', 'again', 'mastered', 'good', 'good', 'good', 'again', 'good', 'good', 'good'] as const;
    let last;
    for (const [i, id] of s.ids.entries()) last = await review(id, ratings[i]!, { now: NOW + i * 60_000, tz: IST });
    expect(last!.completed).toBe(true);
    expect(pendingIds(last!.session)).toEqual([]);
    expect(await db.recall.count()).toBe(10);
    expect((await db.recall.get(s.ids[2]!))!.state).toBe('done');
    // Reviewed posts are marked read.
    expect((await db.bookmarks.bulkGet(s.ids)).every((b) => b!.read === 1)).toBe(true);

    const stats = await recallStatsItem.getValue();
    expect(computeStreak(stats, '2026-10-24')).toMatchObject({ current: 1, todayCounts: true });
    expect(stats.totalReviews).toBe(10);

    // Reloading today: nothing new sneaks in.
    const again = await ensureTodaySession(source, { now: NOW + 5 * 3_600_000, tz: IST });
    expect(pendingIds(again)).toEqual([]);
    expect(await getRecallSummary(NOW + 5 * 3_600_000)).toMatchObject({ dueToday: 0, doneToday: true, streak: 1 });

    // Tomorrow (IST): the "again" and first-step "good" cards are due first, then fresh picks.
    const tomorrow = Date.parse('2026-10-25T03:00:00Z');
    const t = await ensureTodaySession(source, { now: tomorrow, tz: IST });
    expect(t.day).toBe('2026-10-25');
    expect(t.ids).toHaveLength(10);
    const dueTomorrow = new Set(s.ids.filter((_, i) => ratings[i] !== 'mastered'));
    expect(t.ids.slice(0, 9).every((id) => dueTomorrow.has(id))).toBe(true);
    expect(t.ids).not.toContain(s.ids[2]);
  });

  it('archives "Not useful" posts and undo restores everything', async () => {
    const s = await ensureTodaySession(source, { now: NOW, tz: IST });
    const id = s.ids[0]!;
    await db.bookmarks.update(id, { read: 0 });
    const r = await review(id, 'notUseful', { now: NOW, tz: IST });
    expect((await db.bookmarks.get(id))!.archived).toBe(1);
    expect((await db.recall.get(id))!.state).toBe('done');
    expect((await recallStatsItem.getValue()).totalReviews).toBe(1);

    await undoReview(r);
    expect((await db.bookmarks.get(id))!.archived).toBe(0);
    expect(await db.recall.get(id)).toBeUndefined();
    expect((await recallSessionItem.getValue())!.reviewed).toEqual([]);
    expect((await recallStatsItem.getValue()).totalReviews).toBe(0);

    const g = await review(id, 'good', { now: NOW, tz: IST });
    expect((await db.bookmarks.get(id))!.read).toBe(1);
    await undoReview(g);
    expect((await db.bookmarks.get(id))!.read).toBe(0);
  });

  it('skip moves a card to the end without scheduling it', async () => {
    const s = await ensureTodaySession(source, { now: NOW, tz: IST });
    const next = await skipCard(s.ids[0]!);
    expect(next!.ids).toEqual([...s.ids.slice(1), s.ids[0]]);
    expect(await db.recall.count()).toBe(0);
  });

  it('keeps today’s ratings when cards-per-day changes, and can keep going', async () => {
    const s = await ensureTodaySession(source, { now: NOW, tz: IST });
    await review(s.ids[0]!, 'good', { now: NOW, tz: IST });
    await review(s.ids[1]!, 'good', { now: NOW, tz: IST });
    await updateRecallPrefs({ cardsPerDay: 20 });
    const bigger = await ensureTodaySession(source, { now: NOW, tz: IST });
    expect(bigger.ids).toHaveLength(20);
    expect(bigger.ids.slice(0, 2)).toEqual(s.ids.slice(0, 2));
    expect(pendingIds(bigger)).toHaveLength(18);
    expect(new Set(bigger.ids).size).toBe(20);

    const more = await extendSession(source, 5, { now: NOW, tz: IST });
    expect(more!.ids).toHaveLength(25);
    expect(new Set(more!.ids).size).toBe(25);
    expect((await ensureTodaySession(source, { now: NOW, tz: IST })).ids).toEqual(more!.ids);
  });

  it('credits the day when leftover cards vanished, and reset wipes history', async () => {
    await updateRecallPrefs({ cardsPerDay: 5 });
    const s = await ensureTodaySession(source, { now: NOW, tz: IST });
    for (const id of s.ids.slice(0, 3)) await review(id, 'good', { now: NOW, tz: IST });
    expect((await getRecallSummary(NOW)).dueToday).toBe(2);
    await db.bookmarks.where('id').anyOf(s.ids.slice(3)).modify({ archived: 1 });
    expect(await getRecallSummary(NOW)).toMatchObject({ dueToday: 0, doneToday: true });
    const { stats } = await completeSession({ now: NOW, tz: IST });
    expect(computeStreak(stats, '2026-10-24').current).toBe(1);

    await resetRecall();
    expect(await db.recall.count()).toBe(0);
    expect(await recallSessionItem.getValue()).toBeNull();
    expect((await recallStatsItem.getValue()).totalReviews).toBe(0);
  });

  it('estimates today’s cards before a plan exists', async () => {
    expect(await getRecallSummary(NOW)).toMatchObject({ dueToday: 10, streak: 0, doneToday: false });
    await updateRecallPrefs({ cardsPerDay: 30, categories: ['ai'] });
    expect((await getRecallSummary(NOW)).dueToday).toBe(30);
  });
});
