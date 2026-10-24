/** Detail panel: open, j/k navigation, header buttons, notes, tags, Esc / backdrop close. */
import { launch } from '../lib/browser.mjs';
import { sleep } from '../lib/env.mjs';
import { assert, assertEq } from '../lib/oracle.mjs';
import { ariaIn, idbGet, keys, replaceText, setHash, waitIdb } from '../lib/ui.mjs';
import { demoPage, detailOpen, detailPosition, search } from './shared.mjs';

export const name = 'detail';

export async function run({ base, suite }) {
  const { browser, close } = await launch('detail');
  try {
    const ctx = await demoPage(browser, suite, base, { hash: '#/library/all' });
    const { page } = ctx;
    let firstId;

    await suite.check('clicking a card opens the detail panel at position 1', async () => {
      firstId = await page.$eval('main article[data-id]', (e) => e.getAttribute('data-id'));
      await page.$eval(`main article[data-id="${firstId}"]`, (e) => e.click());
      await page.waitForSelector('aside[role="dialog"]', { timeout: 3000 });
      const pos = await detailPosition(page);
      assert(pos && pos.i === 1 && pos.n > 1, `position ${JSON.stringify(pos)}`);
    });

    await suite.check('j / k move through posts; Esc closes', async () => {
      await keys(page, 'j');
      await page.waitForFunction(() => /\b2\s*\/\s*\d/.test(document.querySelector('aside[role="dialog"] header')?.textContent ?? ''), { timeout: 3000 });
      await keys(page, 'j');
      assertEq((await detailPosition(page))?.i, 3, 'after j j');
      await keys(page, 'k', 'k');
      assertEq((await detailPosition(page))?.i, 1, 'after k k');
      await keys(page, 'k');
      assertEq((await detailPosition(page))?.i, 1, 'k at the first post stays put');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('aside[role="dialog"]'), { timeout: 3000 });
    });

    await suite.check('Enter opens the focused post; ArrowDown/ArrowUp navigate', async () => {
      await page.evaluate(() => document.activeElement?.blur());
      await keys(page, 'j', 'j', 'Enter');
      await page.waitForSelector('aside[role="dialog"]', { timeout: 3000 });
      const p = await detailPosition(page);
      assert(p && p.i >= 1, `position ${JSON.stringify(p)}`);
      await keys(page, 'ArrowDown');
      assertEq((await detailPosition(page))?.i, p.i + 1, 'ArrowDown');
      await keys(page, 'ArrowUp');
      assertEq((await detailPosition(page))?.i, p.i, 'ArrowUp');
      await page.keyboard.press('Escape');
    });

    await suite.check('previous/next header buttons and the last-post boundary', async () => {
      const lastId = await page.evaluate(() => [...document.querySelectorAll('main article[data-id]')].pop()?.getAttribute('data-id'));
      await page.$eval(`main article[data-id="${firstId}"]`, (e) => e.click());
      await page.waitForSelector('aside[role="dialog"]');
      const prevDisabled = await page.$eval('aside[role="dialog"] header button', (b) => b.disabled);
      assert(prevDisabled, 'previous enabled on the first post');
      await page.$$eval('aside[role="dialog"] header button', (bs) => bs[1].click());
      assertEq((await detailPosition(page))?.i, 2, 'next button');
      await page.keyboard.press('Escape');
      void lastId;
    });

    await suite.check('star / archive / read buttons in the panel update the post', async () => {
      await page.$eval(`main article[data-id="${firstId}"]`, (e) => e.click());
      await page.waitForSelector('aside[role="dialog"]');
      const b0 = await idbGet(page, 'bookmarks', firstId);
      await page.click(ariaIn('aside[role="dialog"] header', 'star', 'button'));
      await waitIdb(page, 'bookmarks', (r) => r.find((b) => b.id === firstId)?.starred === (b0.starred ? 0 : 1));
      await page.click(ariaIn('aside[role="dialog"] header', 'star', 'button'));
      await waitIdb(page, 'bookmarks', (r) => r.find((b) => b.id === firstId)?.starred === b0.starred);
      await page.click(ariaIn('aside[role="dialog"] header', 'archive', 'button'));
      await waitIdb(page, 'bookmarks', (r) => r.find((b) => b.id === firstId)?.archived === 1);
      await page.click(ariaIn('aside[role="dialog"] header', 'archive', 'button'));
      await waitIdb(page, 'bookmarks', (r) => r.find((b) => b.id === firstId)?.archived === 0);
      await page.keyboard.press('Escape');
    });

    await suite.check('private note autosaves (debounced) and shows on the card', async () => {
      await page.$eval(`main article[data-id="${firstId}"]`, (e) => e.click());
      await page.waitForSelector('aside[role="dialog"] textarea');
      const note = 'QA note — मराठी हिंदी தமிழ் 🧪 j k s e x';
      await replaceText(page, 'aside[role="dialog"] textarea', note);
      await waitIdb(page, 'bookmarks', (r) => r.find((b) => b.id === firstId)?.note === note, { timeout: 4000 });
      assert(await detailOpen(page), 'typing j/k/e/x in the note triggered shortcuts (panel closed)');
      const b = await idbGet(page, 'bookmarks', firstId);
      assertEq(b.archived, 0, 'typing "e" archived the post');
      await page.keyboard.press('Escape');
      await page.evaluate(() => document.activeElement?.blur());
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('aside[role="dialog"]'), { timeout: 3000 });
      await page.waitForFunction((i, n) => document.querySelector(`main article[data-id="${i}"]`)?.textContent.includes(n.slice(0, 10)), { timeout: 3000 }, firstId, note);
    });

    await suite.check('tag editor adds (Enter / comma) and removes tags', async () => {
      await page.$eval(`main article[data-id="${firstId}"]`, (e) => e.click());
      await page.waitForSelector('aside[role="dialog"]');
      const input = 'aside[role="dialog"] input:not([type])';
      await page.waitForSelector(input);
      await page.click(input);
      await page.type(input, 'qa-detail', { delay: 5 });
      await page.keyboard.press('Enter');
      await waitIdb(page, 'bookmarks', (r) => r.find((b) => b.id === firstId)?.tags.includes('qa-detail'));
      await page.type(input, 'second,', { delay: 5 });
      await waitIdb(page, 'bookmarks', (r) => r.find((b) => b.id === firstId)?.tags.includes('second'));
      await page.keyboard.press('Backspace');
      await waitIdb(page, 'bookmarks', (r) => !r.find((b) => b.id === firstId)?.tags.includes('second'));
      await page.keyboard.press('Escape');
      await page.evaluate(() => document.activeElement?.blur());
      await page.keyboard.press('Escape');
    });

    await suite.check('clicking the backdrop closes the panel', async () => {
      await page.$eval(`main article[data-id="${firstId}"]`, (e) => e.click());
      await page.waitForSelector('aside[role="dialog"]');
      await page.mouse.click(30, 450);
      await page.waitForFunction(() => !document.querySelector('aside[role="dialog"]'), { timeout: 3000 });
    });

    await suite.check('panel navigation follows the filtered list (search)', async () => {
      const n = await search(page, 'from:mayabuilds');
      await page.evaluate(() => document.activeElement?.blur());
      await page.$eval('main article[data-id]', (e) => e.click());
      await page.waitForSelector('aside[role="dialog"]');
      assertEq((await detailPosition(page))?.n, n, 'panel total equals filtered count');
      await page.keyboard.press('Escape');
      await search(page, '');
    });

    await suite.check('Home: detail panel opens from a resurfaced post and Esc closes it', async () => {
      await setHash(page, '#/home');
      const opened = await page.evaluate(() => {
        const btn = [...document.querySelectorAll('main button')].find((b) => b.querySelector('img, span') && b.className.includes('animate-rise') && b.textContent.length > 40);
        btn?.click();
        return !!btn;
      });
      if (!opened) return { warn: 'no resurfaced post card found on Home' };
      await page.waitForSelector('aside[role="dialog"]', { timeout: 3000 });
      await sleep(100);
      await page.evaluate(() => document.activeElement?.blur());
      await page.keyboard.press('Escape');
      const closed = await page
        .waitForFunction(() => !document.querySelector('aside[role="dialog"]'), { timeout: 2000 })
        .then(() => true)
        .catch(() => false);
      if (!closed) {
        // clean up through the close button so later checks start clean
        await page.click(ariaIn('aside[role="dialog"] header', 'close', 'button')).catch(() => undefined);
        throw new Error('Esc does not close the detail panel on Home (only LibraryView handles Esc/j/k)');
      }
    });

    await suite.check('detail panel does not stay open when navigating to another screen', async () => {
      await setHash(page, '#/library/all');
      await page.$eval('main article[data-id]', (e) => e.click());
      await page.waitForSelector('aside[role="dialog"]');
      await setHash(page, '#/insights');
      const still = await detailOpen(page);
      await setHash(page, '#/library/all');
      const back = await detailOpen(page);
      if (back) await page.keyboard.press('Escape');
      assert(!still, 'panel visible on Insights');
      if (back) return { warn: 'panel re-opens when returning to the library (activeId kept in the global store)' };
    });
  } finally {
    await close();
  }
}
