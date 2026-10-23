#!/usr/bin/env node
/**
 * Record a Chrome performance trace of dashboard startup and summarize where
 * main-thread time goes (script vs style vs layout vs paint).
 *   node bench/trace.mjs [--n 10000] [--cpu 4] [--query legacyload]
 */
import { spawn, execSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const N = Number(opt('n', 10000));
const CPU = Number(opt('cpu', 4));
const EXTRA = opt('query', '') ? `&${opt('query', '')}` : '';
const SCENARIO = args.includes('--nav') ? 'nav' : 'startup';
const PORT = 5299;
const BASE = `http://localhost:${PORT}/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = spawn('npx', ['vite', 'preview', '--config', 'vite.preview.config.ts', '--port', String(PORT), '--strictPort'], { cwd: root, shell: true, stdio: 'ignore' });
for (let i = 0; i < 180; i++) {
  try {
    if ((await fetch(BASE)).ok) break;
  } catch {
    /* wait */
  }
  await sleep(500);
}
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  userDataDir: join(here, '.profile'),
  args: ['--no-first-run', '--disable-extensions'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const cdp = await page.createCDPSession();
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  const path = join(here, 'results', `${SCENARIO}-trace.json`);
  const cats = ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'v8.execute', 'blink.user_timing', ...(args.includes('--deep') ? ['blink', 'fonts', 'disabled-by-default-fonts', 'disabled-by-default-blink.debug.layout', 'skia'] : [])];
  if (SCENARIO === 'startup') await page.tracing.start({ path, categories: cats });
  await page.goto(`${BASE}?bench=${N}${EXTRA}#/library/all`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => performance.getEntriesByName('route:library:painted').length > 0 && (!window.__twtdashProgressive || performance.getEntriesByName('data:complete').length > 0), { timeout: 240000, polling: 50 });
  await sleep(500);
  if (SCENARIO === 'nav') {
    await page.tracing.start({ path, categories: cats });
    const t0 = await page.evaluate(() => {
      const t = performance.now();
      location.hash = '#/home';
      return t;
    });
    await page.waitForFunction((a) => performance.getEntriesByName('route:home:painted').some((e) => e.startTime > a), { timeout: 120000, polling: 16 }, t0);
    await sleep(300);
  }
  const buf = await page.tracing.stop();
  const parsed = JSON.parse(Buffer.from(buf).toString('utf8'));
  const traceEvents = Array.isArray(parsed) ? parsed : parsed.traceEvents;
  // The renderer main thread that emitted our paint marks.
  const markEv = traceEvents.find((e) => typeof e.name === 'string' && e.name.startsWith('route:'));
  const main = markEv ? { pid: markEv.pid, tid: markEv.tid } : traceEvents.find((e) => e.name === 'thread_name' && e.args?.name === 'CrRendererMain');
  const totals = new Map();
  const counts = new Map();
  for (const e of traceEvents) {
    if (e.ph !== 'X' || !e.dur || (main && (e.pid !== main.pid || e.tid !== main.tid))) continue;
    if (e.dur < 1000 && !['Layout', 'UpdateLayoutTree', 'Paint'].includes(e.name)) continue;
    totals.set(e.name, (totals.get(e.name) ?? 0) + e.dur / 1000);
    counts.set(e.name, (counts.get(e.name) ?? 0) + 1);
  }
  console.log(`\n${SCENARIO} trace (CPU x${CPU}) — main thread, top-level events (note: FunctionCall includes nested work)`);
  for (const [k, v] of [...totals.entries()].sort((a, b) => b[1] - a[1])) console.log(`${String(Math.round(v)).padStart(8)} ms  ×${String(counts.get(k)).padEnd(5)} ${k}`);
  if (args.includes('--deep')) {
    // What happens inside the single longest Layout?
    const longest = traceEvents.filter((e) => e.name === 'Layout' && e.ph === 'X' && e.pid === main.pid && e.tid === main.tid).sort((a, b) => b.dur - a.dur)[0];
    if (longest) {
      const inner = new Map();
      for (const e of traceEvents) {
        if (e.pid !== main.pid || e.tid !== main.tid || e.ph !== 'X' || e === longest) continue;
        if (e.ts < longest.ts || e.ts + (e.dur ?? 0) > longest.ts + longest.dur) continue;
        const k = e.name;
        const v = inner.get(k) ?? { n: 0, ms: 0 };
        v.n++;
        v.ms += (e.dur ?? 0) / 1000;
        inner.set(k, v);
      }
      console.log(`
Inside the longest Layout (${Math.round(longest.dur / 1000)} ms):`);
      for (const [k, v] of [...inner.entries()].sort((a, b) => b[1].ms - a[1].ms).slice(0, 20)) console.log(`${String(Math.round(v.ms)).padStart(8)} ms  ×${String(v.n).padEnd(6)} ${k}`);
    }
  }
  const layouts = traceEvents.filter((e) => e.name === 'Layout' && e.ph === 'X' && e.dur && (!main || (e.pid === main.pid && e.tid === main.tid))).sort((a, b) => b.dur - a.dur).slice(0, 5);
  console.log('\nLongest layouts:');
  for (const l of layouts) console.log(`  ${Math.round(l.dur / 1000)} ms  dirty=${l.args?.beginData?.dirtyObjects ?? '?'} total=${l.args?.beginData?.totalObjects ?? '?'}`);
  const styles = traceEvents.filter((e) => e.name === 'UpdateLayoutTree' && e.ph === 'X' && e.dur && (!main || (e.pid === main.pid && e.tid === main.tid))).sort((a, b) => b.dur - a.dur).slice(0, 5);
  console.log('Longest style recalcs:');
  for (const l of styles) console.log(`  ${Math.round(l.dur / 1000)} ms  elements=${l.args?.elementCount ?? '?'}`);
} finally {
  await browser.close();
  try {
    execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: 'ignore' });
  } catch {
    /* gone */
  }
}
