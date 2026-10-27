#!/usr/bin/env node
/**
 * Memory-leak check: with a 10,000-post library, cycle through every screen
 * many times, force garbage collection and compare the JS heap, DOM nodes and
 * event listeners between an early round and the last. A leak shows up as
 * steady growth.
 *   node bench/qa/leak.mjs [--build] [--rounds=40]
 * Writes bench/results/leak.json; exits 1 if growth exceeds the limits.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, newPage } from '../e2e/lib/browser.mjs';
import { PREVIEW_DIST, RESULTS_DIR } from '../e2e/lib/env.mjs';
import { buildPreview, serveStatic } from '../e2e/lib/server.mjs';

const ROUNDS = Number(process.argv.find((a) => a.startsWith('--rounds='))?.split('=')[1] ?? 40);
const ROUTE = ['#/home', '#/library/all', '#/insights', '#/recall', '#/shelf', '#/ask', '#/wrapped', '#/settings/general', '#/library/category/ai'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

buildPreview({ skip: !process.argv.includes('--build') });
const server = await serveStatic(PREVIEW_DIST, 5380);
const { browser, close } = await launch('leak');
let report;
try {
  const { page } = await newPage(browser, { label: 'leak', intercept: false });
  const cdp = await page.createCDPSession();
  await cdp.send('Performance.enable');
  await page.goto(`${server.url}?bench=10000#/home`, { waitUntil: 'domcontentloaded', timeout: 300_000 });
  await page.waitForFunction(() => window.__benchReady === true && performance.getEntriesByName('data:complete').length > 0, { timeout: 300_000, polling: 300 });

  const measure = async () => {
    await cdp.send('HeapProfiler.collectGarbage');
    await sleep(300);
    await cdp.send('HeapProfiler.collectGarbage');
    const { metrics } = await cdp.send('Performance.getMetrics');
    const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]));
    return { heapMB: +(m.JSHeapUsedSize / 1048576).toFixed(1), nodes: m.Nodes, listeners: m.JSEventListeners, documents: m.Documents };
  };

  const samples = [];
  for (let r = 1; r <= ROUNDS; r++) {
    for (const h of ROUTE) {
      await page.evaluate((x) => (location.hash = x), h);
      await sleep(120);
    }
    // Open and close the post panel and the command palette each round too.
    await page.evaluate((x) => (location.hash = x), '#/library/all');
    await sleep(200);
    await page.evaluate(() => document.querySelector('main article[data-id]')?.click());
    await sleep(150);
    await page.keyboard.press('Escape');
    await page.keyboard.down('Control');
    await page.keyboard.press('k');
    await page.keyboard.up('Control');
    await sleep(120);
    await page.keyboard.press('Escape');
    if (r === 5 || r === Math.round(ROUNDS / 2) || r === ROUNDS) samples.push({ round: r, ...(await measure()) });
  }
  // Return to the same screen as the baseline before the final comparison.
  const [early, , late] = samples;
  const growth = (a, b) => (b - a) / a;
  report = {
    at: new Date().toISOString(),
    rounds: ROUNDS,
    screensVisited: ROUNDS * (ROUTE.length + 1),
    samples,
    heapGrowth: +(growth(early.heapMB, late.heapMB) * 100).toFixed(1),
    nodeGrowth: +(growth(early.nodes, late.nodes) * 100).toFixed(1),
    listenerGrowth: +(growth(early.listeners, late.listeners) * 100).toFixed(1),
  };
} finally {
  await close();
  await server.close();
}
writeFileSync(join(RESULTS_DIR, 'leak.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 1));
const bad = report.heapGrowth > 15 || report.nodeGrowth > 25 || report.listenerGrowth > 25;
console.log(bad ? '✖ memory grows across rounds — likely a leak' : '✔ no leak: heap, DOM nodes and listeners stay flat');
process.exitCode = bad ? 1 : 0;
