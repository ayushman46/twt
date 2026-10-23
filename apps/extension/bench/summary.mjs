#!/usr/bin/env node
/** Print a before/after table across benchmark stages: node bench/summary.mjs */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'results');
const files = readdirSync(dir)
  .filter((f) => /^\d+-.*\.json$/.test(f))
  .sort((a, b) => parseInt(a) - parseInt(b));
const stages = files.map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
const rows = [
  ['startup_libraryPainted', 'Startup → library painted (ms)'],
  ['startup_dataComplete', 'Startup → full library loaded (ms)'],
  ['startup_boot', 'JS evaluated (ms)'],
  ['startup_longTaskMs', 'Main-thread long tasks during startup (ms)'],
  ['nav_library', 'Switch → Library (ms)'],
  ['nav_category', 'Switch → Category (ms)'],
  ['nav_home', 'Switch → Home (ms)'],
  ['nav_insights', 'Switch → Insights (ms)'],
  ['star_ms', 'Star a post → UI updated (ms)'],
  ['search_keyMedianMs', 'Search keystroke → results (ms)'],
  ['scroll_avgFps', 'Scrolling FPS'],
  ['scroll_p95FrameMs', 'Scroll p95 frame (ms)'],
  ['oldest_ms', 'Reach oldest post (ms)'],
  ['popup_painted', 'Popup open → counts (ms)'],
  ['domNodesAfterScroll', 'DOM nodes after scrolling'],
  ['heapMB', 'JS heap (MB)'],
];
const fmt = (v) => (v === null || v === undefined ? '>60000' : typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(1)) : String(v));
const head = ['Metric', ...stages.map((s) => s.label)];
console.log(`| ${head.join(' | ')} |`);
console.log(`|${head.map(() => '---').join('|')}|`);
// Older stages predate the data:complete mark; their whole library arrived at data:ready.
const value = (s, k) => (k === 'startup_dataComplete' && s.summary[k] === undefined ? s.summary.startup_dataReady : s.summary[k]);
for (const [k, name] of rows) console.log(`| ${name} | ${stages.map((s) => fmt(value(s, k))).join(' | ')} |`);
