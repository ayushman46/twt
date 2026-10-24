/** Global keyboard shortcuts: ? help, g-chords, / search focus, keys ignored while typing. */
import { launch } from '../lib/browser.mjs';
import { sleep } from '../lib/env.mjs';
import { assert, assertEq } from '../lib/oracle.mjs';
import { hash, keys, setHash } from '../lib/ui.mjs';
import { demoPage } from './shared.mjs';

export const name = 'shortcuts';

/** Resolve once the main thread has an idle period (React effects flushed), then a short pause. */
const idle = (page) =>
  page.evaluate(
    () =>
      new Promise((r) => {
        const ric = window.requestIdleCallback ?? ((cb) => setTimeout(cb, 50));
        ric(() => setTimeout(r, 150), { timeout: 1500 });
      }),
  );

const CHORDS = [
  ['h', '#/home'],
  ['a', '#/library/all'],
  ['u', '#/library/unread'],
  ['s', '#/library/starred'],
  ['i', '#/insights'],
  ['c', '#/settings/categories'],
  ['r', '#/recall'],
  ['l', '#/shelf'],
  ['q', '#/ask'],
  ['w', '#/wrapped'],
];

export async function run({ base, suite }) {
  const { browser, close } = await launch('shortcuts');
  try {
    const ctx = await demoPage(browser, suite, base, { hash: '#/home' });
    const { page } = ctx;

    await suite.check('? opens the shortcuts dialog; Esc closes it', async () => {
      await page.evaluate(() => document.activeElement?.blur());
      await page.keyboard.press('?');
      await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"]')].some((d) => d.querySelectorAll('kbd').length > 10), { timeout: 3000 });
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 3000 });
    });

    for (const [k, target] of CHORDS) {
      await suite.check(`g ${k} → ${target}`, async () => {
        const start = target === '#/home' ? '#/library/all' : '#/home';
        // The chord state lives in an effect that re-subscribes on every page change, so a "g"
        // pressed while the previous route is still committing is dropped. Wait for idle first.
        const attempt = async () => {
          await setHash(page, start, { quiet: 50 });
          await idle(page);
          await page.evaluate(() => document.activeElement?.blur());
          await keys(page, 'g', k);
          return page
            .waitForFunction((h) => location.hash === h, { timeout: 2500 }, target)
            .then(() => true)
            .catch(() => false);
        };
        if (await attempt()) return;
        if (await attempt()) return { note: 'needed a second attempt (chord pressed during a route commit)' };
        throw new Error(`g ${k} did not navigate to ${target} (hash ${await hash(page)})`);
      });
    }

    await suite.check('g-chord expires (g, pause, h does nothing)', async () => {
      await setHash(page, '#/library/all', { quiet: 50 });
      await page.evaluate(() => document.activeElement?.blur());
      await page.keyboard.press('g');
      await sleep(1200);
      await page.keyboard.press('h');
      await sleep(200);
      assertEq(await hash(page), '#/library/all', 'navigated after the chord timeout');
    });

    await suite.check('/ focuses the library search box', async () => {
      await setHash(page, '#/library/all');
      await page.evaluate(() => document.activeElement?.blur());
      await page.keyboard.press('/');
      const ok = await page.evaluate(() => document.activeElement?.tagName === 'INPUT' && !!document.activeElement.closest('main'));
      assert(ok, 'search not focused');
      const v = await page.$eval('main input:not([type=file])', (i) => i.value);
      assertEq(v, '', '"/" was typed into the box');
    });

    await suite.check('shortcuts are ignored while typing in the search box', async () => {
      await page.keyboard.type('g h 2 ?', { delay: 20 });
      await sleep(200);
      assertEq(await hash(page), '#/library/all', 'navigated while typing');
      const dialog = await page.$('[role="dialog"]');
      assert(!dialog, 'help dialog opened while typing');
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
    });

    await suite.check('number keys do not switch layouts outside the library', async () => {
      await setHash(page, '#/home');
      await page.evaluate(() => document.activeElement?.blur());
      await keys(page, '3');
      await setHash(page, '#/library/all');
      const table = await page.$('main tr[data-id]');
      assert(!table, 'pressing 3 on Home switched the library to table');
    });
  } finally {
    await close();
  }
}
