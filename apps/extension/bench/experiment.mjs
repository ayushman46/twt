#!/usr/bin/env node
/**
 * A/B rendering experiments: inject CSS variants and time screen switches.
 *   node bench/experiment.mjs [--cpu 4]
 */
import { spawn, execSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const args = process.argv.slice(2);
const CPU = Number(args.includes('--cpu') ? args[args.indexOf('--cpu') + 1] : 4);
const PORT = 5299;
const BASE = `http://localhost:${PORT}/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const VARIANTS = {
  baseline: '',
  noFeatures: 'html, body, * { font-feature-settings: normal !important; font-variant-numeric: normal !important; }',
  noTracking: '* { letter-spacing: normal !important; }',
  noFeatNoTrack: '* { font-feature-settings: normal !important; font-variant-numeric: normal !important; letter-spacing: normal !important; }',
  arial: '* { font-family: Arial, sans-serif !important; }',
  arialNoFeat: '* { font-family: Arial, sans-serif !important; font-feature-settings: normal !important; letter-spacing: normal !important; }',
};

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
  const out = {};
  for (const [name, css] of Object.entries(VARIANTS)) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    const cdp = await page.createCDPSession();
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
    await page.evaluateOnNewDocument((c) => {
      const add = () => {
        const st = document.createElement('style');
        st.textContent = c;
        (document.head ?? document.documentElement).append(st);
      };
      if (document.documentElement) add();
      else document.addEventListener('DOMContentLoaded', add);
    }, css);
    await page.goto(`${BASE}?bench=10000#/library/all`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => performance.getEntriesByName('route:library:painted').length > 0 && (!window.__twtdashProgressive || performance.getEntriesByName('data:complete').length > 0), { timeout: 240000, polling: 50 });
    await sleep(500);
    const times = [];
    for (let i = 0; i < 3; i++) {
      for (const [hash, m] of [
        ['#/home', 'route:home:painted'],
        ['#/library/all', 'route:library:painted'],
      ]) {
        const t0 = await page.evaluate((h) => {
          const t = performance.now();
          location.hash = h;
          return t;
        }, hash);
        await page.waitForFunction((n, a) => performance.getEntriesByName(n).some((e) => e.startTime > a), { timeout: 120000, polling: 16 }, m, t0);
        const t = await page.evaluate((n, a) => performance.getEntriesByName(n).find((e) => e.startTime > a).startTime - a, m, t0);
        times.push(t);
        await sleep(200);
      }
    }
    times.sort((a, b) => a - b);
    out[name] = Math.round(times[Math.floor(times.length / 2)]);
    console.log(`${name.padEnd(14)} median screen switch ${out[name]} ms`);
    await page.close();
  }
} finally {
  await browser.close();
  try {
    execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: 'ignore' });
  } catch {
    /* gone */
  }
}
