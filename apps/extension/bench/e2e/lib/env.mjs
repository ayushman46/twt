/**
 * Shared paths, CLI flags and constants for the QA pipeline
 * (bench/e2e, bench/qa, apps/web/tests).
 *
 * Override with env vars:
 *   QA_SCRATCH   scratch dir for builds, browser profiles, downloads, screenshots
 *   CHROME_PATH  Chrome/Chromium executable
 *   QA_HEADFUL=1 show the browser
 */
import { existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const EXT_ROOT = resolve(here, '..', '..', '..'); // apps/extension
export const REPO_ROOT = resolve(EXT_ROOT, '..', '..');
export const WEB_ROOT = join(REPO_ROOT, 'apps', 'web');
export const RESULTS_DIR = join(EXT_ROOT, 'bench', 'results');

const SESSION_SCRATCH = 'C:\\Users\\Ayush\\AppData\\Local\\Temp\\claude\\C--Users-Ayush-Downloads-twt\\b4332329-e788-4b49-ad4a-dc77917b01c5\\scratchpad\\qa';
export const SCRATCH = process.env.QA_SCRATCH || (existsSync(dirname(SESSION_SCRATCH)) ? SESSION_SCRATCH : join(tmpdir(), 'twtdash-qa'));
export const PREVIEW_DIST = join(SCRATCH, 'preview-dist');
export const VITE_CACHE = join(SCRATCH, 'vite-cache');
export const SHOTS_DIR = join(SCRATCH, 'shots');
export const DOWNLOADS_DIR = join(SCRATCH, 'downloads');
export const PROFILES_DIR = join(SCRATCH, 'profiles');

export const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
export const HEADFUL = process.env.QA_HEADFUL === '1' || process.argv.includes('--headful');

/** Ports reserved for QA: e2e 5320, a11y 5321, robustness 5322, stress 5323. */
export const PORTS = { e2e: 5320, a11y: 5321, robustness: 5322, stress: 5323, spare: 5329 };

export const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 360, height: 740 },
};

for (const d of [SCRATCH, RESULTS_DIR, SHOTS_DIR, DOWNLOADS_DIR, PROFILES_DIR]) mkdirSync(d, { recursive: true });

/** `--name=value` / `--name value` / `--flag` parser. */
export function arg(name, def) {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === `--${name}`) {
      const next = argv[i + 1];
      return next !== undefined && !next.startsWith('--') ? next : true;
    }
    if (a.startsWith(`--${name}=`)) return a.slice(name.length + 3);
  }
  return def;
}

export function listArg(name, def) {
  const v = arg(name, undefined);
  if (v === undefined || v === true) return def;
  return String(v)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}
