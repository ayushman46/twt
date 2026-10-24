/** Bulk selection (select mode, checkboxes, x, modifier-click, select all) and every bulk-bar action. */
import { launch } from '../lib/browser.mjs';
import { sleep } from '../lib/env.mjs';
import { assert, assertEq } from '../lib/oracle.mjs';
import { L, aria, clickToastAction, dismissToasts, icon, idbAll, keys, readCount, settle, waitIdb } from '../lib/ui.mjs';
import { demoPage, stableCount } from './shared.mjs';

export const name = 'bulk';

const BAR = 'div.fixed.bottom-5'; // bulk bar container (structure, not text)

async function selectedCount(page) {
  return page.evaluate(() => document.querySelectorAll('main [data-id] button[role="checkbox"][aria-checked="true"]').length);
}

async function barButton(page, iconName) {
  const h = await page.evaluateHandle((bar, sel) => [...(document.querySelector(bar)?.querySelectorAll('button') ?? [])].find((b) => b.querySelector(sel)), BAR, icon(iconName));
  const el = h.asElement();
  if (!el) throw new Error(`bulk bar button with ${iconName} not found`);
  return el;
}

export async function run({ base, suite }) {
  const { browser, close } = await launch('bulk');
  try {
    const ctx = await demoPage(browser, suite, base, { hash: '#/library/all' });
    const { page } = ctx;
    let ids = [];

    await suite.check('select mode + clicking cards selects them; bulk bar appears', async () => {
      await page.click(`main button:has(${icon('list-checks')})`);
      ids = await page.$$eval('main article[data-id]', (l) => l.slice(0, 3).map((e) => e.getAttribute('data-id')));
      for (const id of ids) await page.$eval(`main article[data-id="${id}"]`, (e) => e.click());
      await page.waitForSelector(aria('clearSelection', 'button'), { timeout: 3000 });
      assertEq(await selectedCount(page), 3, 'selected checkboxes');
      assert(!(await page.$('aside[role="dialog"]')), 'detail panel opened in select mode');
      const barText = await page.$eval(BAR, (e) => e.textContent);
      assert(/3/.test(barText), `bar text "${barText.slice(0, 60)}"`);
    });

    await suite.check('bulk star / unstar', async () => {
      await (await barButton(page, 'star')).click();
      await waitIdb(page, 'bookmarks', (r) => ids.every((id) => r.find((b) => b.id === id)?.starred === 1));
      await (await barButton(page, 'star')).click();
      await waitIdb(page, 'bookmarks', (r) => ids.every((id) => r.find((b) => b.id === id)?.starred === 0));
    });

    await suite.check('bulk mark read / unread', async () => {
      const rows = await idbAll(page, 'bookmarks');
      const allRead = ids.every((id) => rows.find((b) => b.id === id).read === 1);
      await (await barButton(page, allRead ? 'circle' : 'circle-check')).click();
      await waitIdb(page, 'bookmarks', (r) => ids.every((id) => r.find((b) => b.id === id)?.read === (allRead ? 0 : 1)));
      await (await barButton(page, allRead ? 'circle-check' : 'circle')).click();
      await waitIdb(page, 'bookmarks', (r) => ids.every((id) => r.find((b) => b.id === id)?.read === (allRead ? 1 : 0)));
    });

    await suite.check('bulk tag adds comma-separated tags (normalized)', async () => {
      await (await barButton(page, 'tag')).click();
      await page.waitForSelector('[data-radix-popper-content-wrapper] input', { timeout: 3000 });
      await page.type('[data-radix-popper-content-wrapper] input', 'QA-Bulk, #Second Tag ', { delay: 5 });
      await page.keyboard.press('Enter');
      await waitIdb(page, 'bookmarks', (r) => ids.every((id) => ['qa-bulk', 'second tag'].every((t) => r.find((b) => b.id === id)?.tags.includes(t))));
      await page.keyboard.press('Escape');
      await sleep(150);
    });

    await suite.check('bulk category moves posts and marks them user-sorted', async () => {
      const cats = await idbAll(page, 'categories');
      await (await barButton(page, 'layers')).click();
      await page.waitForSelector('[role="menu"] [role="menuitem"]', { timeout: 3000 });
      const items = await page.$$('[role="menu"] [role="menuitem"]');
      const label = await items[2].evaluate((e) => e.textContent.trim());
      const cat = cats.find((c) => label.includes(c.name));
      assert(cat, `menu item "${label}" is not a category`);
      await items[2].click();
      await waitIdb(page, 'bookmarks', (r) => ids.every((id) => r.find((b) => b.id === id)?.category === cat.id && r.find((b) => b.id === id)?.categorySource === 'user'));
    });

    await suite.check('bulk collection → "New collection…" creates it with the posts', async () => {
      await dismissToasts(page);
      await (await barButton(page, 'folder-plus')).click();
      await page.waitForSelector('[role="menu"] [role="menuitem"]', { timeout: 3000 });
      await page.$eval(`[role="menu"] [role="menuitem"]:has(${icon('plus')})`, (e) => e.click());
      await page.waitForSelector('[role="dialog"] form input', { timeout: 3000 });
      await page.type('[role="dialog"] form input', 'QA bulk collection', { delay: 5 });
      await page.keyboard.press('Enter');
      const col = await waitIdb(page, 'collections', (r) => r.find((c) => c.name === 'QA bulk collection'));
      await waitIdb(page, 'bookmarks', (r) => ids.every((id) => r.find((b) => b.id === id)?.collections.includes(col.id)));
      // The selection is kept after creating the collection from the bar.
      await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 3000 });
    });

    await suite.check('select all selects every post in view', async () => {
      const total = await readCount(page);
      const ok = await page.evaluate((bar) => {
        const btn = [...(document.querySelector(bar)?.querySelectorAll('button') ?? [])].find((b) => !b.querySelector('svg') && /\d/.test(b.textContent));
        btn?.click();
        return !!btn;
      }, BAR);
      assert(ok, 'select-all button not found');
      await page.waitForFunction((bar, n) => new RegExp(`\\b${n}\\b`).test(document.querySelector(bar)?.textContent ?? ''), { timeout: 3000 }, BAR, String(total));
    });

    await suite.check('Escape clears the selection and hides the bar', async () => {
      await page.evaluate(() => document.activeElement?.blur());
      await page.keyboard.press('Escape');
      await page.waitForFunction((bar) => !document.querySelector(bar), { timeout: 3000 }, BAR);
    });

    await suite.check('x toggles selection of the focused post; ctrl-click toggles a card', async () => {
      // leave select mode first
      const sm = await page.$(`main button:has(${icon('list-checks')})`);
      await sm.click();
      await settle(page, { quiet: 50 });
      await keys(page, 'j', 'x');
      await page.waitForSelector(aria('clearSelection', 'button'), { timeout: 3000 });
      assertEq(await selectedCount(page), 1, 'after x');
      const second = await page.$$eval('main article[data-id]', (l) => l[1].getAttribute('data-id'));
      await page.keyboard.down('Control');
      await page.click(`main article[data-id="${second}"] footer`);
      await page.keyboard.up('Control');
      await page.waitForFunction(() => document.querySelectorAll('main [data-id] button[role="checkbox"][aria-checked="true"]').length === 2, { timeout: 3000 });
      assert(!(await page.$('aside[role="dialog"]')), 'ctrl-click opened the detail panel');
      await page.keyboard.press('Escape');
    });

    await suite.check('bulk delete → Undo restores all posts', async () => {
      await dismissToasts(page);
      const total = await readCount(page);
      const del = await page.$$eval('main article[data-id]', (l) => l.slice(0, 2).map((e) => e.getAttribute('data-id')));
      for (const id of del) await page.$eval(`main article[data-id="${id}"] button[role="checkbox"]`, (b) => b.click());
      await (await barButton(page, 'trash')).click();
      await waitIdb(page, 'bookmarks', (r) => del.every((id) => !r.some((b) => b.id === id)));
      assertEq(await stableCount(page), total - 2, 'count after delete');
      await clickToastAction(page, L.undo);
      await waitIdb(page, 'bookmarks', (r) => del.every((id) => r.some((b) => b.id === id)));
      assertEq(await stableCount(page), total, 'count after undo');
    });

    await suite.check('table header checkbox selects all rows', async () => {
      await keys(page, '3');
      await page.waitForSelector('main thead button[role="checkbox"]', { timeout: 3000 });
      await page.click('main thead button[role="checkbox"]');
      const total = await readCount(page);
      await page.waitForFunction((bar, n) => new RegExp(`\\b${n}\\b`).test(document.querySelector(bar)?.textContent ?? ''), { timeout: 3000 }, BAR, String(total));
      await page.click('main thead button[role="checkbox"]');
      await page.waitForFunction((bar) => !document.querySelector(bar), { timeout: 3000 }, BAR);
      await keys(page, '1');
    });
  } finally {
    await close();
  }
}
