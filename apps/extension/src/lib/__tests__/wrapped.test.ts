import { describe, expect, it } from 'vitest';
import type { Bookmark, Facet } from '../types';
import {
  PERSONAS,
  buildShareText,
  civilFromDays,
  computeWrapped,
  countByPeriod,
  daysFromCivil,
  hourLabel,
  pickPersona,
  shareIntentUrl,
  type PersonaFeatures,
  type PersonaId,
  type WrappedStats,
} from '../wrapped';

let seq = 0;
function bm(savedAt: number, patch: Partial<Bookmark> = {}): Bookmark {
  const id = patch.id ?? `p${String(++seq).padStart(6, '0')}`;
  return {
    id,
    url: `https://x.com/i/status/${id}`,
    text: 'hello world',
    lang: 'en',
    createdAt: savedAt,
    author: { id: '1', name: 'Paul Graham', handle: 'paulg', avatar: '', verified: false },
    media: [],
    links: [],
    hashtags: [],
    mentions: [],
    metrics: { likes: 10, retweets: 0, replies: 0, quotes: 0, views: 100, bookmarks: 0 },
    isReply: false,
    isNote: false,
    sources: ['bookmark'],
    savedAt,
    capturedAt: savedAt,
    updatedAt: savedAt,
    category: 'dev',
    categorySource: 'rule',
    tags: [],
    collections: [],
    starred: 0,
    archived: 0,
    read: 0,
    note: '',
    facets: [],
    ...patch,
  };
}

const author = (handle: string, name = handle) => ({ id: handle, name, handle, avatar: '', verified: false });
const NOW = Date.UTC(2026, 5, 15, 12, 0); // 15 Jun 2026, 12:00 UTC = 17:30 IST
const IST = 'Asia/Kolkata';
const UTC = 'UTC';

describe('calendar helpers', () => {
  it('round-trips civil dates', () => {
    for (const day of [-719468, -1, 0, 1, 10_957, 20_000, 20_454, 25_000, 60_000]) {
      const { y, m, d } = civilFromDays(day);
      expect(daysFromCivil(y, m, d)).toBe(day);
    }
    expect(civilFromDays(0)).toEqual({ y: 1970, m: 1, d: 1 });
    expect(civilFromDays(daysFromCivil(2024, 2, 29))).toEqual({ y: 2024, m: 2, d: 29 });
  });

  it('labels hours in 12-hour time', () => {
    expect([0, 1, 11, 12, 13, 23].map(hourLabel)).toEqual(['12 AM', '1 AM', '11 AM', '12 PM', '1 PM', '11 PM']);
  });
});

describe('computeWrapped — empty and tiny libraries', () => {
  it('handles an empty library', () => {
    const s = computeWrapped([], { period: 'year', now: NOW, timeZone: IST });
    expect(s.total).toBe(0);
    expect(s.categories).toEqual([]);
    expect(s.authors).toEqual([]);
    expect(s.streak).toBeNull();
    expect(s.busiestHour).toBeNull();
    expect(s.busiestWeekday).toBeNull();
    expect(s.busiestMonth).toBeNull();
    expect(s.mostLiked).toBeNull();
    expect(s.firstSaveEver).toBeNull();
    expect(s.readShare).toBe(0);
    expect(s.persona.id).toBe('fresh');
    expect(s.funFacts).toEqual([]);
    // Jan → Jun of the current year, all zero.
    expect(s.timeline.buckets.map((b) => b.label)).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']);
    expect(s.timeline.buckets.every((b) => b.count === 0)).toBe(true);
    expect(computeWrapped([], { period: 'all', now: NOW }).timeline.buckets).toEqual([]);
  });

  it('handles a single post', () => {
    const t = Date.UTC(2026, 2, 10, 4, 30); // 10:00 IST, Tuesday
    const s = computeWrapped([bm(t, { read: 1, metrics: { likes: 5, retweets: 0, replies: 0, quotes: 0, views: 9, bookmarks: 0 } })], { period: 'year', now: NOW, timeZone: IST });
    expect(s.total).toBe(1);
    expect(s.streak?.days).toBe(1);
    expect(s.streak?.startLabel).toBe('Mar 10');
    expect(s.busiestHour).toEqual({ hour: 10, label: '10 AM', count: 1 });
    expect(s.busiestWeekday?.label).toBe('Tuesday');
    expect(s.busiestMonth?.label).toBe('March 2026');
    expect(s.categories).toEqual([expect.objectContaining({ id: 'dev', name: 'Programming', emoji: '💻', count: 1, share: 1 })]);
    expect(s.authors[0]).toMatchObject({ handle: 'paulg', count: 1, share: 1 });
    expect(s.readShare).toBe(1);
    expect(s.mostLiked?.likes).toBe(5);
    expect(s.firstSaveLabel).toBe('Mar 10, 2026');
    expect(s.persona.id).toBe('fresh');
    expect(s.mix.text).toBe(1);
  });

  it('skips posts with a broken savedAt', () => {
    const s = computeWrapped([bm(NaN), bm(Date.UTC(2026, 0, 5))], { period: 'all', now: NOW, timeZone: UTC });
    expect(s.total).toBe(1);
    expect(s.libraryTotal).toBe(2);
  });
});

describe('computeWrapped — time zones (IST vs UTC)', () => {
  // 19:00 UTC on 31 Dec 2025 is 00:30 on 1 Jan 2026 in India.
  const newYearEve = Date.UTC(2025, 11, 31, 19, 0);

  it('puts a save in the right calendar year', () => {
    expect(computeWrapped([bm(newYearEve)], { period: 'year', now: NOW, timeZone: IST }).total).toBe(1);
    expect(computeWrapped([bm(newYearEve)], { period: 'year', now: NOW, timeZone: UTC }).total).toBe(0);
  });

  it('uses local hours and weekdays', () => {
    const t = Date.UTC(2026, 2, 10, 18, 45); // Tue 18:45 UTC = Wed 00:15 IST
    const ist = computeWrapped([bm(t)], { period: 'year', now: NOW, timeZone: IST });
    const utc = computeWrapped([bm(t)], { period: 'year', now: NOW, timeZone: UTC });
    expect(ist.busiestHour?.hour).toBe(0);
    expect(ist.busiestWeekday?.label).toBe('Wednesday');
    expect(utc.busiestHour?.hour).toBe(18);
    expect(utc.busiestWeekday?.label).toBe('Tuesday');
    expect(ist.nightShare).toBe(1);
    expect(utc.nightShare).toBe(0);
  });

  it('counts streaks on local days', () => {
    const list = [Date.UTC(2026, 2, 1, 20, 0), Date.UTC(2026, 2, 2, 10, 0), Date.UTC(2026, 2, 3, 10, 0)].map((t) => bm(t));
    const ist = computeWrapped(list, { period: 'year', now: NOW, timeZone: IST });
    const utc = computeWrapped(list, { period: 'year', now: NOW, timeZone: UTC });
    expect(ist.streak).toMatchObject({ days: 2, startLabel: 'Mar 2', endLabel: 'Mar 3' });
    expect(ist.activeDays).toBe(2);
    expect(utc.streak).toMatchObject({ days: 3, startLabel: 'Mar 1', endLabel: 'Mar 3' });
  });

  it('assigns months on local dates', () => {
    const list = [bm(Date.UTC(2026, 3, 30, 20, 0)), bm(Date.UTC(2026, 3, 30, 21, 0)), bm(Date.UTC(2026, 3, 10, 9, 0))];
    expect(computeWrapped(list, { period: 'year', now: NOW, timeZone: IST }).busiestMonth?.label).toBe('May 2026');
    expect(computeWrapped(list, { period: 'year', now: NOW, timeZone: UTC }).busiestMonth?.label).toBe('April 2026');
  });

  it('handles DST transition days exactly', () => {
    // US clocks jump from 2:00 to 3:00 EST→EDT at 07:00 UTC on 8 Mar 2026.
    const before = Date.UTC(2026, 2, 8, 6, 30); // 01:30 EST
    const after = Date.UTC(2026, 2, 8, 7, 30); // 03:30 EDT
    const s = computeWrapped([bm(before), bm(after)], { period: 'year', now: NOW, timeZone: 'America/New_York' });
    expect(s.hours[1]).toBe(1);
    expect(s.hours[3]).toBe(1);
    expect(s.hours[2]).toBe(0);
  });

  it('matches the runtime zone by default', () => {
    const t = Date.UTC(2026, 4, 20, 13, 5);
    const s = computeWrapped([bm(t)], { period: 'all', now: NOW });
    expect(s.busiestHour?.hour).toBe(new Date(t).getHours());
    expect(s.busiestWeekday?.day).toBe(new Date(t).getDay());
  });
});

describe('computeWrapped — periods and comparisons', () => {
  it('filters rolling windows and compares with the window before', () => {
    const day = 86_400_000;
    const list = [
      ...Array.from({ length: 15 }, (_, i) => bm(NOW - (i + 1) * day)), // last 30 days
      ...Array.from({ length: 10 }, (_, i) => bm(NOW - (31 + i) * day)), // 30 days before
      bm(NOW - 400 * day),
    ];
    const s30 = computeWrapped(list, { period: '30d', now: NOW, timeZone: IST });
    expect(s30.total).toBe(15);
    expect(s30.previous).toMatchObject({ total: 10, change: 0.5 });
    expect(s30.timeline.unit).toBe('day');
    expect(s30.timeline.buckets).toHaveLength(30);
    expect(s30.timeline.buckets.reduce((a, b) => a + b.count, 0)).toBe(15);

    const s12 = computeWrapped(list, { period: '12m', now: NOW, timeZone: IST });
    expect(s12.total).toBe(25);
    expect(s12.previous?.total).toBe(1);
    expect(s12.timeline.buckets).toHaveLength(12);

    const all = computeWrapped(list, { period: 'all', now: NOW, timeZone: IST });
    expect(all.total).toBe(26);
    expect(all.previous).toBeNull();
    expect(all.firstSaveEver).toBe(NOW - 400 * day);
    expect(countByPeriod(list, NOW, IST)).toEqual({ year: 25, '12m': 25, '30d': 15, all: 26 });
  });

  it('compares the year with the same stretch of last year', () => {
    const list = [bm(Date.UTC(2025, 2, 1)), bm(Date.UTC(2025, 3, 1)), bm(Date.UTC(2025, 10, 1)), bm(Date.UTC(2026, 2, 1))];
    const s = computeWrapped(list, { period: 'year', now: NOW, timeZone: UTC });
    expect(s.total).toBe(1);
    expect(s.previous).toMatchObject({ total: 2, change: -0.5, label: 'this time last year' });
  });

  it('switches long all-time timelines to years', () => {
    const list = [bm(Date.UTC(2019, 5, 1)), bm(Date.UTC(2022, 1, 1)), bm(Date.UTC(2026, 1, 1))];
    const s = computeWrapped(list, { period: 'all', now: NOW, timeZone: UTC });
    expect(s.timeline.unit).toBe('year');
    expect(s.timeline.buckets.map((b) => b.label)).toEqual(['2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026']);
  });
});

describe('computeWrapped — rankings and ties', () => {
  const t0 = Date.UTC(2026, 1, 2, 6, 0);

  it('ranks categories and authors with deterministic tie-breaks', () => {
    const list = [
      bm(t0, { category: 'design', author: author('zed') }),
      bm(t0 + 1, { category: 'ai', author: author('Amy') }),
      bm(t0 + 2, { category: 'design', author: author('amy') }),
      bm(t0 + 3, { category: 'ai', author: author('zed') }),
      bm(t0 + 4, { category: 'custom-x', author: author('bob') }),
    ];
    const s = computeWrapped(list, { period: 'year', now: NOW, timeZone: IST, categories: [{ id: 'custom-x', name: 'Cricket', emoji: '🏏', color: '#0f0' }] });
    expect(s.categories.map((c) => c.id)).toEqual(['ai', 'design', 'custom-x']);
    expect(s.categories[2]).toMatchObject({ name: 'Cricket', emoji: '🏏', share: 0.2 });
    // Handles are case-insensitive; ties sort alphabetically.
    expect(s.authors.map((a) => [a.handle, a.count])).toEqual([
      ['Amy', 2],
      ['zed', 2],
      ['bob', 1],
    ]);
    expect(s.authorCount).toBe(3);
  });

  it('breaks hour, weekday, day and most-liked ties toward the earliest', () => {
    const list = [
      bm(Date.UTC(2026, 0, 6, 15, 0), { id: 'b', metrics: { likes: 50, retweets: 0, replies: 0, quotes: 0, views: 1, bookmarks: 0 } }),
      bm(Date.UTC(2026, 0, 5, 9, 0), { id: 'a', metrics: { likes: 50, retweets: 0, replies: 0, quotes: 0, views: 1, bookmarks: 0 } }),
    ];
    const s = computeWrapped(list, { period: 'year', now: NOW, timeZone: UTC });
    expect(s.busiestHour?.hour).toBe(9);
    expect(s.busiestWeekday?.label).toBe('Monday');
    expect(s.busiestDay?.label).toBe('Jan 5, 2026');
    expect(s.mostLiked?.id).toBe('a');
    expect(s.mostViewed?.id).toBe('a');
  });

  it('splits the format mix into exclusive buckets', () => {
    const f = (...facets: Facet[]) => ({ facets });
    const list = [bm(t0, f('thread', 'media')), bm(t0, f('long')), bm(t0, f('media', 'image')), bm(t0, f('link')), bm(t0, f()), bm(t0, f('article', 'link'))];
    const s = computeWrapped(list, { period: 'year', now: NOW, timeZone: IST });
    expect(s.mix).toEqual({ thread: 1, article: 2, media: 1, link: 1, text: 1 });
    expect(Object.values(s.mix).reduce((a, b) => a + b, 0)).toBe(s.total);
  });

  it('is independent of input order', () => {
    const list = Array.from({ length: 300 }, (_, i) =>
      bm(Date.UTC(2026, 0, 1) + i * 13 * 3_600_000, { category: ['ai', 'dev', 'design', 'finance'][i % 4]!, author: author(`u${i % 17}`), read: (i % 3 === 0 ? 1 : 0) as 0 | 1 }),
    );
    const a = computeWrapped(list, { period: 'year', now: NOW, timeZone: IST });
    const b = computeWrapped([...list].reverse(), { period: 'year', now: NOW, timeZone: IST });
    expect(b).toEqual(a);
  });
});

describe('personas', () => {
  const base: PersonaFeatures = { total: 200, perDay: 1, readShare: 0.3, nightShare: 0.1, morningShare: 0.1, weekendShare: 0.28, categoryShares: { other: 1 } };
  const cases: Array<[PersonaId, Partial<PersonaFeatures>]> = [
    ['fresh', { total: 3 }],
    ['hoarder', { total: 4000, perDay: 11, readShare: 0.02, categoryShares: { dev: 0.3, finance: 0.3, health: 0.4 } }],
    ['night-owl', { nightShare: 0.45 }],
    ['early-bird', { morningShare: 0.42 }],
    ['completionist', { readShare: 0.9 }],
    ['weekend', { weekendShare: 0.62 }],
    ['prompt', { categoryShares: { ai: 0.55, dev: 0.05, other: 0.4 } }],
    ['builder', { categoryShares: { dev: 0.35, ai: 0.15, tools: 0.1, other: 0.4 } }],
    ['aesthete', { categoryShares: { design: 0.4, other: 0.6 } }],
    ['market', { categoryShares: { finance: 0.2, crypto: 0.15, startups: 0.1, other: 0.55 } }],
    ['learner', { categoryShares: { learning: 0.2, science: 0.15, other: 0.65 } }],
    ['optimizer', { categoryShares: { health: 0.2, productivity: 0.2, other: 0.6 } }],
    ['culture', { categoryShares: { culture: 0.2, humor: 0.2, other: 0.6 } }],
    ['news', { categoryShares: { news: 0.35, other: 0.65 } }],
    ['polymath', { categoryShares: { ai: 0.15, dev: 0.12, design: 0.15, finance: 0.15, health: 0.15, news: 0.14, humor: 0.14 } }],
  ];

  it.each(cases)('reaches %s', (id, patch) => {
    const p = pickPersona({ ...base, ...patch });
    expect(p.id).toBe(id);
    expect(p.name).toBe(PERSONAS[id].name);
    expect(p.reason.length).toBeGreaterThan(5);
  });

  it('covers every persona', () => {
    expect(new Set(cases.map(([id]) => id))).toEqual(new Set(Object.keys(PERSONAS)));
    expect(Object.keys(PERSONAS).length).toBeGreaterThanOrEqual(8);
    for (const p of Object.values(PERSONAS)) {
      expect(p.emoji).toBeTruthy();
      expect(p.line.length).toBeGreaterThan(15);
    }
  });

  it('groups custom categories by name', () => {
    const p = pickPersona({ ...base, categoryShares: { 'c-123': 0.45, other: 0.55 }, categoryNames: { 'c-123': 'Cricket & IPL' } });
    expect(p.id).toBe('culture');
  });

  it('falls back to a moderate lean, then the polymath', () => {
    expect(pickPersona({ ...base, categoryShares: { dev: 0.32, other: 0.68 } }).id).toBe('builder');
    expect(pickPersona({ ...base, categoryShares: { other: 1 } }).id).toBe('polymath');
  });

  it('is deterministic for real libraries', () => {
    const night = Array.from({ length: 40 }, (_, i) => bm(Date.UTC(2026, 1, 1 + i, 18, 30 + (i % 20)), { category: ['ai', 'news', 'humor', 'health'][i % 4]! })); // 00:00–00:20 IST
    const a = computeWrapped(night, { period: 'year', now: NOW, timeZone: IST });
    expect(a.persona.id).toBe('night-owl');
    expect(computeWrapped([...night].reverse(), { period: 'year', now: NOW, timeZone: IST }).persona).toEqual(a.persona);
    // Same saves seen from UTC happen in the evening — no night owl there.
    expect(computeWrapped(night, { period: 'year', now: NOW, timeZone: UTC }).persona.id).not.toBe('night-owl');

    const dev = Array.from({ length: 60 }, (_, i) => bm(Date.UTC(2026, 0, 2 + i, 6, 0), { category: i % 5 === 0 ? 'humor' : 'dev', read: (i % 2) as 0 | 1 }));
    expect(computeWrapped(dev, { period: 'year', now: NOW, timeZone: IST }).persona.id).toBe('builder');
  });
});

describe('fun facts and sharing', () => {
  function rich(): WrappedStats {
    const list: Bookmark[] = [];
    for (let i = 0; i < 120; i++) {
      const d = new Date(Date.UTC(2026, 0, 4)); // a Sunday
      const dayOffset = i % 3 === 0 ? 0 : (i % 7) + 1; // lots of Sundays
      d.setUTCDate(d.getUTCDate() + Math.floor(i / 7) * 7 + (dayOffset % 7));
      list.push(
        bm(d.getTime() + 10 * 3_600_000, {
          author: i % 4 === 0 ? author('karpathy', 'Andrej Karpathy') : author(`a${i}`),
          category: i % 2 ? 'ai' : 'learning',
          metrics: { likes: i * 1000, retweets: 0, replies: 0, quotes: 0, views: i * 10_000, bookmarks: 0 },
        }),
      );
    }
    return computeWrapped(list, { period: 'year', now: NOW, timeZone: UTC });
  }

  it('produces two or three ranked facts', () => {
    const s = rich();
    expect(s.funFacts.length).toBeGreaterThanOrEqual(2);
    expect(s.funFacts.length).toBeLessThanOrEqual(3);
    const ids = s.funFacts.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    const author = s.funFacts.find((f) => f.id === 'author');
    expect(author?.text).toMatch(/^@karpathy got 30 of your saves — 1 in every 4\.$/);
    expect(author?.mentionsAuthor).toBe(true);
    const weekday = s.funFacts.find((f) => f.id === 'weekday');
    expect(weekday?.text).toMatch(/more on Sundays than on/);
    const sorted = [...s.funFacts].sort((a, b) => b.score - a.score);
    expect(s.funFacts).toEqual(sorted);
  });

  it('builds a share post within 250 characters', () => {
    const s = rich();
    const text = buildShareText(s);
    expect(text.length).toBeLessThanOrEqual(250);
    expect(text).toContain(s.persona.name);
    expect(text).toContain(s.categories[0]!.name);
    expect(text).toContain('Made with twtdash');
    expect(text).toContain('https://twtdash.vercel.app');
    expect(shareIntentUrl(s)).toMatch(/^https:\/\/x\.com\/intent\/post\?text=/);
    expect(decodeURIComponent(shareIntentUrl(s).split('text=')[1]!)).toBe(text);

    for (const id of Object.keys(PERSONAS) as PersonaId[]) {
      const long: WrappedStats = {
        ...s,
        total: 1_234_567,
        persona: { ...PERSONAS[id], reason: '' },
        categories: [{ id: 'x', name: 'An Extremely Long Custom Category Name That Goes On And On Forever And Ever', emoji: '🏏', color: '#000', count: 1, share: 1 }],
      };
      const t = buildShareText(long);
      expect(t.length).toBeLessThanOrEqual(250);
      expect(t).toContain(PERSONAS[id].name);
      expect(t).toContain('https://twtdash.vercel.app');
    }
  });
});

describe('performance', () => {
  function synthetic(n: number): Bookmark[] {
    let s = 7;
    const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const cats = ['ai', 'dev', 'design', 'startups', 'finance', 'crypto', 'health', 'learning', 'humor', 'news'];
    const facets: Facet[][] = [[], ['media', 'image'], ['link'], ['thread'], ['long']];
    const authors = Array.from({ length: 800 }, (_, i) => author(`user_${i}`, `User ${i}`));
    return Array.from({ length: n }, (_, i) =>
      bm(NOW - Math.floor(rand() * 4 * 365 * 86_400_000), {
        id: `perf${i}`,
        category: cats[Math.floor(rand() * cats.length)]!,
        author: authors[Math.floor(Math.pow(rand(), 2) * authors.length)]!,
        facets: facets[Math.floor(rand() * facets.length)]!,
        read: (rand() < 0.3 ? 1 : 0) as 0 | 1,
        metrics: { likes: Math.floor(rand() * 50_000), retweets: 0, replies: 0, quotes: 0, views: Math.floor(rand() * 1e6), bookmarks: 0 },
      }),
    );
  }

  // Timing test: opt in with PERF_TESTS=1 (load-sensitive under parallel test workers).
  it.skipIf(!process.env.PERF_TESTS)('computes 50k posts in well under 200ms', () => {
    const list = synthetic(50_000);
    // Warm up the JIT and ICU's time-zone data (first Intl call costs ~100ms on its own).
    computeWrapped(list, { period: 'all', now: NOW });
    computeWrapped(list, { period: 'all', now: NOW, timeZone: IST });
    for (const timeZone of [undefined, IST]) {
      for (const period of ['year', 'all'] as const) {
        const t0 = performance.now();
        const s = computeWrapped(list, { period, now: NOW, timeZone });
        const ms = performance.now() - t0;
        expect(s.total).toBeGreaterThan(0);
        expect(ms).toBeLessThan(200);
      }
    }
  });
});
