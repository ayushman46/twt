/**
 * Fuzzing lib/parse.ts with mutated X GraphQL payloads.
 *
 * X changes its schema without notice, so the parser must never throw and must
 * never hand the rest of the extension a post with the wrong shape (a number
 * where a string belongs, NaN dates, non-array lists…). Every mutated payload
 * goes through parseTimeline, collectTweets, normalizeTweet and
 * parseBookmarkFolders; every post they produce is checked against the
 * TweetData contract and fed to the two first consumers (facets, classifier).
 *
 * The PRNG is seeded, so a failure message (`#iteration base`) reproduces.
 */
import { describe, expect, it } from 'vitest';
import { classifyTweet, compileCategories } from '../classify';
import { defaultCategories } from '../db';
import { computeFacets } from '../facets';
import { collectTweets, normalizeTweet, parseBookmarkFolders, parseTimeline, type TimelineParseResult } from '../parse';
import type { TweetData } from '../types';
import { aiTweet, bookmarksPage, cardTweet, devTweetWrapped, endPage, noteTweet, retweetOfAi, SORT } from './fixtures';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

/* ------------------------------------------------------------------ */
/* Deterministic randomness                                            */
/* ------------------------------------------------------------------ */

/** mulberry32 — tiny, fast, good enough for fuzzing. */
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

/* ------------------------------------------------------------------ */
/* Extra fixtures (shapes the shared fixtures don't cover)             */
/* ------------------------------------------------------------------ */

const user = (id: string, handle: string) => ({
  __typename: 'User',
  rest_id: id,
  core: { name: `User ${id}`, screen_name: handle },
  avatar: { image_url: `https://pbs.twimg.com/profile_images/${id}/x_normal.jpg` },
  relationship_counts: { followers: 7 },
});

const videoTweet = {
  __typename: 'Tweet',
  rest_id: '1790000000000000010',
  core: { user_results: { result: user('77', 'clipper') } },
  views: { count: '1200' },
  legacy: {
    created_at: 'Tue May 21 09:00:00 +0000 2024',
    full_text: 'Watch this क्रिकेट clip 🏏 https://t.co/vid1',
    lang: 'hi',
    favorite_count: 5,
    entities: { urls: [], hashtags: [{ text: 'IPL2026' }], user_mentions: [{ screen_name: 'bcci' }], media: [{ url: 'https://t.co/vid1' }] },
    extended_entities: {
      media: [
        {
          url: 'https://t.co/vid1',
          type: 'video',
          media_url_https: 'https://pbs.twimg.com/ext_tw_video_thumb/1/pu/img/a.jpg',
          original_info: { width: 1280, height: 720 },
          video_info: {
            duration_millis: 30_000,
            variants: [
              { content_type: 'application/x-mpegURL', url: 'https://video.twimg.com/a.m3u8' },
              { content_type: 'video/mp4', bitrate: 256000, url: 'https://video.twimg.com/low.mp4' },
              { content_type: 'video/mp4', bitrate: 832000, url: 'https://video.twimg.com/mid.mp4' },
              { content_type: 'video/mp4', bitrate: 2176000, url: 'https://video.twimg.com/high.mp4' },
            ],
          },
        },
        { url: 'https://t.co/vid1', type: 'animated_gif', media_url_https: 'https://pbs.twimg.com/tweet_video_thumb/g.jpg', video_info: { variants: [{ content_type: 'video/mp4', url: 'https://video.twimg.com/g.mp4' }] } },
      ],
    },
  },
};

const pollTweet = {
  __typename: 'Tweet',
  rest_id: '1790000000000000011',
  core: { user_results: { result: user('78', 'pollster') } },
  card: {
    legacy: {
      name: 'poll3choice_text_only',
      binding_values: [
        { key: 'choice1_label', value: { string_value: 'Tabs' } },
        { key: 'choice1_count', value: { string_value: '120' } },
        { key: 'choice2_label', value: { string_value: 'Spaces' } },
        { key: 'choice2_count', value: { string_value: '80' } },
        { key: 'choice3_label', value: { string_value: 'Both 🙃' } },
        { key: 'choice3_count', value: { string_value: '3' } },
        { key: 'end_datetime_utc', value: { string_value: '2024-05-22T09:00:00Z' } },
      ],
    },
  },
  legacy: { created_at: 'Wed May 22 09:00:00 +0000 2024', full_text: 'Settle it once and for all', entities: {} },
};

const articleTweet = {
  __typename: 'Tweet',
  rest_id: '1790000000000000012',
  core: { user_results: { result: user('79', 'longform') } },
  article: { article_results: { result: { title: 'Why we left the cloud', preview_text: 'A cost story', cover_media: { media_info: { original_img_url: 'https://pbs.twimg.com/a.jpg' } } } } },
  legacy: { created_at: 'Thu May 23 09:00:00 +0000 2024', full_text: 'https://t.co/art1', entities: { urls: [{ url: 'https://t.co/art1', expanded_url: 'https://x.com/i/article/1', display_url: 'x.com/i/article/1' }] } },
};

const unifiedCardTweet = {
  __typename: 'Tweet',
  rest_id: '1790000000000000013',
  core: { user_results: { result: user('80', 'appmaker') } },
  card: {
    legacy: {
      name: 'unified_card',
      binding_values: [
        {
          key: 'unified_card',
          value: {
            string_value: JSON.stringify({
              destination_objects: { d1: { data: { url_data: { url: 'https://apps.apple.com/app/id1' } } } },
              component_objects: { c1: { data: { title: { content: 'Habit app' } } } },
              media_entities: { m1: { media_url_https: 'https://pbs.twimg.com/card.jpg' } },
            }),
          },
        },
      ],
    },
  },
  legacy: { created_at: 'Fri May 24 09:00:00 +0000 2024', full_text: 'New app is live', entities: {} },
};

const quoteOfDeleted = {
  __typename: 'Tweet',
  rest_id: '1790000000000000014',
  core: { user_results: { result: user('81', 'quoter') } },
  quoted_status_result: { result: { __typename: 'TweetTombstone', tombstone: { text: { text: 'This Post was deleted by the Post author.' } } } },
  legacy: {
    created_at: 'Sat May 25 09:00:00 +0000 2024',
    full_text: 'lol this aged well https://t.co/q9',
    quoted_status_id_str: '1700000000000000000',
    quoted_status_permalink: { url: 'https://t.co/q9', expanded: 'https://twitter.com/gone/status/1700000000000000000' },
    entities: { urls: [{ url: 'https://t.co/q9', expanded_url: 'https://twitter.com/gone/status/1700000000000000000', display_url: 'twitter.com/gone/status/…' }] },
  },
};

const entry = (id: string, result: unknown, sortIndex: string) => ({
  entryId: `tweet-${id}`,
  sortIndex,
  content: { entryType: 'TimelineTimelineItem', itemContent: { itemType: 'TimelineTweet', tweet_results: { result } } },
});

const page = (results: unknown[]) => ({
  data: {
    bookmark_timeline_v2: {
      timeline: {
        instructions: [
          { type: 'TimelineClearCache' },
          { type: 'TimelineAddEntries', entries: [...results.map((r, i) => entry(String(1790000000000000100 + i), r, String(BigInt(SORT.a) - BigInt(i)))), { entryId: 'cursor-bottom-9', content: { cursorType: 'Bottom', value: 'NEXT' } }] },
        ],
      },
    },
  },
});

/** Conversation-style module + module items + replace-entry instructions. */
const modulePage = {
  data: {
    threaded_conversation_with_injections_v2: {
      instructions: [
        {
          type: 'TimelineAddEntries',
          entries: [
            { entryId: 'conversationthread-1', sortIndex: SORT.b, content: { entryType: 'TimelineTimelineModule', items: [{ entryId: 'x-1', item: { itemContent: { itemType: 'TimelineTweet', tweet_results: { result: aiTweet } } } }, { entryId: 'x-2', item: { itemContent: { cursorType: 'ShowMore', value: 'MORE' } } }] } },
            { entryId: 'promoted-tweet-1', content: { itemContent: { tweet_results: { result: cardTweet } } } },
            { entryId: 'who-to-follow-1', content: { entryType: 'TimelineTimelineModule', items: [{ item: { itemContent: { itemType: 'TimelineUser', user_results: { result: user('5', 'someone') } } } }] } },
          ],
        },
        { type: 'TimelineAddToModule', moduleItems: [{ entryId: 'm-1', item: { itemContent: { tweet_results: { result: noteTweet } } } }] },
        { type: 'TimelineReplaceEntry', entry: { entryId: 'cursor-bottom-2', content: { cursorType: 'Bottom', value: 'REPLACED' } } },
        { type: 'TimelineShowAlert', alertType: 'NewTweets' },
      ],
    },
  },
};

const foldersPage = {
  data: { viewer: { user_results: { result: { bookmark_collections_slice: { items: [{ __typename: 'BookmarkCollection', id: '1', name: 'Read later' }, { __typename: 'BookmarkCollection', id: '2', name: 'पढ़ना है' }] } } } } },
};

const TWEETS: Record<string, unknown> = { aiTweet, devTweetWrapped, noteTweet, cardTweet, retweetOfAi, videoTweet, pollTweet, articleTweet, unifiedCardTweet, quoteOfDeleted };

const BASES: Array<[string, unknown]> = [
  ['bookmarksPage', bookmarksPage],
  ['endPage', endPage],
  ['modulePage', modulePage],
  ['foldersPage', foldersPage],
  ['allTweetsPage', page(Object.values(TWEETS))],
  ...Object.entries(TWEETS).map(([k, v]) => [k, v] as [string, unknown]),
  ...Object.entries(TWEETS).map(([k, v]) => [`page(${k})`, page([v])] as [string, unknown]),
];

/* ------------------------------------------------------------------ */
/* The contract every emitted post must satisfy                        */
/* ------------------------------------------------------------------ */

const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const optStr = (v: unknown) => v === undefined || isStr(v);
const optNum = (v: unknown) => v === undefined || isNum(v);
const MEDIA_TYPES = new Set(['photo', 'video', 'gif']);

function findNaN(v: unknown, at: string, out: string[], depth = 0) {
  if (depth > 20) return;
  if (typeof v === 'number' && Number.isNaN(v)) out.push(`${at} is NaN`);
  else if (v && typeof v === 'object') for (const [k, c] of Object.entries(v)) findNaN(c, `${at}.${k}`, out, depth + 1);
}

function checkAuthor(a: Json, at: string, out: string[]) {
  if (!a || typeof a !== 'object') return void out.push(`${at} is not an object`);
  for (const k of ['id', 'name', 'handle', 'avatar']) if (!isStr(a[k])) out.push(`${at}.${k} is ${typeof a[k]}`);
  if (typeof a.verified !== 'boolean') out.push(`${at}.verified is ${typeof a.verified}`);
  if (!optNum(a.followers)) out.push(`${at}.followers is ${String(a.followers)}`);
}

function checkMedia(list: Json, at: string, out: string[]) {
  if (!Array.isArray(list)) return void out.push(`${at} is not an array`);
  list.forEach((m: Json, i: number) => {
    if (!m || typeof m !== 'object') return void out.push(`${at}[${i}] is not an object`);
    if (!MEDIA_TYPES.has(m.type)) out.push(`${at}[${i}].type is ${String(m.type)}`);
    if (!isStr(m.url)) out.push(`${at}[${i}].url is ${typeof m.url}`);
    for (const k of ['width', 'height', 'durationMs']) if (!optNum(m[k])) out.push(`${at}[${i}].${k} is ${String(m[k])}`);
    for (const k of ['alt', 'videoUrl']) if (!optStr(m[k])) out.push(`${at}[${i}].${k} is ${typeof m[k]}`);
  });
}

function checkStrings(list: Json, at: string, out: string[]) {
  if (!Array.isArray(list)) return void out.push(`${at} is not an array`);
  list.forEach((s: Json, i: number) => isStr(s) || out.push(`${at}[${i}] is ${typeof s}`));
}

/** Problems with one parsed post (empty = valid). */
function tweetProblems(t: TweetData): string[] {
  const out: string[] = [];
  const p = t as Json;
  if (!p || typeof p !== 'object') return ['post is not an object'];
  if (!isStr(p.id) || !/^\d+$/.test(p.id)) out.push(`id is ${JSON.stringify(p.id)?.slice(0, 40)}`);
  if (!isStr(p.url)) out.push(`url is ${typeof p.url}`);
  else if (isStr(p.id) && !p.url.endsWith(`/status/${p.id}`)) out.push(`url ${p.url.slice(0, 60)} does not point at the post`);
  if (!isStr(p.text)) out.push(`text is ${typeof p.text}`);
  if (!isStr(p.lang)) out.push(`lang is ${typeof p.lang}`);
  if (!isNum(p.createdAt)) out.push(`createdAt is ${String(p.createdAt)}`);
  checkAuthor(p.author, 'author', out);
  checkMedia(p.media, 'media', out);
  if (!Array.isArray(p.links)) out.push('links is not an array');
  else
    p.links.forEach((l: Json, i: number) => {
      if (!l || !isStr(l.url) || !isStr(l.display) || !isStr(l.domain)) out.push(`links[${i}] has the wrong shape: ${JSON.stringify(l)?.slice(0, 80)}`);
    });
  checkStrings(p.hashtags, 'hashtags', out);
  checkStrings(p.mentions, 'mentions', out);
  if (p.card !== undefined) {
    const c = p.card;
    if (!c || !isStr(c.url) || !optStr(c.title) || !optStr(c.description) || !optStr(c.image) || !optStr(c.domain)) out.push(`card has the wrong shape: ${JSON.stringify(c)?.slice(0, 120)}`);
  }
  if (p.poll !== undefined) {
    const pl = p.poll;
    if (!pl || !Array.isArray(pl.options) || !optNum(pl.endsAt)) out.push('poll has the wrong shape');
    else pl.options.forEach((o: Json, i: number) => (o && isStr(o.label) && isNum(o.votes)) || out.push(`poll.options[${i}] has the wrong shape: ${JSON.stringify(o)?.slice(0, 80)}`));
  }
  if (p.quoted !== undefined) {
    const q = p.quoted;
    if (!q || typeof q !== 'object') out.push('quoted is not an object');
    else {
      if (!isStr(q.id) || !/^\d+$/.test(q.id)) out.push(`quoted.id is ${JSON.stringify(q.id)?.slice(0, 40)}`);
      if (!isStr(q.url)) out.push(`quoted.url is ${typeof q.url}`);
      if (!isStr(q.text)) out.push(`quoted.text is ${typeof q.text}`);
      if (!isNum(q.createdAt)) out.push(`quoted.createdAt is ${String(q.createdAt)}`);
      checkAuthor(q.author, 'quoted.author', out);
      checkMedia(q.media, 'quoted.media', out);
    }
  }
  if (p.article !== undefined) {
    const a = p.article;
    if (!a || !isStr(a.title) || !optStr(a.preview) || !optStr(a.cover)) out.push(`article has the wrong shape: ${JSON.stringify(a)?.slice(0, 120)}`);
  }
  if (!p.metrics || typeof p.metrics !== 'object') out.push('metrics is not an object');
  else for (const k of ['likes', 'retweets', 'replies', 'quotes', 'views', 'bookmarks']) if (!isNum(p.metrics[k])) out.push(`metrics.${k} is ${JSON.stringify(p.metrics[k])?.slice(0, 40)}`);
  if (typeof p.isReply !== 'boolean') out.push('isReply is not a boolean');
  if (typeof p.isNote !== 'boolean') out.push('isNote is not a boolean');
  if (!optStr(p.replyTo)) out.push(`replyTo is ${typeof p.replyTo}`);
  if (!optStr(p.conversationId)) out.push(`conversationId is ${typeof p.conversationId}`);
  findNaN(p, 'post', out);
  return out;
}

const compiled = compileCategories(defaultCategories());

/** Validate a post and push it through the first consumers (facets + classifier). */
function checkPost(t: TweetData, label: string, failures: string[]) {
  const problems = tweetProblems(t);
  if (problems.length) {
    failures.push(`${label}: ${problems.slice(0, 4).join('; ')}`);
    return;
  }
  try {
    computeFacets(t);
    classifyTweet(t, compiled);
  } catch (e) {
    failures.push(`${label}: consumer threw on parsed post: ${(e as Error).message}`);
  }
}

function checkTimeline(r: TimelineParseResult, label: string, failures: string[]) {
  if (!r || !Array.isArray(r.tweets)) return void failures.push(`${label}: tweets is not an array`);
  if (!Number.isInteger(r.entryCount) || r.entryCount < 0) failures.push(`${label}: entryCount is ${r.entryCount}`);
  if (!optStr(r.cursorBottom)) failures.push(`${label}: cursorBottom is ${typeof r.cursorBottom}`);
  r.tweets.forEach((x, i) => {
    if (!optStr(x.sortIndex)) failures.push(`${label}: tweets[${i}].sortIndex is ${typeof x.sortIndex}`);
    checkPost(x.tweet, `${label} tweets[${i}]`, failures);
  });
}

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */

const HUGE = [
  'a'.repeat(120_000),
  '&amp;&lt;'.repeat(15_000),
  '🧵👨‍👩‍👧‍👦'.repeat(10_000),
  'https://t.co/abc123 '.repeat(5_000),
  'क्रिकेट '.repeat(12_000),
  '9'.repeat(5_000),
];
const UNICODE = ['', ' ', '‍', '‮', '\ud800', 'हिन्दी', 'اردو', '𝐈𝐏𝐋', '\u0000', 'é', '"', '\\', '__proto__', 'constructor', 'toString', '<script>', '1790000000000000001', '-1', 'NaN', 'Infinity'];
const TYPENAMES = ['Tweet', 'TweetTombstone', 'TweetUnavailable', 'TweetWithVisibilityResults', 'User', 'UserUnavailable', 'TimelineTimelineModule', 'TimelineTimelineCursor', 'BookmarkCollection', 'SomethingNew', '', null];

function deepJunk(r: () => number, depth: number): unknown {
  let v: Json = pick(r, [null, 1, 'x', {}, []]);
  for (let i = 0; i < depth; i++) {
    const k = pick(r, ['legacy', 'result', 'tweet', 'core', 'items', 'instructions', 'entries', 'content', 'x']);
    v = int(r, 3) === 0 ? [v] : { [k]: v, __typename: pick(r, TYPENAMES) };
  }
  return v;
}

function randomUnicode(r: () => number, n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) {
    const roll = int(r, 5);
    if (roll === 0) s += String.fromCharCode(0x20 + int(r, 0x5f));
    else if (roll === 1) s += String.fromCharCode(0x0900 + int(r, 0x480)); // Indic blocks
    else if (roll === 2) s += String.fromCodePoint(0x1f300 + int(r, 0x300)); // emoji
    else if (roll === 3) s += pick(r, ['‍', '‌', '​', '﻿', '́', '‮', '\ud83d']);
    else s += String.fromCharCode(0x0600 + int(r, 0x100)); // Arabic
  }
  return s;
}

function junk(r: () => number): unknown {
  switch (int(r, 18)) {
    case 0:
      return null;
    case 1:
      return undefined;
    case 2:
      return 0;
    case 3:
      return pick(r, [-1, 1.5, -0, 2 ** 53 + 1, 1e308, 1790000000000000001]);
    case 4:
      return pick(r, [NaN, Infinity, -Infinity]);
    case 5:
      return r() < 0.5;
    case 6:
      return '';
    case 7:
      return pick(r, HUGE);
    case 8:
      return [];
    case 9:
      return {};
    case 10:
      return deepJunk(r, 20 + int(r, 200));
    case 11:
      return [null, 1, 'x', {}, [], undefined];
    case 12:
      return randomUnicode(r, 1 + int(r, 40));
    case 13:
      return pick(r, UNICODE);
    case 14:
      return { __typename: pick(r, TYPENAMES) };
    case 15:
      return { __typename: 'TweetWithVisibilityResults', tweet: { __typename: 'TweetTombstone' } };
    case 16:
      return { length: 3, 0: 'a' }; // array-like, not an array
    default:
      return 'Wed May 15 10:00:00 +0000 2024';
  }
}

interface Slot {
  parent: Json;
  key: string | number;
}

function slotsOf(root: unknown): Slot[] {
  const out: Slot[] = [];
  const stack: unknown[] = [root];
  while (stack.length && out.length < 20_000) {
    const v = stack.pop();
    if (!v || typeof v !== 'object') continue;
    const arr = Array.isArray(v);
    for (const k of Object.keys(v)) {
      out.push({ parent: v, key: arr ? Number(k) : k });
      const c = (v as Json)[k];
      if (c && typeof c === 'object') stack.push(c);
    }
  }
  return out;
}

/** Apply 1-6 random mutations in place. Returns a short description. */
function mutate(root: Json, r: () => number): string[] {
  const done: string[] = [];
  const n = 1 + int(r, 6);
  for (let i = 0; i < n; i++) {
    const all = slotsOf(root);
    if (!all.length) break;
    const { parent, key } = all[int(r, all.length)]!;
    const op = int(r, 8);
    switch (op) {
      case 0:
        if (Array.isArray(parent)) parent.splice(key as number, 1);
        else delete parent[key];
        done.push(`delete ${key}`);
        break;
      case 1:
        parent[key] = null;
        done.push(`null ${key}`);
        break;
      case 2:
      case 3: {
        parent[key] = junk(r);
        done.push(`junk ${key}`);
        break;
      }
      case 4: {
        const v = parent[key];
        if (Array.isArray(v)) v.length = int(r, v.length + 1);
        else if (Array.isArray(parent)) parent.length = int(r, parent.length);
        else parent[key] = undefined;
        done.push(`truncate ${key}`);
        break;
      }
      case 5: {
        // Graft another node here (type confusion: a user where a tweet belongs, etc.).
        const other = all[int(r, all.length)]!;
        const v = other.parent[other.key];
        parent[key] = v && typeof v === 'object' ? structuredClone(v) : v;
        done.push(`graft ${other.key}→${key}`);
        break;
      }
      case 6: {
        const t = all.find((s) => s.key === '__typename' && r() < 0.3) ?? { parent, key };
        t.parent[t.key] = pick(r, TYPENAMES);
        done.push(`typename ${t.key}`);
        break;
      }
      default: {
        // Wrap in a visibility wrapper / unwrap one level.
        const v = parent[key];
        parent[key] = r() < 0.5 ? { __typename: 'TweetWithVisibilityResults', tweet: v } : { tweet: v, legacy: r() < 0.5 ? undefined : {} };
        done.push(`wrap ${key}`);
      }
    }
  }
  return done;
}

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

function run(label: string, fn: () => void, failures: string[]) {
  try {
    fn();
  } catch (e) {
    failures.push(`${label}: threw ${(e as Error)?.stack?.split('\n').slice(0, 3).join(' | ') ?? String(e)}`);
  }
}

describe('parse fuzzing (seeded)', () => {
  it('the unmutated bases parse into valid posts', () => {
    const failures: string[] = [];
    for (const [name, base] of BASES) {
      run(name, () => checkTimeline(parseTimeline(base), name, failures), failures);
      run(name, () => collectTweets(base).forEach((t, i) => checkPost(t, `${name} collect[${i}]`, failures)), failures);
    }
    for (const [name, t] of Object.entries(TWEETS)) {
      const parsed = normalizeTweet(t);
      expect(parsed, name).not.toBeNull();
      checkPost(parsed!, name, failures);
    }
    expect(failures).toEqual([]);
  });

  it('never throws and never emits an invalid post across 2,400 mutated payloads', () => {
    const r = rng(0x7a17da5);
    const failures: string[] = [];
    let posts = 0;
    let emptyPages = 0;
    const ITERATIONS = 2_400;
    for (let i = 0; i < ITERATIONS; i++) {
      const [name, base] = BASES[i % BASES.length]!;
      const payload = structuredClone(base) as Json;
      const ops = mutate(payload, r);
      const label = `#${i} ${name} [${ops.join(', ')}]`;
      run(`${label} parseTimeline`, () => {
        const res = parseTimeline(payload);
        checkTimeline(res, label, failures);
        posts += res.tweets.length;
        if (!res.tweets.length) emptyPages++;
      }, failures);
      run(`${label} collectTweets`, () => {
        const list = collectTweets(payload);
        posts += list.length;
        list.forEach((t, k) => checkPost(t, `${label} collect[${k}]`, failures));
      }, failures);
      run(`${label} normalizeTweet`, () => {
        const t = normalizeTweet(payload);
        if (t) posts++;
        if (t) checkPost(t, `${label} normalize`, failures);
        const nested = normalizeTweet(payload, true);
        if (nested) checkPost(nested, `${label} normalize(nested)`, failures);
      }, failures);
      run(`${label} parseBookmarkFolders`, () => {
        for (const f of parseBookmarkFolders(payload)) if (!isStr(f.id) || !isStr(f.name)) failures.push(`${label}: folder has the wrong shape`);
      }, failures);
      if (failures.length > 40) break;
    }
    expect(failures.slice(0, 25)).toEqual([]);
    // The fuzzer must still produce plenty of posts (it isn't just destroying every payload)…
    expect(posts).toBeGreaterThan(2 * ITERATIONS);
    // …and plenty of payloads that yield nothing.
    expect(emptyPages).toBeGreaterThan(100);
  }, 60_000);

  it('survives payloads made of nothing but junk', () => {
    const r = rng(42);
    const failures: string[] = [];
    for (let i = 0; i < 300; i++) {
      const payload = i % 3 === 0 ? deepJunk(r, 1 + int(r, 400)) : junk(r);
      run(`junk #${i}`, () => {
        checkTimeline(parseTimeline(payload), `junk #${i}`, failures);
        collectTweets(payload).forEach((t, k) => checkPost(t, `junk #${i} collect[${k}]`, failures));
        const t = normalizeTweet(payload);
        if (t) checkPost(t, `junk #${i} normalize`, failures);
        parseBookmarkFolders(payload);
      }, failures);
    }
    expect(failures).toEqual([]);
  });
});

describe('parse edge cases', () => {
  const ids = (json: unknown) => parseTimeline(json).tweets.map((t) => t.tweet.id);

  it('skips tombstones and unavailable posts, bare or behind a visibility wrapper', () => {
    for (const result of [
      { __typename: 'TweetTombstone', tombstone: {} },
      { __typename: 'TweetUnavailable', reason: 'Suspended' },
      { __typename: 'TweetWithVisibilityResults', tweet: { __typename: 'TweetTombstone' } },
      { __typename: 'TweetWithVisibilityResults', tweet: null },
      { __typename: 'TweetWithVisibilityResults' },
      { __typename: 'TweetTombstone', legacy: { full_text: 'ghost' }, rest_id: '1790000000000000555' },
    ]) {
      expect(normalizeTweet(result)).toBeNull();
      expect(ids(page([result, aiTweet]))).toEqual(['1790000000000000001']);
    }
  });

  it('unwraps nested visibility wrappers (up to three levels)', () => {
    const wrap = (v: unknown) => ({ __typename: 'TweetWithVisibilityResults', tweet: v });
    expect(normalizeTweet(wrap(wrap(aiTweet)))?.id).toBe('1790000000000000001');
    expect(normalizeTweet(wrap(wrap(wrap(aiTweet))))?.id).toBe('1790000000000000001');
    // Deeper nesting is not a real X shape; it must not throw.
    expect(() => normalizeTweet(wrap(wrap(wrap(wrap(wrap(aiTweet))))))).not.toThrow();
  });

  it('handles note tweets with missing or odd note bodies', () => {
    const variants = [
      { note_tweet: {} },
      { note_tweet: { note_tweet_results: { result: { text: '' } } } },
      { note_tweet: { note_tweet_results: { result: { text: 'Long note', entity_set: null } } } },
      { note_tweet: { note_tweet_results: { result: { text: 'x'.repeat(25_000) } } } },
    ];
    for (const v of variants) {
      const t = normalizeTweet({ ...noteTweet, ...v })!;
      expect(t).not.toBeNull();
      expect(tweetProblems(t)).toEqual([]);
    }
    expect(normalizeTweet({ ...noteTweet, note_tweet: { note_tweet_results: { result: { text: 'x'.repeat(25_000) } } } })!.text).toHaveLength(25_000);
  });

  it('keeps a post whose quoted post was deleted, and drops the dead permalink', () => {
    const t = normalizeTweet(quoteOfDeleted)!;
    expect(t.quoted).toBeUndefined();
    expect(t.text).toBe('lol this aged well');
    expect(t.links).toEqual([]);
    expect(tweetProblems(t)).toEqual([]);
  });

  it('survives missing author, core, legacy and ids', () => {
    const noCore = normalizeTweet({ ...aiTweet, core: undefined })!;
    expect(noCore.author.handle).toBe('');
    expect(noCore.url).toBe('https://x.com/i/status/1790000000000000001');
    expect(tweetProblems(noCore)).toEqual([]);
    expect(tweetProblems(normalizeTweet({ ...aiTweet, core: { user_results: { result: { __typename: 'UserUnavailable' } } } })!)).toEqual([]);
    expect(normalizeTweet({ ...aiTweet, legacy: undefined })).toBeNull();
    expect(normalizeTweet({ ...aiTweet, rest_id: undefined, legacy: { ...aiTweet.legacy, id_str: undefined } })).toBeNull();
    expect(normalizeTweet({ ...aiTweet, rest_id: 'not-a-number' })).toBeNull();
    // created_at missing: falls back to the snowflake time.
    const noDate = normalizeTweet({ ...aiTweet, legacy: { ...aiTweet.legacy, created_at: undefined } })!;
    expect(new Date(noDate.createdAt).toISOString().slice(0, 10)).toBe('2024-05-13');
  });

  it('treats an unknown __typename with a tweet body as a tweet', () => {
    const t = normalizeTweet({ ...aiTweet, __typename: 'TweetWithEditControl2027' });
    expect(t?.id).toBe('1790000000000000001');
  });

  it('ignores timeline entries and instructions of unknown types', () => {
    const json = {
      data: {
        x: {
          instructions: [
            null,
            7,
            'TimelineAddEntries',
            { type: 'TimelineTerminateTimeline', direction: 'Top' },
            { type: 'TimelineAddEntries', entries: [null, 3, { entryId: 42 }, { entryId: 'label-1', content: { entryType: 'TimelineTimelineLabel' } }, entry('1', aiTweet, SORT.a), { entryId: 'messageprompt-1', content: { entryType: 'TimelineMessagePrompt', content: {} } }] },
            { type: 'TimelineAddToModule', moduleItems: [null, { item: null }, { item: { itemContent: { tweet_results: { result: cardTweet } } } }] },
            { type: 'TimelinePinEntry', entry: null },
          ],
        },
      },
    };
    const r = parseTimeline(json);
    expect(r.tweets.map((t) => t.tweet.id)).toEqual(['1790000000000000001', '1790000000000000004']);
    checkTimeline(r, 'unknown entries', []);
  });

  it('parses a module page, skipping promoted posts and user modules', () => {
    const r = parseTimeline(modulePage);
    expect(r.tweets.map((t) => t.tweet.id)).toEqual(['1790000000000000001', '1790000000000000003']);
    expect(r.cursorBottom).toBe('REPLACED');
  });

  it('returns an empty result for cursor-only pages', () => {
    const r = parseTimeline(endPage);
    expect(r).toEqual({ tweets: [], cursorBottom: 'B', entryCount: 2 });
    const r2 = parseTimeline({ data: { t: { instructions: [{ entries: [{ entryId: 'cursor-bottom-0', content: { itemContent: { value: 'INNER' } } }] }] } } });
    expect(r2.cursorBottom).toBe('INNER');
  });

  it('parses polls, video variants, articles and unified cards', () => {
    const poll = normalizeTweet(pollTweet)!;
    expect(poll.poll).toEqual({ options: [{ label: 'Tabs', votes: 120 }, { label: 'Spaces', votes: 80 }, { label: 'Both 🙃', votes: 3 }], endsAt: Date.parse('2024-05-22T09:00:00Z') });
    const video = normalizeTweet(videoTweet)!;
    expect(video.media.map((m) => m.type)).toEqual(['video', 'gif']);
    expect(video.media[0]!.videoUrl).toBe('https://video.twimg.com/mid.mp4');
    expect(video.metrics.views).toBe(1200);
    expect(normalizeTweet(articleTweet)!.article).toEqual({ title: 'Why we left the cloud', preview: 'A cost story', cover: 'https://pbs.twimg.com/a.jpg' });
    expect(normalizeTweet(unifiedCardTweet)!.card).toMatchObject({ url: 'https://apps.apple.com/app/id1', title: 'Habit app', domain: 'apps.apple.com' });
  });

  it("keeps X's bookmark folder order (collections are numbered in this order)", () => {
    expect(parseBookmarkFolders(foldersPage)).toEqual([{ id: '1', name: 'Read later' }, { id: '2', name: 'पढ़ना है' }]);
    const many = { data: { items: Array.from({ length: 12 }, (_, i) => ({ __typename: 'BookmarkCollection', id: String(i), name: `F${i}` })) } };
    expect(parseBookmarkFolders(many).map((f) => f.id)).toEqual(Array.from({ length: 12 }, (_, i) => String(i)));
  });

  it('does not blow the stack on very deep payloads', () => {
    let deep: Json = aiTweet;
    for (let i = 0; i < 10_000; i++) deep = { child: deep, list: [deep === aiTweet ? null : 1] };
    expect(() => parseTimeline(deep)).not.toThrow();
    expect(() => collectTweets(deep)).not.toThrow();
    expect(() => parseBookmarkFolders(deep)).not.toThrow();
  });
});
