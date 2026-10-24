/**
 * Every route × theme (dark, light) × viewport (1440×900, 768×1024, 360×740):
 * renders without errors, follows the theme, no horizontal overflow, and
 * library scopes show the count the data says they should.
 */
import { launch, newPage } from '../lib/browser.mjs';
import { assert, assertEq, countScope } from '../lib/oracle.mjs';
import { idbAll, openApp, overflowReport, readCount, screenSanity, setHash, waitMark } from '../lib/ui.mjs';
import { enrichDemo, scopeValues } from './shared.mjs';

export const name = 'routes';

export function routeList(v) {
  return [
    { hash: '#/home', kind: 'home' },
    { hash: '#/library/all', scope: ['all'] },
    { hash: '#/library/unread', scope: ['unread'] },
    { hash: '#/library/starred', scope: ['starred'] },
    { hash: '#/library/archived', scope: ['archived'] },
    { hash: '#/library/likes', scope: ['likes'] },
    v.category && { hash: `#/library/category/${encodeURIComponent(v.category)}`, scope: ['category', v.category] },
    v.collection && { hash: `#/library/collection/${encodeURIComponent(v.collection)}`, scope: ['collection', v.collection] },
    v.tag && { hash: `#/library/tag/${encodeURIComponent(v.tag)}`, scope: ['tag', v.tag] },
    v.author && { hash: `#/library/author/${encodeURIComponent(v.author)}`, scope: ['author', v.author] },
    v.facet && { hash: `#/library/facet/${encodeURIComponent(v.facet)}`, scope: ['facet', v.facet] },
    { hash: '#/insights', kind: 'insights' },
    ...['general', 'categories', 'ai', 'sync', 'data', 'plan', 'about'].map((s) => ({ hash: `#/settings/${s}`, kind: 'settings' })),
    { hash: '#/recall', kind: 'new' },
    { hash: '#/shelf', kind: 'new' },
    { hash: '#/ask', kind: 'new' },
    { hash: '#/wrapped', kind: 'new' },
    { hash: '#/welcome', kind: 'welcome' },
    { hash: '#/does-not-exist', kind: 'fallback' },
  ].filter(Boolean);
}

export async function run({ base, suite, opts = {} }) {
  const themes = opts.themes ?? ['dark', 'light'];
  const viewports = opts.viewports ?? ['desktop', 'tablet', 'mobile'];
  const { browser, close } = await launch('routes');
  try {
    const seed = suite.track(await newPage(browser, { label: 'routes:seed' }));
    let values;
    await suite.check('seed demo library with collection, archive and likes', async () => {
      await openApp(seed.page, base, { query: 'demo', hash: '#/home' });
      await enrichDemo(seed.page);
      values = await scopeValues(seed.page);
      return { data: { category: values.category, tag: values.tag, author: values.author, facet: values.facet, collection: values.collection } };
    });
    await seed.page.close();
    suite.untrack(seed);
    if (!values) return;
    const routes = routeList(values);

    for (const theme of themes) {
      for (const vp of viewports) {
        const ctx = suite.track(await newPage(browser, { viewport: vp, theme, label: `routes:${theme}/${vp}` }));
        const { page } = ctx;
        await openApp(page, base, { hash: '#/home' });
        const fresh = await idbAll(page, 'bookmarks');
        for (const r of routes) {
          await suite.check(`${theme}/${vp} ${r.hash}`, async () => {
            const t0 = await page.evaluate(() => performance.now());
            await setHash(page, r.hash);
            if (r.kind === 'insights') await waitMark(page, 'route:insights:painted', { after: t0, timeout: 15000 }).catch(() => undefined);
            const s = await screenSanity(page);
            assert(s.rootChildren > 0 && s.mainText > 20, `blank or near-empty screen (text=${s.mainText})`);
            assertEq(s.dark, theme === 'dark', 'theme class');
            if (r.scope) {
              const expected = countScope(fresh, r.scope[0], r.scope[1]);
              const shown = await readCount(page);
              assertEq(shown, expected, `count pill for ${r.scope.join(':')}`);
              if (expected > 0) await page.waitForSelector('main [data-id], main [data-vkey]', { timeout: 5000 });
            }
            if (r.kind === 'settings') {
              assert(await page.$('main h2'), 'settings section heading missing');
            }
            if (r.kind === 'fallback') {
              assert(await page.$('main h1'), 'unknown route did not fall back to a screen');
            }
            const o = await overflowReport(page);
            assert(!o.overflow, `horizontal overflow: scrollWidth ${o.sw} > ${o.vw}; offenders ${JSON.stringify(o.offenders)}`);
            if (vp === 'mobile' && r.kind !== 'welcome') {
              const bar = await page.evaluate(() => {
                const b = document.querySelector('main > div.sticky button');
                const rect = b?.getBoundingClientRect();
                return rect ? rect.width > 0 && rect.height > 0 : false;
              });
              assert(bar, 'mobile top bar / menu button not visible');
            }
            if (!s.h1 && r.kind !== 'new') return { warn: 'no <h1> on this screen' };
          });
        }
        await page.close();
        suite.untrack(ctx);
      }
    }
  } finally {
    await close();
  }
}
