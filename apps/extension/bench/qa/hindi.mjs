#!/usr/bin/env node
/**
 * The whole dashboard in Hindi: every screen on desktop and phone, both themes.
 * Checks html[lang], console/page errors, horizontal overflow and clipped text
 * (Devanagari is taller and longer than English), and saves screenshots.
 *   node bench/qa/hindi.mjs [--build]
 * Writes bench/results/hindi.json; exits 1 on failure.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, newPage } from '../e2e/lib/browser.mjs';
import { PREVIEW_DIST, RESULTS_DIR, SCRATCH } from '../e2e/lib/env.mjs';
import { Suite, printTable, summarize } from '../e2e/lib/harness.mjs';
import { buildPreview, serveStatic } from '../e2e/lib/server.mjs';
import { clippedText, openApp, overflowReport, setHash } from '../e2e/lib/ui.mjs';

const SCREENS = ['#/home', '#/library/all', '#/insights', '#/recall', '#/shelf', '#/ask', '#/wrapped', '#/settings/general', '#/settings/ai', '#/settings/categories', '#/settings/data'];
const shots = join(SCRATCH, 'hindi-shots');
mkdirSync(shots, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

buildPreview({ skip: !process.argv.includes('--build') });
const server = await serveStatic(PREVIEW_DIST, 5370);
const { browser, close } = await launch('hindi');
const suite = new Suite('hindi');
try {
  for (const theme of ['dark', 'light']) {
    for (const viewport of ['desktop', 'mobile']) {
      const ctx = suite.track(await newPage(browser, { theme, viewport, label: `hi:${theme}/${viewport}` }));
      const { page } = ctx;
      // Same storage the preview shim persists to: the user picked Hindi in Settings.
      await page.evaluateOnNewDocument(() => {
        try {
          const KEY = '__twtdash_preview_storage';
          const cur = JSON.parse(localStorage.getItem(KEY) ?? '{}');
          localStorage.setItem(KEY, JSON.stringify({ ...cur, settings: { ...(cur.settings ?? {}), language: 'hi' } }));
        } catch {
          /* ignore */
        }
      });
      await openApp(page, server.url, { query: 'demo', hash: '#/home' });
      for (const hash of SCREENS) {
        await suite.check(`${hash} in Hindi (${theme}/${viewport})`, async () => {
          await setHash(page, hash);
          await sleep(500);
          const lang = await page.evaluate(() => document.documentElement.lang);
          if (lang !== 'hi') throw new Error(`html lang is "${lang}", expected "hi"`);
          const o = await overflowReport(page);
          if (o.overflow) throw new Error(`horizontal overflow ${o.sw}px > ${o.vw}px: ${o.offenders.map((x) => x.sel).join('; ')}`);
          const clipped = await clippedText(page, 'main');
          if (clipped.length) throw new Error(`clipped text: ${clipped.slice(0, 3).map((c) => `"${c.text}"`).join(', ')}`);
          if (theme === 'dark') await page.screenshot({ path: join(shots, `${hash.replace(/[#/]+/g, '-').replace(/^-/, '')}-${viewport}.png`) });
        });
      }
      await page.close();
      suite.untrack(ctx);
    }
  }
} finally {
  await close();
  await server.close();
  writeFileSync(join(RESULTS_DIR, 'hindi.json'), JSON.stringify({ at: new Date().toISOString(), summary: summarize(suite.results), results: suite.results, screenshots: shots }, null, 2));
  printTable(suite.results, 'Hindi UI');
  process.exitCode = suite.results.some((r) => r.status === 'fail') ? 1 : 0;
}
