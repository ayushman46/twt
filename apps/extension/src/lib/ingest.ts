/**
 * Writes captured posts into the library: merges fresh X data with the
 * user's own fields, keeps bookmark order, and auto-categorizes new posts.
 */
import { FALLBACK_CATEGORY_ID } from '@twtdash/shared';
import { classifyTweet, compileCategories, inferFromAuthor } from './classify';
import { db } from './db';
import { computeFacets } from './facets';
import { bookmarkTimeFromSortIndex, type TimelineTweet } from './parse';
import type { Bookmark, Category, Source, TweetData } from './types';
import type { IngestSummary } from './messages';

/**
 * Timeline pages arrive newest → oldest. When X doesn't expose a bookmark
 * time, we hand out descending timestamps so library order matches X.
 */
const orderCursor: Record<Source, { t: number; at: number }> = {
  bookmark: { t: 0, at: 0 },
  like: { t: 0, at: 0 },
};

export function resetOrderCursor(source: Source) {
  orderCursor[source] = { t: Date.now(), at: Date.now() };
}

function cursorFor(source: Source) {
  const c = orderCursor[source];
  // A cursor older than 10 minutes belongs to a previous browsing session.
  if (!c.t || Date.now() - c.at > 10 * 60_000) resetOrderCursor(source);
  return orderCursor[source];
}

/**
 * Next timestamp in timeline order: the known bookmark time when X exposes
 * one, but always strictly below the previous post so X's order wins ties.
 */
function nextOrderTime(source: Source, known?: number): number {
  const c = cursorFor(source);
  c.t = Math.min(known ?? c.t - 1, c.t - 1);
  c.at = Date.now();
  return c.t;
}

/** An already-saved post was seen in the timeline: later posts sort below it. */
function observeOrderTime(source: Source, t: number) {
  const c = cursorFor(source);
  c.t = Math.min(c.t, t);
  c.at = Date.now();
}

let categoriesCache: { at: number; list: Category[] } | null = null;

export async function loadCategories(): Promise<Category[]> {
  if (categoriesCache && Date.now() - categoriesCache.at < 5_000) return categoriesCache.list;
  const list = await db.categories.toArray();
  categoriesCache = { at: Date.now(), list };
  return list;
}

export function invalidateCategories() {
  categoriesCache = null;
}

function tweetFields(t: TweetData): TweetData {
  return {
    id: t.id,
    url: t.url,
    text: t.text,
    lang: t.lang,
    createdAt: t.createdAt,
    author: t.author,
    media: t.media,
    links: t.links,
    hashtags: t.hashtags,
    mentions: t.mentions,
    card: t.card,
    poll: t.poll,
    quoted: t.quoted,
    article: t.article,
    metrics: t.metrics,
    isReply: t.isReply,
    replyTo: t.replyTo,
    conversationId: t.conversationId,
    isNote: t.isNote,
  };
}

/** Same stored data, ignoring `updatedAt` (a field set to `undefined` counts as absent). */
function sameData(a: unknown, b: unknown, top = true): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const x = a as Record<string, unknown>;
  const y = b as Record<string, unknown>;
  const keys = (o: Record<string, unknown>) => Object.keys(o).filter((k) => o[k] !== undefined && !(top && k === 'updatedAt'));
  const kx = keys(x);
  return kx.length === keys(y).length && kx.every((k) => sameData(x[k], y[k], false));
}

interface IngestOptions {
  source: Source;
  partial?: boolean;
  collectionId?: string;
  /** Real-time capture: the post was saved just now. */
  savedNow?: boolean;
}

export async function ingestTweets(items: TimelineTweet[], opts: IngestOptions): Promise<IngestSummary & { addedIds: string[] }> {
  // De-duplicate within the batch, keep first occurrence.
  const seen = new Set<string>();
  const unique = items.filter((i) => (seen.has(i.tweet.id) ? false : (seen.add(i.tweet.id), true)));
  if (!unique.length) return { count: 0, added: 0, updated: 0, addedIds: [] };

  const categories = await loadCategories();
  const compiled = compileCategories(categories);
  const now = Date.now();
  const existing = await db.bookmarks.bulkGet(unique.map((i) => i.tweet.id));
  const toPut: Bookmark[] = [];
  const addedIds: string[] = [];
  let updated = 0;

  const exactTimes = unique.map(({ tweet, sortIndex }) => (opts.source === 'bookmark' || opts.source === 'like' ? bookmarkTimeFromSortIndex(sortIndex, tweet.createdAt) : undefined));
  // Pages continue downwards, so a batch starting above the cursor is a fresh read
  // (X refetched the top, or another folder): restart, or known times would drift down.
  const newest = exactTimes.find((t) => t !== undefined);
  if (!opts.savedNow && newest !== undefined && newest >= cursorFor(opts.source).t) resetOrderCursor(opts.source);

  unique.forEach(({ tweet, sortIndex }, idx) => {
    const prev = existing[idx];
    const exactTime = exactTimes[idx];
    const fields = tweetFields(tweet);
    const facets = computeFacets(tweet);

    if (prev) {
      // Keep the stored copy when the incoming one is a lower-fidelity DOM scrape.
      const base = opts.partial && !prev.partial ? prev : { ...prev, ...fields };
      const hadSource = prev.sources.includes(opts.source);
      const sources = hadSource ? prev.sources : [...prev.sources, opts.source];
      let savedAt = prev.savedAt;
      if (opts.savedNow) {
        if (!hadSource) savedAt = now;
      } else if (exactTime !== undefined) {
        savedAt = nextOrderTime(opts.source, exactTime);
      } else if (hadSource) {
        observeOrderTime(opts.source, prev.savedAt);
      } else {
        savedAt = nextOrderTime(opts.source);
      }
      const next: Bookmark = {
        ...base,
        sources,
        facets: opts.partial && !prev.partial ? prev.facets : facets,
        sortIndex: sortIndex ?? prev.sortIndex,
        savedAt,
        partial: opts.partial ? prev.partial : undefined,
        collections: opts.collectionId && !prev.collections.includes(opts.collectionId) ? [...prev.collections, opts.collectionId] : prev.collections,
        updatedAt: now,
      };
      if ((prev.categorySource === 'rule' || prev.categorySource === 'author' || prev.partial) && !opts.partial) {
        const c = classifyTweet(next, compiled);
        if (c.category !== FALLBACK_CATEGORY_ID || prev.categorySource === 'rule') {
          next.category = c.category;
          next.categorySource = 'rule';
        }
      }
      // A re-read with nothing new keeps updatedAt, so live views and search caches stay put.
      if (sameData(next, prev)) next.updatedAt = prev.updatedAt;
      toPut.push(next);
      updated++;
      return;
    }

    const c = classifyTweet(tweet, compiled);
    const savedAt = opts.savedNow ? now : nextOrderTime(opts.source, exactTime);
    toPut.push({
      ...fields,
      sources: [opts.source],
      savedAt,
      capturedAt: now,
      updatedAt: now,
      sortIndex,
      category: c.category,
      categorySource: 'rule',
      tags: [],
      collections: opts.collectionId ? [opts.collectionId] : [],
      starred: 0,
      archived: 0,
      read: 0,
      note: '',
      facets,
      partial: opts.partial || undefined,
    });
    addedIds.push(tweet.id);
  });

  await db.bookmarks.bulkPut(toPut);

  // Author affinity pass for anything still uncategorized.
  const uncategorized = toPut.filter((b) => b.category === FALLBACK_CATEGORY_ID && b.categorySource === 'rule');
  if (uncategorized.length) {
    const byAuthor = new Map<string, Bookmark[]>();
    for (const b of uncategorized) {
      const list = byAuthor.get(b.author.handle) ?? [];
      list.push(b);
      byAuthor.set(b.author.handle, list);
    }
    const changes: Bookmark[] = [];
    for (const [handle, list] of byAuthor) {
      if (!handle) continue;
      const others = await db.bookmarks.where('author.handle').equals(handle).toArray();
      for (const b of list) {
        const inferred = inferFromAuthor(others, b.id);
        if (inferred) changes.push({ ...b, category: inferred, categorySource: 'author', updatedAt: now });
      }
    }
    if (changes.length) await db.bookmarks.bulkPut(changes);
  }

  return { count: unique.length, added: addedIds.length, updated, addedIds };
}

/** Remove a source from a post (un-bookmark / un-like on X). */
export async function removeSource(tweetId: string, source: Source, mirrorDeletions: boolean): Promise<void> {
  const b = await db.bookmarks.get(tweetId);
  if (!b) return;
  const sources = b.sources.filter((s) => s !== source);
  if (!sources.length && mirrorDeletions) {
    await db.bookmarks.delete(tweetId);
    return;
  }
  if (sources.length !== b.sources.length) await db.bookmarks.update(tweetId, { sources, updatedAt: Date.now() });
}

/** Re-run the rule engine over the library (after editing categories). */
export async function recategorizeAll(keepAi: boolean): Promise<number> {
  invalidateCategories();
  const compiled = compileCategories(await loadCategories());
  const all = await db.bookmarks.toArray();
  const changes: Bookmark[] = [];
  const now = Date.now();
  for (const b of all) {
    if (b.categorySource === 'user') continue;
    if (keepAi && b.categorySource === 'ai') continue;
    const c = classifyTweet(b, compiled);
    if (c.category !== b.category || b.categorySource !== 'rule') changes.push({ ...b, category: c.category, categorySource: 'rule', updatedAt: now });
  }
  // Second pass: author affinity using the updated picture.
  const merged = new Map(all.map((b) => [b.id, b]));
  for (const c of changes) merged.set(c.id, c);
  const byAuthor = new Map<string, Bookmark[]>();
  for (const b of merged.values()) {
    const list = byAuthor.get(b.author.handle) ?? [];
    list.push(b);
    byAuthor.set(b.author.handle, list);
  }
  const final = new Map(changes.map((c) => [c.id, c]));
  for (const b of merged.values()) {
    if (b.category !== FALLBACK_CATEGORY_ID || b.categorySource !== 'rule') continue;
    const inferred = inferFromAuthor(byAuthor.get(b.author.handle) ?? [], b.id);
    if (inferred) final.set(b.id, { ...b, category: inferred, categorySource: 'author', updatedAt: now });
  }
  const list = [...final.values()];
  for (let i = 0; i < list.length; i += 500) await db.bookmarks.bulkPut(list.slice(i, i + 500));
  return list.length;
}
