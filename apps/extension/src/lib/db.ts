import Dexie, { type EntityTable } from 'dexie';
import { DEFAULT_CATEGORIES } from '@twtdash/shared';
import type { Bookmark, Category, Collection, RecallCard, SyncRun } from './types';

export class TwtdashDB extends Dexie {
  bookmarks!: EntityTable<Bookmark, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  collections!: EntityTable<Collection, 'id'>;
  syncRuns!: EntityTable<SyncRun, 'id'>;
  recall!: EntityTable<RecallCard, 'id'>;

  constructor() {
    super('twtdash');
    this.version(1).stores({
      bookmarks: 'id, savedAt, createdAt, author.handle, category, *tags, *collections, *sources, *facets, starred, archived, read',
      categories: 'id, order',
      collections: 'id, order, xFolderId',
      syncRuns: 'id, startedAt',
    });
    // v2: `updatedAt` powers incremental live updates; [archived+category] gives index-only counts.
    this.version(2).stores({
      bookmarks: 'id, savedAt, createdAt, updatedAt, author.handle, category, [archived+category], *tags, *collections, *sources, *facets, starred, archived, read',
    });
    // v3: spaced-repetition state for Recall, kept apart from bookmarks so reviews never touch library rows.
    this.version(3).stores({
      recall: 'id, due, state',
    });
  }
}

export const db = new TwtdashDB();

export function defaultCategories(): Category[] {
  return DEFAULT_CATEGORIES.map((c, i) => ({
    id: c.id,
    name: c.name,
    emoji: c.emoji,
    color: c.color,
    description: c.description,
    keywords: '',
    builtin: true,
    enabled: true,
    order: i,
  }));
}

/** Seed built-in categories and add any that shipped in a newer version. */
export async function ensureCategories(): Promise<void> {
  const existing = await db.categories.toArray();
  const have = new Set(existing.map((c) => c.id));
  const missing = defaultCategories().filter((c) => !have.has(c.id));
  if (missing.length) await db.categories.bulkAdd(missing);
}

export function uid(prefix = ''): string {
  const rnd = crypto.getRandomValues(new Uint32Array(2));
  return prefix + Date.now().toString(36) + rnd[0]!.toString(36) + rnd[1]!.toString(36).slice(0, 4);
}
