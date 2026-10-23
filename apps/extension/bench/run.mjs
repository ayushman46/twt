#!/usr/bin/env node
/**
 * twtdash performance benchmark.
 *
 *   node bench/run.mjs <label> [--runs 5] [--n 10000] [--cpu 4] [--skip-build]
 *
 * Builds the dashboard preview in production mode, seeds a synthetic
 * library of N posts into IndexedDB (persisted in bench/.profile), then
 * measures each scenario in fresh pages under CPU throttling and reports
 * medians. Results are written to bench/results/<label>.json.
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const args = process.argv.slice(2);
const label = args.find((a) => !a.startsWith('--')) ?? 'run';
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const RUNS = Number(opt('runs', 5));
const N = Number(opt('n', 10000));
const CPU = Number(opt('cpu', 4));
const EXTRA = opt('query', '') ? `&${opt('query', '')}` : '';
const PORT = 5299;
const BASE = `http://localhost:${PORT}/`;
const CHROME = process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const median = (xs) => {
  const v = xs.filter((x) => typeof x === 'number' && !Number.isNaN(x)).sort((a, b) => a - b);
  if (!v.length) return NaN;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function bundleSizes() {
  const dir = join(root, 'preview', 'dist', 'assets');
  let js = 0;
  let css = 0;
  for (const f of readdirSync(dir)) {
    const size = statSync(join(dir, f)).size;
    if (f.endsWith('.js')) js += size;
    if (f.endsWith('.css')) css += size;
  }
  return { totalJsKB: Math.round(js / 1024), cssKB: Math.round(css / 1024) };
}

async function startServer() {
  if (!args.includes('--skip-build')) {
    execSync('npx vite build --config vite.preview.config.ts --logLevel error', { cwd: root, stdio: 'inherit' });
  }
  const proc = spawn('npx', ['vite', 'preview', '--config', 'vite.preview.config.ts', '--port', String(PORT), '--strictPort'], { cwd: root, shell: true, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(BASE);
      if (r.ok) return proc;
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  throw new Error('preview server did not start');
}

async function newPage(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  const cdp = await page.createCDPSession();
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  await page.evaluateOnNewDocument(() => {
    window.__longTasks = [];
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) window.__longTasks.push({ start: e.startTime, dur: e.duration });
      }).observe({ type: 'longtask', buffered: true });
    } catch {
      /* unsupported */
    }
  });
  return page;
}

/** Wait for a performance mark (optionally one that started after `after`). */
function waitMark(page, name, after = -1, timeout = 120000) {
  return page.waitForFunction(
    (n, a) => performance.getEntriesByName(n).some((e) => e.startTime > a),
    { timeout, polling: 16 },
    name,
    after,
  );
}

async function markTime(page, name, after = -1) {
  return page.evaluate((n, a) => performance.getEntriesByName(n).find((e) => e.startTime > a)?.startTime ?? NaN, name, after);
}

async function seed(browser) {
  const page = await newPage(browser);
  await page.goto(`${BASE}?bench=${N}#/home`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__benchReady === true, { timeout: 300000 });
  await page.close();
}

async function navTo(page, hash, markName) {
  const t0 = await page.evaluate((h) => {
    const t = performance.now();
    location.hash = h;
    return t;
  }, hash);
  await waitMark(page, markName, t0);
  return (await markTime(page, markName, t0)) - t0;
}

async function oneRun(browser) {
  const r = {};
  const page = await newPage(browser);

  // 1. Cold start of the dashboard straight into the library.
  await page.goto(`${BASE}?bench=${N}${EXTRA}#/library/all`, { waitUntil: 'domcontentloaded' });
  await waitMark(page, 'route:library:painted');
  // Progressive builds stream the rest of the library after first paint; wait for it.
  await page.waitForFunction(() => !window.__twtdashProgressive || performance.getEntriesByName('data:complete').length > 0, { timeout: 180000, polling: 16 });
  await sleep(300);
  Object.assign(
    r,
    await page.evaluate(() => {
      const at = (n) => performance.getEntriesByName(n)[0]?.startTime ?? NaN;
      const perf = window.__twtdashPerf ?? {};
      const paint = at('route:library:painted');
      const lt = (window.__longTasks ?? []).filter((t) => t.start < paint);
      return {
        startup_boot: at('app:boot'),
        startup_dataReady: at('data:ready'),
        startup_libraryPainted: paint,
        startup_dataComplete: at('data:complete') || at('data:ready'),
        startup_loadFirstMs: perf.loadFirst?.[0] ?? NaN,
        startup_loadAllMs: perf.loadAll?.[0] ?? NaN,
        startup_indexMs: perf.indexSync?.length ? Math.max(...perf.indexSync) : 0,
        startup_deriveMs: perf.derive?.length ? Math.max(...perf.derive) : NaN,
        startup_longTaskMs: lt.reduce((s, t) => s + t.dur, 0),
        heapMB: performance.memory ? performance.memory.usedJSHeapSize / 1048576 : NaN,
        domNodesAfterStart: document.getElementsByTagName('*').length,
      };
    }),
  );

  // 2. Screen switches.
  r.nav_insights = await navTo(page, '#/insights', 'route:insights:painted');
  r.nav_home = await navTo(page, '#/home', 'route:home:painted');
  r.nav_settings = await navTo(page, '#/settings/general', 'route:settings:painted');
  r.nav_library = await navTo(page, '#/library/all', 'route:library:painted');
  r.nav_category = await navTo(page, '#/library/category/ai', 'route:library:painted');
  r.nav_library2 = await navTo(page, '#/library/all', 'route:library:painted');
  await sleep(300);

  // 3. Star / unstar the first post (DB write → live query → re-render).
  const starTimes = [];
  for (let i = 0; i < 2; i++) {
    starTimes.push(
      await page.evaluate(async () => {
        const card = document.querySelector('article[data-id]');
        const id = card.getAttribute('data-id');
        const btn = card.querySelector('button[aria-label="Star"]');
        const count = () => document.querySelector(`article[data-id="${id}"]`)?.querySelectorAll('.fill-amber-400').length ?? -1;
        const before = count();
        const t0 = performance.now();
        btn.click();
        await new Promise((res) => {
          const check = () => (count() !== before ? res() : requestAnimationFrame(check));
          check();
        });
        await new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0)));
        return performance.now() - t0;
      }),
    );
    await sleep(200);
  }
  r.star_ms = median(starTimes);

  // 4. Search: per-keystroke latency typing "design".
  const keyTimes = await page.evaluate(async () => {
    const input = document.querySelector('input[placeholder^="Search text"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    const out = [];
    let q = '';
    for (const ch of 'design') {
      q += ch;
      const t0 = performance.now();
      setter.call(input, q);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((res) => {
        const check = () => (performance.getEntriesByName('search:painted').some((e) => e.startTime > t0) ? res() : requestAnimationFrame(check));
        check();
      });
      out.push(performance.now() - t0);
    }
    setter.call(input, '');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return out;
  });
  r.search_keyMedianMs = median(keyTimes);
  r.search_keyMaxMs = Math.max(...keyTimes);
  await sleep(500);

  // 5. Scroll smoothness: 4 s of continuous scrolling at ~2,400 px/s.
  Object.assign(
    r,
    await page.evaluate(async () => {
      window.scrollTo(0, 0);
      await new Promise((res) => setTimeout(res, 300));
      const frames = [];
      const start = performance.now();
      let last = start;
      await new Promise((res) => {
        const step = (t) => {
          frames.push(t - last);
          last = t;
          window.scrollBy(0, 40);
          if (t - start < 4000) requestAnimationFrame(step);
          else res();
        };
        requestAnimationFrame(step);
      });
      const sorted = [...frames].sort((a, b) => a - b);
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      return {
        scroll_avgFps: (frames.length / 4000) * 1000,
        scroll_p95FrameMs: p95,
        scroll_jankyFrames: frames.filter((f) => f > 50).length,
        scroll_distancePx: window.scrollY,
        domNodesAfterScroll: document.getElementsByTagName('*').length,
      };
    }),
  );

  // 6. Older content: time until the oldest post is on screen.
  r.oldest_ms = await page.evaluate(async () => {
    const id = window.__benchOldestId;
    const t0 = performance.now();
    while (performance.now() - t0 < 60000) {
      const el = document.querySelector(`[data-id="${id}"]`);
      if (el) {
        el.scrollIntoView();
        return performance.now() - t0;
      }
      window.scrollTo(0, document.documentElement.scrollHeight);
      await new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0)));
    }
    return Infinity;
  });
  await page.close();

  // 7. Toolbar popup.
  const popup = await newPage(browser);
  await popup.goto(`${BASE}?bench=${N}${EXTRA}&popup`, { waitUntil: 'domcontentloaded' });
  await waitMark(popup, 'popup:painted');
  r.popup_painted = await markTime(popup, 'popup:painted');
  await popup.close();
  return r;
}

const server = await startServer();
let browser;
try {
  browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    userDataDir: join(here, '.profile'),
    args: ['--no-first-run', '--disable-extensions', '--enable-precise-memory-info', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'],
  });
  await seed(browser);
  const runs = [];
  for (let i = 0; i < RUNS; i++) {
    const r = await oneRun(browser);
    runs.push(r);
    process.stdout.write(`run ${i + 1}/${RUNS} done\n`);
  }
  const keys = Object.keys(runs[0]);
  const summary = Object.fromEntries(keys.map((k) => [k, Math.round(median(runs.map((r) => r[k])) * 10) / 10]));
  Object.assign(summary, bundleSizes());
  mkdirSync(join(here, 'results'), { recursive: true });
  writeFileSync(join(here, 'results', `${label}.json`), JSON.stringify({ label, n: N, cpu: CPU, runs: RUNS, summary, raw: runs }, null, 2));
  console.log(`\n=== ${label} — ${N} posts, ${CPU}x CPU throttle, median of ${RUNS} ===`);
  for (const [k, v] of Object.entries(summary)) console.log(`${k.padEnd(26)} ${v === Infinity ? '>60000 (never reached)' : v}`);
} finally {
  await browser?.close();
  try {
    if (process.platform === 'win32') execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: 'ignore' });
    else server.kill();
  } catch {
    /* already gone */
  }
}
