#!/usr/bin/env node
/**
 * Functional smoke test of the production dashboard build (preview harness).
 *   node bench/smoke.mjs [--skip-build]
 */
import { spawn, execSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
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

const results = [];
const check = async (name, fn) => {
  try {
    await fn();
    results.push([name, 'PASS']);
  } catch (e) {
    results.push([name, `FAIL — ${String(e.message ?? e).split('\n')[0]}`]);
  }
};

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  userDataDir: join(here, '.profile'),
  args: ['--no-first-run', '--disable-extensions'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && errors.push(m.text()));
  page.on('response', (r) => r.status() >= 400 && errors.push(`HTTP ${r.status()} ${r.url()}`));
  await page.goto(`${BASE}?bench=10000#/library/all`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => performance.getEntriesByName('data:complete').length > 0, { timeout: 120000 });
  await page.keyboard.press('1');
  await sleep(500);

  await check('library renders cards', async () => {
    await page.waitForSelector('article[data-id]', { timeout: 10000 });
  });

  await check('card menu opens on first click (lazy Radix menu)', async () => {
    await page.click('article[data-id] button[aria-label="More actions"]');
    await page.waitForFunction(() => [...document.querySelectorAll('[role="menuitem"]')].some((e) => e.textContent.includes('Open details')), { timeout: 3000 });
    await page.keyboard.press('Escape');
    await sleep(200);
  });

  await check('tooltip appears on hover (lazy Radix tooltip)', async () => {
    const btn = await page.$('article[data-id] button[aria-label="Star"]');
    const box = await btn.boundingBox();
    await page.mouse.move(box.x + 5, box.y + 5);
    await page.mouse.move(box.x + 8, box.y + 8);
    await page.waitForFunction(() => [...document.querySelectorAll('[role="tooltip"], [data-radix-popper-content-wrapper]')].some((e) => /star/i.test(e.textContent)), { timeout: 3000 });
    await page.mouse.move(5, 5);
  });

  await check('star toggles', async () => {
    const id = await page.$eval('article[data-id]', (e) => e.getAttribute('data-id'));
    const before = await page.$$eval(`article[data-id="${id}"] .fill-amber-400`, (l) => l.length);
    await page.$eval(`article[data-id="${id}"] button[aria-label="Star"]`, (b) => b.click());
    await page.waitForFunction((i, n) => document.querySelectorAll(`article[data-id="${i}"] .fill-amber-400`).length !== n, { timeout: 5000 }, id, before);
    await page.$eval(`article[data-id="${id}"] button[aria-label="Star"]`, (b) => b.click());
  });

  await check('detail panel opens, j moves to next post, Esc closes', async () => {
    await page.$eval('article[data-id] p, article[data-id] div.mt-3', (e) => e.click());
    await page.waitForSelector('[aria-label="Post details"]', { timeout: 3000 });
    const pos1 = await page.$eval('[aria-label="Post details"] header', (h) => h.textContent);
    await page.keyboard.press('j');
    await page.waitForFunction((p) => document.querySelector('[aria-label="Post details"] header')?.textContent !== p, { timeout: 3000 }, pos1);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('[aria-label="Post details"]'), { timeout: 3000 });
  });

  await check('search filters results', async () => {
    await page.keyboard.press('/');
    await page.keyboard.type('python rust', { delay: 20 });
    await page.waitForFunction(() => performance.getEntriesByName('search:painted').length > 0, { timeout: 5000 });
    await sleep(400);
    const count = await page.$eval('h1 + span', (e) => Number(e.textContent.replace(/\D/g, '')));
    if (!(count > 0 && count < 10000)) throw new Error(`unexpected count ${count}`);
    await page.keyboard.press('Escape');
  });

  await check('selection shows bulk bar', async () => {
    await sleep(300);
    await page.$eval('article[data-id] button[role="checkbox"]', (b) => b.click());
    await page.waitForFunction(() => document.body.textContent.includes('1 selected'), { timeout: 3000 });
    await page.keyboard.press('Escape');
  });

  await check('list, table and gallery layouts render', async () => {
    await page.click('body', { offset: { x: 700, y: 20 } }).catch(() => undefined);
    await page.keyboard.press('2');
    await page.waitForSelector('div[data-id]', { timeout: 3000 });
    await page.keyboard.press('3');
    await page.waitForSelector('tr[data-id]', { timeout: 3000 });
    await page.keyboard.press('4');
    await page.waitForFunction(() => document.querySelectorAll('main img').length > 4, { timeout: 3000 });
    await page.keyboard.press('1');
  });

  await check('jump to oldest post (virtualized end of list)', async () => {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForFunction((id) => !!document.querySelector(`[data-id="${id}"]`), { timeout: 5000 }, await page.evaluate(() => window.__benchOldestId));
    await page.evaluate(() => window.scrollTo(0, 0));
  });

  await check('insights loads (lazy chunk) with charts', async () => {
    await page.evaluate(() => (location.hash = '#/insights'));
    await page.waitForSelector('svg[aria-label^="Column chart"] path', { timeout: 10000 });
    await page.screenshot({ path: join(here, 'results', 'insights.png') });
  });

  await check('settings loads (lazy chunk)', async () => {
    await page.evaluate(() => (location.hash = '#/settings/ai'));
    await page.waitForFunction(() => document.body.textContent.includes('AI organization'), { timeout: 10000 });
  });

  await check('command palette opens with Ctrl+K', async () => {
    await page.evaluate(() => (location.hash = '#/home'));
    await sleep(500);
    await page.keyboard.down('Control');
    await page.keyboard.press('k');
    await page.keyboard.up('Control');
    await page.waitForSelector('[cmdk-input]', { timeout: 3000 });
    await page.keyboard.press('Escape');
  });

  await check('home renders stats', async () => {
    await page.waitForFunction(() => document.body.textContent.includes('In your stash'), { timeout: 3000 });
  });

  const popup = await browser.newPage();
  popup.on('pageerror', (e) => errors.push(`popup: ${e.message}`));
  await check('popup renders counts and categories', async () => {
    await popup.goto(`${BASE}?bench=10000&popup`, { waitUntil: 'domcontentloaded' });
    await popup.waitForFunction(() => document.body.textContent.includes('Top categories') && /Stashed\s*[\d,]+/.test(document.body.textContent), { timeout: 30000 });
  });

  await check('no uncaught page errors', async () => {
    const real = errors.filter((e) => !/favicon|ERR_|net::/.test(e));
    if (real.length) throw new Error(real.slice(0, 3).join(' | '));
  });
} finally {
  await browser.close();
  try {
    execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: 'ignore' });
  } catch {
    /* gone */
  }
}
console.log('\nSmoke test');
for (const [n, r] of results) console.log(`${r.startsWith('PASS') ? '✔' : '✖'} ${n}${r.startsWith('PASS') ? '' : ' — ' + r}`);
process.exitCode = results.some(([, r]) => !r.startsWith('PASS')) ? 1 : 0;
