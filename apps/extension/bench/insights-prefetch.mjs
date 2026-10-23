#!/usr/bin/env node
/** First Insights visit: cold vs hover-prefetched vs idle-prefetched. node bench/insights-prefetch.mjs */
import { spawn, execSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const PORT = 5299;
const BASE = `http://localhost:${PORT}/`;
const CPU = 4;
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
const browser = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, userDataDir: join(here, '.profile'), args: ['--no-first-run'] });
const results = { cold: [], hover: [], idle: [] };
try {
  for (let trial = 0; trial < 3; trial++) {
    for (const mode of Object.keys(results)) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1440, height: 900 });
      const cdp = await page.createCDPSession();
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
      await page.goto(`${BASE}?bench=10000#/library/all`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => performance.getEntriesByName('data:complete').length > 0, { timeout: 240000 });
      await sleep(300);
      if (mode === 'hover') {
        const link = await page.evaluateHandle(() => [...document.querySelectorAll('nav button')].find((b) => b.textContent.trim() === 'Insights'));
        await link.hover();
        await sleep(400); // typical hover-to-click time
      }
      if (mode === 'idle') await sleep(9000);
      const t0 = await page.evaluate(() => {
        const t = performance.now();
        location.hash = '#/insights';
        return t;
      });
      await page.waitForFunction((a) => performance.getEntriesByName('route:insights:painted').some((e) => e.startTime > a), { timeout: 120000, polling: 16 }, t0);
      results[mode].push(await page.evaluate((a) => performance.getEntriesByName('route:insights:painted').find((e) => e.startTime > a).startTime - a, t0));
      await page.close();
    }
  }
} finally {
  await browser.close();
  try {
    execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: 'ignore' });
  } catch {
    /* gone */
  }
}
const med = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
console.log(`First Insights visit (CPU x${CPU}, median of 3):`);
for (const [k, v] of Object.entries(results)) console.log(`  ${k.padEnd(6)} ${Math.round(med(v))} ms   [${v.map((x) => Math.round(x)).join(', ')}]`);
