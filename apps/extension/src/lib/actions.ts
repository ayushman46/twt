/** Library mutations used by the dashboard. Every change bumps `updatedAt`. */
import { FALLBACK_CATEGORY_ID } from '@twtdash/shared';
import { db, uid } from './db';
import { invalidateCategories } from './ingest';
import type { Bookmark, Category, Collection } from './types';

async function modify(ids: string[], fn: (b: Bookmark) => void) {
  if (!ids.length) return;
  const now = Date.now();
  await db.bookmarks
    .where('id')
    .anyOf(ids)
    .modify((b) => {
      fn(b);
      b.updatedAt = now;
    });
}

export const setStarred = (ids: string[], starred: boolean) => modify(ids, (b) => void (b.starred = starred ? 1 : 0));
export const setArchived = (ids: string[], archived: boolean) => modify(ids, (b) => void (b.archived = archived ? 1 : 0));
export const setRead = (ids: string[], read: boolean) => modify(ids, (b) => void (b.read = read ? 1 : 0));

export const setCategory = (ids: string[], category: string) =>
  modify(ids, (b) => {
    b.category = category;
    b.categorySource = 'user';
  });

export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase().replace(/^#+/, '').replace(/\s+/g, ' ').slice(0, 40);
}

export const addTags = (ids: string[], tags: string[]) => {
  const clean = tags.map(normalizeTag).filter(Boolean);
  return modify(ids, (b) => {
    b.tags = [...new Set([...b.tags, ...clean])];
  });
};

export const removeTag = (ids: string[], tag: string) => modify(ids, (b) => void (b.tags = b.tags.filter((t) => t !== tag)));

export const addToCollection = (ids: string[], collectionId: string) =>
  modify(ids, (b) => {
    if (!b.collections.includes(collectionId)) b.collections = [...b.collections, collectionId];
  });

export const removeFromCollection = (ids: string[], collectionId: string) =>
  modify(ids, (b) => void (b.collections = b.collections.filter((c) => c !== collectionId)));

export async function setNote(id: string, note: string) {
  await db.bookmarks.update(id, { note, updatedAt: Date.now() });
}

export async function deleteBookmarks(ids: string[]): Promise<Bookmark[]> {
  const removed = (await db.bookmarks.bulkGet(ids)).filter((b): b is Bookmark => !!b);
  await db.bookmarks.bulkDelete(ids);
  return removed;
}

export async function restoreBookmarks(list: Bookmark[]) {
  await db.bookmarks.bulkPut(list);
}

export async function renameTag(from: string, to: string) {
  const target = normalizeTag(to);
  const list = await db.bookmarks.where('tags').equals(from).toArray();
  await modify(
    list.map((b) => b.id),
    (b) => void (b.tags = [...new Set(b.tags.map((t) => (t === from ? target : t)).filter(Boolean))]),
  );
}

export async function deleteTag(tag: string) {
  const list = await db.bookmarks.where('tags').equals(tag).toArray();
  await removeTag(
    list.map((b) => b.id),
    tag,
  );
}

// Collections

export const COLLECTION_COLORS = ['#7C5CFF', '#3B82F6', '#06B6D4', '#10B981', '#84CC16', '#EAB308', '#F97316', '#EF4444', '#EC4899', '#A855F7', '#64748B'];

export async function createCollection(input: Pick<Collection, 'name' | 'emoji' | 'color'> & { description?: string }): Promise<Collection> {
  const order = await db.collections.count();
  const col: Collection = { id: uid('col_'), createdAt: Date.now(), order, ...input, name: input.name.trim() || 'Untitled' };
  await db.collections.add(col);
  return col;
}

export async function updateCollection(id: string, patch: Partial<Collection>) {
  await db.collections.update(id, patch);
}

export async function deleteCollection(id: string) {
  await db.transaction('rw', db.collections, db.bookmarks, async () => {
    await db.collections.delete(id);
    const list = await db.bookmarks.where('collections').equals(id).toArray();
    await removeFromCollection(
      list.map((b) => b.id),
      id,
    );
  });
}

// Categories

export async function updateCategory(id: string, patch: Partial<Category>) {
  await db.categories.update(id, patch);
  invalidateCategories();
}

export async function createCategory(input: Pick<Category, 'name' | 'emoji' | 'color' | 'keywords'> & { description?: string }): Promise<Category> {
  const order = (await db.categories.count()) - 1;
  const cat: Category = {
    id: uid('cat_'),
    description: input.description ?? `Posts about ${input.name}.`,
    builtin: false,
    enabled: true,
    order,
    ...input,
  };
  await db.categories.add(cat);
  // Keep "Other" last.
  await db.categories.update(FALLBACK_CATEGORY_ID, { order: order + 1 });
  invalidateCategories();
  return cat;
}

export async function deleteCategory(id: string) {
  if (id === FALLBACK_CATEGORY_ID) return;
  await db.transaction('rw', db.categories, db.bookmarks, async () => {
    await db.categories.delete(id);
    await db.bookmarks
      .where('category')
      .equals(id)
      .modify((b) => {
        b.category = FALLBACK_CATEGORY_ID;
        b.categorySource = 'rule';
        b.updatedAt = Date.now();
      });
  });
  invalidateCategories();
}

export async function wipeLibrary() {
  await db.transaction('rw', [db.bookmarks, db.collections, db.syncRuns], async () => {
    await db.bookmarks.clear();
    await db.collections.clear();
    await db.syncRuns.clear();
  });
}
