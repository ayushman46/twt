/** Helpers shared by scenario groups. */
import { newPage } from '../lib/browser.mjs';
import { sleep } from '../lib/env.mjs';
import { idbAll, idbPut, openApp, readCount, settle } from '../lib/ui.mjs';

/** New tracked page with the demo library loaded (fresh profiles seed it once). */
export async function demoPage(browser, suite, base, { viewport = 'desktop', theme = 'dark', label, hash = '#/library/all' } = {}) {
  const ctx = suite.track(await newPage(browser, { viewport, theme, label: label ?? `${suite.group}:${theme}/${viewport}` }));
  await openApp(ctx.page, base, { query: 'demo', hash });
  return ctx;
}

/**
 * Make the demo library exercise every scope: a collection, archived posts,
 * posts that are also likes, and a long unbroken word. Reloads the page.
 */
export async function enrichDemo(page) {
  const rows = await idbAll(page, 'bookmarks');
  rows.sort((a, b) => b.savedAt - a.savedAt);
  const now = Date.now();
  const col = { id: 'col_qa_reading', name: 'QA reading list', emoji: '📚', color: '#3B82F6', description: 'Seeded by the QA suite', createdAt: now, order: 0 };
  const touched = [];
  rows.slice(0, 3).forEach((b) => touched.push({ ...b, collections: [...new Set([...(b.collections ?? []), col.id])], updatedAt: now }));
  rows.slice(5, 7).forEach((b) => touched.push({ ...b, archived: 1, updatedAt: now }));
  rows.slice(8, 10).forEach((b) => touched.push({ ...b, sources: [...new Set([...(b.sources ?? []), 'like'])], updatedAt: now }));
  await idbPut(page, 'collections', [col]);
  await idbPut(page, 'bookmarks', touched);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => performance.getEntriesByName('data:complete').length > 0, { timeout: 60_000 });
  await settle(page);
  return { collectionId: col.id };
}

/** Scope values that exist in the current library. */
export async function scopeValues(page) {
  const rows = await idbAll(page, 'bookmarks');
  const live = rows.filter((b) => !b.archived);
  const freq = (fn) => {
    const m = new Map();
    for (const b of live) for (const k of [].concat(fn(b) ?? [])) m.set(k, (m.get(k) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  };
  const cols = await idbAll(page, 'collections');
  return {
    rows,
    category: freq((b) => b.category)[0],
    tag: freq((b) => b.tags)[0],
    author: freq((b) => b.author.handle)[0],
    facet: freq((b) => b.facets).find((f) => ['image', 'video', 'link', 'thread', 'long', 'article'].includes(f)),
    collection: cols[0]?.id,
  };
}

/** Focus the library search box (via "/"), replace its value, wait for results to settle. */
export async function search(page, q) {
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  await page.keyboard.press('/');
  await page.waitForFunction(() => document.activeElement?.tagName === 'INPUT', { timeout: 3000 });
  await page.keyboard.down('Control');
  await page.keyboard.press('a');
  await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  if (q) await page.keyboard.type(q, { delay: 8 });
  return stableCount(page);
}

/** Wait until the count pill stops changing. */
export async function stableCount(page, { timeout = 8000 } = {}) {
  await sleep(120);
  const deadline = Date.now() + timeout;
  let prev = await readCount(page);
  let same = 0;
  while (Date.now() < deadline) {
    await sleep(120);
    const n = await readCount(page);
    if (n === prev && n !== null) {
      if (++same >= 2) return n;
    } else same = 0;
    prev = n;
  }
  return prev;
}

/** Read the "i / n" position shown in the detail panel header. */
export function detailPosition(page) {
  return page.evaluate(() => {
    const h = document.querySelector('aside[role="dialog"] header');
    const m = (h?.textContent ?? '').match(/(\d[\d,]*)\s*\/\s*(\d[\d,]*)/);
    return m ? { i: Number(m[1].replace(/,/g, '')), n: Number(m[2].replace(/,/g, '')) } : null;
  });
}

export const detailOpen = (page) => page.evaluate(() => !!document.querySelector('aside[role="dialog"]'));
