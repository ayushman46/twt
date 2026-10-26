/**
 * Large libraries (synthetic, via the preview's ?bench=N): the first screen
 * paints, the full library streams in, search answers per keystroke, the
 * oldest post is reachable, and nothing throws. Thresholds only catch real
 * breakage (they are generous for slower machines); the measured numbers are
 * recorded as metrics for comparison across runs.
 */
import { launch, newPage } from '../lib/browser.mjs';
import { assert } from '../lib/oracle.mjs';

export const name = 'stress';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const markAt = (page, name) => page.evaluate((n) => performance.getEntriesByName(n).at(-1)?.startTime ?? null, name);

export async function run({ base, suite, opts = {} }) {
  const sizes = opts.stressSizes ?? [10_000, 50_000];
  for (const n of sizes) {
    const { browser, close } = await launch(`stress-${n}`);
    try {
      // No request interception here: it serializes asset loading and would inflate the timings.
      const ctx = suite.track(await newPage(browser, { label: `stress:${n}`, intercept: false }));
      const { page } = ctx;
      await page.evaluateOnNewDocument(() => {
        window.__longTasks = [];
        try {
          new PerformanceObserver((l) => window.__longTasks.push(...l.getEntries().map((e) => e.duration))).observe({ type: 'longtask', buffered: true });
        } catch {
          /* longtask API unavailable */
        }
      });

      await suite.check(`${n.toLocaleString('en')} posts: seed the library`, async () => {
        await page.goto(`${base}?bench=${n}#/home`, { waitUntil: 'domcontentloaded', timeout: 600_000 });
        await page.waitForFunction(() => window.__benchReady === true, { timeout: 600_000, polling: 500 });
      }, { timeout: 600_000 });

      let painted = null;
      await suite.check(`${n.toLocaleString('en')} posts: library paints and the full library loads`, async () => {
        // Only the hash differs from the seeding URL, which would be a same-document navigation
        // (timings would include seeding). Go through a blank page to measure a real cold load.
        await page.goto('about:blank');
        await page.goto(`${base}?bench=${n}#/library/all`, { waitUntil: 'domcontentloaded', timeout: 300_000 });
        await page.waitForFunction(() => window.__benchReady === true, { timeout: 300_000, polling: 200 });
        await page.waitForFunction(() => performance.getEntriesByName('route:library:painted').length > 0, { timeout: 120_000, polling: 100 });
        await page.waitForFunction(() => performance.getEntriesByName('data:complete').length > 0, { timeout: 240_000, polling: 200 });
        painted = await markAt(page, 'route:library:painted');
        const complete = await markAt(page, 'data:complete');
        assert(painted !== null && painted < 30_000, `library took ${Math.round(painted)} ms to paint`);
        const longTasks = await page.evaluate(() => (window.__longTasks ?? []).reduce((a, b) => a + b, 0));
        return { data: { paintedMs: Math.round(painted), completeMs: Math.round(complete), longTaskMs: Math.round(longTasks) } };
      }, { timeout: 600_000 });

      await suite.check(`${n.toLocaleString('en')} posts: search answers each keystroke`, async () => {
        await sleep(800);
        const times = await page.evaluate(async () => {
          const input = document.querySelector('main input:not([type=file])');
          if (!input) return null;
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
          const out = [];
          let q = '';
          for (const ch of 'design') {
            q += ch;
            const t0 = performance.now();
            setter.call(input, q);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            await new Promise((res) => {
              const deadline = t0 + 10_000;
              const check = () => (performance.getEntriesByName('search:painted').some((e) => e.startTime > t0) || performance.now() > deadline ? res() : requestAnimationFrame(check));
              check();
            });
            out.push(performance.now() - t0);
          }
          setter.call(input, '');
          input.dispatchEvent(new Event('input', { bubbles: true }));
          return out;
        });
        assert(times, 'search input not found');
        const sorted = [...times].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        assert(Math.max(...times) < 5000, `a keystroke took ${Math.round(Math.max(...times))} ms`);
        return { data: { keyMedianMs: Math.round(median), keyMaxMs: Math.round(Math.max(...times)) } };
      }, { timeout: 120_000 });

      await suite.check(`${n.toLocaleString('en')} posts: the oldest post is reachable`, async () => {
        await sleep(500);
        const ms = await page.evaluate(async () => {
          const id = window.__benchOldestId;
          const t0 = performance.now();
          while (performance.now() - t0 < 30_000) {
            const el = document.querySelector(`[data-id="${id}"]`);
            if (el) {
              el.scrollIntoView();
              return performance.now() - t0;
            }
            window.scrollTo(0, document.documentElement.scrollHeight);
            await new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0)));
          }
          return null;
        });
        assert(ms !== null, 'oldest post not reached within 30 s');
        return { data: { oldestMs: Math.round(ms) } };
      }, { timeout: 120_000 });

      await page.close();
      suite.untrack(ctx);
    } finally {
      await close();
    }
  }
}
