#!/usr/bin/env node
/**
 * CPU-profile one scenario and print the hottest functions by self time.
 *   node bench/profile.mjs <startup|nav|star|popup> [--n 10000] [--cpu 4]
 * Expects the preview build to exist (run bench/run.mjs once first).
 */
import { spawn, execSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const args = process.argv.slice(2);
const scenario = args[0] ?? 'startup';
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const N = Number(opt('n', 10000));
const CPU = Number(opt('cpu', 4));
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
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });

  const waitMark = (name, after = -1) =>
    page.waitForFunction((n, a) => performance.getEntriesByName(n).some((e) => e.startTime > a), { timeout: 180000, polling: 50 }, name, after);

  if (scenario === 'popup') {
    await cdp.send('Profiler.start');
    await page.goto(`${BASE}?bench=${N}&popup`, { waitUntil: 'domcontentloaded' });
    await waitMark('popup:painted');
  } else {
    if (scenario === 'startup') await cdp.send('Profiler.start');
    await page.goto(`${BASE}?bench=${N}#/library/all`, { waitUntil: 'domcontentloaded' });
    await waitMark('route:library:painted');
    await sleep(1500);
    if (scenario === 'nav') {
      await cdp.send('Profiler.start');
      const t0 = await page.evaluate(() => {
        const t = performance.now();
        location.hash = '#/home';
        return t;
      });
      await waitMark('route:home:painted', t0);
    }
    if (scenario === 'insights') {
      await page.waitForFunction(() => performance.getEntriesByName('data:complete').length > 0, { timeout: 240000 });
      await page.evaluate(() => import('/assets/' + [...document.scripts].length).catch(() => undefined));
      await sleep(6000);
      await cdp.send('Profiler.start');
      const t0 = await page.evaluate(() => {
        const t = performance.now();
        location.hash = '#/insights';
        return t;
      });
      await waitMark('route:insights:painted', t0);
    }
    if (scenario === 'star') {
      await cdp.send('Profiler.start');
      await page.evaluate(() => document.querySelector('article[data-id] button[aria-label="Star"]').click());
      await sleep(8000);
    }
  }
  const { profile } = await cdp.send('Profiler.stop');

  // Aggregate self time per function.
  const dt = profile.timeDeltas;
  const selfTime = new Map();
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  profile.samples.forEach((id, i) => {
    const n = byId.get(id);
    const f = n.callFrame;
    const key = `${f.functionName || '(anonymous)'}  ${f.url.split('/').pop()}:${f.lineNumber + 1}`;
    selfTime.set(key, (selfTime.get(key) ?? 0) + (dt[i] ?? 0) / 1000);
  });
  const total = [...selfTime.values()].reduce((a, b) => a + b, 0);
  console.log(`\n${scenario}: total sampled ${Math.round(total)} ms (CPU x${CPU})`);
  for (const [k, v] of [...selfTime.entries()].sort((a, b) => b[1] - a[1]).slice(0, 28)) {
    console.log(`${String(Math.round(v)).padStart(7)} ms  ${((v / total) * 100).toFixed(1).padStart(5)}%  ${k}`);
  }
} finally {
  await browser.close();
  try {
    execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: 'ignore' });
  } catch {
    /* gone */
  }
}
