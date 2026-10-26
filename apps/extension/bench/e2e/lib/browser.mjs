/**
 * Chrome launcher + page factory with error capture.
 *
 * Every page records page errors, console.error, failed same-origin
 * requests and HTTP >= 400 responses. Requests to other hosts are answered
 * locally (placeholder image / blocked) so runs are deterministic and
 * offline-safe, and are listed so the report can flag unexpected network use.
 */
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import puppeteer from 'puppeteer-core';
import { CHROME, HEADFUL, PROFILES_DIR, VIEWPORTS, sleep } from './env.mjs';

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

/** Solid-colour RGB PNG (valid file, generated so no binary blob lives in the repo). */
export function makePng(w = 16, h = 16, rgb = [128, 128, 140]) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => rgb).flat())]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// Neutral grey image served for every external image request.
const PLACEHOLDER_PNG = makePng(32, 20);

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

export async function launch(name = 'qa', { headless = !HEADFUL, extraArgs = [] } = {}) {
  const userDataDir = mkdtempSync(join(PROFILES_DIR, `${name.replace(/[^\w-]/g, '_')}-`));
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless,
    userDataDir,
    protocolTimeout: 300_000,
    args: [
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--lang=en-US',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--disable-features=Translate,MediaRouter,OptimizationHints',
      '--hide-scrollbars',
      ...extraArgs,
    ],
    defaultViewport: null,
  });
  const close = async () => {
    // Chrome on Windows can take ~20 s to exit gracefully; give it 1.5 s, then kill the tree.
    const proc = browser.process();
    try {
      await Promise.race([browser.close(), sleep(1500)]);
    } catch {
      /* already gone */
    }
    if (proc && proc.exitCode === null) {
      try {
        if (process.platform === 'win32') execSync(`taskkill /pid ${proc.pid} /T /F`, { stdio: 'ignore' });
        else proc.kill('SIGKILL');
      } catch {
        /* exited meanwhile */
      }
      await sleep(300);
    }
    for (let i = 0; i < 20; i++) {
      try {
        rmSync(userDataDir, { recursive: true, force: true });
        break;
      } catch {
        await sleep(300);
      }
    }
  };
  return { browser, userDataDir, close };
}

/**
 * New tab with viewport/theme emulation and error capture.
 * Returns { page, log } where log = { errors: [{t,msg}], warnings, external:Set, dialogs: [] }.
 */
export async function newPage(browser, { viewport = 'desktop', theme = 'dark', intercept = true, dialog = 'accept', label = '' } = {}) {
  const page = await browser.newPage();
  const vp = typeof viewport === 'string' ? VIEWPORTS[viewport] : viewport;
  const mobile = vp.width < 600;
  await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }]);
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
  page.setDefaultTimeout(20_000);

  const log = { errors: [], warnings: [], external: new Set(), dialogs: [], label };
  const push = (msg) => log.errors.push({ t: Date.now(), msg: String(msg).slice(0, process.env.QA_DEBUG_BUILD ? 4000 : 600) });
  const isLocal = (u) => {
    try {
      const url = new URL(u);
      return url.protocol === 'data:' || url.protocol === 'blob:' || LOCAL_HOSTS.has(url.hostname);
    } catch {
      return true;
    }
  };

  // With QA_DEBUG_BUILD=1 (unminified build) the first stack frames are attached, so the culprit is readable.
  const frames = (e) => (process.env.QA_DEBUG_BUILD && e?.stack ? ' | ' + String(e.stack).split('\n').slice(1, 9).map((l) => l.trim()).join(' | ') : '');
  page.on('pageerror', (e) => push(`pageerror: ${e?.message ?? e}${frames(e)}`));
  page.on('console', (m) => {
    const type = m.type();
    const text = m.text();
    if (type === 'error') {
      // Resource failures are reported (deduplicated) by the network listeners below.
      if (/^Failed to load resource/i.test(text)) return;
      push(`console.error: ${text}`);
    } else if (type === 'warn' || type === 'warning') log.warnings.push(text.slice(0, 300));
  });
  page.on('requestfailed', (r) => {
    const f = r.failure()?.errorText ?? '';
    if (!isLocal(r.url()) || /ERR_ABORTED|ERR_BLOCKED_BY_CLIENT/.test(f)) return;
    push(`requestfailed: ${r.url()} ${f}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400 && isLocal(r.url())) push(`HTTP ${r.status()} ${r.url()}`);
  });
  page.on('dialog', async (d) => {
    log.dialogs.push({ type: d.type(), message: d.message() });
    try {
      const policy = page.__qaDialog ?? dialog;
      if (d.type() === 'prompt' && policy === 'accept') await d.accept(page.__qaPromptValue ?? d.defaultValue());
      else if (policy === 'accept') await d.accept();
      else await d.dismiss();
    } catch {
      /* closed */
    }
  });

  if (intercept) {
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (req.isInterceptResolutionHandled?.()) return;
      const url = req.url();
      if (isLocal(url)) return void req.continue().catch(() => undefined);
      try {
        log.external.add(new URL(url).hostname);
      } catch {
        /* ignore */
      }
      if (req.resourceType() === 'image') {
        return void req.respond({ status: 200, contentType: 'image/png', body: PLACEHOLDER_PNG, headers: { 'access-control-allow-origin': '*' } }).catch(() => undefined);
      }
      return void req.abort('blockedbyclient').catch(() => undefined);
    });
  }

  await page.evaluateOnNewDocument(() => {
    window.__qaLongTasks = [];
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) window.__qaLongTasks.push({ start: Math.round(e.startTime), dur: Math.round(e.duration) });
      }).observe({ type: 'longtask', buffered: true });
    } catch {
      /* unsupported */
    }
  });
  return { page, log };
}

/** Allow downloads from this page into `dir` (Chrome DevTools Protocol). */
export async function allowDownloads(page, dir) {
  const cdp = await page.browser().target().createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dir, eventsEnabled: true });
  return cdp;
}
