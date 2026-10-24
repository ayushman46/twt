/** Collections (create / rename / add posts / delete) and categories (create / edit / toggle / delete). */
import { launch } from '../lib/browser.mjs';
import { sleep } from '../lib/env.mjs';
import { L, aria, ariaIn, clickText, icon, idbAll, readCount, replaceText, setHash, settle, waitIdb } from '../lib/ui.mjs';
import { assert, assertEq } from '../lib/oracle.mjs';
import { demoPage, stableCount } from './shared.mjs';

export const name = 'organize';

async function fillDialogName(page, value) {
  await page.waitForSelector('[role="dialog"] form input', { timeout: 3000 });
  await replaceText(page, '[role="dialog"] form input', value);
}

export async function run({ base, suite }) {
  const { browser, close } = await launch('organize');
  try {
    const ctx = await demoPage(browser, suite, base, { hash: '#/library/all' });
    const { page } = ctx;
    let col;

    // ------------------------------------------------------------ collections
    await suite.check('create a collection from the sidebar → navigates to it', async () => {
      await page.$eval(aria('newCollection', 'button'), (b) => b.click()).catch(async () => {
        // empty-state "Create a collection" button (no aria-label) as a fallback when the section action is absent
        await page.$eval(`aside nav button:has(${icon('plus')})`, (b) => b.click());
      });
      await fillDialogName(page, 'QA 🧪 Reading — पढ़ना');
      const submit = await page.$('[role="dialog"] form button[type="submit"]');
      assert(!(await submit.evaluate((b) => b.disabled)), 'submit disabled with a name');
      await page.keyboard.press('Enter');
      col = await waitIdb(page, 'collections', (r) => r.find((c) => c.name === 'QA 🧪 Reading — पढ़ना'));
      await page.waitForFunction((id) => location.hash === `#/library/collection/${id}`, { timeout: 3000 }, col.id);
      await page.waitForFunction((n) => document.querySelector('main h1')?.textContent.includes(n), { timeout: 3000 }, 'QA 🧪 Reading');
      assertEq(await readCount(page), 0, 'new collection count');
      const inSidebar = await page.evaluate((n) => [...document.querySelectorAll('aside nav button')].some((b) => b.textContent.includes(n)), 'QA 🧪 Reading');
      assert(inSidebar, 'collection not listed in the sidebar');
    });

    await suite.check('collection dialog: empty name cannot be submitted', async () => {
      await page.$eval(aria('newCollection', 'button'), (b) => b.click());
      await page.waitForSelector('[role="dialog"] form input');
      const disabled = await page.$eval('[role="dialog"] form button[type="submit"]', (b) => b.disabled);
      assert(disabled, 'submit enabled with an empty name');
      await page.type('[role="dialog"] form input', '   ');
      assert(await page.$eval('[role="dialog"] form button[type="submit"]', (b) => b.disabled), 'whitespace-only name accepted');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 3000 });
    });

    await suite.check('add posts to the collection from the card menu', async () => {
      await setHash(page, '#/library/all');
      const ids = await page.$$eval('main article[data-id]', (l) => l.slice(0, 2).map((e) => e.getAttribute('data-id')));
      for (const id of ids) {
        await page.click(ariaIn(`main article[data-id="${id}"]`, 'moreActions', 'button'));
        await page.waitForSelector('[role="menu"]', { timeout: 3000 });
        // open the "Collections" submenu (folder-plus icon) with the keyboard-friendly path
        await page.hover(`[role="menu"] [role="menuitem"]:has(${icon('folder-plus')})`);
        await page.waitForFunction((n) => [...document.querySelectorAll('[role="menu"]')].some((m) => m.textContent.includes(n)), { timeout: 3000 }, 'QA 🧪 Reading');
        await clickText(page, '[role="menu"] [role="menuitem"]', /QA 🧪 Reading/);
        await waitIdb(page, 'bookmarks', (r) => r.find((b) => b.id === id)?.collections.includes(col.id));
        await page.keyboard.press('Escape').catch(() => undefined);
        await sleep(150);
      }
      await setHash(page, `#/library/collection/${col.id}`);
      assertEq(await stableCount(page), 2, 'collection count');
    });

    await suite.check('rename the collection (Edit dialog)', async () => {
      await page.$eval('main h1 ~ button', (b) => b.click());
      await fillDialogName(page, 'QA renamed');
      await page.keyboard.press('Enter');
      await waitIdb(page, 'collections', (r) => r.find((c) => c.id === col.id)?.name === 'QA renamed');
      await page.waitForFunction(() => document.querySelector('main h1')?.textContent.includes('QA renamed'), { timeout: 3000 });
    });

    await suite.check('delete the collection keeps its posts', async () => {
      const before = (await idbAll(page, 'bookmarks')).length;
      await page.$eval('main h1 ~ button', (b) => b.click());
      await page.waitForSelector('[role="dialog"] form');
      await clickText(page, '[role="dialog"] form button[type="button"]', L.deleteText);
      await waitIdb(page, 'collections', (r) => !r.some((c) => c.id === col.id));
      await page.waitForFunction(() => location.hash === '#/library/all', { timeout: 3000 });
      const rows = await idbAll(page, 'bookmarks');
      assertEq(rows.length, before, 'posts deleted with the collection');
      assert(!rows.some((b) => b.collections.includes(col.id)), 'posts still reference the deleted collection');
    });

    await suite.check('visiting a deleted collection URL shows an empty, non-crashing view', async () => {
      await setHash(page, `#/library/collection/${col.id}`);
      assertEq(await readCount(page), 0, 'count');
      await setHash(page, '#/library/all');
    });

    // ------------------------------------------------------------- categories
    let cat;
    await suite.check('create a custom category in Settings → Categories', async () => {
      await setHash(page, '#/settings/categories');
      const form = 'main form';
      await page.waitForSelector(`${form} input`);
      const inputs = await page.$$(`${form} input`);
      await inputs[0].type('QA Climbing', { delay: 5 });
      await inputs[1].type('bouldering, crag, belay', { delay: 2 });
      await page.$eval(`${form} button[type="submit"]`, (b) => b.click());
      cat = await waitIdb(page, 'categories', (r) => r.find((c) => c.name === 'QA Climbing'));
      assertEq(cat.builtin, false, 'builtin');
      assertEq(cat.keywords, 'bouldering, crag, belay', 'keywords');
      const cats = await idbAll(page, 'categories');
      const other = cats.find((c) => c.id === 'other');
      assert(other.order > cat.order, '"Other" is no longer last');
      await page.waitForFunction(() => [...document.querySelectorAll('main input')].some((i) => i.value === 'QA Climbing'), { timeout: 3000 });
    });

    await suite.check('rename + recolor the category (inline editing)', async () => {
      const nameInput = await page.evaluateHandle(() => [...document.querySelectorAll('main input')].find((i) => i.value === 'QA Climbing'));
      await replaceText(page, nameInput.asElement(), 'QA Bouldering');
      await page.keyboard.press('Tab');
      await waitIdb(page, 'categories', (r) => r.find((c) => c.id === cat.id)?.name === 'QA Bouldering');
      const row = await nameInput.evaluateHandle((i) => i.closest('.grid'));
      const swatches = await row.asElement().$$('button[aria-label^="Color"]');
      assert(swatches.length >= 2, 'color swatches missing');
      await swatches[1].click();
      await waitIdb(page, 'categories', (r) => r.find((c) => c.id === cat.id)?.color !== cat.color);
    });

    await suite.check('disable / enable the category with its switch', async () => {
      const sw = await page.evaluateHandle(() => [...document.querySelectorAll('main input')].find((i) => i.value === 'QA Bouldering')?.closest('.grid')?.querySelector('button[role="switch"]'));
      assert(sw.asElement(), 'switch not found');
      await sw.asElement().click();
      await waitIdb(page, 'categories', (r) => r.find((c) => c.id === cat.id)?.enabled === false);
      await sw.asElement().click();
      await waitIdb(page, 'categories', (r) => r.find((c) => c.id === cat.id)?.enabled === true);
    });

    await suite.check('built-in categories cannot be deleted', async () => {
      const builtinDelete = await page.evaluate((sel) => {
        const row = [...document.querySelectorAll('main input')].find((i) => i.value === 'AI & ML')?.closest('.grid');
        return row ? !!row.querySelector(sel) : null;
      }, aria('deleteCategory', 'button'));
      assert(builtinDelete === false, `built-in row delete button present (${builtinDelete})`);
    });

    await suite.check('move a post into the category, then deleting it moves posts to Other', async () => {
      await setHash(page, '#/library/all');
      const id = await page.$eval('main article[data-id]', (e) => e.getAttribute('data-id'));
      await page.click(ariaIn(`main article[data-id="${id}"]`, 'moreActions', 'button'));
      await page.waitForSelector('[role="menu"]');
      await page.hover(`[role="menu"] [role="menuitem"]:has(${icon('layers')})`);
      await page.waitForFunction(() => [...document.querySelectorAll('[role="menu"]')].some((m) => m.textContent.includes('QA Bouldering')), { timeout: 3000 });
      await clickText(page, '[role="menu"] [role="menuitem"]', /QA Bouldering/);
      await waitIdb(page, 'bookmarks', (r) => r.find((b) => b.id === id)?.category === cat.id);
      await page.keyboard.press('Escape').catch(() => undefined);
      await setHash(page, `#/library/category/${cat.id}`);
      assertEq(await stableCount(page), 1, 'category count');
      await setHash(page, '#/settings/categories');
      page.__qaDialog = 'accept';
      await page.evaluate((sel) => {
        const row = [...document.querySelectorAll('main input')].find((i) => i.value === 'QA Bouldering')?.closest('.grid');
        row?.querySelector(sel)?.click();
      }, aria('deleteCategory', 'button'));
      await waitIdb(page, 'categories', (r) => !r.some((c) => c.id === cat.id));
      await waitIdb(page, 'bookmarks', (r) => r.find((b) => b.id === id)?.category === 'other');
      assert(ctx.log.dialogs.some((d) => d.type === 'confirm'), 'no confirmation before deleting');
    });

    await suite.check('dismissing the delete confirmation keeps the category', async () => {
      const inputs = await page.$$('main form input');
      await inputs[0].type('QA Keep', { delay: 5 });
      await page.$eval('main form button[type="submit"]', (b) => b.click());
      const keep = await waitIdb(page, 'categories', (r) => r.find((c) => c.name === 'QA Keep'));
      page.__qaDialog = 'dismiss';
      await page.waitForFunction(() => [...document.querySelectorAll('main input')].some((i) => i.value === 'QA Keep'), { timeout: 3000 });
      await page.evaluate((sel) => {
        const row = [...document.querySelectorAll('main input')].find((i) => i.value === 'QA Keep')?.closest('.grid');
        row?.querySelector(sel)?.click();
      }, aria('deleteCategory', 'button'));
      await sleep(400);
      page.__qaDialog = 'accept';
      const still = (await idbAll(page, 'categories')).some((c) => c.id === keep.id);
      assert(still, 'category deleted although the confirmation was dismissed');
    });

    await suite.check('category scope for a deleted category id renders safely', async () => {
      await setHash(page, '#/library/category/cat_does_not_exist');
      assertEq(await readCount(page), 0, 'count');
      await settle(page);
    });
  } finally {
    await close();
  }
}
