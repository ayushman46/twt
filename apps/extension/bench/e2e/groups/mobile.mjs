/**
 * Small screens (360×740): every main screen fits without horizontal scroll,
 * the navigation drawer opens, navigates and closes, and primary controls are
 * large enough to tap.
 */
import { launch, newPage } from '../lib/browser.mjs';
import { assert } from '../lib/oracle.mjs';
import { aria, openApp, overflowReport, setHash } from '../lib/ui.mjs';

export const name = 'mobile';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SCREENS = ['#/home', '#/library/all', '#/insights', '#/settings/general', '#/settings/ai', '#/recall', '#/shelf', '#/ask', '#/wrapped'];

export async function run({ base, suite, opts = {} }) {
  const themes = opts.themes ?? ['dark', 'light'];
  const { browser, close } = await launch('mobile');
  try {
    for (const theme of themes) {
      const ctx = suite.track(await newPage(browser, { viewport: 'mobile', theme, label: `mobile:${theme}` }));
      const { page } = ctx;
      await openApp(page, base, { query: 'demo', hash: '#/home' });

      for (const h of SCREENS) {
        await suite.check(`${h} fits 360px without horizontal scroll (${theme})`, async () => {
          await setHash(page, h);
          await sleep(300);
          const r = await overflowReport(page);
          assert(!r.overflow, `scrollWidth ${r.sw} > ${r.vw}: ${r.offenders.map((o) => `${o.sel} (${o.right}px)`).join('; ')}`);
        });
      }

      await suite.check(`drawer opens, navigates and closes (${theme})`, async () => {
        await setHash(page, '#/home');
        const open = await page.$(aria('openMenu', 'button'));
        assert(open, 'menu button not found on mobile');
        await open.click();
        // The desktop sidebar stays in the DOM (hidden); the drawer is the one inside the fixed overlay.
        await page.waitForSelector('.fixed aside nav', { visible: true, timeout: 3000 });
        const went = await page.evaluate(() => {
          const btn = [...document.querySelectorAll('.fixed aside nav button')].find((b) => /insights/i.test(b.textContent ?? ''));
          btn?.click();
          return !!btn;
        });
        assert(went, 'Insights link not found in the drawer');
        await page.waitForFunction(() => location.hash === '#/insights', { timeout: 3000 });
        await sleep(300);
        const stillOpen = await page.evaluate(() => [...document.querySelectorAll('aside')].some((a) => a.getBoundingClientRect().width > 0 && getComputedStyle(a).visibility !== 'hidden' && a.closest('.fixed')));
        assert(!stillOpen, 'drawer stayed open after navigating');
      });

      await suite.check(`primary controls are at least 32px tall (${theme})`, async () => {
        await setHash(page, '#/library/all');
        const small = await page.evaluate(() =>
          [...document.querySelectorAll('main button, main input, main [role="button"]')]
            .filter((e) => {
              const r = e.getBoundingClientRect();
              return r.width > 0 && r.height > 0 && r.top < innerHeight && r.height < 32 && r.width < 32;
            })
            .map((e) => e.getAttribute('aria-label') || e.textContent?.trim().slice(0, 20) || e.tagName)
            .slice(0, 8),
        );
        if (small.length) return { warn: `small tap targets: ${small.join(', ')}` };
      }, { soft: true });

      await page.close();
      suite.untrack(ctx);
    }
  } finally {
    await close();
  }
}
