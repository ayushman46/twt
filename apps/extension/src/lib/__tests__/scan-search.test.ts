import { describe, expect, it } from 'vitest';
import { SearchIndex, tokenize } from '../scan-search';
import type { Bookmark } from '../types';

function bm(id: string, text: string, extra: Partial<Bookmark> = {}): Bookmark {
  return {
    id,
    url: '',
    text,
    lang: 'en',
    createdAt: 0,
    author: { id: '1', name: 'Maya Chen', handle: 'mayabuilds', avatar: '', verified: false },
    media: [],
    links: [],
    hashtags: [],
    mentions: [],
    metrics: { likes: 0, retweets: 0, replies: 0, quotes: 0, views: 0, bookmarks: 0 },
    isReply: false,
    isNote: false,
    sources: ['bookmark'],
    savedAt: 0,
    capturedAt: 0,
    updatedAt: 1,
    category: 'other',
    categorySource: 'rule',
    tags: [],
    collections: [],
    starred: 0,
    archived: 0,
    read: 0,
    note: '',
    facets: [],
    ...extra,
  };
}

describe('scan search', () => {
  const idx = new SearchIndex();
  idx.sync([
    bm('a', 'Design systems are a product, not a project'),
    bm('b', 'The redesign shipped today'),
    bm('c', 'Typography rules for interfaces', { tags: ['design'] }),
    bm('d', 'Unrelated post about sleep', { note: 'great design notes' }),
    bm('e', 'Cooking pasta', { author: { id: '2', name: 'Design Daily', handle: 'designdaily', avatar: '', verified: false } }),
  ]);

  it('finds whole words, prefixes, substrings, tags, notes and authors', () => {
    const r = idx.search('design');
    expect([...r.keys()].sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('ranks author and whole-word matches above in-word matches', () => {
    const r = idx.search('design');
    expect(r.get('e')!).toBeGreaterThan(r.get('b')!);
    expect(r.get('a')!).toBeGreaterThan(r.get('b')!);
  });

  it('requires every term (AND) and falls back to OR', () => {
    expect([...idx.search('design product').keys()]).toEqual(['a']);
    expect(idx.search('pasta typography').size).toBe(2);
  });

  it('picks up edits via updatedAt', () => {
    const list = [bm('x', 'first version')];
    const i2 = new SearchIndex();
    i2.sync(list);
    expect(i2.search('version').size).toBe(1);
    i2.sync([bm('x', 'renamed entirely', { updatedAt: 2 })]);
    expect(i2.search('version').size).toBe(0);
    expect(i2.search('renamed').size).toBe(1);
  });

  it('tokenizes punctuation away but keeps handles and hashtags', () => {
    expect(tokenize('  "Design", #react @maya!  ')).toEqual(['design', '#react', '@maya']);
  });
});
