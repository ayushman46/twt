import { format } from 'date-fns';
import { db } from './db';
import type { Bookmark, Category, Collection } from './types';

export interface twtdashBackup {
  app: 'twtdash';
  version: 1;
  exportedAt: string;
  bookmarks: Bookmark[];
  collections: Collection[];
  categories: Category[];
}

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const stamp = () => format(Date.now(), 'yyyy-MM-dd');

export async function exportJson(list?: Bookmark[]) {
  const backup: twtdashBackup = {
    app: 'twtdash',
    version: 1,
    exportedAt: new Date().toISOString(),
    bookmarks: list ?? (await db.bookmarks.toArray()),
    collections: await db.collections.toArray(),
    categories: await db.categories.toArray(),
  };
  download(`twtdash-backup-${stamp()}.json`, JSON.stringify(backup, null, 2), 'application/json');
}

/** Spreadsheet apps run text cells starting with these as formulas (CSV injection). */
const FORMULA_START = /^[=+\-@\t\r]/;

function csvCell(v: unknown): string {
  let s = v === undefined || v === null ? '' : String(v);
  // Post text, names and notes are attacker-controlled: a leading quote makes them inert text.
  if (typeof v === 'string' && FORMULA_START.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function exportCsv(list?: Bookmark[]) {
  const bookmarks = list ?? (await db.bookmarks.toArray());
  const cats = new Map((await db.categories.toArray()).map((c) => [c.id, c.name]));
  const cols = new Map((await db.collections.toArray()).map((c) => [c.id, c.name]));
  const header = ['id', 'url', 'author_name', 'author_handle', 'text', 'posted_at', 'saved_at', 'category', 'tags', 'collections', 'starred', 'read', 'archived', 'note', 'summary', 'likes', 'reposts', 'replies', 'views', 'links', 'media'];
  const rows = bookmarks.map((b) =>
    [
      b.id,
      b.url,
      b.author.name,
      b.author.handle,
      b.text,
      new Date(b.createdAt).toISOString(),
      new Date(b.savedAt).toISOString(),
      cats.get(b.category) ?? b.category,
      b.tags.join('; '),
      b.collections.map((c) => cols.get(c) ?? c).join('; '),
      b.starred,
      b.read,
      b.archived,
      b.note,
      b.summary ?? '',
      b.metrics.likes,
      b.metrics.retweets,
      b.metrics.replies,
      b.metrics.views,
      b.links.map((l) => l.url).join(' '),
      b.media.map((m) => m.url).join(' '),
    ]
      .map(csvCell)
      .join(','),
  );
  // BOM so Excel opens UTF-8 correctly.
  download(`twtdash-${stamp()}.csv`, '﻿' + [header.join(','), ...rows].join('\r\n'), 'text/csv;charset=utf-8');
}

function mdEscape(s: string): string {
  return s.replace(/\r?\n/g, '\n> ');
}

export async function exportMarkdown(list?: Bookmark[]) {
  const bookmarks = (list ?? (await db.bookmarks.toArray())).sort((a, b) => b.savedAt - a.savedAt);
  const categories = (await db.categories.toArray()).sort((a, b) => a.order - b.order);
  const cols = new Map((await db.collections.toArray()).map((c) => [c.id, c.name]));
  const lines: string[] = [`# X bookmarks`, '', `Exported from twtdash on ${format(Date.now(), 'MMMM d, yyyy')} · ${bookmarks.length} posts`, ''];
  for (const cat of categories) {
    const items = bookmarks.filter((b) => b.category === cat.id);
    if (!items.length) continue;
    lines.push(`## ${cat.emoji} ${cat.name} (${items.length})`, '');
    for (const b of items) {
      lines.push(`### ${b.author.name} (@${b.author.handle}) · ${format(b.createdAt, 'MMM d, yyyy')}`, '');
      lines.push(`> ${mdEscape(b.text || '(media)')}`, '');
      if (b.quoted) lines.push(`> **Quoting @${b.quoted.author.handle}:** ${mdEscape(b.quoted.text)}`, '');
      if (b.summary) lines.push(`**Gist:** ${b.summary}`, '');
      const meta: string[] = [`[Open on X](${b.url})`];
      if (b.tags.length) meta.push(b.tags.map((t) => `#${t.replace(/\s+/g, '-')}`).join(' '));
      if (b.collections.length) meta.push(`Collections: ${b.collections.map((c) => cols.get(c) ?? c).join(', ')}`);
      lines.push(meta.join(' · '), '');
      for (const l of b.links) lines.push(`- ${l.url}`);
      if (b.links.length) lines.push('');
      if (b.note.trim()) lines.push(`**Note:** ${b.note.trim()}`, '');
      lines.push('---', '');
    }
  }
  download(`twtdash-${stamp()}.md`, lines.join('\n'), 'text/markdown;charset=utf-8');
}

export interface ImportResult {
  bookmarks: number;
  collections: number;
}

const NOT_A_BACKUP = 'This file is not a twtdash backup.';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const isRow = (v: unknown): v is Row => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStrs = (v: unknown) => Array.isArray(v) && v.every(isStr);
/** A time `Date` can represent (every export formats dates). */
const isTime = (v: unknown) => isNum(v) && Math.abs(v) <= 8.64e15;
const isFlag = (v: unknown) => v === 0 || v === 1;
const METRICS = ['likes', 'retweets', 'replies', 'quotes', 'views', 'bookmarks'];

/** Rows the library can show, search and export; anything else in a file is skipped. */
function isBookmark(b: unknown): b is Bookmark {
  return (
    isRow(b) &&
    isStr(b.id) &&
    b.id !== '' &&
    isStr(b.url) &&
    isStr(b.text) &&
    isStr(b.note) &&
    isStr(b.category) &&
    isRow(b.author) &&
    isStr(b.author.handle) &&
    isStr(b.author.name) &&
    isRow(b.metrics) &&
    METRICS.every((k) => isNum(b.metrics[k])) &&
    isTime(b.createdAt) &&
    isTime(b.savedAt) &&
    Array.isArray(b.media) &&
    Array.isArray(b.links) &&
    isStrs(b.tags) &&
    isStrs(b.collections) &&
    isStrs(b.sources) &&
    isStrs(b.facets) &&
    isFlag(b.starred) &&
    isFlag(b.read) &&
    isFlag(b.archived)
  );
}

const isCollection = (c: unknown): c is Collection => isRow(c) && isStr(c.id) && c.id !== '' && isStr(c.name) && isNum(c.order);
const isCategory = (c: unknown): c is Category => isCollection(c) && isStr((c as Row).keywords);

export async function importJson(file: File): Promise<ImportResult> {
  let data: Row;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error(NOT_A_BACKUP);
  }
  if (!isRow(data) || data.app !== 'twtdash' || !Array.isArray(data.bookmarks)) throw new Error(NOT_A_BACKUP);
  const valid = data.bookmarks.filter(isBookmark);
  if (data.bookmarks.length && !valid.length) throw new Error('None of the posts in this backup could be read.');
  const collections = Array.isArray(data.collections) ? data.collections.filter(isCollection) : [];
  const categories = Array.isArray(data.categories) ? data.categories.filter(isCategory) : [];
  await db.transaction('rw', [db.bookmarks, db.collections, db.categories], async () => {
    const existing = new Map((await db.bookmarks.bulkGet(valid.map((b) => b.id))).filter((b): b is Bookmark => !!b).map((b) => [b.id, b]));
    const now = Date.now();
    const merged = valid.map((b) => {
      const prev = existing.get(b.id);
      if (!prev) return { ...b, updatedAt: now };
      return {
        ...prev,
        ...b,
        tags: [...new Set([...prev.tags, ...b.tags])],
        collections: [...new Set([...prev.collections, ...b.collections])],
        note: b.note || prev.note,
        updatedAt: now,
      };
    });
    await db.bookmarks.bulkPut(merged);
    await db.collections.bulkPut(collections);
    if (categories.length) {
      const have = new Set((await db.categories.toArray()).map((c) => c.id));
      // Keep local edits to built-ins; add custom categories from the backup.
      await db.categories.bulkPut(categories.filter((c) => !have.has(c.id) || !c.builtin));
    }
  });
  return { bookmarks: valid.length, collections: collections.length };
}
