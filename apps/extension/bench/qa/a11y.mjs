#!/usr/bin/env node
/**
 * Accessibility audit with axe-core on every main screen, in dark and light,
 * on desktop and mobile. Uses the preview build produced by the e2e suite.
 *   node bench/qa/a11y.mjs [--build]
 * Exits 1 on any critical or serious violation; writes bench/results/a11y.json.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { launch, newPage } from '../e2e/lib/browser.mjs';
import { PREVIEW_DIST, RESULTS_DIR } from '../e2e/lib/env.mjs';
import { buildPreview, serveStatic } from '../e2e/lib/server.mjs';
import { openApp, setHash } from '../e2e/lib/ui.mjs';

const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const SCREENS = ['#/home', '#/library/all', '#/insights', '#/recall', '#/shelf', '#/ask', '#/wrapped', '#/settings/general', '#/settings/ai', '#/settings/data'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

buildPreview({ skip: !process.argv.includes('--build') });
const server = await serveStatic(PREVIEW_DIST, 5360);
const { browser, close } = await launch('a11y');
const findings = [];
try {
  for (const theme of ['dark', 'light']) {
    for (const viewport of ['desktop', 'mobile']) {
      const { page } = await newPage(browser, { theme, viewport, label: `a11y:${theme}/${viewport}` });
      await openApp(page, server.url, { query: 'demo', hash: '#/home' });
      for (const hash of SCREENS) {
        await setHash(page, hash);
        await sleep(400);
        // Let entrance animations finish: axe would otherwise sample half-faded text as low contrast.
        await page.evaluate(() => Promise.race([Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))), new Promise((r) => setTimeout(r, 3000))]));
        await page.evaluate(AXE);
        const res = await page.evaluate(async () => {
          // Colour contrast is measured on rendered pixels; keep everything else at WCAG 2.1 AA.
          const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] }, resultTypes: ['violations'] });
          return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
        });
        for (const v of res) findings.push({ screen: hash, theme, viewport, ...v });
      }
      await page.close();
    }
  }
} finally {
  await close();
  await server.close();
}

const blocking = findings.filter((f) => f.impact === 'critical' || f.impact === 'serious');
const byRule = {};
for (const f of findings) {
  const k = `${f.impact} · ${f.id}`;
  byRule[k] ??= { help: f.help, where: new Set(), nodes: 0, sample: f.targets };
  byRule[k].where.add(`${f.screen} ${f.theme}/${f.viewport}`);
  byRule[k].nodes += f.nodes;
}
console.log(`\naxe: ${findings.length} violations (${blocking.length} critical/serious) across ${SCREENS.length} screens × 2 themes × 2 viewports`);
for (const [k, v] of Object.entries(byRule).sort()) console.log(`  ${k} — ${v.help} — ${v.nodes} nodes on ${v.where.size} views — e.g. ${v.sample[0] ?? ''}`);
writeFileSync(join(RESULTS_DIR, 'a11y.json'), JSON.stringify({ at: new Date().toISOString(), total: findings.length, blocking: blocking.length, findings }, null, 2));
process.exit(blocking.length ? 1 : 0);
