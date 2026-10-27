/**
 * People who installed an earlier build already have a version-2 database.
 * Opening it with the current schema must keep every row and keep the indexes
 * the app queries working.
 */
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';

const V1 = {
  bookmarks: 'id, savedAt, createdAt, author.handle, category, *tags, *collections, *sources, *facets, starred, archived, read',
  categories: 'id, order',
  collections: 'id, order, xFolderId',
  syncRuns: 'id, startedAt',
};
const V2_BOOKMARKS = 'id, savedAt, createdAt, updatedAt, author.handle, category, [archived+category], *tags, *collections, *sources, *facets, starred, archived, read';

function oldBookmark(i: number) {
  return {
    id: String(1800000000000000000n + BigInt(i)),
    url: `https://x.com/someone/status/${i}`,
    text: `Saved post ${i}`,
    lang: 'en',
    createdAt: 1_700_000_000_000 + i,
    savedAt: 1_700_000_100_000 + i,
    capturedAt: 1_700_000_100_000 + i,
    updatedAt: 1_700_000_100_000 + i,
    author: { id: '1', name: 'Someone', handle: i % 2 ? 'alpha' : 'beta', avatar: '', verified: false },
    media: [],
    links: [],
    hashtags: [],
    mentions: [],
    metrics: { likes: i, retweets: 0, replies: 0, quotes: 0, views: 0, bookmarks: 0 },
    isReply: false,
    isNote: false,
    sources: ['bookmark'],
    category: i % 3 ? 'ai' : 'dev',
    categorySource: 'rule',
    tags: i % 5 ? [] : ['keep'],
    collections: [],
    starred: (i % 7 === 0 ? 1 : 0) as 0 | 1,
    archived: (i % 11 === 0 ? 1 : 0) as 0 | 1,
    read: 0 as 0 | 1,
    note: i === 3 ? 'my note' : '',
    facets: [],
  };
}

describe('database upgrade from version 2', () => {
  it('keeps every bookmark, category, collection and index, and adds the Recall table', async () => {
    const old = new Dexie('twtdash');
    old.version(1).stores(V1);
    old.version(2).stores({ bookmarks: V2_BOOKMARKS });
    await old.open();
    const rows = Array.from({ length: 250 }, (_, i) => oldBookmark(i));
    await old.table('bookmarks').bulkAdd(rows);
    await old.table('categories').bulkAdd([
      { id: 'ai', name: 'AI & ML', emoji: '🤖', color: '#8b5cf6', description: '', keywords: 'llm', builtin: true, enabled: true, order: 0 },
      { id: 'mine', name: 'My category', emoji: '📌', color: '#000', description: '', keywords: '', builtin: false, enabled: true, order: 99 },
    ]);
    await old.table('collections').add({ id: 'c1', name: 'Read later', emoji: '📚', color: '#000', createdAt: 1, order: 0 });
    old.close();

    // The app's database module opens the same IndexedDB with the current schema.
    const { db, ensureCategories } = await import('../db');
    await db.open();
    expect(db.verno).toBeGreaterThanOrEqual(3);
    expect(db.tables.map((t) => t.name)).toContain('recall');
    expect(await db.recall.count()).toBe(0);

    expect(await db.bookmarks.count()).toBe(rows.length);
    const sample = await db.bookmarks.get(rows[3]!.id);
    expect(sample?.note).toBe('my note');
    // Indexes the dashboard relies on still answer correctly.
    expect(await db.bookmarks.where('[archived+category]').equals([0, 'ai']).count()).toBe(rows.filter((b) => !b.archived && b.category === 'ai').length);
    expect(await db.bookmarks.where('author.handle').equals('alpha').count()).toBe(rows.filter((b) => b.author.handle === 'alpha').length);
    expect(await db.bookmarks.where('tags').equals('keep').count()).toBe(rows.filter((b) => b.tags.includes('keep')).length);
    expect(await db.bookmarks.where('updatedAt').above(0).count()).toBe(rows.length);
    expect(await db.collections.get('c1')).toMatchObject({ name: 'Read later' });

    // New built-in categories are added without touching the user's own.
    await ensureCategories();
    const cats = await db.categories.toArray();
    expect(cats.find((c) => c.id === 'mine')).toMatchObject({ name: 'My category', builtin: false });
    expect(cats.find((c) => c.id === 'ai')).toMatchObject({ keywords: 'llm' });
    expect(cats.some((c) => c.id === 'sports')).toBe(true);
    db.close();
  });
});
