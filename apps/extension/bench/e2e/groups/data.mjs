/**
 * Own-your-data flows: export Markdown / CSV / JSON from Settings → Data and
 * check each file against IndexedDB, then re-import the JSON backup and make
 * sure the merge neither loses nor duplicates posts.
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { launch, newPage, allowDownloads } from '../lib/browser.mjs';
import { SCRATCH } from '../lib/env.mjs';
import { assert, assertEq, parseCsv } from '../lib/oracle.mjs';
import { idbAll, openApp, setHash } from '../lib/ui.mjs';

export const name = 'data';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Wait for a finished download whose name matches `re` (Chrome writes *.crdownload first). */
async function waitFile(dir, re, timeout = 15_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const hit = readdirSync(dir).find((f) => re.test(f) && !f.endsWith('.crdownload'));
    if (hit && statSync(join(dir, hit)).size > 0) return join(dir, hit);
    await sleep(150);
  }
  throw new Error(`no download matching ${re} in ${dir}`);
}

/** Click a Settings → Data export button (`data-export="md|csv|json"`). */
async function clickDataButton(page, kind) {
  const ok = await page.evaluate((k) => {
    const btn = document.querySelector(`main button[data-export="${k}"]`);
    btn?.click();
    return !!btn;
  }, kind);
  assert(ok, `no Settings → Data export button for ${kind}`);
}

export async function run({ base, suite }) {
  const dir = join(SCRATCH, `downloads-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const { browser, close } = await launch('data');
  try {
    const ctx = suite.track(await newPage(browser, { label: 'data' }));
    const { page } = ctx;
    await allowDownloads(page, dir);
    let rows = [];

    await suite.check('demo library loads for export', async () => {
      await openApp(page, base, { query: 'demo', hash: '#/settings/data' });
      rows = await idbAll(page, 'bookmarks');
      assert(rows.length >= 20, `expected a demo library, got ${rows.length} posts`);
      return { data: { posts: rows.length } };
    });

    await suite.check('JSON backup contains every post', async () => {
      await setHash(page, '#/settings/data');
      await clickDataButton(page, 'json');
      const file = await waitFile(dir, /\.json$/);
      const data = JSON.parse(readFileSync(file, 'utf8'));
      const list = Array.isArray(data) ? data : (data.bookmarks ?? data.posts ?? []);
      assertEq(list.length, rows.length, 'posts in the JSON backup');
      const ids = new Set(list.map((b) => b.id));
      assert(rows.every((b) => ids.has(b.id)), 'a stored post is missing from the backup');
      return { data: { bytes: statSync(file).size } };
    });

    await suite.check('CSV export has a header and one row per post', async () => {
      await clickDataButton(page, 'csv');
      const file = await waitFile(dir, /\.csv$/);
      const text = readFileSync(file, 'utf8').replace(/^﻿/, '');
      const table = parseCsv(text);
      assert(table.length >= 2, 'CSV has no rows');
      const header = table[0].map((h) => h.toLowerCase());
      assert(header.some((h) => /url|link/.test(h)), `CSV header lacks a URL column: ${header.join(', ')}`);
      const body = table.slice(1).filter((r) => r.some((c) => c.trim()));
      assert(body.length >= rows.filter((b) => !b.archived).length, `CSV rows ${body.length} < live posts`);
      return { data: { rows: body.length } };
    });

    await suite.check('Markdown export is grouped and links to the posts', async () => {
      await clickDataButton(page, 'md');
      const file = await waitFile(dir, /\.md$/);
      const md = readFileSync(file, 'utf8');
      assert(/^#\s+\S/m.test(md), 'Markdown has no title heading');
      assert(/^##\s+\S/m.test(md), 'Markdown has no category sections');
      // Every post links to its own URL (sample posts use example.com, real ones x.com).
      const linked = rows.filter((b) => md.includes(`](${b.url})`)).length;
      assert(linked >= Math.min(10, rows.length), `only ${linked} post links in the Markdown`);
      return { data: { links: linked } };
    });

    await suite.check('re-importing the JSON backup merges without duplicates', async () => {
      const file = readdirSync(dir).find((f) => f.endsWith('.json'));
      assert(file, 'backup file missing');
      await setHash(page, '#/settings/data');
      const input = await page.$('main input[type="file"]');
      assert(input, 'no import file input in Settings → Data');
      await input.uploadFile(join(dir, file));
      await sleep(1500);
      const after = await idbAll(page, 'bookmarks');
      assertEq(after.length, rows.length, 'post count after merge-import');
      assertEq(new Set(after.map((b) => b.id)).size, after.length, 'unique ids after import');
    });

    await page.close();
    suite.untrack(ctx);
  } finally {
    await close();
    rmSync(dir, { recursive: true, force: true });
  }
}
