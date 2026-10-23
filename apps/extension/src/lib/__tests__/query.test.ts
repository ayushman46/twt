import { describe, expect, it } from 'vitest';
import { applyOperators, isEmptyQuery, matchesScope, parseQuery } from '../query';
import type { Bookmark } from '../types';
import { defaultCategories } from '../db';

function bm(id: string, patch: Partial<Bookmark> = {}): Bookmark {
  return {
    id,
    url: '',
    text: 'hello world',
    lang: 'en',
    createdAt: Date.UTC(2025, 0, 10),
    author: { id: '1', name: 'Paul', handle: 'paulg', avatar: '', verified: false },
    media: [],
    links: [],
    hashtags: [],
    mentions: [],
    metrics: { likes: 10, retweets: 0, replies: 0, quotes: 0, views: 0, bookmarks: 0 },
    isReply: false,
    isNote: false,
    sources: ['bookmark'],
    savedAt: 1,
    capturedAt: 1,
    updatedAt: 1,
    category: 'startups',
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

const ctx = { categories: defaultCategories(), collections: [{ id: 'c1', name: 'Read later', emoji: '📌', color: '', createdAt: 0, order: 0 }] };

describe('parseQuery', () => {
  it('splits operators from free text', () => {
    const q = parseQuery('react hooks from:@dan_abramov has:video -crypto "server components" min_likes:1.5k in:"read later"');
    expect(q.text).toBe('react hooks');
    expect(q.from).toEqual(['dan_abramov']);
    expect(q.has).toEqual(['video']);
    expect(q.exclude).toEqual(['crypto']);
    expect(q.phrases).toEqual(['server components']);
    expect(q.minLikes).toBe(1500);
    expect(q.collections).toEqual(['read later']);
    expect(q.highlight).toEqual(['react', 'hooks', 'server components']);
  });

  it('parses relative and absolute dates', () => {
    const q = parseQuery('after:7d before:2025-01-01');
    expect(q.after).toBeGreaterThan(Date.now() - 8 * 86_400_000);
    expect(q.before).toBe(Date.parse('2025-01-01'));
  });

  it('detects empty queries', () => {
    expect(isEmptyQuery(parseQuery('   '))).toBe(true);
    expect(isEmptyQuery(parseQuery('is:starred'))).toBe(false);
  });
});

describe('applyOperators', () => {
  const list = [
    bm('a', { author: { id: '1', name: 'Paul', handle: 'paulg', avatar: '', verified: false }, facets: ['video', 'media'], metrics: { likes: 5000, retweets: 0, replies: 0, quotes: 0, views: 0, bookmarks: 0 } }),
    bm('b', { category: 'ai', tags: ['llm'], text: 'crypto is back', collections: ['c1'] }),
    bm('c', { category: 'design', starred: 1, links: [{ url: 'https://github.com/a', display: '', domain: 'github.com' }], note: 'great repo' }),
  ];
  const ids = (q: string) => applyOperators(list, parseQuery(q), ctx).map((b) => b.id);

  it('filters by author, facets, likes', () => {
    expect(ids('from:paulg has:video min_likes:1k')).toEqual(['a']);
  });
  it('filters by category id or name prefix, and tags', () => {
    expect(ids('cat:ai')).toEqual(['b']);
    expect(ids('cat:design')).toEqual(['c']);
    expect(ids('tag:ll')).toEqual(['b']);
  });
  it('filters by collection name, domain, notes and state', () => {
    expect(ids('in:"read later"')).toEqual(['b']);
    expect(ids('domain:github.com')).toEqual(['c']);
    expect(ids('has:note is:starred')).toEqual(['c']);
  });
  it('excludes words and unknown collections', () => {
    expect(ids('-crypto')).toEqual(['a', 'c']);
    expect(ids('in:nope')).toEqual([]);
  });
});

describe('matchesScope', () => {
  it('hides archived posts from regular views', () => {
    const archived = bm('x', { archived: 1 });
    expect(matchesScope(archived, { kind: 'all' })).toBe(false);
    expect(matchesScope(archived, { kind: 'archived' })).toBe(true);
  });
});
