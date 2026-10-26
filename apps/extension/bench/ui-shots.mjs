#!/usr/bin/env node
/**
 * Screenshot the dashboard screens for design review.
 *   node bench/ui-shots.mjs <outDir> [--base=http://localhost:5340] [--themes=dark,light] [--routes=home,library,...] [--mobile] [--height=2400]
 * Writes <outDir>/<route>-<theme>[-m].png at 1440×900 (or 390×844 with --mobile).
 */
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const args = process.argv.slice(2);
const outDir = args.find((a) => !a.startsWith('--')) ?? join(tmpdir(), 'twtdash-ui');
const opt = (n, d) => args.find((a) => a.startsWith(`--${n}=`))?.split('=')[1] ?? d;
const BASE = opt('base', 'http://localhost:5340');
const THEMES = opt('themes', 'dark,light').split(',');
const ROUTES = {
  home: '#/home',
  library: '#/library/all',
  detail: '#/library/all',
  insights: '#/insights',
  settings: '#/settings/general',
  ai: '#/settings/ai',
  welcome: '#/welcome',
  recall: '#/recall',
  shelf: '#/shelf',
  ask: '#/ask',
  wrapped: '#/wrapped',
  popup: '&popup',
};
const want = opt('routes', Object.keys(ROUTES).join(',')).split(',');
const mobile = args.includes('--mobile');
const HEIGHT = Number(opt('height', mobile ? 844 : 900));
mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), 'twtdash-ui-'));
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, userDataDir: profile, args: ['--no-first-run', '--hide-scrollbars'] });
const errors = [];
try {
  for (const theme of THEMES) {
    for (const name of want) {
      const page = await browser.newPage();
      page.on('pageerror', (e) => errors.push(`${name}-${theme}: ${e.message}`));
      page.on('console', (m) => m.type() === 'error' && errors.push(`${name}-${theme} console: ${m.text().slice(0, 160)}`));
      await page.setViewport(mobile ? { width: 390, height: HEIGHT, deviceScaleFactor: 2, isMobile: true } : { width: 1440, height: HEIGHT, deviceScaleFactor: 1 });
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme === 'dark' ? 'dark' : 'light' }]);
      const hash = ROUTES[name];
      const url = hash.startsWith('&') ? `${BASE}/?demo${hash}` : `${BASE}/?demo${hash}`;
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 120000 });
      if (!hash.startsWith('&')) await page.waitForSelector('main, [data-page]', { timeout: 60000 }).catch(() => {});
      await sleep(1500);
      if (name === 'detail') {
        await page.evaluate(() => document.querySelector('main article[data-id] div.mt-3, main article[data-id]')?.click());
        await sleep(900);
      }
      const file = join(outDir, `${name}-${theme}${mobile ? '-m' : ''}.png`);
      await page.screenshot({ path: file });
      console.log('saved', file);
      await page.close();
    }
  }
} finally {
  await browser.close();
  rmSync(profile, { recursive: true, force: true });
}
if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
