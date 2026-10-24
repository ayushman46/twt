/** Empty library → welcome screen, empty states on every route, demo load/remove, ?demo / ?reset. */
import { launch, newPage } from '../lib/browser.mjs';
import { assert, assertEq } from '../lib/oracle.mjs';
import { L, clickText, icon, idbAll, openApp, overflowReport, readCount, screenSanity, setHash, settle, waitIdb } from '../lib/ui.mjs';

export const name = 'welcome';

const EMPTY_ROUTES = [
  '#/library/all',
  '#/library/unread',
  '#/library/starred',
  '#/library/archived',
  '#/library/likes',
  '#/insights',
  '#/settings/general',
  '#/settings/categories',
  '#/settings/ai',
  '#/settings/sync',
  '#/settings/data',
  '#/settings/plan',
  '#/settings/about',
  '#/recall',
  '#/shelf',
  '#/ask',
  '#/wrapped',
];

const isWelcome = (page) =>
  page.evaluate(() => ({
    fileInput: !!document.querySelector('main input[type="file"], #root input[type="file"]'),
    cards: document.querySelectorAll('[data-id]').length,
    h1: document.querySelector('h1')?.textContent?.trim() ?? '',
    sidebar: !!document.querySelector('aside nav'),
  }));

export async function run({ base, suite }) {
  const { browser, close } = await launch('welcome');
  try {
    for (const theme of ['dark', 'light']) {
      const ctx = suite.track(await newPage(browser, { viewport: 'desktop', theme, label: `welcome:${theme}` }));
      const { page } = ctx;

      await suite.check(`${theme}: empty library shows the welcome screen on #/home`, async () => {
        await openApp(page, base, { hash: '#/home' });
        const w = await isWelcome(page);
        assert(w.fileInput, 'welcome (backup restore input) not rendered');
        assertEq(w.cards, 0, 'cards in an empty library');
        assert(w.h1.length > 0, 'no heading');
        const s = await screenSanity(page);
        assertEq(s.dark, theme === 'dark', 'html.dark follows prefers-color-scheme');
      });

      await suite.check(`${theme}: #/welcome is full-bleed (no sidebar, no mobile bar)`, async () => {
        await setHash(page, '#/welcome');
        const w = await isWelcome(page);
        assert(!w.sidebar, 'sidebar shown on full-bleed welcome');
        assert(!(await page.$('main > div.sticky')), 'mobile top bar shown on full-bleed welcome');
        const o = await overflowReport(page);
        assert(!o.overflow, `horizontal overflow ${o.sw}>${o.vw}: ${JSON.stringify(o.offenders)}`);
      });

      if (theme === 'dark') {
        for (const route of EMPTY_ROUTES) {
          await suite.check(`empty library renders ${route}`, async () => {
            await setHash(page, route);
            const s = await screenSanity(page);
            assert(s.rootChildren > 0 && s.mainText > 0, 'blank screen');
            if (route.startsWith('#/library/')) {
              assertEq(await page.$$eval('main [data-id]', (l) => l.length), 0, 'items rendered');
              const n = await readCount(page);
              assert(n === 0, `count pill shows ${n}`);
            }
          });
        }
      }

      if (theme === 'dark') {
        await suite.check('"Explore with sample data" loads the demo library', async () => {
          await setHash(page, '#/welcome');
          await clickText(page, 'main button', L.exploreSample);
          await page.waitForFunction(() => location.hash === '#/home', { timeout: 15000 });
          const rows = await waitIdb(page, 'bookmarks', (r) => (r.length > 0 ? r : null), { timeout: 15000 });
          assert(rows.every((b) => b.id.startsWith('demo-')), 'non-demo ids');
          await page.waitForSelector(`main ${icon('flask-conical')}`, { timeout: 8000 });
          await settle(page);
          const w = await isWelcome(page);
          assert(!w.fileInput, 'still on the welcome screen after loading samples');
          return { data: { demoPosts: rows.length } };
        });

        await suite.check('library shows the demo posts with correct count', async () => {
          await setHash(page, '#/library/all');
          const rows = await idbAll(page, 'bookmarks');
          await page.waitForSelector('main [data-id]');
          assertEq(await readCount(page), rows.filter((b) => !b.archived).length, 'count pill');
        });

        await suite.check('"Remove sample data" (banner) empties the library', async () => {
          const ok = await page.evaluate((x, f) => {
            const banner = document.querySelector(f)?.closest('div');
            const btn = [...(banner?.querySelectorAll('button') ?? [])].find((b) => b.querySelector(x));
            btn?.click();
            return !!btn;
          }, icon('x'), `main ${icon('flask-conical')}`);
          assert(ok, 'banner remove button not found');
          await waitIdb(page, 'bookmarks', (r) => r.length === 0, { timeout: 8000 });
          await page.waitForFunction(() => location.hash === '#/home', { timeout: 5000 });
          await page.waitForFunction(() => !!document.querySelector('main input[type="file"]'), { timeout: 8000 });
        });
      }

      await page.close();
      suite.untrack(ctx);
    }

    const ctx = suite.track(await newPage(browser, { viewport: 'desktop', theme: 'dark', label: 'welcome:params' }));
    await suite.check('?demo seeds only an empty library; ?reset clears posts', async () => {
      const { page } = ctx;
      await openApp(page, base, { query: 'demo', hash: '#/library/all' });
      const n1 = (await idbAll(page, 'bookmarks')).length;
      assert(n1 > 0, 'demo not seeded');
      await openApp(page, base, { query: 'demo', hash: '#/library/all' });
      assertEq((await idbAll(page, 'bookmarks')).length, n1, 'demo re-seeded on reload');
      await page.goto(`${base}?reset#/home`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => !location.search.includes('reset'), { timeout: 15000 });
      await waitIdb(page, 'bookmarks', (r) => r.length === 0, { timeout: 15000 });
    });
  } finally {
    await close();
  }
}
