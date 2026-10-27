#!/usr/bin/env node
/**
 * Lighthouse (mobile, default simulated throttling) for the key pages.
 *
 *   node tests/lighthouse.mjs [baseUrl] [--runs=3] [--cpu=N]   (default http://localhost:3302)
 *
 * Runs `npx --yes lighthouse@12` per page, keeps the median run (by
 * performance) and writes category scores plus core metrics to
 * tests/results/lighthouse.json. Exit code 1 when a page misses the targets:
 * performance ≥ 90, accessibility / best practices / SEO ≥ 95.
 * Run it against a production build (`npx next build && npx next start -p 3302`).
 *
 * Default throttling (4x CPU) assumes a high-end desktop host. On a slower
 * host Lighthouse warns and `benchmarkIndex` in the results is low; pass
 * `--cpu=N` to set the CPU multiplier per the calibration table in
 * Lighthouse's docs/throttling.md. That run is stored under its own key
 * ("cpu-Nx") and never replaces the default one.
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const BASE = (args.find((a) => !a.startsWith("--")) || "http://localhost:3302").replace(/\/+$/, "");
const RUNS = Math.max(1, Number(args.find((a) => a.startsWith("--runs="))?.slice(7)) || 3);
const CPU = Number(args.find((a) => a.startsWith("--cpu="))?.slice(6)) || null;
const MODE = CPU ? `cpu-${CPU}x` : "default";
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PAGES = ["/", "/hi", "/install"];
const TARGETS = { performance: 90, accessibility: 95, "best-practices": 95, seo: 95 };
const METRICS = {
  "first-contentful-paint": "FCP",
  "largest-contentful-paint": "LCP",
  "total-blocking-time": "TBT",
  "cumulative-layout-shift": "CLS",
  "speed-index": "SI",
};

function lighthouse(url, outputPath) {
  const command = [
    "npx",
    "--yes",
    "lighthouse@12",
    `"${url}"`,
    `--chrome-path="${CHROME}"`,
    '--chrome-flags="--headless=new"',
    "--output=json",
    `--output-path="${outputPath}"`,
    "--quiet",
    ...(CPU ? [`--throttling.cpuSlowdownMultiplier=${CPU}`] : []),
  ].join(" ");
  const res = spawnSync(command, { shell: true, stdio: ["ignore", "ignore", "pipe"], encoding: "utf8", timeout: 240_000 });
  if (res.status !== 0) throw new Error(`lighthouse failed for ${url}: ${res.stderr?.slice(-2000)}`);
  const report = JSON.parse(readFileSync(outputPath, "utf8"));
  if (report.runtimeError) throw new Error(`lighthouse runtime error for ${url}: ${report.runtimeError.message}`);
  const scores = Object.fromEntries(Object.keys(TARGETS).map((k) => [k, Math.round((report.categories[k]?.score ?? 0) * 100)]));
  const metrics = Object.fromEntries(Object.entries(METRICS).map(([id, label]) => [label, report.audits[id]?.displayValue ?? null]));
  // Audits that cost points in the non-performance categories, for quick triage.
  const failing = [];
  for (const key of ["accessibility", "best-practices", "seo"]) {
    for (const ref of report.categories[key]?.auditRefs ?? []) {
      const audit = report.audits[ref.id];
      if (ref.weight > 0 && audit && audit.score !== null && audit.score < 1) failing.push(`${key}: ${ref.id}`);
    }
  }
  const opportunities = Object.values(report.audits)
    .filter((a) => a.details?.type === "opportunity" && (a.details.overallSavingsMs ?? 0) >= 100)
    .map((a) => `${a.id} (${Math.round(a.details.overallSavingsMs)} ms)`);
  return {
    scores,
    metrics,
    failing,
    opportunities,
    benchmarkIndex: Math.round(report.environment?.benchmarkIndex ?? 0),
    cpuSlowdownMultiplier: report.configSettings?.throttling?.cpuSlowdownMultiplier,
    warnings: report.runWarnings ?? [],
    lighthouseVersion: report.lighthouseVersion,
    formFactor: report.configSettings?.formFactor,
  };
}

const work = mkdtempSync(join(tmpdir(), "twtdash-lighthouse-"));
const pages = {};
let ok = true;
try {
  for (const path of PAGES) {
    const url = `${BASE}${path}`;
    const runs = [];
    for (let i = 0; i < RUNS; i++) {
      process.stdout.write(`\r  ${path} run ${i + 1}/${RUNS}   `);
      runs.push(lighthouse(url, join(work, `run-${i}.json`)));
    }
    runs.sort((a, b) => a.scores.performance - b.scores.performance);
    const median = runs[Math.floor(runs.length / 2)];
    const misses = Object.entries(TARGETS)
      .filter(([k, min]) => median.scores[k] < min)
      .map(([k]) => k);
    if (misses.length) ok = false;
    pages[path] = {
      url,
      median,
      misses,
      runs: runs.map((r) => ({ scores: r.scores, metrics: r.metrics, benchmarkIndex: r.benchmarkIndex })),
    };
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
process.stdout.write("\n");

const first = Object.values(pages)[0]?.median;
console.log(
  `\nLighthouse ${first?.lighthouseVersion} · ${first?.formFactor} · CPU ${first?.cpuSlowdownMultiplier}x (${MODE}) · median of ${RUNS} · host benchmarkIndex ${first?.benchmarkIndex}`,
);
for (const w of new Set(Object.values(pages).flatMap((p) => p.median.warnings))) console.log(`  warning: ${w.replace(/\s+/g, " ").slice(0, 160)}`);
console.log(`${"page".padEnd(10)}${"perf".padEnd(6)}${"a11y".padEnd(6)}${"bp".padEnd(6)}${"seo".padEnd(6)}FCP / LCP / TBT / CLS / SI`);
for (const [path, p] of Object.entries(pages)) {
  const s = p.median.scores;
  const m = p.median.metrics;
  console.log(
    `${path.padEnd(10)}${String(s.performance).padEnd(6)}${String(s.accessibility).padEnd(6)}${String(s["best-practices"]).padEnd(6)}${String(s.seo).padEnd(6)}${[m.FCP, m.LCP, m.TBT, m.CLS, m.SI].join(" / ")}${p.misses.length ? `   below target: ${p.misses.join(", ")}` : ""}`,
  );
  if (p.median.failing.length) console.log(`          failing audits: ${p.median.failing.join(", ")}`);
}

mkdirSync(join(here, "results"), { recursive: true });
const file = join(here, "results", "lighthouse.json");
let saved = {};
try {
  saved = JSON.parse(readFileSync(file, "utf8"));
  if (saved.pages) saved = {}; // older single-mode format
} catch {
  // First run.
}
saved[MODE] = { baseUrl: BASE, finishedAt: new Date().toISOString(), runsPerPage: RUNS, targets: TARGETS, pass: ok, pages };
writeFileSync(file, `${JSON.stringify(saved, null, 2)}\n`);
console.log(`Results written to ${file} (key "${MODE}")`);
process.exit(ok ? 0 : 1);
