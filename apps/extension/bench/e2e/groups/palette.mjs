/** Command palette (Ctrl+K): open/close, navigation by click and keyboard, search hand-off, post results, commands. */
import { launch } from '../lib/browser.mjs';
import { sleep } from '../lib/env.mjs';
import { assert, assertEq, expectCount } from '../lib/oracle.mjs';
import { ctrlK, hash, idbAll, setHash, settle } from '../lib/ui.mjs';
import { demoPage, stableCount } from './shared.mjs';

export const name = 'palette';

const item = (value) => `[cmdk-item][data-value="${value}"]`;
const isOpen = (page) => page.evaluate(() => !!document.querySelector('[cmdk-input]'));

async function open(page) {
  await page.evaluate(() => document.activeElement?.blur());
  await ctrlK(page);
  await page.waitForSelector('[cmdk-input]', { timeout: 3000 });
}

async function closed(page) {
  await page.waitForFunction(() => !document.querySelector('[cmdk-input]'), { timeout: 3000 });
}

export async function run({ base, suite }) {
  const { browser, close } = await launch('palette');
  try {
    const ctx = await demoPage(browser, suite, base, { hash: '#/home' });
    const { page } = ctx;
    const rows = await idbAll(page, 'bookmarks');

    await suite.check('Ctrl+K opens, Esc closes, Ctrl+K toggles', async () => {
      await open(page);
      const focused = await page.evaluate(() => document.activeElement?.hasAttribute('cmdk-input'));
      assert(focused, 'palette input not focused');
      await page.keyboard.press('Escape');
      await closed(page);
      await open(page);
      await ctrlK(page);
      await closed(page);
    });

    const nav = [
      ['insights stats analytics', '#/insights'],
      ['all bookmarks library', '#/library/all'],
      ['unread inbox', '#/library/unread'],
      ['starred favorites', '#/library/starred'],
      ['archive', '#/library/archived'],
      ['settings preferences', '#/settings/general'],
      ['ai categorize settings', '#/settings/ai'],
      ['home', '#/home'],
    ];
    for (const [value, target] of nav) {
      await suite.check(`palette "${value}" → ${target}`, async () => {
        await open(page);
        await page.click(item(value));
        await closed(page);
        await page.waitForFunction((h) => location.hash === h, { timeout: 3000 }, target);
        await settle(page, { quiet: 50 });
      });
    }

    await suite.check('palette keyboard: Enter on the first item, ArrowDown + Enter on the next', async () => {
      await setHash(page, '#/insights');
      await open(page);
      await page.keyboard.press('Enter');
      await closed(page);
      assertEq(await hash(page), '#/home', 'first item (Home)');
      await open(page);
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await closed(page);
      assertEq(await hash(page), '#/library/all', 'second item (All bookmarks)');
    });

    await suite.check('palette filters items as you type', async () => {
      await open(page);
      await page.type('[cmdk-input]', 'insig', { delay: 10 });
      await sleep(150);
      const values = await page.$$eval('[cmdk-item]', (l) => l.map((e) => e.getAttribute('data-value')));
      assert(values.includes('insights stats analytics'), 'insights missing');
      assert(!values.includes('archive'), 'unrelated items still listed');
      await page.keyboard.press('Escape');
      await closed(page);
    });

    await suite.check('typing text + Enter searches all bookmarks', async () => {
      await setHash(page, '#/home');
      await open(page);
      await page.type('[cmdk-input]', 'from:mayabuilds', { delay: 10 });
      await page.keyboard.press('Enter');
      await closed(page);
      await page.waitForFunction(() => location.hash === '#/library/all', { timeout: 3000 });
      const n = await stableCount(page);
      assertEq(n, expectCount(rows, { from: 'mayabuilds' }), 'results');
      const v = await page.$eval('main input:not([type=file])', (i) => i.value);
      assertEq(v, 'from:mayabuilds', 'search box value');
      await page.focus('main input:not([type=file])');
      await page.keyboard.press('Escape');
    });

    await suite.check('post results open the detail panel', async () => {
      await open(page);
      await page.type('[cmdk-input]', 'rust', { delay: 10 });
      await page.waitForSelector('[cmdk-item][data-value^="post:"]', { timeout: 3000 });
      const id = await page.$eval('[cmdk-item][data-value^="post:"]', (e) => e.getAttribute('data-value').slice(5));
      await page.click('[cmdk-item][data-value^="post:"]');
      await closed(page);
      await page.waitForSelector('aside[role="dialog"]', { timeout: 3000 });
      assert(rows.some((b) => b.id === id), 'unknown post id');
      await page.keyboard.press('Escape');
    });

    await suite.check('category entries navigate to the category scope', async () => {
      const cats = await idbAll(page, 'categories');
      const c = cats.find((x) => x.enabled && x.id !== 'other');
      await open(page);
      await page.click(item(`category ${c.name}`));
      await closed(page);
      await page.waitForFunction((h) => location.hash === h, { timeout: 3000 }, `#/library/category/${c.id}`);
    });

    await suite.check('"Keyboard shortcuts" command opens the help dialog', async () => {
      await open(page);
      await page.click(item('keyboard shortcuts help'));
      await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"]')].some((d) => d.querySelectorAll('kbd').length > 10), { timeout: 3000 });
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 3000 });
    });

    await suite.check('"Toggle dark mode" flips the theme', async () => {
      const before = await page.evaluate(() => document.documentElement.classList.contains('dark'));
      await open(page);
      await page.click(item('toggle theme dark light mode'));
      await closed(page);
      await page.waitForFunction((b) => document.documentElement.classList.contains('dark') !== b, { timeout: 3000 }, before);
      await open(page);
      await page.click(item('toggle theme dark light mode'));
      await closed(page);
      await page.waitForFunction((b) => document.documentElement.classList.contains('dark') === b, { timeout: 3000 }, before);
    });

    await suite.check('"New collection" command opens the collection dialog', async () => {
      await open(page);
      await page.click(item('new collection create'));
      await page.waitForSelector('[role="dialog"] form input', { timeout: 3000 });
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 3000 });
    });

    await suite.check('palette does not trigger global shortcuts while typing', async () => {
      await setHash(page, '#/home');
      await open(page);
      await page.type('[cmdk-input]', 'g a 1 ? /', { delay: 20 });
      assertEq(await hash(page), '#/home', 'navigated while typing in the palette');
      assert(await isOpen(page), 'palette closed while typing');
      await page.keyboard.press('Escape');
      await closed(page);
    });
  } finally {
    await close();
  }
}
