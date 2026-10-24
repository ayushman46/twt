/** Layouts 1–4, full-text search, every documented operator (checked against the data), quick filters and sorting. */
import { launch } from '../lib/browser.mjs';
import { assert, assertEq, expectCount, phraseText } from '../lib/oracle.mjs';
import { currentLayout, icon, idbAll, keys, readCount, renderedIds, setHash, settle } from '../lib/ui.mjs';
import { demoPage, search, stableCount } from './shared.mjs';

export const name = 'library';

const DAY = 86_400_000;

export async function run({ base, suite }) {
  const { browser, close } = await launch('library');
  try {
    const ctx = await demoPage(browser, suite, base, { hash: '#/library/all' });
    const { page } = ctx;
    const rows = await idbAll(page, 'bookmarks');
    const live = rows.filter((b) => !b.archived);

    // ---------------------------------------------------------------- layouts
    const layouts = [
      ['1', 'grid'],
      ['2', 'list'],
      ['3', 'table'],
      ['4', 'gallery'],
    ];
    for (const [key, layout] of layouts) {
      await suite.check(`key ${key} switches to ${layout} layout`, async () => {
        await keys(page, key);
        await page.waitForFunction(
          (l) => {
            const m = document.querySelector('main');
            if (!m) return false;
            if (l === 'table') return !!m.querySelector('tr[data-id]');
            if (l === 'grid') return !!m.querySelector('article[data-id]');
            if (l === 'list') return !!m.querySelector('div[data-id]') && !m.querySelector('article[data-id]');
            return !m.querySelector('[data-id]') && m.querySelectorAll('[data-vkey] img').length > 0;
          },
          { timeout: 5000 },
          layout,
        );
        assertEq(await currentLayout(page), layout, 'layout');
        const pressed = await page.$$eval('main button[aria-pressed="true"]', (l) => l.length);
        assertEq(pressed, 1, 'exactly one layout toggle pressed');
      });
    }

    await suite.check('layout toggle buttons switch layouts (click)', async () => {
      const toggles = await page.$$('main button[aria-pressed]');
      assertEq(toggles.length, 4, 'layout toggle count');
      for (const [i, layout] of ['grid', 'list', 'table', 'gallery'].entries()) {
        await toggles[i].click();
        await page.waitForFunction((n) => document.querySelectorAll('main button[aria-pressed]')[n]?.getAttribute('aria-pressed') === 'true', { timeout: 3000 }, i);
        await settle(page, { quiet: 50 });
        assertEq(await currentLayout(page), layout, `toggle ${i + 1}`);
      }
      await keys(page, '1');
    });

    await suite.check('gallery shows only posts with media', async () => {
      await keys(page, '4');
      await page.waitForSelector('main [data-vkey] img', { timeout: 5000 });
      const tiles = await page.$$eval('main [data-vkey] img', (l) => l.length);
      const media = live.reduce((n, b) => n + (b.media?.length ?? 0), 0);
      assert(tiles > 0 && tiles <= media, `gallery tiles ${tiles} vs media ${media}`);
      await keys(page, '1');
    });

    // ----------------------------------------------------------------- search
    await suite.check('count pill matches the library', async () => {
      assertEq(await readCount(page), live.length, 'all');
    });

    const word = 'rust';
    const cases = [
      { q: word, parts: { text: word } },
      { q: 'from:mayabuilds', parts: { from: 'mayabuilds' } },
      { q: 'from:@priyadesigns', parts: { from: 'priyadesigns' } },
      { q: '-from:mayabuilds', parts: { notFrom: 'mayabuilds' } },
      { q: 'cat:ai', parts: { cat: 'ai' } },
      { q: 'cat:design', parts: { cat: 'design' } },
      { q: 'has:image', parts: { has: 'image' } },
      { q: 'has:video', parts: { has: 'video' } },
      { q: 'has:link', parts: { has: 'link' } },
      { q: 'has:note', parts: { has: 'note' } },
      { q: 'has:tags', parts: { has: 'tags' } },
      { q: '-has:link', parts: { notHas: 'link' } },
      { q: 'is:starred', parts: { is: 'starred' } },
      { q: 'is:unread', parts: { is: 'unread' } },
      { q: 'is:read', parts: { is: 'read' } },
      { q: 'is:thread', parts: { is: 'thread' } },
      { q: 'is:quote', parts: { is: 'quote' } },
      { q: 'is:long', parts: { is: 'long' } },
      { q: 'after:90d', parts: { after: Date.now() - 90 * DAY } },
      { q: 'before:90d', parts: { before: Date.now() - 90 * DAY } },
      { q: 'min_likes:1k', parts: { minLikes: 1000 } },
      { q: 'lang:en', parts: { lang: 'en' } },
      { q: 'domain:example.com', parts: { domain: 'example.com' } },
      { q: '"small habit"', parts: { phrase: 'small habit' } },
      { q: '-the', parts: { exclude: 'the' } },
      { q: 'has:link from:mayabuilds', parts: { has: 'link', from: 'mayabuilds' } },
      { q: 'cat:ai -has:image', parts: { cat: 'ai', notHas: 'image' } },
    ];
    const tag = live.flatMap((b) => b.tags ?? [])[0];
    if (tag) cases.push({ q: `tag:${tag.includes(' ') ? `"${tag}"` : tag}`, parts: { tag } });

    for (const c of cases) {
      await suite.check(`search ${JSON.stringify(c.q)} → count matches data`, async () => {
        const expected = expectCount(rows, { scope: 'all', ...c.parts });
        // Dates are relative to "now"; posts within a minute of the boundary could flip — none in the demo set.
        const shown = await search(page, c.q);
        assertEq(shown, expected, `results for ${c.q}`);
        if (expected === 0) {
          const empty = await page.$$eval('main [data-id]', (l) => l.length);
          assertEq(empty, 0, 'items shown for an empty result');
        }
        return { data: { expected, shown } };
      });
    }

    await suite.check('free-text results contain the term (rendered cards)', async () => {
      await search(page, word);
      const ids = await renderedIds(page);
      assert(ids.length > 0, 'no rendered results');
      const byId = new Map(rows.map((b) => [b.id, b]));
      const bad = ids.filter((id) => !JSON.stringify(byId.get(id) ?? {}).toLowerCase().includes(word));
      assert(!bad.length, `results without "${word}": ${bad.join(', ')}`);
      const marks = await page.$$eval('main mark', (l) => l.length);
      assert(marks > 0, 'search term is not highlighted');
    });

    await suite.check('exclusion "-word" hides every post containing it', async () => {
      await search(page, '-ai');
      const ids = await renderedIds(page);
      const byId = new Map(rows.map((b) => [b.id, b]));
      const bad = ids.filter((id) => phraseText(byId.get(id)).includes('ai'));
      assert(!bad.length, `excluded word present in ${bad.join(', ')}`);
    });

    await suite.check('unknown operator is treated as text (no crash)', async () => {
      const n = await search(page, 'http://example.com');
      assert(n !== null, 'count missing');
      const n2 = await search(page, 'nonsense:operator zzzzqqq');
      assertEq(n2, 0, 'nonsense query');
    });

    await suite.check('no-match search shows the empty state with a clear action', async () => {
      const n = await search(page, 'qqqqzzzzxxxx');
      assertEq(n, 0, 'count');
      assertEq(await page.$$eval('main [data-id]', (l) => l.length), 0, 'items');
      const hasClear = await page.evaluate(() => [...document.querySelectorAll('main button')].some((b) => b.offsetParent && /clear/i.test(b.textContent)));
      assert(hasClear, 'no clear-search button in the empty state');
    });

    await suite.check('Escape clears the search and restores the full list', async () => {
      await search(page, 'rust');
      await page.keyboard.press('Escape');
      const n = await stableCount(page);
      assertEq(n, live.length, 'count after Escape');
      const value = await page.$eval('main input:not([type=file])', (i) => i.value);
      assertEq(value, '', 'search input value');
    });

    await suite.check('deep link #/library/all?q=… applies the query', async () => {
      await setHash(page, '#/library/all?q=from%3Amayabuilds');
      const n = await stableCount(page);
      assertEq(n, expectCount(rows, { from: 'mayabuilds' }), 'deep-link count');
      await setHash(page, '#/library/all');
      await search(page, '');
    });

    await suite.check('quick filter chip toggles has:image', async () => {
      await search(page, '');
      await page.evaluate(() => document.activeElement?.blur());
      const chip = await page.evaluateHandle((sel) => [...document.querySelectorAll('main button:not([aria-pressed])')].find((b) => b.querySelector(sel)), icon('images'));
      assert(chip.asElement(), 'image chip not found');
      await chip.asElement().click();
      const n = await stableCount(page);
      assertEq(n, expectCount(rows, { has: 'image' }), 'chip on');
      const value = await page.$eval('main input:not([type=file])', (i) => i.value);
      assert(/has:image/.test(value), `query is "${value}"`);
      await chip.asElement().click();
      assertEq(await stableCount(page), live.length, 'chip off');
    });

    // ------------------------------------------------------------------- sort
    await suite.check('sort "Most liked" orders by likes (list layout)', async () => {
      await keys(page, '2');
      await page.click(`main button:has(${icon('arrow-up-down')})`);
      await page.waitForSelector('[role="menuitemradio"]', { timeout: 3000 });
      const items = await page.$$('[role="menuitemradio"]');
      // Without a text query: Recently saved, Oldest saved, Newest, Oldest, Most liked, Most viewed.
      assert(items.length >= 6, `sort options: ${items.length}`);
      await items[items.length - 2].click();
      await settle(page);
      const ids = (await renderedIds(page)).slice(0, 8);
      const expected = [...live].sort((a, b) => b.metrics.likes - a.metrics.likes).map((b) => b.id);
      const likes = (id) => rows.find((b) => b.id === id).metrics.likes;
      for (let i = 1; i < ids.length; i++) assert(likes(ids[i - 1]) >= likes(ids[i]), `not sorted by likes at ${i}: ${ids.join(',')}`);
      assertEq(ids[0], expected[0], 'most liked first');
    });

    await suite.check('sort "Oldest saved" puts the oldest save first', async () => {
      await page.click(`main button:has(${icon('arrow-up-down')})`);
      await page.waitForSelector('[role="menuitemradio"]', { timeout: 3000 });
      const items = await page.$$('[role="menuitemradio"]');
      await items[1].click();
      await settle(page);
      const first = (await renderedIds(page))[0];
      const oldest = [...live].sort((a, b) => a.savedAt - b.savedAt)[0].id;
      assertEq(first, oldest, 'first item');
      // back to default
      await page.click(`main button:has(${icon('arrow-up-down')})`);
      await page.waitForSelector('[role="menuitemradio"]', { timeout: 3000 });
      await (await page.$$('[role="menuitemradio"]'))[0].click();
      await keys(page, '1');
    });
  } finally {
    await close();
  }
}
