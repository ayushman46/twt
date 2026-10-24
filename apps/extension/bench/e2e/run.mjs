#!/usr/bin/env node
/**
 * twtdash end-to-end scenario suite (preview harness + headless Chrome).
 *
 *   node bench/e2e/run.mjs [--only=group1,group2] [--skip=group] [--skip-build]
 *                          [--stress-sizes=10000,50000] [--themes=dark,light]
 *                          [--viewports=desktop,tablet,mobile] [--headful] [--port=5320]
 *
 * Groups: welcome, routes, library, actions, bulk, detail, palette, shortcuts,
 *         organize, data, theme, popup, mobile, stress
 *
 * Builds the preview into the QA scratch dir, serves it on 127.0.0.1:5320,
 * runs every group in a fresh Chrome profile, prints a pass/fail table and
 * writes bench/results/e2e.json. Exit code 1 when any check fails.
 */
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PORTS, PREVIEW_DIST, RESULTS_DIR, SCRATCH, arg, listArg } from './lib/env.mjs';
import { Suite, printTable, summarize } from './lib/harness.mjs';
import { buildPreview, serveStatic } from './lib/server.mjs';

export const GROUPS = ['welcome', 'routes', 'library', 'actions', 'bulk', 'detail', 'palette', 'shortcuts', 'organize', 'data', 'theme', 'popup', 'mobile', 'stress'];

export async function runE2E({ only, skip = [], skipBuild = false, port = PORTS.e2e, out = join(RESULTS_DIR, 'e2e.json'), opts = {} } = {}) {
  const t0 = Date.now();
  const build = buildPreview({ skip: skipBuild });
  const server = await serveStatic(PREVIEW_DIST, port);
  console.log(`[e2e] serving ${PREVIEW_DIST} at ${server.url}`);
  const selected = GROUPS.filter((g) => (!only || only.includes(g)) && !skip.includes(g));
  const results = [];
  const metrics = {};
  try {
    for (const g of selected) {
      console.log(`\n▶ ${g}`);
      const suite = new Suite(g);
      const gt0 = Date.now();
      try {
        const mod = await import(`./groups/${g}.mjs`);
        await mod.run({ base: server.url, suite, opts });
      } catch (e) {
        suite.results.push({ group: g, name: 'group crashed', status: 'fail', ms: Date.now() - gt0, error: String(e?.stack ?? e).split('\n').slice(0, 5).join(' | ') });
        console.log(`  ✖ [${g}] group crashed — ${String(e?.message ?? e)}`);
      }
      results.push(...suite.results);
      if (Object.keys(suite.metrics).length) metrics[g] = suite.metrics;
      console.log(`  (${g}: ${((Date.now() - gt0) / 1000).toFixed(1)}s)`);
    }
  } finally {
    await server.close();
  }
  const report = {
    suite: 'e2e',
    startedAt: new Date(t0).toISOString(),
    durationMs: Date.now() - t0,
    build: { dir: PREVIEW_DIST, ms: build.ms, skipped: build.skipped },
    scratch: SCRATCH,
    groups: selected,
    summary: summarize(results),
    metrics,
    results,
  };
  writeFileSync(out, JSON.stringify(report, null, 2));
  printTable(results, 'E2E results');
  console.log(`\nwrote ${out} (${(report.durationMs / 1000).toFixed(0)}s)`);
  return report;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const report = await runE2E({
    only: listArg('only'),
    skip: listArg('skip', []),
    skipBuild: !!arg('skip-build', false),
    port: Number(arg('port', PORTS.e2e)),
    opts: {
      stressSizes: listArg('stress-sizes', ['10000', '50000']).map(Number),
      themes: listArg('themes', ['dark', 'light']),
      viewports: listArg('viewports', ['desktop', 'tablet', 'mobile']),
    },
  });
  process.exitCode = report.summary.fail ? 1 : 0;
}
