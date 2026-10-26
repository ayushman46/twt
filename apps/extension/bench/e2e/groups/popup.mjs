/**
 * Toolbar popup (preview harness `?popup`): renders counts that match the
 * library, offers search and sync, and fits its fixed width without overflow,
 * in both themes.
 */
import { launch, newPage } from '../lib/browser.mjs';
import { assert } from '../lib/oracle.mjs';
import { idbAll } from '../lib/ui.mjs';

export const name = 'popup';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function run({ base, suite, opts = {} }) {
  const themes = opts.themes ?? ['dark', 'light'];
  const { browser, close } = await launch('popup');
  try {
    // Seed the demo library once in this profile.
    const seed = suite.track(await newPage(browser, { label: 'popup:seed' }));
    await seed.page.goto(`${base}?demo#/home`, { waitUntil: 'domcontentloaded' });
    await seed.page.waitForFunction(() => performance.getEntriesByName('data:complete').length > 0, { timeout: 120_000 });
    const rows = await idbAll(seed.page, 'bookmarks');
    await seed.page.close();
    suite.untrack(seed);

    for (const theme of themes) {
      const ctx = suite.track(await newPage(browser, { theme, viewport: { width: 520, height: 760 }, label: `popup:${theme}` }));
      const { page } = ctx;
      await suite.check(`popup renders counts, search and actions (${theme})`, async () => {
        await page.goto(`${base}?popup`, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => document.querySelector('#root')?.textContent?.match(/\d/), { timeout: 30_000 });
        await sleep(600);
        const info = await page.evaluate(() => {
          const root = document.querySelector('#root');
          const text = root?.textContent ?? '';
          return {
            numbers: (text.match(/\d[\d,.]*/g) ?? []).map((n) => Number(n.replace(/,/g, ''))),
            hasSearch: !!root?.querySelector('input'),
            buttons: root?.querySelectorAll('button').length ?? 0,
          };
        });
        const live = rows.filter((b) => !b.archived).length;
        assert(info.numbers.includes(live) || info.numbers.includes(rows.length), `popup does not show the library count (${live}); saw ${info.numbers.slice(0, 8).join(', ')}`);
        assert(info.hasSearch, 'popup has no search input');
        assert(info.buttons >= 3, 'popup is missing its actions');
        return { data: { buttons: info.buttons } };
      });

      await suite.check(`popup content fits its frame (${theme})`, async () => {
        const fit = await page.evaluate(() => {
          const card = document.querySelector('#root .w-fit, #root > div > div');
          const r = card?.getBoundingClientRect();
          const inner = card ? [...card.querySelectorAll('*')].filter((e) => e.getBoundingClientRect().right > (r?.right ?? 0) + 1).length : 0;
          return { width: Math.round(r?.width ?? 0), overflowing: inner };
        });
        assert(fit.width > 280 && fit.width <= 440, `popup width ${fit.width}px is outside 280–440px`);
        assert(fit.overflowing === 0, `${fit.overflowing} elements stick out of the popup`);
        return { data: fit };
      });
      await page.close();
      suite.untrack(ctx);
    }
  } finally {
    await close();
  }
}
