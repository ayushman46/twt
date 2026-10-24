/**
 * Minimal check runner: named checks with timeouts, per-check error
 * attribution (any page error / console.error during a check fails it),
 * failure screenshots and structured results.
 */
import { join } from 'node:path';
import { SHOTS_DIR } from './env.mjs';

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

export class Suite {
  constructor(group) {
    this.group = group;
    this.results = [];
    /** @type {Array<{page: import('puppeteer-core').Page, log: any}>} */
    this.tracked = [];
    this.current = null;
    this.metrics = {};
    this.started = Date.now();
  }

  /** Register a page whose errors are attributed to the running check. */
  track(ctx) {
    this.tracked.push(ctx);
    this.current = ctx;
    return ctx;
  }

  untrack(ctx) {
    this.tracked = this.tracked.filter((c) => c !== ctx);
    if (this.current === ctx) this.current = this.tracked[this.tracked.length - 1] ?? null;
  }

  errorsSince(t0, allow) {
    const out = [];
    for (const { log } of this.tracked) {
      for (const e of log.errors) {
        if (e.t >= t0 && !(allow && allow.test(e.msg))) out.push(`${log.label ? `[${log.label}] ` : ''}${e.msg}`);
      }
    }
    return out;
  }

  /**
   * Run one check.
   * opts: { timeout=60000, allowErrors: RegExp, page (for screenshot), soft: true → 'warn' instead of 'fail' }
   * fn may return { data, note, warn } to attach metrics / downgrade to a warning.
   */
  async check(name, fn, opts = {}) {
    const t0 = Date.now();
    const result = { group: this.group, name, status: 'pass', ms: 0 };
    let timer;
    try {
      const out = await Promise.race([
        fn(),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error(`timed out after ${opts.timeout ?? 60_000}ms`)), opts.timeout ?? 60_000);
        }),
      ]);
      if (out && typeof out === 'object') {
        if (out.data !== undefined) result.data = out.data;
        if (out.note) result.note = out.note;
        if (out.warn) {
          result.status = 'warn';
          result.error = out.warn;
        }
      }
    } catch (e) {
      result.status = opts.soft ? 'warn' : 'fail';
      result.error = String(e?.message ?? e)
        .split('\n')
        .slice(0, 6)
        .join(' | ')
        .slice(0, 1200);
    } finally {
      clearTimeout(timer);
    }
    // Let late async errors (rejected promises, effects) land before attributing.
    await new Promise((r) => setTimeout(r, opts.settleMs ?? 120));
    const errs = this.errorsSince(t0, opts.allowErrors);
    if (errs.length && !opts.ignoreErrors) {
      result.status = 'fail';
      result.error = [result.error, `page errors: ${errs.slice(0, 4).join(' || ')}${errs.length > 4 ? ` (+${errs.length - 4} more)` : ''}`].filter(Boolean).join(' — ');
      result.pageErrors = errs.slice(0, 20);
    }
    result.ms = Date.now() - t0;
    if (result.status !== 'pass') {
      const page = opts.page ?? this.current?.page;
      if (page && !page.isClosed()) {
        const file = join(SHOTS_DIR, `${slug(this.group)}--${slug(name)}.png`);
        try {
          await page.screenshot({ path: file });
          result.screenshot = file;
        } catch {
          /* page gone */
        }
      }
    }
    this.results.push(result);
    const icon = result.status === 'pass' ? '✔' : result.status === 'warn' ? '!' : result.status === 'skip' ? '-' : '✖';
    console.log(`  ${icon} [${this.group}] ${name} (${result.ms}ms)${result.error ? ` — ${result.error.slice(0, 300)}` : ''}`);
    return result;
  }

  skip(name, reason) {
    this.results.push({ group: this.group, name, status: 'skip', ms: 0, error: reason });
    console.log(`  - [${this.group}] ${name} — skipped: ${reason}`);
  }

  metric(key, value) {
    this.metrics[key] = value;
  }

  /** Fail-only-on-errors sweep for anything that happened outside checks. */
  async finalStrayErrors() {
    return this.check('no stray page errors outside checks', async () => {
      const stray = this.errorsSince(this.started).filter((m) => !this.results.some((r) => r.pageErrors?.some((p) => p === m)));
      if (stray.length) throw new Error(stray.slice(0, 4).join(' || '));
    });
  }
}

export function summarize(results) {
  const count = (s) => results.filter((r) => r.status === s).length;
  return { total: results.length, pass: count('pass'), fail: count('fail'), warn: count('warn'), skip: count('skip') };
}

export function printTable(results, title = 'Results') {
  const groups = [...new Set(results.map((r) => r.group))];
  console.log(`\n${title}`);
  console.log('group'.padEnd(14) + 'pass'.padStart(6) + 'fail'.padStart(6) + 'warn'.padStart(6) + 'skip'.padStart(6));
  for (const g of groups) {
    const rs = results.filter((r) => r.group === g);
    const s = summarize(rs);
    console.log(g.padEnd(14) + String(s.pass).padStart(6) + String(s.fail).padStart(6) + String(s.warn).padStart(6) + String(s.skip).padStart(6));
  }
  const s = summarize(results);
  console.log('TOTAL'.padEnd(14) + String(s.pass).padStart(6) + String(s.fail).padStart(6) + String(s.warn).padStart(6) + String(s.skip).padStart(6));
  const bad = results.filter((r) => r.status === 'fail' || r.status === 'warn');
  if (bad.length) {
    console.log('\nFailures & warnings:');
    for (const r of bad) console.log(`${r.status === 'fail' ? '✖' : '!'} [${r.group}] ${r.name}\n    ${r.error ?? ''}${r.screenshot ? `\n    screenshot: ${r.screenshot}` : ''}`);
  }
}
