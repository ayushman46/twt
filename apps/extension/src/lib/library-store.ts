/**
 * In-memory mirror of the bookmarks table.
 *
 * Before: a live `toArray()` re-read and re-deserialized the whole table on
 * every change (a star on one post cost a full 10k-row read). Now:
 *  1. the newest posts load first so the first screen paints immediately,
 *  2. the rest streams in small pages that yield to the UI,
 *  3. afterwards only rows changed since the last read (via the `updatedAt`
 *     index) are fetched; deletions are reconciled from primary keys.
 */
import { liveQuery, type Subscription } from 'dexie';
import { db } from './db';
import { mark, perfStat } from './perf';
import type { Bookmark } from './types';

export interface StoreSnapshot {
  list: Bookmark[];
  /** True until the full library has been read. */
  partial: boolean;
  version: number;
}

const FIRST_SLICE = 150;
const PAGE = 400;
const yieldToUi = () => new Promise<void>((r) => setTimeout(r, 0));

class BookmarkStore {
  private map = new Map<string, Bookmark>();
  private snapshot: StoreSnapshot = { list: [], partial: true, version: 0 };
  private listeners = new Set<() => void>();
  private started = false;
  private loaded = false;
  private cursor = 0;
  private subs: Subscription[] = [];

  get = (): StoreSnapshot => this.snapshot;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    void this.start();
    return () => {
      this.listeners.delete(fn);
    };
  };

  private emit(partial: boolean) {
    this.snapshot = { list: Array.from(this.map.values()), partial, version: this.snapshot.version + 1 };
    for (const l of this.listeners) l();
  }

  private absorb(rows: Bookmark[]) {
    for (const b of rows) {
      this.map.set(b.id, b);
      if (b.updatedAt > this.cursor) this.cursor = b.updatedAt;
    }
  }

  private async start() {
    if (this.started) return;
    this.started = true;
    (globalThis as { __twtdashProgressive?: boolean }).__twtdashProgressive = true;
    const t0 = performance.now();

    const first = await db.bookmarks.orderBy('savedAt').reverse().limit(FIRST_SLICE).toArray();
    this.absorb(first);
    perfStat('loadFirst', performance.now() - t0);
    const total = await db.bookmarks.count();
    this.emit(total > first.length);
    if (total > first.length) {
      let last: string | undefined;
      for (;;) {
        await yieldToUi();
        const page = last === undefined ? await db.bookmarks.orderBy(':id').limit(PAGE).toArray() : await db.bookmarks.where(':id').above(last).limit(PAGE).toArray();
        this.absorb(page);
        if (page.length < PAGE) break;
        last = page[page.length - 1]!.id;
      }
      this.emit(false);
    }
    this.loaded = true;
    perfStat('loadAll', performance.now() - t0);
    mark('data:complete');

    this.subs.push(
      liveQuery(() => db.bookmarks.where('updatedAt').aboveOrEqual(this.cursor).toArray()).subscribe({
        next: (rows) => this.applyChanges(rows),
        error: (e) => console.error('[twtdash] live updates failed', e),
      }),
      liveQuery(() => db.bookmarks.count()).subscribe({
        next: (n) => void this.reconcile(n),
        error: (e) => console.error('[twtdash] live count failed', e),
      }),
    );
  }

  private applyChanges(rows: Bookmark[]) {
    let changed = false;
    for (const b of rows) {
      const prev = this.map.get(b.id);
      if (prev && prev.updatedAt === b.updatedAt && JSON.stringify(prev) === JSON.stringify(b)) continue;
      changed = true;
      this.map.set(b.id, b);
      if (b.updatedAt > this.cursor) this.cursor = b.updatedAt;
    }
    if (changed) this.emit(false);
  }

  /** Row count changed without an `updatedAt` bump (delete, restore, clear). */
  private async reconcile(count: number) {
    if (!this.loaded || count === this.map.size) return;
    const keys = new Set(await db.bookmarks.toCollection().primaryKeys());
    let changed = false;
    for (const id of [...this.map.keys()]) {
      if (!keys.has(id)) {
        this.map.delete(id);
        changed = true;
      }
    }
    const missing = [...keys].filter((k) => !this.map.has(k));
    if (missing.length) {
      this.absorb((await db.bookmarks.bulkGet(missing)).filter((b): b is Bookmark => !!b));
      changed = true;
    }
    if (changed) this.emit(false);
  }
}

export const bookmarkStore = new BookmarkStore();
