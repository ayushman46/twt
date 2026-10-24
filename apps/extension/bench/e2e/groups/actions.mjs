/** Star / read / archive (buttons, keyboard, card menu) and their undo paths, delete + undo. */
import { launch } from '../lib/browser.mjs';
import { sleep } from '../lib/env.mjs';
import { assert, assertEq } from '../lib/oracle.mjs';
import { L, aria, ariaIn, clickToastAction, dismissToasts, icon, idbAll, idbGet, keys, readCount, setHash, settle, waitIdb } from '../lib/ui.mjs';
import { demoPage, stableCount } from './shared.mjs';

export const name = 'actions';

const strip = (b) => {
  const { updatedAt, ...rest } = b;
  void updatedAt;
  return JSON.stringify(rest);
};

export async function run({ base, suite }) {
  const { browser, close } = await launch('actions');
  try {
    const ctx = await demoPage(browser, suite, base, { hash: '#/library/all' });
    const { page } = ctx;
    const firstId = () => page.$eval('main article[data-id]', (e) => e.getAttribute('data-id'));

    await suite.check('card star button toggles starred (and back)', async () => {
      const id = await firstId();
      const before = (await idbGet(page, 'bookmarks', id)).starred;
      await page.$eval(`main article[data-id="${id}"] header button:has(${icon('star')})`, (b) => b.click());
      await waitIdb(page, 'bookmarks', (r) => r.find((b) => b.id === id)?.starred === (before ? 0 : 1));
      await page.waitForFunction((i, s) => !!document.querySelector(`main article[data-id="${i}"] .fill-amber-400`) === s, { timeout: 3000 }, id, !before);
      await page.$eval(`main article[data-id="${id}"] header button:has(${icon('star')})`, (b) => b.click());
      await waitIdb(page, 'bookmarks', (r) => r.find((b) => b.id === id)?.starred === before);
    });

    await suite.check('keyboard: j focuses, s stars, r toggles read (and back)', async () => {
      await page.evaluate(() => document.activeElement?.blur());
      await keys(page, 'j');
      const focusId = await page.waitForFunction(() => document.querySelector('main [data-id].border-accent\\/50, main [data-id][class*="border-accent"]')?.getAttribute('data-id'), { timeout: 3000 }).then((h) => h.jsonValue());
      const b0 = await idbGet(page, 'bookmarks', focusId);
      await keys(page, 's');
      await waitIdb(page, 'bookmarks', (r) => r.find((b) => b.id === focusId)?.starred === (b0.starred ? 0 : 1));
      await keys(page, 's');
      await waitIdb(page, 'bookmarks', (r) => r.find((b) => b.id === focusId)?.starred === b0.starred);
      await keys(page, 'r');
      await waitIdb(page, 'bookmarks', (r) => r.find((b) => b.id === focusId)?.read === (b0.read ? 0 : 1));
      await keys(page, 'r');
      await waitIdb(page, 'bookmarks', (r) => r.find((b) => b.id === focusId)?.read === b0.read);
    });

    await suite.check('keyboard: e archives the focused post; archived scope can restore it', async () => {
      const total = await readCount(page);
      const focusId = await page.evaluate(() => document.querySelector('main [data-id][class*="border-accent"]')?.getAttribute('data-id'));
      assert(focusId, 'no focused post');
      await keys(page, 'e');
      await waitIdb(page, 'bookmarks', (r) => r.find((b) => b.id === focusId)?.archived === 1);
      assertEq(await stableCount(page), total - 1, 'count after archive');
      await setHash(page, '#/library/archived');
      await page.waitForSelector(`main [data-id="${focusId}"]`, { timeout: 5000 });
      await page.evaluate(() => document.activeElement?.blur());
      await keys(page, 'j', 'e');
      await waitIdb(page, 'bookmarks', (r) => r.find((b) => b.id === focusId)?.archived === 0);
      await setHash(page, '#/library/all');
      assertEq(await stableCount(page), total, 'count after unarchive');
    });

    await suite.check('card menu: Star / Mark as read / Archive items work', async () => {
      const id = await firstId();
      const b0 = await idbGet(page, 'bookmarks', id);
      const openMenu = async () => {
        await page.click(ariaIn(`main article[data-id="${id}"]`, 'moreActions', 'button'));
        await page.waitForSelector('[role="menu"] [role="menuitem"]', { timeout: 3000 });
      };
      const pick = async (iconName) => {
        await openMenu();
        await page.$eval(`[role="menu"] [role="menuitem"]:has(${icon(iconName)})`, (e) => e.click());
        await page.waitForFunction(() => !document.querySelector('[role="menu"]'), { timeout: 3000 });
      };
      await pick('star');
      await waitIdb(page, 'bookmarks', (r) => r.find((b) => b.id === id)?.starred === (b0.starred ? 0 : 1));
      await pick('star');
      await waitIdb(page, 'bookmarks', (r) => r.find((b) => b.id === id)?.starred === b0.starred);
      await pick('circle');
      await waitIdb(page, 'bookmarks', (r) => r.find((b) => b.id === id)?.read === (b0.read ? 0 : 1));
      await pick('archive');
      await waitIdb(page, 'bookmarks', (r) => r.find((b) => b.id === id)?.archived === 1);
      await page.waitForFunction((i) => !document.querySelector(`main [data-id="${i}"]`), { timeout: 3000 }, id);
      // restore through the archived view's menu (Unarchive)
      await setHash(page, '#/library/archived');
      await page.waitForSelector(`main article[data-id="${id}"]`, { timeout: 5000 });
      await page.click(ariaIn(`main article[data-id="${id}"]`, 'moreActions', 'button'));
      await page.waitForSelector('[role="menu"]', { timeout: 3000 });
      await page.$eval(`[role="menu"] [role="menuitem"]:has(${icon('archive-restore')})`, (e) => e.click());
      await waitIdb(page, 'bookmarks', (r) => r.find((b) => b.id === id)?.archived === 0);
      await page.$eval(`[role="menu"]`, () => undefined).catch(() => undefined);
      await setHash(page, '#/library/all');
      // put read state back
      const now = await idbGet(page, 'bookmarks', id);
      if (now.read !== b0.read) {
        await page.click(ariaIn(`main article[data-id="${id}"]`, 'moreActions', 'button'));
        await page.waitForSelector('[role="menu"]', { timeout: 3000 });
        await page.$eval(`[role="menu"] [role="menuitem"]:has(${icon('circle')})`, (e) => e.click());
        await waitIdb(page, 'bookmarks', (r) => r.find((b) => b.id === id)?.read === b0.read);
      }
    });

    await suite.check('remove from twtdash → toast Undo restores the exact post', async () => {
      await dismissToasts(page);
      const id = await firstId();
      const before = await idbGet(page, 'bookmarks', id);
      const total = await readCount(page);
      await page.click(ariaIn(`main article[data-id="${id}"]`, 'moreActions', 'button'));
      await page.waitForSelector('[role="menu"]', { timeout: 3000 });
      await page.$eval(`[role="menu"] [role="menuitem"]:has(${icon('trash')})`, (e) => e.click());
      await waitIdb(page, 'bookmarks', (r) => !r.some((b) => b.id === id));
      assertEq(await stableCount(page), total - 1, 'count after delete');
      await clickToastAction(page, L.undo);
      await waitIdb(page, 'bookmarks', (r) => r.some((b) => b.id === id));
      const after = await idbGet(page, 'bookmarks', id);
      assertEq(strip(after), strip(before), 'restored post differs');
      assertEq(await stableCount(page), total, 'count after undo');
      await page.waitForSelector(`main [data-id="${id}"]`, { timeout: 5000 });
    });

    await suite.check('bulk archive → toast Undo unarchives every post', async () => {
      await dismissToasts(page);
      const total = await readCount(page);
      const ids = await page.$$eval('main article[data-id]', (l) => l.slice(0, 3).map((e) => e.getAttribute('data-id')));
      for (const id of ids) await page.$eval(`main article[data-id="${id}"] button[role="checkbox"]`, (b) => b.click());
      await page.waitForSelector(aria('clearSelection', 'button'), { timeout: 3000 });
      await page.$eval(`${aria('archive', 'button')}`, (b) => b.click());
      await waitIdb(page, 'bookmarks', (r) => ids.every((id) => r.find((b) => b.id === id)?.archived === 1));
      assertEq(await stableCount(page), total - 3, 'count after bulk archive');
      await clickToastAction(page, L.undo);
      await waitIdb(page, 'bookmarks', (r) => ids.every((id) => r.find((b) => b.id === id)?.archived === 0));
      assertEq(await stableCount(page), total, 'count after undo');
    });

    await suite.check('opening a post marks it read after a moment', async () => {
      const rows = await idbAll(page, 'bookmarks');
      await setHash(page, '#/library/unread');
      await settle(page);
      const id = await page.$eval('main article[data-id]', (e) => e.getAttribute('data-id'));
      assertEq(rows.find((b) => b.id === id).read, 0, 'precondition: unread');
      await page.$eval(`main article[data-id="${id}"]`, (e) => e.click());
      await page.waitForSelector('aside[role="dialog"]', { timeout: 3000 });
      await sleep(1100);
      await waitIdb(page, 'bookmarks', (r) => r.find((b) => b.id === id)?.read === 1, { timeout: 3000 });
      await page.keyboard.press('Escape');
      await setHash(page, '#/library/all');
    });

  } finally {
    await close();
  }
}
