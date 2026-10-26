/**
 * Theme handling: the system preference is followed, the sidebar toggle
 * switches and persists across reloads, and core text meets WCAG AA contrast
 * (4.5:1) on its own background in both themes.
 */
import { launch, newPage } from '../lib/browser.mjs';
import { assert } from '../lib/oracle.mjs';
import { aria, openApp, settle } from '../lib/ui.mjs';

export const name = 'theme';

const isDark = (page) => page.evaluate(() => document.documentElement.classList.contains('dark'));

/** Contrast ratios for representative text: body, muted meta, and nav labels against their own backgrounds. */
function contrastReport(page) {
  return page.evaluate(() => {
    const parse = (c) => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      return { r, g, b, a };
    };
    const lum = ({ r, g, b }) => {
      const f = (v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const bgOf = (el) => {
      for (let n = el; n; n = n.parentElement) {
        const c = parse(getComputedStyle(n).backgroundColor);
        if (c && c.a > 0.9) return c;
      }
      return parse(getComputedStyle(document.body).backgroundColor);
    };
    const ratio = (el) => {
      const fg = parse(getComputedStyle(el).color);
      const bg = bgOf(el);
      if (!fg || !bg) return null;
      const [l1, l2] = [lum(fg), lum(bg)].sort((a, b) => b - a);
      return Math.round(((l1 + 0.05) / (l2 + 0.05)) * 100) / 100;
    };
    const pick = (sel) => [...document.querySelectorAll(sel)].find((e) => e.textContent?.trim() && e.getBoundingClientRect().height > 0);
    const out = {};
    const body = pick('main p, main h1, main h2');
    if (body) out.body = ratio(body);
    const nav = pick('aside nav button');
    if (nav) out.nav = ratio(nav);
    const muted = pick('main .text-muted');
    if (muted) out.muted = ratio(muted);
    return out;
  });
}

export async function run({ base, suite }) {
  const { browser, close } = await launch('theme');
  try {
    for (const system of ['dark', 'light']) {
      const ctx = suite.track(await newPage(browser, { theme: system, label: `theme:${system}` }));
      const { page } = ctx;

      await suite.check(`follows the system preference (${system})`, async () => {
        await openApp(page, base, { query: 'demo', hash: '#/home' });
        assert((await isDark(page)) === (system === 'dark'), `html.dark should be ${system === 'dark'}`);
      });

      await suite.check(`text contrast meets WCAG AA (${system})`, async () => {
        const r = await contrastReport(page);
        const low = Object.entries(r).filter(([, v]) => v !== null && v < 4.5);
        assert(Object.keys(r).length >= 2, 'could not sample text for contrast');
        assert(!low.length, `low contrast: ${low.map(([k, v]) => `${k} ${v}:1`).join(', ')}`);
        return { data: r };
      });

      await page.close();
      suite.untrack(ctx);
    }

    const ctx = suite.track(await newPage(browser, { theme: 'light', label: 'theme:toggle' }));
    const { page } = ctx;
    await suite.check('sidebar toggle switches the theme and it persists after reload', async () => {
      await openApp(page, base, { query: 'demo', hash: '#/home' });
      const before = await isDark(page);
      const toggle = await page.$(aria('toggleTheme', 'button'));
      assert(toggle, 'theme toggle button not found');
      await toggle.click();
      await page.waitForFunction((b) => document.documentElement.classList.contains('dark') !== b, { timeout: 3000 }, before);
      const after = await isDark(page);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelector('#root')?.children.length > 0, { timeout: 30_000 });
      await settle(page);
      assert((await isDark(page)) === after, 'theme choice did not persist across reload');
    });
    await page.close();
    suite.untrack(ctx);
  } finally {
    await close();
  }
}
