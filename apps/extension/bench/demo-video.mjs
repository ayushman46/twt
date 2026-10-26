#!/usr/bin/env node
/**
 * Record the product walkthrough used in the README.
 *   node bench/demo-video.mjs [--skip-build]
 * Drives the production preview build (sample library) in headless Chrome,
 * records it with Puppeteer's screencast, and writes:
 *   docs/media/twtdash-demo.mp4    (H.264, faststart)
 *   docs/media/demo-poster.webp    (a clean library frame with a play button)
 * Needs ffmpeg on PATH.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { PREVIEW_DIST } from './e2e/lib/env.mjs';
import { buildPreview, serveStatic } from './e2e/lib/server.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const media = resolve(here, '../../../docs/media');
mkdirSync(media, { recursive: true });
const W = 1440;
const H = 900;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

buildPreview({ skip: process.argv.includes('--skip-build') });
const server = await serveStatic(PREVIEW_DIST, 5350);
const work = mkdtempSync(join(tmpdir(), 'twtdash-demo-'));
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  userDataDir: join(work, 'profile'),
  args: ['--no-first-run', '--hide-scrollbars', `--window-size=${W},${H}`],
});

/** A visible cursor, click ripples and a caption bar, styled like the app (injected before every load). */
const OVERLAY = () => {
  const install = () => {
    if (document.getElementById('__demo')) return;
    const root = document.createElement('div');
    root.id = '__demo';
    root.innerHTML = `
      <div id="__cur" style="position:fixed;left:0;top:0;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:rgba(242,242,240,.92);box-shadow:0 0 0 1.5px rgba(12,12,13,.55),0 2px 8px rgba(0,0,0,.35);z-index:2147483647;pointer-events:none;transition:transform .12s ease-out;transform:translate(-100px,-100px)"></div>
      <div id="__cap" style="position:fixed;left:50%;bottom:28px;transform:translateX(-50%) translateY(8px);opacity:0;transition:opacity .25s ease-out,transform .25s ease-out;z-index:2147483646;pointer-events:none;padding:10px 18px;border-radius:12px;background:#141416;border:1px solid rgba(255,255,255,.1);box-shadow:0 18px 48px -16px rgba(0,0,0,.7);color:#f2f2f0;font:500 16px/1.4 'Geist Variable',ui-sans-serif,system-ui,'Nirmala UI',sans-serif;letter-spacing:-.01em;white-space:nowrap"></div>`;
    document.documentElement.appendChild(root);
    const cur = document.getElementById('__cur');
    let x = -100;
    let y = -100;
    addEventListener('mousemove', (e) => {
      x = e.clientX;
      y = e.clientY;
      cur.style.transform = `translate(${x}px,${y}px)`;
    }, true);
    addEventListener('mousedown', () => (cur.style.transform = `translate(${x}px,${y}px) scale(.8)`), true);
    addEventListener('mouseup', () => (cur.style.transform = `translate(${x}px,${y}px)`), true);
    window.__caption = (text) => {
      const cap = document.getElementById('__cap');
      if (!text) {
        cap.style.opacity = '0';
        cap.style.transform = 'translateX(-50%) translateY(8px)';
        return;
      }
      cap.textContent = text;
      cap.style.opacity = '1';
      cap.style.transform = 'translateX(-50%) translateY(0)';
    };
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
};

try {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await page.evaluateOnNewDocument(OVERLAY);

  const base = server.url.replace(/\/$/, '');
  // Seed the sample library first (not recorded), then reload into a clean state.
  await page.goto(`${base}/?demo#/home`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => performance.getEntriesByName('data:complete').length > 0, { timeout: 120_000 });
  await page.goto(`${base}/#/home`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => performance.getEntriesByName('data:complete').length > 0, { timeout: 120_000 });
  // The sample-data banner is for real users; hide it for the film (same approach as bench/screenshots.mjs).
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('main > div')) if (/exploring sample data/i.test(el.textContent ?? '')) el.style.display = 'none';
  });
  await sleep(800);

  let mx = W / 2;
  let my = H / 2;
  const caption = (text) => page.evaluate((t) => window.__caption?.(t), text);
  const moveTo = async (x, y, steps = 24) => {
    await page.mouse.move(x, y, { steps });
    mx = x;
    my = y;
  };
  const center = async (handle) => {
    const b = await handle.boundingBox();
    return b ? [b.x + b.width / 2, b.y + b.height / 2] : null;
  };
  const clickHandle = async (handle) => {
    const c = await center(handle);
    if (!c) return false;
    await moveTo(c[0], c[1]);
    await sleep(120);
    await page.mouse.down();
    await sleep(60);
    await page.mouse.up();
    return true;
  };
  const byText = (sel, re) => page.evaluateHandle((s, src) => [...document.querySelectorAll(s)].find((e) => new RegExp(src, 'i').test(e.textContent ?? '') && e.getBoundingClientRect().width > 0), sel, re.source);
  const clickText = async (sel, re) => {
    const h = await byText(sel, re);
    const el = h.asElement();
    if (!el) throw new Error(`demo: nothing matches ${re} in ${sel}`);
    await clickHandle(el);
  };
  const nav = async (re, settle = 1100) => {
    await clickText('aside nav button', re);
    await sleep(settle);
  };

  const webm = join(work, 'demo.webm');
  const recorder = await page.screencast({ path: webm, fps: 30, quality: 18 });
  await moveTo(W * 0.55, H * 0.45, 1);

  // 1 · Home
  await caption('Your X bookmarks, organized.');
  await sleep(2600);
  await page.mouse.wheel({ deltaY: 520 });
  await sleep(1400);
  await page.mouse.wheel({ deltaY: -520 });
  await sleep(700);

  // 2 · Library
  await caption('Every post sorted on your device');
  await nav(/^\s*all bookmarks/);
  await sleep(1200);
  await page.screenshot({ path: join(work, 'poster.png') });

  // 3 · Search with operators
  await caption('Search as you type, with operators');
  const search = await page.$('main input[type="search"], main input');
  if (search) {
    await clickHandle(search);
    await page.keyboard.type('cat:ai has:link', { delay: 70 });
    await sleep(1600);
    await page.keyboard.down('Control');
    await page.keyboard.press('a');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('agents', { delay: 80 });
    await sleep(1500);
    await page.keyboard.press('Escape');
    await page.evaluate(() => document.activeElement?.blur());
    await sleep(600);
  }

  // 4 · Layouts
  await caption('Grid, list, table and gallery');
  for (const k of ['2', '3', '4', '1']) {
    await page.keyboard.press(k);
    await sleep(1000);
  }

  // 5 · Detail panel
  await caption('Notes, tags and collections on every post');
  const card = await page.$('main article[data-id]');
  if (card) {
    const b = await card.boundingBox();
    await moveTo(b.x + b.width / 2, b.y + 70);
    await page.mouse.down();
    await page.mouse.up();
    await sleep(1700);
    await page.keyboard.press('j');
    await sleep(900);
    await page.keyboard.press('j');
    await sleep(1100);
    await page.keyboard.press('Escape');
    await sleep(600);
  }

  // 6 · Command palette
  await caption('Jump anywhere with Ctrl K');
  await page.keyboard.down('Control');
  await page.keyboard.press('k');
  await page.keyboard.up('Control');
  await sleep(500);
  await page.keyboard.type('design', { delay: 90 });
  await sleep(1600);
  await page.keyboard.press('Escape');
  await sleep(500);

  // 7 · Recall
  await caption('Recall brings back what you saved, a few posts a day');
  await nav(/^\s*recall/, 1600);
  for (const k of ['2', '2']) {
    await page.keyboard.press(k);
    await sleep(1300);
  }

  // 8 · Shelf
  await caption('Shelf collects every repo, paper, video and tool');
  await nav(/^\s*shelf/, 1800);
  await page.mouse.wheel({ deltaY: 360 });
  await sleep(1200);

  // 9 · Insights
  await caption('Insights: what you save, and when');
  await nav(/^\s*insights/, 2400);

  // 10 · Wrapped
  await caption('Wrapped: your year in bookmarks');
  await nav(/^\s*wrapped/, 1500);
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('ArrowRight');
    await sleep(1300);
  }
  await page.keyboard.press('Escape');

  // 11 · Hindi
  await caption('हिन्दी और आठ और भारतीय भाषाओं में');
  await page.evaluate(() => (location.hash = '#/settings/general'));
  await sleep(1000);
  const picked = await page.evaluate(() => {
    const sel = [...document.querySelectorAll('main select')].find((s) => [...s.options].some((o) => o.value === 'hi'));
    if (!sel) return false;
    sel.id = '__lang';
    return true;
  });
  if (picked) {
    await page.select('#__lang', 'hi');
    await sleep(1200);
    await page.evaluate(() => (location.hash = '#/home'));
    await sleep(2400);
    await page.evaluate(() => (location.hash = '#/settings/general'));
    await sleep(700);
    await page.evaluate(() => {
      const sel = [...document.querySelectorAll('main select')].find((s) => [...s.options].some((o) => o.value === 'hi'));
      if (sel) sel.id = '__lang';
    });
    await page.select('#__lang', 'auto').catch(() => page.select('#__lang', 'en'));
    await sleep(600);
  }

  // 12 · Light theme
  await caption('Dark and light, in sync with your system');
  await page.evaluate(() => (location.hash = '#/library/all'));
  await sleep(900);
  const toggle = await page.$('aside button[aria-label="Toggle theme"]');
  if (toggle) await clickHandle(toggle);
  await sleep(2200);

  // 13 · End card
  await caption('');
  await page.evaluate(() => {
    const end = document.createElement('div');
    end.style.cssText = 'position:fixed;inset:0;z-index:2147483645;display:grid;place-items:center;background:#0c0c0d;opacity:0;transition:opacity .5s ease-out;font-family:"Geist Variable",ui-sans-serif,system-ui,sans-serif';
    end.innerHTML = `<div style="text-align:center;color:#f2f2f0">
      <svg viewBox="0 0 128 128" width="76" height="76" aria-hidden="true"><rect width="128" height="128" rx="28" fill="#3D5BD9"/><path transform="translate(-2 0)" d="M44 24h44a7 7 0 0 1 7 7v71.2a3.2 3.2 0 0 1-5 2.6L66 88 42 104.8a3.2 3.2 0 0 1-5-2.6V31a7 7 0 0 1 7-7z" fill="#fff"/><rect x="52" y="49" width="24" height="9" rx="4.5" fill="#3D5BD9"/></svg>
      <div style="margin-top:22px;font-size:44px;font-weight:600;letter-spacing:-.03em">twtdash</div>
      <div style="margin-top:8px;font-size:19px;color:#8f8f8a">Your X bookmarks, organized.</div>
      <div style="margin-top:28px;font-size:15px;color:#cfcfcb">twtdash.vercel.app</div></div>`;
    document.body.appendChild(end);
    requestAnimationFrame(() => (end.style.opacity = '1'));
  });
  await moveTo(W + 40, H + 40, 10);
  await sleep(3200);
  await recorder.stop();

  // Encode for GitHub: H.264, yuv420p, faststart, 30 fps.
  const mp4 = join(media, 'twtdash-demo.mp4');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', webm, '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p', '-r', '30', '-movflags', '+faststart', '-an', mp4], { stdio: 'inherit' });

  // Poster: the clean library frame with a quiet play button.
  const play = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><g transform="translate(${W / 2},${H / 2})"><circle r="44" fill="rgba(12,12,13,0.78)" stroke="rgba(255,255,255,0.28)" stroke-width="1.5"/><path d="M-11 -17 L21 0 L-11 17 Z" fill="#f2f2f0"/></g></svg>`);
  await sharp(join(work, 'poster.png')).composite([{ input: play }]).webp({ quality: 88 }).toFile(join(media, 'demo-poster.webp'));
  console.log(`wrote ${mp4} and demo-poster.webp`);
} finally {
  await browser.close();
  await server.close?.();
  rmSync(work, { recursive: true, force: true });
}
