#!/usr/bin/env node
/**
 * Capture README screenshots from the production preview build with the
 * sample library. Output: docs/screenshots/*.webp
 *   node bench/screenshots.mjs [--skip-build]
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const out = resolve(root, '../../docs/screenshots');
mkdirSync(out, { recursive: true });
const PORT = 5299;
const BASE = `http://localhost:${PORT}/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!process.argv.includes('--skip-build')) execSync('npx vite build --config vite.preview.config.ts --logLevel error', { cwd: root, stdio: 'inherit' });
const server = spawn('npx', ['vite', 'preview', '--config', 'vite.preview.config.ts', '--port', String(PORT), '--strictPort'], { cwd: root, shell: true, stdio: 'ignore' });
for (let i = 0; i < 180; i++) {
  try {
    if ((await fetch(BASE)).ok) break;
  } catch {
    /* wait */
  }
  await sleep(500);
}

const profile = mkdtempSync(join(tmpdir(), 'twtdash-shots-'));
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  userDataDir: profile,
  args: ['--no-first-run', '--hide-scrollbars'],
});

async function save(page, name, clip) {
  const buf = await page.screenshot({ type: 'png', clip });
  await sharp(buf).webp({ quality: 88 }).toFile(join(out, `${name}.webp`));
  console.log(`saved ${name}.webp`);
}

async function open(hash, { dark = true, demo = true, width = 1440, height = 900 } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 2 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }]);
  await page.goto(`${BASE}${demo ? '?demo' : ''}${hash}`, { waitUntil: 'networkidle0', timeout: 120000 });
  await sleep(1200);
  // Marketing shots: hide the "sample data" banner.
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('main > div')) if (el.textContent?.includes('exploring sample data')) el.style.display = 'none';
  });
  await sleep(400);
  return page;
}

try {
  // Welcome (empty library) first, before demo data exists in this profile.
  let p = await open('#/welcome', { demo: false });
  await save(p, 'welcome');
  await p.close();

  p = await open('#/home');
  await p.evaluate(() => {
    for (const el of document.querySelectorAll('main > div')) if (el.textContent?.includes('exploring sample data')) el.style.display = 'none';
  });
  await save(p, 'home-dark');
  await p.close();

  p = await open('#/library/all');
  await p.keyboard.press('1');
  await sleep(1500);
  await save(p, 'library-dark');
  // Detail panel
  await p.$eval('article[data-id] div.mt-3', (e) => e.click());
  await p.waitForSelector('[aria-label="Post details"]');
  await sleep(800);
  await save(p, 'detail-dark');
  await p.keyboard.press('Escape');
  await sleep(400);
  // Command palette
  await p.keyboard.down('Control');
  await p.keyboard.press('k');
  await p.keyboard.up('Control');
  await p.waitForSelector('[cmdk-input]');
  await p.keyboard.type('design', { delay: 30 });
  await sleep(700);
  await save(p, 'command-palette');
  await p.close();

  p = await open('#/insights');
  await p.waitForSelector('svg[aria-label^="Column chart"]');
  await sleep(600);
  await save(p, 'insights-dark');
  await p.close();

  p = await open('#/library/all', { dark: false });
  await p.keyboard.press('1');
  await sleep(1500);
  await save(p, 'library-light');
  await p.close();

  p = await open('#/home', { dark: false });
  await save(p, 'home-light');
  await p.close();

  p = await open('#/settings/ai');
  await save(p, 'settings-ai');
  await p.close();

  // Popup (crop to the card)
  p = await open('&popup', { width: 520, height: 760 });
  const box = await p.$eval('div.w-fit', (e) => {
    const r = e.getBoundingClientRect();
    return { x: r.x - 16, y: r.y - 16, width: r.width + 32, height: r.height + 32 };
  });
  await save(p, 'popup', box);
  await p.close();

  // Live marketing site
  const site = await browser.newPage();
  await site.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await site.goto('https://twtdash.vercel.app', { waitUntil: 'networkidle0', timeout: 120000 });
  await sleep(2500);
  await save(site, 'landing');
  await site.close();
} finally {
  await browser.close();
  try {
    execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: 'ignore' });
  } catch {
    /* gone */
  }
  rmSync(profile, { recursive: true, force: true });
}
