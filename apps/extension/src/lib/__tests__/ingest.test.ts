import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, ensureCategories } from '../db';
import { ingestTweets, recategorizeAll, removeSource, resetOrderCursor } from '../ingest';
import { normalizeTweet, parseTimeline } from '../parse';
import { bookmarksPage, cardTweet } from './fixtures';

beforeEach(async () => {
  await db.bookmarks.clear();
  await db.categories.clear();
  await ensureCategories();
  resetOrderCursor('bookmark');
});

describe('ingestTweets', () => {
  it('adds new posts with categories, facets and bookmark-time ordering', async () => {
    const page = parseTimeline(bookmarksPage);
    const res = await ingestTweets(page.tweets, { source: 'bookmark' });
    expect(res).toMatchObject({ count: 4, added: 4, updated: 0 });

    const all = await db.bookmarks.orderBy('savedAt').reverse().toArray();
    expect(all.map((b) => b.id)).toEqual(page.tweets.map((t) => t.tweet.id));
    const ai = await db.bookmarks.get('1790000000000000001');
    expect(ai).toMatchObject({ category: 'ai', categorySource: 'rule', read: 0, starred: 0, sources: ['bookmark'] });
    expect(ai!.facets).toEqual(expect.arrayContaining(['media', 'image', 'link']));
  });

  it('merges fresh data without losing the user’s organization', async () => {
    const t = normalizeTweet(cardTweet)!;
    await ingestTweets([{ tweet: t }], { source: 'bookmark' });
    await db.bookmarks.update(t.id, { tags: ['fonts'], note: 'use in redesign', category: 'learning', categorySource: 'user', starred: 1 });

    const fresher = { ...t, metrics: { ...t.metrics, likes: 999 } };
    const res = await ingestTweets([{ tweet: fresher }], { source: 'like' });
    expect(res).toMatchObject({ added: 0, updated: 1 });
    const b = await db.bookmarks.get(t.id);
    expect(b).toMatchObject({ tags: ['fonts'], note: 'use in redesign', category: 'learning', categorySource: 'user', starred: 1 });
    expect(b!.metrics.likes).toBe(999);
    expect(b!.sources).toEqual(['bookmark', 'like']);
  });

  it('does not let a partial DOM capture overwrite full data', async () => {
    const t = normalizeTweet(cardTweet)!;
    await ingestTweets([{ tweet: t }], { source: 'bookmark' });
    await ingestTweets([{ tweet: { ...t, text: 'scraped', card: undefined } }], { source: 'bookmark', partial: true });
    const b = await db.bookmarks.get(t.id);
    expect(b!.text).toBe(t.text);
    expect(b!.card).toBeDefined();
  });

  it('removes posts un-bookmarked on X when mirroring is on', async () => {
    const t = normalizeTweet(cardTweet)!;
    await ingestTweets([{ tweet: t }], { source: 'bookmark' });
    await removeSource(t.id, 'bookmark', false);
    expect(await db.bookmarks.get(t.id)).toBeDefined();
    await removeSource(t.id, 'bookmark', true);
    expect(await db.bookmarks.get(t.id)).toBeUndefined();
  });

  it('re-sorts the library but keeps manual choices', async () => {
    const page = parseTimeline(bookmarksPage);
    await ingestTweets(page.tweets, { source: 'bookmark' });
    await db.bookmarks.update('1790000000000000001', { category: 'humor', categorySource: 'user' });
    await db.bookmarks.update('1790000000000000004', { category: 'news', categorySource: 'rule' });
    await recategorizeAll(true);
    expect((await db.bookmarks.get('1790000000000000001'))!.category).toBe('humor');
    expect((await db.bookmarks.get('1790000000000000004'))!.category).toBe('design');
  });
});
