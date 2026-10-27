/**
 * "Wrapped" — a year-in-review of the user's saved posts.
 *
 * Pure and synchronous: one pass over the library plus small post-passes over
 * per-day buckets, so 50k posts take a few milliseconds. All calendar maths
 * (days, hours, weekdays, months, streaks) uses the user's local time zone —
 * or an explicit IANA zone, which the tests use to check IST vs UTC edges.
 */
import { DEFAULT_CATEGORIES } from '@twtdash/shared';
import type { Bookmark } from './types';

export type WrappedPeriod = 'year' | '12m' | '30d' | 'all';

export const WRAPPED_PERIODS: WrappedPeriod[] = ['year', '12m', '30d', 'all'];

/** Below this many saves in a period there is not enough to tell a story. */
export const WRAPPED_MIN_POSTS = 5;

// Kept local (not lib/format) so this module stays pure and dependency-free.
const numberFmt = new Intl.NumberFormat();
const compactFmt = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });
const fmtNumber = (n: number) => numberFmt.format(n);
const fmtCompact = (n: number) => (n < 1000 ? String(n) : compactFmt.format(n));

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));

/** "12 AM", "9 AM", "11 PM". */
export function hourLabel(h: number): string {
  const x = ((h % 24) + 24) % 24;
  return `${x % 12 === 0 ? 12 : x % 12} ${x < 12 ? 'AM' : 'PM'}`;
}

/* ------------------------------------------------------------------------ */
/* Calendar helpers (time-zone aware, allocation-free on the hot path)       */
/* ------------------------------------------------------------------------ */

const mod = (a: number, n: number) => ((a % n) + n) % n;

/** Minutes east of UTC at instant `ts`. */
export type OffsetFn = (ts: number) => number;

/**
 * Offset function for a time zone (default: the runtime's local zone).
 * Offsets are cached per UTC week; a week whose two ends disagree (a DST
 * change) is resolved per day, and the transition day per instant. Intl
 * lookups are slow (~20-40µs), so 50k saves over years need only a few
 * hundred of them.
 */
export function makeOffsetFn(timeZone?: string): OffsetFn {
  let raw: OffsetFn;
  // Probe only instants Date/Intl handle: a week probe next to the last valid date (8.64e15)
  // throws, local time past it is NaN, Intl prints BCE years without a sign and Date.UTC
  // reads years < 100 as 19xx. Offsets that far out are local mean time anyway.
  const valid = (ts: number) => Math.max(-59_011_459_200_000, Math.min(8.64e15 - DAY, ts));
  if (!timeZone) {
    raw = (ts) => -new Date(valid(ts)).getTimezoneOffset();
  } else {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    raw = (input) => {
      const ts = valid(input);
      const parts = fmt.formatToParts(ts);
      const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
      const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
      return Math.round((asUtc - (ts - mod(ts, 1000))) / MIN);
    };
  }
  const WEEK = 7 * DAY;
  const at = new Map<number, number>();
  const rawAt = (t: number) => {
    let v = at.get(t);
    if (v === undefined) at.set(t, (v = raw(t)));
    return v;
  };
  const weeks = new Map<number, number>();
  let lastWeek = NaN;
  let lastOff = 0;
  return (ts) => {
    const w = Math.floor(ts / WEEK);
    if (w === lastWeek) return lastOff;
    let o = weeks.get(w);
    if (o === undefined) {
      const a = rawAt(w * WEEK);
      o = a === rawAt((w + 1) * WEEK) ? a : NaN;
      weeks.set(w, o);
    }
    if (!Number.isNaN(o)) {
      lastWeek = w;
      lastOff = o;
      return o;
    }
    const day = Math.floor(ts / DAY);
    const a = rawAt(day * DAY);
    return a === rawAt((day + 1) * DAY) ? a : raw(ts);
  };
}

/** Civil date (proleptic Gregorian) from days since 1970-01-01. Month is 1-12. */
export function civilFromDays(z: number): { y: number; m: number; d: number } {
  const zz = z + 719468;
  const era = Math.floor(zz / 146097);
  const doe = zz - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return { y: yoe + era * 400 + (m <= 2 ? 1 : 0), m, d };
}

/** Days since 1970-01-01 for a civil date (month 1-12). */
export function daysFromCivil(y: number, m: number, d: number): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** Local day index (days since 1970-01-01 in the zone) of an instant. */
export function localDay(ts: number, offset: OffsetFn): number {
  return Math.floor((ts + offset(ts) * MIN) / DAY);
}

/** UTC instant of local midnight starting local day `day`. */
function localMidnight(day: number, offset: OffsetFn): number {
  const local = day * DAY;
  const guess = local - offset(local) * MIN;
  return local - offset(guess) * MIN;
}

function dayLabel(day: number, withYear = false): string {
  const { y, m, d } = civilFromDays(day);
  return withYear ? `${MONTHS_SHORT[m - 1]} ${d}, ${y}` : `${MONTHS_SHORT[m - 1]} ${d}`;
}

/* ------------------------------------------------------------------------ */
/* Periods                                                                   */
/* ------------------------------------------------------------------------ */

export interface PeriodRange {
  start: number;
  /** Exclusive. */
  end: number;
  prevStart: number;
  prevEnd: number;
  /** "2026", "Last 12 months"… */
  label: string;
  /** Comparison phrase: "this time last year", "the 30 days before". */
  prevLabel: string | null;
  /** Calendar year of `now` in the zone. */
  year: number;
}

export function periodRange(period: WrappedPeriod, now: number, offset: OffsetFn): PeriodRange {
  const today = localDay(now, offset);
  const year = civilFromDays(today).y;
  if (period === 'year') {
    const start = localMidnight(daysFromCivil(year, 1, 1), offset);
    const end = localMidnight(daysFromCivil(year + 1, 1, 1), offset);
    const prevStart = localMidnight(daysFromCivil(year - 1, 1, 1), offset);
    return { start, end, prevStart, prevEnd: prevStart + Math.max(0, now - start), label: String(year), prevLabel: 'this time last year', year };
  }
  if (period === '12m' || period === '30d') {
    const len = (period === '12m' ? 365 : 30) * DAY;
    const end = now + 1;
    const start = end - len;
    return {
      start,
      end,
      prevStart: start - len,
      prevEnd: start,
      label: period === '12m' ? 'Last 12 months' : 'Last 30 days',
      prevLabel: period === '12m' ? 'the 12 months before' : 'the 30 days before',
      year,
    };
  }
  return { start: -Infinity, end: Infinity, prevStart: 0, prevEnd: 0, label: 'All time', prevLabel: null, year };
}

/** Saves per period — cheap enough to pick a sensible default period. */
export function countByPeriod(bookmarks: readonly Bookmark[], now = Date.now(), timeZone?: string): Record<WrappedPeriod, number> {
  const offset = makeOffsetFn(timeZone);
  const ranges = WRAPPED_PERIODS.map((p) => periodRange(p, now, offset));
  const out: Record<WrappedPeriod, number> = { year: 0, '12m': 0, '30d': 0, all: 0 };
  for (const b of bookmarks) {
    const t = b.savedAt;
    if (!Number.isFinite(t)) continue;
    for (let i = 0; i < ranges.length; i++) {
      const r = ranges[i]!;
      if (t >= r.start && t < r.end) out[WRAPPED_PERIODS[i]!]++;
    }
  }
  return out;
}

/* ------------------------------------------------------------------------ */
/* Personas                                                                  */
/* ------------------------------------------------------------------------ */

export type PersonaId =
  | 'fresh'
  | 'hoarder'
  | 'night-owl'
  | 'early-bird'
  | 'completionist'
  | 'weekend'
  | 'prompt'
  | 'builder'
  | 'aesthete'
  | 'market'
  | 'learner'
  | 'optimizer'
  | 'culture'
  | 'news'
  | 'polymath';

export interface PersonaDef {
  id: PersonaId;
  name: string;
  emoji: string;
  /** Witty one-liner. */
  line: string;
}

export interface Persona extends PersonaDef {
  /** Why this persona, in plain words ("62% of your saves were…"). */
  reason: string;
}

/** Order doubles as the tie-breaker: earlier wins on equal strength. */
export const PERSONAS: Record<PersonaId, PersonaDef> = {
  fresh: { id: 'fresh', name: 'The Fresh Start', emoji: '🌱', line: 'Every legendary library starts with a single bookmark.' },
  hoarder: { id: 'hoarder', name: 'The Hoarder', emoji: '🐉', line: 'Dragon energy: guarding a mountain of posts you’ll “definitely read later”.' },
  'night-owl': { id: 'night-owl', name: 'The Night Owl Researcher', emoji: '🦉', line: 'While the city sleeps, you’re three threads deep.' },
  'early-bird': { id: 'early-bird', name: 'The Early Bird', emoji: '🌅', line: 'Saving gems before the chai is even ready.' },
  completionist: { id: 'completionist', name: 'The Completionist', emoji: '🏆', line: 'You actually read what you save. Rare. Legendary, even.' },
  weekend: { id: 'weekend', name: 'The Weekend Scholar', emoji: '🛋️', line: 'Weekdays are for work. Weekends are for tabs, threads and deep dives.' },
  prompt: { id: 'prompt', name: 'The Prompt Whisperer', emoji: '🤖', line: 'Half your saves are prompts. The other half are about prompts.' },
  builder: { id: 'builder', name: 'The Builder', emoji: '🛠️', line: 'You don’t bookmark posts. You bookmark future side projects.' },
  aesthete: { id: 'aesthete', name: 'The Aesthete', emoji: '🎨', line: 'Kerning, colour, craft — your bookmarks could pass a design review.' },
  market: { id: 'market', name: 'The Market Mind', emoji: '📈', line: 'Charts, cap tables and conviction. You read the market before it reads you.' },
  learner: { id: 'learner', name: 'The Lifelong Learner', emoji: '📚', line: 'Your bookmarks are a university with no fees and no exams.' },
  optimizer: { id: 'optimizer', name: 'The Optimizer', emoji: '⚡', line: 'Zone 2, deep work, eight hours of sleep — min-maxing being human.' },
  culture: { id: 'culture', name: 'The Culture Curator', emoji: '🎬', line: 'Memes, movies and moments — you save what the group chat talks about tomorrow.' },
  news: { id: 'news', name: 'The News Hound', emoji: '📰', line: 'First to know, last to log off.' },
  polymath: { id: 'polymath', name: 'The Polymath', emoji: '🧭', line: 'Interested in everything, bored by nothing.' },
};

const PERSONA_ORDER = Object.keys(PERSONAS) as PersonaId[];

type Group = 'builder' | 'prompt' | 'aesthete' | 'market' | 'learner' | 'optimizer' | 'culture' | 'news';

const GROUP_IDS: Record<Group, string[]> = {
  builder: ['dev', 'ai', 'tools'],
  prompt: ['ai'],
  aesthete: ['design'],
  market: ['finance', 'crypto', 'startups', 'marketing'],
  learner: ['learning', 'science', 'career'],
  optimizer: ['health', 'productivity'],
  culture: ['culture', 'humor'],
  news: ['news'],
};

/** Share of saves a group needs to define the persona. */
const GROUP_THRESHOLD: Record<Group, number> = {
  builder: 0.4,
  prompt: 0.3,
  aesthete: 0.25,
  market: 0.35,
  learner: 0.3,
  optimizer: 0.3,
  culture: 0.3,
  news: 0.25,
};

const GROUP_REASON: Record<Group, string> = {
  builder: 'AI, code and tools',
  prompt: 'about AI',
  aesthete: 'design',
  market: 'money, markets and startups',
  learner: 'learning, science and careers',
  optimizer: 'health and productivity',
  culture: 'culture and memes',
  news: 'news',
};

/** Custom (user-made) categories join a group by name. */
const CUSTOM_GROUP_RE: Array<[Group, RegExp]> = [
  ['culture', /sport|cricket|\bipl\b|football|soccer|\bnba\b|\bf1\b|gaming|games?\b|anime|music|film|movie|cinema|bollywood|meme|comedy|art\b/i],
  ['market', /financ|invest|stock|trading|crypto|money|startup|business|market/i],
  ['builder', /code|coding|program|dev\b|engineer|software|\bai\b|\bml\b|tool/i],
  ['learner', /learn|study|science|book|research|career|job|course|edu/i],
  ['optimizer', /health|fitness|gym|workout|nutrition|diet|productiv|habit|mindset/i],
  ['aesthete', /design|\bui\b|\bux\b|typograph|illustrat|photo/i],
  ['news', /news|politic|world|elections?/i],
];

const BUILTIN_IDS = new Set(DEFAULT_CATEGORIES.map((c) => c.id));

function groupsFor(id: string, name: string): Group[] {
  const out: Group[] = [];
  for (const g of Object.keys(GROUP_IDS) as Group[]) if (GROUP_IDS[g].includes(id)) out.push(g);
  if (!out.length && !BUILTIN_IDS.has(id)) {
    const hit = CUSTOM_GROUP_RE.find(([, re]) => re.test(name || id));
    if (hit) out.push(hit[0]);
  }
  return out;
}

export interface PersonaFeatures {
  total: number;
  perDay: number;
  readShare: number;
  /** Share saved 11 PM – 5 AM. */
  nightShare: number;
  /** Share saved 5 AM – 9 AM. */
  morningShare: number;
  /** Share saved on Saturday or Sunday. */
  weekendShare: number;
  /** Share per category id (0..1). */
  categoryShares: Record<string, number>;
  /** Display names for custom categories (to group them by name). */
  categoryNames?: Record<string, string>;
}

const pct = (x: number) => Math.round(x * 100);

/** Deterministic archetype from category mix and saving habits. */
export function pickPersona(f: PersonaFeatures): Persona {
  const make = (id: PersonaId, reason: string): Persona => ({ ...PERSONAS[id], reason });
  if (f.total < WRAPPED_MIN_POSTS) return make('fresh', f.total ? `Only ${f.total} ${f.total === 1 ? 'save' : 'saves'} so far — plenty of room to grow` : 'Your story starts with your first save');

  const groupShare: Record<Group, number> = { builder: 0, prompt: 0, aesthete: 0, market: 0, learner: 0, optimizer: 0, culture: 0, news: 0 };
  const shares = Object.entries(f.categoryShares).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  for (const [id, s] of shares) for (const g of groupsFor(id, f.categoryNames?.[id] ?? id)) groupShare[g] += s;
  const maxShare = shares[0]?.[1] ?? 0;
  const diverse = shares.filter(([, s]) => s >= 0.06).length;

  const candidates: Array<{ id: PersonaId; strength: number; reason: string; category: boolean }> = [];
  for (const g of Object.keys(groupShare) as Group[]) {
    const s = groupShare[g];
    if (s > 0) candidates.push({ id: g, strength: (s / GROUP_THRESHOLD[g]) * (g === 'prompt' ? 1.02 : 1), reason: `${pct(s)}% of your saves were ${GROUP_REASON[g]}`, category: true });
  }
  if (f.total >= 500 && f.perDay >= 3 && f.readShare < 0.1) {
    candidates.push({ id: 'hoarder', strength: 1.25 + Math.min(0.5, (f.perDay - 3) / 10), reason: `${f.perDay >= 10 ? Math.round(f.perDay) : f.perDay.toFixed(1)} saves a day — and only ${pct(f.readShare)}% opened`, category: false });
  }
  if (f.total >= 10 && f.nightShare >= 0.3) {
    candidates.push({ id: 'night-owl', strength: (f.nightShare / 0.3) * 1.1, reason: `${pct(f.nightShare)}% of your saves happened between 11 PM and 5 AM`, category: false });
  }
  if (f.total >= 10 && f.morningShare >= 0.3) {
    candidates.push({ id: 'early-bird', strength: (f.morningShare / 0.3) * 1.05, reason: `${pct(f.morningShare)}% of your saves happened before 9 AM`, category: false });
  }
  if (f.total >= 15 && f.readShare >= 0.7) {
    candidates.push({ id: 'completionist', strength: (f.readShare / 0.7) * 1.05, reason: `You opened ${pct(f.readShare)}% of what you saved`, category: false });
  }
  if (f.total >= 14 && f.weekendShare >= 0.5) {
    candidates.push({ id: 'weekend', strength: f.weekendShare / 0.5, reason: `${pct(f.weekendShare)}% of your saves happened on weekends`, category: false });
  }
  if (maxShare < 0.25 && diverse >= 5) {
    candidates.push({ id: 'polymath', strength: 1.05, reason: `${diverse} different interests, none above ${pct(maxShare)}%`, category: false });
  }

  const rank = (a: (typeof candidates)[number], b: (typeof candidates)[number]) => b.strength - a.strength || PERSONA_ORDER.indexOf(a.id) - PERSONA_ORDER.indexOf(b.id);
  candidates.sort(rank);
  const best = candidates[0];
  if (best && best.strength >= 1) return make(best.id, best.reason);
  const lean = candidates.find((c) => c.category && c.strength >= 0.75);
  if (lean) return make(lean.id, lean.reason);
  return make('polymath', `${Math.max(diverse, shares.length)} different interests and no single obsession`);
}

/* ------------------------------------------------------------------------ */
/* Stats                                                                     */
/* ------------------------------------------------------------------------ */

export interface CategoryLike {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

export interface WrappedOptions {
  period: WrappedPeriod;
  now?: number;
  /** IANA zone; defaults to the runtime's local zone. */
  timeZone?: string;
  /** User categories (names/emoji/colors); built-ins are the fallback. */
  categories?: Iterable<CategoryLike>;
}

export interface WrappedCategory extends CategoryLike {
  count: number;
  share: number;
}

export interface WrappedAuthor {
  handle: string;
  name: string;
  avatar: string;
  verified: boolean;
  count: number;
  share: number;
}

export interface WrappedPost {
  id: string;
  url: string;
  text: string;
  authorName: string;
  authorHandle: string;
  likes: number;
  views: number;
  savedAt: number;
}

export interface WrappedBucket {
  key: string;
  label: string;
  count: number;
}

/** Mutually exclusive format buckets (sum = total). */
export interface WrappedMix {
  thread: number;
  article: number;
  media: number;
  link: number;
  text: number;
}

export interface FunFact {
  id: string;
  emoji: string;
  text: string;
  score: number;
  /** Names an author — hidden when the share card is in private mode. */
  mentionsAuthor?: boolean;
}

export interface WrappedStats {
  period: WrappedPeriod;
  /** "2026", "Last 12 months", "Last 30 days", "All time". */
  label: string;
  year: number;
  start: number;
  end: number;
  now: number;
  total: number;
  perDay: number;
  libraryTotal: number;
  previous: { total: number; label: string; /** Relative change, null when the previous period was empty. */ change: number | null } | null;
  firstSaveEver: number | null;
  firstSaveInPeriod: number | null;
  /** "Jan 2, 2026" in the zone. */
  firstSaveLabel: string | null;
  categories: WrappedCategory[];
  categoryCount: number;
  authors: WrappedAuthor[];
  authorCount: number;
  /** Saves per local hour (0-23). */
  hours: number[];
  /** Saves per local weekday, 0 = Sunday. */
  weekdays: number[];
  busiestHour: { hour: number; label: string; count: number } | null;
  busiestWeekday: { day: number; label: string; count: number } | null;
  busiestMonth: { year: number; month: number; label: string; count: number } | null;
  busiestDay: { day: number; label: string; count: number } | null;
  streak: { days: number; start: number; end: number; startLabel: string; endLabel: string } | null;
  activeDays: number;
  readCount: number;
  readShare: number;
  starred: number;
  mix: WrappedMix;
  mostLiked: WrappedPost | null;
  mostViewed: WrappedPost | null;
  nightShare: number;
  morningShare: number;
  weekendShare: number;
  readingMinutes: number;
  timeline: { unit: 'day' | 'month' | 'year'; buckets: WrappedBucket[] };
  persona: Persona;
  funFacts: FunFact[];
}

function toPost(b: Bookmark): WrappedPost {
  return {
    id: b.id,
    url: b.url,
    text: b.text || b.article?.title || b.card?.title || '',
    authorName: b.author.name,
    authorHandle: b.author.handle,
    likes: b.metrics?.likes ?? 0,
    views: b.metrics?.views ?? 0,
    savedAt: b.savedAt,
  };
}

/** Prefer higher metric, then the earlier save, then the smaller id. */
function beats(metric: number, b: Bookmark, bestMetric: number, best: Bookmark | null): boolean {
  if (!best) return true;
  if (metric !== bestMetric) return metric > bestMetric;
  if (b.savedAt !== best.savedAt) return b.savedAt < best.savedAt;
  return b.id < best.id;
}

export function computeWrapped(bookmarks: readonly Bookmark[], opts: WrappedOptions): WrappedStats {
  const now = opts.now ?? Date.now();
  const offset = makeOffsetFn(opts.timeZone);
  const range = periodRange(opts.period, now, offset);
  const { start, end, prevStart, prevEnd } = range;

  const catInfo = new Map<string, CategoryLike>();
  for (const c of DEFAULT_CATEGORIES) catInfo.set(c.id, { id: c.id, name: c.name, emoji: c.emoji, color: c.color });
  if (opts.categories) for (const c of opts.categories) catInfo.set(c.id, { id: c.id, name: c.name, emoji: c.emoji, color: c.color });

  const hours = new Array<number>(24).fill(0);
  const weekdays = new Array<number>(7).fill(0);
  const dayCounts = new Map<number, number>();
  const catCounts = new Map<string, number>();
  const authorMap = new Map<string, WrappedAuthor>();
  let total = 0;
  let prevTotal = 0;
  let readCount = 0;
  let starred = 0;
  let chars = 0;
  let firstEver = Infinity;
  let firstIn = Infinity;
  let firstInB: Bookmark | null = null;
  let likedB: Bookmark | null = null;
  let likedMax = -1;
  let viewedB: Bookmark | null = null;
  let viewedMax = -1;
  const mix: WrappedMix = { thread: 0, article: 0, media: 0, link: 0, text: 0 };

  for (let i = 0; i < bookmarks.length; i++) {
    const b = bookmarks[i]!;
    const ts = b.savedAt;
    if (!Number.isFinite(ts)) continue;
    if (ts < firstEver) firstEver = ts;
    if (ts >= prevStart && ts < prevEnd) prevTotal++;
    if (ts < start || ts >= end) continue;
    total++;

    const local = ts + offset(ts) * MIN;
    const day = Math.floor(local / DAY);
    hours[Math.floor((local - day * DAY) / HOUR)]!++;
    weekdays[mod(day + 4, 7)]!++;
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);

    catCounts.set(b.category, (catCounts.get(b.category) ?? 0) + 1);
    // Exact handle here; case variants are merged after the loop (no per-post allocation).
    const handle = b.author?.handle;
    if (handle) {
      const a = authorMap.get(handle);
      if (a) a.count++;
      else authorMap.set(handle, { handle, name: b.author.name, avatar: b.author.avatar, verified: !!b.author.verified, count: 1, share: 0 });
    }

    if (b.read) readCount++;
    if (b.starred) starred++;
    chars += b.text?.length ?? 0;

    let thread = false;
    let article = false;
    let media = false;
    let link = false;
    const facets = b.facets ?? [];
    for (let j = 0; j < facets.length; j++) {
      const f = facets[j];
      if (f === 'thread') thread = true;
      else if (f === 'article' || f === 'long') article = true;
      else if (f === 'media') media = true;
      else if (f === 'link') link = true;
    }
    if (thread) mix.thread++;
    else if (article) mix.article++;
    else if (media) mix.media++;
    else if (link) mix.link++;
    else mix.text++;

    const likes = b.metrics?.likes ?? 0;
    if (beats(likes, b, likedMax, likedB)) {
      likedB = b;
      likedMax = likes;
    }
    const views = b.metrics?.views ?? 0;
    if (beats(views, b, viewedMax, viewedB)) {
      viewedB = b;
      viewedMax = views;
    }
    if (ts < firstIn || (ts === firstIn && firstInB && b.id < firstInB.id)) {
      firstIn = ts;
      firstInB = b;
    }
  }

  const share = (n: number) => (total ? n / total : 0);

  // Days, streaks, months.
  const days = [...dayCounts.keys()].sort((x, y) => x - y);
  let streak: WrappedStats['streak'] = null;
  let busiestDay: WrappedStats['busiestDay'] = null;
  const monthCounts = new Map<number, number>();
  {
    let runStart = 0;
    let bestLen = 0;
    let bestStart = 0;
    for (let i = 0; i < days.length; i++) {
      const d = days[i]!;
      if (i === 0 || d !== days[i - 1]! + 1) runStart = d;
      const len = d - runStart + 1;
      if (len > bestLen) {
        bestLen = len;
        bestStart = runStart;
      }
      const c = dayCounts.get(d)!;
      if (!busiestDay || c > busiestDay.count) busiestDay = { day: d, label: dayLabel(d, true), count: c };
      const { y, m } = civilFromDays(d);
      const mk = y * 12 + (m - 1);
      monthCounts.set(mk, (monthCounts.get(mk) ?? 0) + c);
    }
    if (bestLen) {
      const endDay = bestStart + bestLen - 1;
      streak = { days: bestLen, start: bestStart, end: endDay, startLabel: dayLabel(bestStart), endLabel: dayLabel(endDay) };
    }
  }
  let busiestMonth: WrappedStats['busiestMonth'] = null;
  for (const mk of [...monthCounts.keys()].sort((x, y) => x - y)) {
    const c = monthCounts.get(mk)!;
    if (!busiestMonth || c > busiestMonth.count) {
      const y = Math.floor(mk / 12);
      const m = mk - y * 12;
      busiestMonth = { year: y, month: m, label: `${MONTHS[m]} ${y}`, count: c };
    }
  }
  const argmax = (arr: number[]) => arr.reduce((best, v, i) => (v > arr[best]! ? i : best), 0);
  const bh = argmax(hours);
  const bw = argmax(weekdays);

  const categoriesAll = [...catCounts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  const categories: WrappedCategory[] = categoriesAll.slice(0, 5).map(([id, count]) => {
    const c = catInfo.get(id) ?? { id, name: id, emoji: '📁', color: '#A1A1AA' };
    return { ...c, count, share: share(count) };
  });
  const merged = new Map<string, WrappedAuthor>();
  for (const a of authorMap.values()) {
    const key = a.handle.toLowerCase();
    const m = merged.get(key);
    if (!m) merged.set(key, { ...a });
    else {
      // Keep the spelling/profile seen most often.
      if (a.count > m.count) Object.assign(m, { handle: a.handle, name: a.name, avatar: a.avatar, verified: a.verified });
      m.count += a.count;
    }
  }
  const authorsAll = [...merged.values()].sort((a, b) => b.count - a.count || (a.handle.toLowerCase() < b.handle.toLowerCase() ? -1 : 1));
  const authors = authorsAll.slice(0, 5).map((a) => ({ ...a, share: share(a.count) }));

  // Period length for per-day rates.
  const firstEverOrNull = Number.isFinite(firstEver) ? firstEver : null;
  const effStart = Number.isFinite(start) ? start : (firstEverOrNull ?? now);
  const effEnd = Math.min(Number.isFinite(end) ? end : now, Math.max(now, effStart));
  const periodDays = Math.max(1, (effEnd - effStart) / DAY);

  const nightShare = share(hours[23]! + hours[0]! + hours[1]! + hours[2]! + hours[3]! + hours[4]!);
  const morningShare = share(hours[5]! + hours[6]! + hours[7]! + hours[8]!);
  const weekendShare = share(weekdays[0]! + weekdays[6]!);
  const readShare = share(readCount);
  const perDay = total / periodDays;

  const categoryShares: Record<string, number> = {};
  const categoryNames: Record<string, string> = {};
  for (const [id, n] of categoriesAll) {
    categoryShares[id] = share(n);
    categoryNames[id] = catInfo.get(id)?.name ?? id;
  }

  const timeline = buildTimeline(opts.period, dayCounts, monthCounts, days, range, now, offset);

  const stats: WrappedStats = {
    period: opts.period,
    label: range.label,
    year: range.year,
    start: effStart,
    end: Number.isFinite(end) ? end : now,
    now,
    total,
    perDay,
    libraryTotal: bookmarks.length,
    previous: range.prevLabel ? { total: prevTotal, label: range.prevLabel, change: prevTotal ? (total - prevTotal) / prevTotal : null } : null,
    firstSaveEver: firstEverOrNull,
    firstSaveInPeriod: Number.isFinite(firstIn) ? firstIn : null,
    firstSaveLabel: Number.isFinite(firstIn) ? dayLabel(localDay(firstIn, offset), true) : null,
    categories,
    categoryCount: catCounts.size,
    authors,
    authorCount: merged.size,
    hours,
    weekdays,
    busiestHour: total ? { hour: bh, label: hourLabel(bh), count: hours[bh]! } : null,
    busiestWeekday: total ? { day: bw, label: WEEKDAYS[bw]!, count: weekdays[bw]! } : null,
    busiestMonth,
    busiestDay,
    streak,
    activeDays: days.length,
    readCount,
    readShare,
    starred,
    mix,
    mostLiked: likedB ? toPost(likedB) : null,
    mostViewed: viewedB ? toPost(viewedB) : null,
    nightShare,
    morningShare,
    weekendShare,
    // ~5.5 characters per word, ~230 words per minute.
    readingMinutes: Math.round(chars / 5.5 / 230),
    timeline,
    persona: pickPersona({ total, perDay, readShare, nightShare, morningShare, weekendShare, categoryShares, categoryNames }),
    funFacts: [],
  };
  stats.funFacts = buildFunFacts(stats, firstInB);
  return stats;
}

function buildTimeline(
  period: WrappedPeriod,
  dayCounts: Map<number, number>,
  monthCounts: Map<number, number>,
  days: number[],
  range: PeriodRange,
  now: number,
  offset: OffsetFn,
): WrappedStats['timeline'] {
  const today = localDay(now, offset);
  if (period === '30d') {
    const buckets: WrappedBucket[] = [];
    for (let d = today - 29; d <= today; d++) buckets.push({ key: String(d), label: dayLabel(d), count: dayCounts.get(d) ?? 0 });
    return { unit: 'day', buckets };
  }
  const { y: ny, m: nm } = civilFromDays(today);
  const nowKey = ny * 12 + (nm - 1);
  let fromKey: number;
  if (period === 'year') fromKey = range.year * 12;
  else if (period === '12m') fromKey = nowKey - 11;
  else {
    if (!days.length) return { unit: 'month', buckets: [] };
    const { y, m } = civilFromDays(days[0]!);
    // X launched in 2006: an older date is corrupt and would stretch the chart over millennia.
    fromKey = Math.max(y * 12 + (m - 1), 2006 * 12);
  }
  const toKey = Math.max(fromKey, period === 'year' ? Math.min(nowKey, range.year * 12 + 11) : nowKey);
  if (period === 'all' && toKey - fromKey >= 36) {
    const years = new Map<number, number>();
    for (const [mk, c] of monthCounts) years.set(Math.floor(mk / 12), (years.get(Math.floor(mk / 12)) ?? 0) + c);
    const buckets: WrappedBucket[] = [];
    for (let y = Math.floor(fromKey / 12); y <= Math.floor(toKey / 12); y++) buckets.push({ key: String(y), label: String(y), count: years.get(y) ?? 0 });
    return { unit: 'year', buckets };
  }
  const buckets: WrappedBucket[] = [];
  for (let k = fromKey; k <= toKey; k++) {
    const y = Math.floor(k / 12);
    const m = k - y * 12;
    buckets.push({ key: `${y}-${m + 1}`, label: MONTHS_SHORT[m]!, count: monthCounts.get(k) ?? 0 });
  }
  return { unit: 'month', buckets };
}

function ratioText(r: number): string {
  return r >= 3 ? `${Math.round(r)}×` : `${(Math.round(r * 10) / 10).toFixed(1).replace(/\.0$/, '')}×`;
}

function buildFunFacts(s: WrappedStats, firstB: Bookmark | null): FunFact[] {
  const facts: FunFact[] = [];
  const n = s.total;
  if (n < WRAPPED_MIN_POSTS) return facts;

  // Busiest vs quietest weekday.
  if (n >= 14 && s.busiestWeekday) {
    let quiet = 0;
    for (let d = 0; d < 7; d++) if (s.weekdays[d]! < s.weekdays[quiet]!) quiet = d;
    const lo = s.weekdays[quiet]!;
    const hi = s.busiestWeekday.count;
    if (lo > 0 && hi / lo >= 1.5) {
      facts.push({ id: 'weekday', emoji: '📅', text: `You save ${ratioText(hi / lo)} more on ${s.busiestWeekday.label}s than on ${WEEKDAYS[quiet]}s.`, score: 0.6 + Math.min(hi / lo, 5) / 25 });
    } else if (hi / (n / 7) >= 1.25) {
      facts.push({ id: 'weekday', emoji: '📅', text: `${s.busiestWeekday.label}s are your power day — ${ratioText(hi / (n / 7))} your daily average.`, score: 0.55 });
    }
  }

  const top = s.authors[0];
  if (top && top.count >= 3) {
    const every = Math.max(2, Math.round(n / top.count));
    facts.push({ id: 'author', emoji: '⭐', text: `@${top.handle} got ${fmtNumber(top.count)} of your saves — 1 in every ${every}.`, score: 0.62 + Math.min(top.share, 0.3), mentionsAuthor: true });
  }

  if (s.previous && s.previous.change !== null && s.previous.total >= WRAPPED_MIN_POSTS) {
    const c = s.previous.change;
    if (c >= 0.25) facts.push({ id: 'growth', emoji: '🚀', text: `You saved ${c >= 2 ? `${ratioText(c + 1)} as much` : `${pct(c)}% more`} than ${s.previous.label}.`, score: 0.66 });
    else if (c <= -0.25) facts.push({ id: 'growth', emoji: '🧘', text: `You saved ${pct(-c)}% less than ${s.previous.label}. Quality over quantity.`, score: 0.45 });
  }

  if (s.busiestDay && s.busiestDay.count >= 5) {
    facts.push({ id: 'big-day', emoji: '💥', text: `Your biggest day was ${s.busiestDay.label}: ${fmtNumber(s.busiestDay.count)} saves in 24 hours.`, score: 0.5 + Math.min(s.busiestDay.count / 100, 0.15) });
  }

  if (s.mostLiked && s.mostLiked.likes >= 1000) {
    facts.push({ id: 'most-liked', emoji: '❤️', text: `The most-liked post you saved had ${fmtCompact(s.mostLiked.likes)} likes.`, score: 0.48 + (s.mostLiked.likes >= 100_000 ? 0.12 : 0) });
  }

  if (s.readingMinutes >= 90) {
    const hrs = Math.round(s.readingMinutes / 60);
    const movies = Math.round(s.readingMinutes / 150);
    facts.push({ id: 'reading', emoji: '⏳', text: `That’s about ${fmtNumber(hrs)} hours of reading${movies >= 2 ? ` — ${fmtNumber(movies)} movies’ worth` : ''}.`, score: 0.52 });
  }

  const threadShare = s.mix.thread / n;
  if (threadShare >= 0.15) facts.push({ id: 'threads', emoji: '🧵', text: `1 in ${Math.max(2, Math.round(1 / threadShare))} of your saves was a thread.`, score: 0.5 });

  if (s.readShare >= 0.5) facts.push({ id: 'read', emoji: '👀', text: `You actually opened ${pct(s.readShare)}% of what you saved. Respect.`, score: 0.5 });
  else if (n >= 50 && s.readShare < 0.1) facts.push({ id: 'read', emoji: '👀', text: `You opened ${pct(s.readShare)}% of your saves. The rest are “for later”.`, score: 0.58 });

  if (s.nightShare >= 0.2) facts.push({ id: 'night', emoji: '🌙', text: `${pct(s.nightShare)}% of your saves happened after 11 PM.`, score: 0.5 + s.nightShare / 5 });

  if (firstB && s.firstSaveLabel && s.period === 'year') {
    facts.push({ id: 'first', emoji: '🌱', text: `Your first save of ${s.label} was on ${s.firstSaveLabel.replace(/, \d{4}$/, '')}, from @${firstB.author.handle}.`, score: 0.35, mentionsAuthor: true });
  }

  return facts.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1)).slice(0, 3);
}

/* ------------------------------------------------------------------------ */
/* Sharing                                                                   */
/* ------------------------------------------------------------------------ */

export const WRAPPED_SITE = 'https://twtdash.vercel.app';

/** Headline for a period: "Your 2026 on X". */
export function periodHeadline(s: Pick<WrappedStats, 'period' | 'label'>, who: 'Your' | 'My' = 'Your'): string {
  if (s.period === 'year') return `${who} ${s.label} on X`;
  if (s.period === '12m') return `${who} last 12 months on X`;
  if (s.period === '30d') return `${who} last 30 days on X`;
  return `${who} X bookmarks, all time`;
}

/** Prefilled post for the X intent (≤ 250 characters). */
export function buildShareText(s: WrappedStats): string {
  const cat = s.categories[0];
  const head = `${periodHeadline(s, 'My')}, wrapped 🎁`;
  const who = `I’m ${s.persona.name} ${s.persona.emoji}`;
  const saves = `${fmtNumber(s.total)} ${s.total === 1 ? 'save' : 'saves'}`;
  const tail = `Made with twtdash ${WRAPPED_SITE}`;
  const options = [
    `${head}\n${who} — ${saves}${cat ? `, mostly ${cat.emoji} ${cat.name}` : ''}.\nWhat’s yours? ${tail}`,
    `${head}\n${who} — ${saves}${cat ? `, mostly ${cat.name}` : ''}.\n${tail}`,
    `${head}\n${who}.\n${tail}`,
  ];
  return options.find((t) => t.length <= 250) ?? options[options.length - 1]!.slice(0, 250);
}

export function shareIntentUrl(s: WrappedStats): string {
  return `https://x.com/intent/post?text=${encodeURIComponent(buildShareText(s))}`;
}
