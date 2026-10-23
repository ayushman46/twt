import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { bookmarkStore } from '@/lib/library-store';
import { mark, perfStat } from '@/lib/perf';
import { searchIndex } from '@/lib/scan-search';
import type { Bookmark, Category, Collection, Facet } from '@/lib/types';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useCategories, useCollections } from './data';

export interface AuthorStat {
  handle: string;
  name: string;
  avatar: string;
  verified: boolean;
  count: number;
}

export interface LibraryData {
  loading: boolean;
  /** Still streaming the rest of the library in (counts are incomplete). */
  partial: boolean;
  bookmarks: Bookmark[];
  byId: Map<string, Bookmark>;
  categories: Category[];
  categoryMap: Map<string, Category>;
  collections: Collection[];
  collectionMap: Map<string, Collection>;
  counts: {
    all: number;
    unread: number;
    starred: number;
    archived: number;
    likes: number;
    total: number;
    categories: Map<string, number>;
    collections: Map<string, number>;
    facets: Map<Facet, number>;
  };
  tags: Array<[string, number]>;
  authors: AuthorStat[];
}

const Ctx = createContext<LibraryData | null>(null);

function useStoreBookmarks() {
  const snap = useSyncExternalStore(bookmarkStore.subscribe, bookmarkStore.get);
  return { raw: snap.version === 0 ? undefined : snap.list, partial: snap.partial };
}

/** Pre-optimization loader (full-table live query), kept only for A/B benchmarks. */
function useLegacyBookmarks() {
  const raw = useLiveQuery(async () => {
    const t0 = performance.now();
    const list = await db.bookmarks.toArray();
    perfStat('loadAll', performance.now() - t0);
    return list;
  }, []);
  return { raw, partial: false };
}

const useRawBookmarks = (globalThis as { __twtdashLegacyLoad?: boolean }).__twtdashLegacyLoad ? useLegacyBookmarks : useStoreBookmarks;

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { raw, partial } = useRawBookmarks();
  const categories = useCategories();
  const collections = useCollections();

  const value = useMemo<LibraryData>(() => {
    if (raw !== undefined) mark('data:ready');
    const t0 = performance.now();
    const bookmarks = raw ?? [];
    searchIndex.sync(bookmarks);
    const byId = new Map<string, Bookmark>();
    const catCounts = new Map<string, number>();
    const colCounts = new Map<string, number>();
    const facetCounts = new Map<Facet, number>();
    const tagCounts = new Map<string, number>();
    const authorMap = new Map<string, AuthorStat>();
    let unread = 0;
    let starred = 0;
    let archived = 0;
    let likes = 0;
    for (const b of bookmarks) {
      byId.set(b.id, b);
      if (b.starred) starred++;
      for (const c of b.collections) colCounts.set(c, (colCounts.get(c) ?? 0) + 1);
      if (b.archived) {
        archived++;
        continue;
      }
      if (!b.read) unread++;
      if (b.sources.includes('like')) likes++;
      catCounts.set(b.category, (catCounts.get(b.category) ?? 0) + 1);
      for (const f of b.facets) facetCounts.set(f, (facetCounts.get(f) ?? 0) + 1);
      for (const t of b.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
      const key = b.author.handle.toLowerCase();
      const a = authorMap.get(key);
      if (a) a.count++;
      else authorMap.set(key, { handle: b.author.handle, name: b.author.name, avatar: b.author.avatar, verified: b.author.verified, count: 1 });
    }
    const result: LibraryData = {
      loading: raw === undefined,
      partial,
      bookmarks,
      byId,
      categories,
      categoryMap: new Map(categories.map((c) => [c.id, c])),
      collections,
      collectionMap: new Map(collections.map((c) => [c.id, c])),
      counts: {
        all: bookmarks.length - archived,
        unread,
        starred,
        archived,
        likes,
        total: bookmarks.length,
        categories: catCounts,
        collections: colCounts,
        facets: facetCounts,
      },
      tags: [...tagCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
      authors: [...authorMap.values()].sort((a, b) => b.count - a.count),
    };
    if (raw !== undefined) perfStat('derive', performance.now() - t0);
    return result;
  }, [raw, partial, categories, collections]);

  // Build search haystacks in idle time once the library is on screen.
  useEffect(() => {
    if (!value.loading && !value.partial) searchIndex.warm();
  }, [value]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLibrary(): LibraryData {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLibrary must be used inside LibraryProvider');
  return v;
}
