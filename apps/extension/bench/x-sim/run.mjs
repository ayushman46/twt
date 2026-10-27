#!/usr/bin/env node
/**
 * End-to-end test of the REAL built extension against a simulated x.com.
 *   node bench/x-sim/run.mjs [--skip-build] [--headful]
 *
 * Builds the Chrome MV3 extension, installs it into Chrome, maps x.com to the
 * local simulator (bench/x-sim/server.mjs) and checks the whole pipeline:
 * MAIN-world capture (fetch + XHR) → bridge → service worker → IndexedDB →
 * dashboard and popup. Writes bench/results/x-sim.json; exits 1 on failure.
 */
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { RESULTS_DIR, SCRATCH } from '../e2e/lib/env.mjs';
import { Suite, printTable, summarize } from '../e2e/lib/harness.mjs';
import { startSim } from './server.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const EXT_ROOT = resolve(here, '../..');
const EXT_DIR = join(EXT_ROOT, '.output', 'chrome-mv3');
const PORT = 8443;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const args = process.argv.slice(2);

if (!args.includes('--skip-build')) {
  console.log('[x-sim] building the extension…');
  execSync('npx wxt build', { cwd: EXT_ROOT, stdio: 'inherit' });
}

const sim = await startSim(PORT, join(SCRATCH, 'x-sim'));
const profile = mkdtempSync(join(tmpdir(), 'twtdash-xsim-'));
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: !args.includes('--headful'),
  pipe: true,
  enableExtensions: true,
  userDataDir: profile,
  args: [`--host-resolver-rules=MAP x.com 127.0.0.1:${PORT},MAP twitter.com 127.0.0.1:${PORT}`, '--ignore-certificate-errors', '--no-first-run', '--window-size=1280,900'],
});

const suite = new Suite('x-sim');
const errors = [];
const watch = (page, label) => {
  page.on('pageerror', (e) => errors.push(`${label} pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|pbs\.twimg\.com|ERR_CERT|net::ERR/.test(m.text())) errors.push(`${label} console: ${m.text().slice(0, 300)}`);
  });
};

/** Read a whole IndexedDB store from an extension page. */
const idb = (page, store) =>
  page.evaluate(
    (s) =>
      new Promise((res, rej) => {
        const r = indexedDB.open('twtdash');
        r.onerror = () => rej(r.error);
        r.onsuccess = () => {
          const db = r.result;
          if (!db.objectStoreNames.contains(s)) return res([]);
          const q = db.transaction(s).objectStore(s).getAll();
          q.onsuccess = () => {
            res(q.result);
            db.close();
          };
          q.onerror = () => rej(q.error);
        };
      }),
    store,
  );
const storageGet = (page, key) => page.evaluate((k) => chrome.storage.local.get(k).then((o) => o[k]), key);
const sendMsg = (page, msg) => page.evaluate((m) => chrome.runtime.sendMessage(m), msg);
async function until(fn, { timeout = 60_000, every = 400, what = 'condition' } = {}) {
  const t0 = Date.now();
  let last;
  while (Date.now() - t0 < timeout) {
    last = await fn();
    if (last) return last;
    await sleep(every);
  }
  throw new Error(`timed out waiting for ${what}`);
}
/** Wait until the sync run started after `since` has finished; returns the final state. */
const syncDone = (page, since, timeout = 180_000) =>
  until(
    async () => {
      const s = await storageGet(page, 'syncState');
      return s && (s.startedAt ?? 0) >= since && ['done', 'stopped', 'error'].includes(s.status) ? s : null;
    },
    { timeout, what: 'sync to finish' },
  );

let extId = '';
let dash;
// Don't attach to the sync tabs the extension opens while they run: attaching a debugger
// session to an extension-created tab can stall it. Their errors are collected at the end.

try {
  await suite.check('the built extension installs and its service worker starts', async () => {
    extId = await browser.installExtension(EXT_DIR);
    const sw = await browser.waitForTarget((t) => t.type() === 'service_worker' && t.url().startsWith(`chrome-extension://${extId}/`), { timeout: 20_000 });
    const worker = await sw.worker();
    worker?.on('console', (m) => m.type() === 'error' && errors.push(`service worker: ${m.text().slice(0, 300)}`));
    return { data: { extId } };
  });

  await suite.check('dashboard opens to the welcome screen with an empty library', async () => {
    dash = await browser.newPage();
    watch(dash, 'dashboard');
    await dash.setViewport({ width: 1280, height: 860 });
    await dash.goto(`chrome-extension://${extId}/dashboard.html#/home`, { waitUntil: 'domcontentloaded' });
    await dash.waitForFunction(() => document.querySelector('#root')?.children.length > 0, { timeout: 20_000 });
    await until(async () => (await dash.$('main input[type="file"]')) || (await dash.evaluate(() => /sync/i.test(document.body.innerText))), { what: 'welcome screen' });
    const rows = await idb(dash, 'bookmarks');
    if (rows.length) throw new Error(`library should start empty, has ${rows.length}`);
  });

  let expected = sim.expected();
  let firstSync;
  await suite.check('full sync imports every bookmark from X (fetch and XHR)', async () => {
    const since = Date.now();
    const before = sim.state.requests.length;
    const res = await sendMsg(dash, { type: 'sync/start', source: 'bookmark', mode: 'full' });
    if (!res?.ok) throw new Error(`sync/start failed: ${JSON.stringify(res)}`);
    firstSync = await syncDone(dash, since);
    if (firstSync.status !== 'done') throw new Error(`sync ended ${firstSync.status}: ${firstSync.message ?? ''}`);
    const rows = await idb(dash, 'bookmarks');
    const ids = new Set(rows.map((b) => b.id));
    const missing = expected.filter((p) => !ids.has(p.id));
    if (missing.length) throw new Error(`${missing.length} bookmarks missing, e.g. ${missing.slice(0, 3).map((p) => p.id).join(', ')}`);
    if (rows.length !== expected.length) throw new Error(`stored ${rows.length}, expected ${expected.length} (tombstones must be skipped)`);
    // The run's own counters must match what was stored (guards the start-of-sync race).
    if (firstSync.found !== rows.length || firstSync.added !== rows.length) throw new Error(`sync reported found ${firstSync.found} / added ${firstSync.added}, but stored ${rows.length}`);
    const pages = sim.state.requests.slice(before).filter((r) => r.includes('/Bookmarks')).length;
    return { data: { stored: rows.length, pages, found: firstSync.found, added: firstSync.added, seconds: Math.round((Date.now() - since) / 1000) } };
  }, { timeout: 200_000 });

  await suite.check('synced posts keep their content, media, quotes, cards and bookmark order', async () => {
    const rows = await idb(dash, 'bookmarks');
    const byId = new Map(rows.map((b) => [b.id, b]));
    const pick = (k) => expected.find((p) => p.kind === k && byId.has(p.id));
    const note = byId.get(pick(3).id);
    if (!note.text.includes('3/ Hire slowly')) throw new Error('long "note" post was truncated');
    const card = byId.get(pick(4).id);
    if (!card.card?.title?.includes('variable fonts')) throw new Error('link card title missing');
    const photo = byId.get(pick(5).id);
    if (!photo.media?.length || photo.media[0].type !== 'photo') throw new Error('photo media missing');
    const quote = byId.get(pick(6).id);
    if (!quote.quoted?.text?.includes('Rust')) throw new Error('quoted post missing');
    const wrapped = byId.get(pick(2).id);
    if (!wrapped.author?.handle) throw new Error('post inside a visibility wrapper lost its author');
    const legacyAuthor = byId.get(pick(0).id);
    const newAuthor = byId.get(pick(1).id);
    if (!legacyAuthor.author.name || !newAuthor.author.name) throw new Error('author names missing for one of the user schemas');
    // Bookmark order: savedAt must follow X's order (newest first).
    const order = expected.map((p) => byId.get(p.id).savedAt);
    for (let i = 1; i < order.length; i++) if (!(order[i - 1] >= order[i])) throw new Error(`bookmark order broken at position ${i}`);
  });

  await suite.check('posts are auto-sorted into the right categories (incl. Hindi and Hinglish)', async () => {
    const rows = await idb(dash, 'bookmarks');
    const byId = new Map(rows.map((b) => [b.id, b]));
    let right = 0;
    const wrong = [];
    for (const p of expected) {
      const got = byId.get(p.id)?.category;
      if (got === p.expect) right++;
      else wrong.push(`${p.expect}→${got}`);
    }
    const acc = right / expected.length;
    const hindi = expected.filter((p) => p.expect === 'sports').every((p) => byId.get(p.id)?.category === 'sports');
    const hinglish = expected.filter((p) => p.expect === 'finance').every((p) => byId.get(p.id)?.category === 'finance');
    if (!hindi) throw new Error('Hindi cricket posts were not sorted into Sports');
    if (!hinglish) throw new Error('Hinglish SIP posts were not sorted into Finance');
    if (acc < 0.9) throw new Error(`only ${(acc * 100).toFixed(0)}% sorted as expected; misses: ${[...new Set(wrong)].slice(0, 6).join(', ')}`);
    return { data: { accuracy: `${(acc * 100).toFixed(1)}%`, misses: [...new Set(wrong)].slice(0, 6) } };
  });

  await suite.check('the dashboard library shows the synced posts', async () => {
    // Hash-only change: a same-document navigation, so no load event to wait for.
    await dash.evaluate(() => (location.hash = '#/library/all'));
    await dash.waitForSelector('main [data-id]', { timeout: 20_000 });
    const shown = await until(
      () =>
        dash.evaluate(() => {
          const h1 = document.querySelector('main h1');
          const pill = h1?.parentElement?.textContent?.match(/\d[\d,]*/g);
          return pill ? Number(pill.at(-1).replace(/,/g, '')) : null;
        }),
      { what: 'library count' },
    );
    if (shown !== expected.length) throw new Error(`library shows ${shown}, expected ${expected.length}`);
  });

  await suite.check('quick sync adds only the new posts and stops early', async () => {
    sim.state.extra = 5;
    expected = sim.expected();
    const since = Date.now();
    const before = sim.state.requests.length;
    await sendMsg(dash, { type: 'sync/start', source: 'bookmark', mode: 'quick' });
    const s = await syncDone(dash, since);
    if (s.status !== 'done') throw new Error(`quick sync ended ${s.status}: ${s.message ?? ''}`);
    const rows = await idb(dash, 'bookmarks');
    if (rows.length !== expected.length) throw new Error(`stored ${rows.length}, expected ${expected.length}`);
    const pages = sim.state.requests.slice(before).filter((r) => r.includes('/Bookmarks')).length;
    const allPages = Math.ceil(expected.length / sim.PAGE) + 1;
    if (pages >= allPages) throw new Error(`quick sync read ${pages} pages — it should stop early (full = ${allPages})`);
    return { data: { added: s.added, pages, fullSyncPages: allPages } };
  }, { timeout: 200_000 });

  await suite.check('a rate-limited page is retried and the sync still completes', async () => {
    sim.state.ratelimit = 2;
    sim.state.rateLimited = false;
    const since = Date.now();
    await sendMsg(dash, { type: 'sync/start', source: 'bookmark', mode: 'full' });
    const s = await syncDone(dash, since, 240_000);
    sim.state.ratelimit = -1;
    if (!sim.state.rateLimited) throw new Error('the simulator never served the 429 (test did not exercise the retry)');
    if (s.status !== 'done') throw new Error(`sync ended ${s.status}: ${s.message ?? ''}`);
    const rows = await idb(dash, 'bookmarks');
    if (rows.length !== expected.length) throw new Error(`stored ${rows.length}, expected ${expected.length}`);
  }, { timeout: 260_000 });

  const live = sim.homePosts()[0];
  let home;
  await suite.check('bookmarking a post on X saves it to twtdash instantly', async () => {
    home = await browser.newPage();
    watch(home, 'x.com/home');
    await home.goto('https://x.com/home', { waitUntil: 'domcontentloaded' });
    await home.waitForSelector('body[data-ready="1"]', { timeout: 20_000 });
    await sleep(500);
    await home.click(`article[data-id="${live.id}"] [data-testid="bookmark"]`);
    const saved = await until(async () => (await idb(dash, 'bookmarks')).find((b) => b.id === live.id), { timeout: 15_000, what: 'captured bookmark' });
    if (saved.partial) throw new Error('captured post is partial — the timeline data was not reused');
    // The confirmation toast lives in a closed shadow root (isolated from X's scripts), so it isn't checked here.
    return { data: { category: saved.category } };
  });

  await suite.check('removing the bookmark on X removes it from twtdash', async () => {
    await home.click(`article[data-id="${live.id}"] [data-testid="removeBookmark"]`);
    await until(async () => !(await idb(dash, 'bookmarks')).some((b) => b.id === live.id), { timeout: 15_000, what: 'removal' });
    await home.close();
  });

  await suite.check('when logged out of X, sync stops with a clear message', async () => {
    sim.state.loggedout = true;
    const since = Date.now();
    await sendMsg(dash, { type: 'sync/start', source: 'bookmark', mode: 'quick' });
    const s = await syncDone(dash, since, 60_000);
    sim.state.loggedout = false;
    if (s.status !== 'error') throw new Error(`expected an error state, got ${s.status}`);
    if (!/log in/i.test(s.message ?? '')) throw new Error(`message should tell the user to log in: "${s.message}"`);
    const rows = await idb(dash, 'bookmarks');
    if (rows.length !== expected.length) throw new Error('library changed during a failed sync');
    return { data: { message: s.message } };
  });

  await suite.check('the toolbar popup shows the synced library', async () => {
    const popup = await browser.newPage();
    watch(popup, 'popup');
    await popup.setViewport({ width: 400, height: 640 });
    await popup.goto(`chrome-extension://${extId}/popup.html`, { waitUntil: 'domcontentloaded' });
    const read = () => popup.evaluate(() => (document.body.innerText.match(/\d[\d,]*/g) ?? []).map((n) => Number(n.replace(/,/g, ''))));
    // Wait for the real count (an empty list would count as "ready").
    const nums = await until(async () => {
      const n = await read();
      return n.includes(expected.length) ? n : null;
    }, { what: `popup to show ${expected.length}`, every: 300, timeout: 15_000 }).catch(async () => read());
    if (!nums.includes(expected.length)) throw new Error(`popup does not show ${expected.length}; saw ${nums.slice(0, 8).join(', ')}`);
    await popup.close();
  });

  await suite.check('no errors in the service worker, dashboard, popup or on x.com', async () => {
    // The sync tabs ran unattached; check what their overlay ended with instead.
    for (const p of await browser.pages()) {
      if (!p.url().startsWith('https://x.com/i/bookmarks')) continue;
      const overlay = await p.evaluate(() => [...document.querySelectorAll('*')].map((el) => el.shadowRoot?.textContent ?? '').join(' ')).catch(() => '');
      if (/needs attention/i.test(overlay) && !/log in/i.test(overlay)) errors.push(`sync overlay reported a problem: ${overlay.slice(0, 200)}`);
    }
    if (errors.length) throw new Error(errors.slice(0, 5).join(' || '));
  });
} finally {
  const report = { suite: 'x-sim', at: new Date().toISOString(), summary: summarize(suite.results), results: suite.results, errors };
  writeFileSync(join(RESULTS_DIR, 'x-sim.json'), JSON.stringify(report, null, 2));
  printTable(suite.results, 'Real extension × simulated x.com');
  await browser.close().catch(() => undefined);
  await sim.close();
  rmSync(profile, { recursive: true, force: true });
  process.exitCode = suite.results.some((r) => r.status === 'fail') ? 1 : 0;
}
