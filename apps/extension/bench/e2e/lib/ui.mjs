/**
 * UI helpers for the twtdash dashboard preview.
 *
 * Selection strategy (the UI is being localized): prefer structure, roles,
 * data attributes, lucide icon classes (`svg.lucide-<name>`) and URL hashes.
 * Where an accessible name or visible text is unavoidable it lives in `L`
 * below — adapt that one table when strings change. Each entry accepts
 * several alternatives (English first, then translations).
 */
import { sleep } from './env.mjs';

export const L = {
  // aria-labels (exact match, any alternative)
  openMenu: ['Open menu', 'मेनू खोलें'],
  toggleTheme: ['Toggle theme', 'थीम बदलें'],
  star: ['Star', 'स्टार'],
  moreActions: ['More actions', 'और कार्रवाइयां'],
  more: ['More', 'और'],
  clearSelection: ['Clear selection', 'चयन हटाएं'],
  postDetails: ['Post details', 'पोस्ट विवरण'],
  selectMode: ['Select mode'],
  newCollection: ['New collection', 'नया कलेक्शन'],
  deleteCategory: ['Delete category'],
  categoryName: ['Category name'],
  close: ['Close', 'बंद करें'],
  exportSelection: ['Export selection'],
  archive: ['Archive'],
  delete: ['Delete'],
  toggleRead: ['Toggle read'],
  settings: ['Settings'],
  // visible text (RegExp)
  exploreSample: /sample data|सैंपल|नमूना/i,
  undo: /^\s*(undo|पूर्ववत)\s*$/i,
  edit: /^\s*(edit|संपादित)\s*$/i,
  deleteText: /^\s*(delete|हटाएं)\s*$/i,
  removeFromApp: /remove from twtdash|twtdash से हटाएं/i,
  newCollectionItem: /new collection|नया कलेक्शन/i,
  topCategories: /top categories|शीर्ष श्रेणियां/i,
};

/** CSS selector matching any alternative of an aria-label key. */
export function aria(key, prefix = '') {
  const alts = L[key];
  if (!alts) throw new Error(`unknown label key ${key}`);
  return alts.map((a) => `${prefix}[aria-label="${a.replace(/"/g, '\\"')}"]`).join(', ');
}

/** `aria()` scoped under a container selector, e.g. ariaIn('main article', 'star', 'button'). */
export function ariaIn(scope, key, tag = '') {
  return L[key].map((a) => `${scope} ${tag}[aria-label="${a.replace(/"/g, '\\"')}"]`).join(', ');
}

/** lucide-react renders `<svg class="lucide lucide-<kebab-name> …">`. */
export const icon = (name) => `svg.lucide-${name}`;

export async function waitApp(page, timeout = 30_000) {
  await page.waitForFunction(() => document.querySelector('#root')?.children.length > 0, { timeout });
}

export async function waitMark(page, name, { after = -1, timeout = 60_000 } = {}) {
  await page.waitForFunction((n, a) => performance.getEntriesByName(n).some((e) => e.startTime > a), { timeout, polling: 50 }, name, after);
}

export async function markTime(page, name, after = -1) {
  return page.evaluate((n, a) => performance.getEntriesByName(n).find((e) => e.startTime > a)?.startTime ?? null, name, after);
}

/** Open the harness: base + query + hash; waits for the app and (optionally) the full library. */
export async function openApp(page, base, { query = '', hash = '#/home', data = true, timeout = 120_000 } = {}) {
  const url = `${base}${query ? `?${query.replace(/^\?/, '')}` : ''}${hash}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
  await waitApp(page, timeout);
  if (data) await waitMark(page, 'data:complete', { timeout });
  await settle(page);
}

/** Wait for the UI to calm down: lazy-screen skeletons gone + two frames. */
export async function settle(page, { timeout = 10_000, quiet = 150 } = {}) {
  try {
    await page.waitForFunction(() => !document.querySelector('main .skeleton'), { timeout, polling: 50 });
  } catch {
    /* some screens keep skeletons (e.g. loading media) — callers assert specifics */
  }
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
  await sleep(quiet);
}

export async function setHash(page, hash, opts) {
  await page.evaluate((h) => {
    if (location.hash !== h) location.hash = h;
  }, hash);
  await page.waitForFunction((h) => location.hash === h, { timeout: 5000 }, hash);
  await settle(page, opts);
}

export const hash = (page) => page.evaluate(() => location.hash);

/** Press keys with small gaps (for chords like "g h"). */
export async function keys(page, ...seq) {
  for (const k of seq) {
    await page.keyboard.press(k);
    await sleep(40);
  }
}

export async function ctrlK(page) {
  await page.keyboard.down('Control');
  await page.keyboard.press('k');
  await page.keyboard.up('Control');
}

/** Click the first visible element matching `selector` whose text matches `re`. */
export async function clickText(page, selector, re, { timeout = 5000 } = {}) {
  const src = re.source;
  const flags = re.flags;
  const handle = await page.waitForFunction(
    (sel, s, f) => {
      const rx = new RegExp(s, f);
      return [...document.querySelectorAll(sel)].find((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && rx.test((el.textContent ?? '').trim());
      });
    },
    { timeout },
    selector,
    src,
    flags,
  );
  await handle.asElement().click();
  return handle;
}

/** Click via DOM (works for hover-only / opacity-0 controls). */
export async function domClick(page, selector, { within } = {}) {
  const ok = await page.evaluate(
    (sel, w) => {
      const root = w ? document.querySelector(w) : document;
      const el = root?.querySelector(sel);
      if (!el) return false;
      el.click();
      return true;
    },
    selector,
    within ?? null,
  );
  if (!ok) throw new Error(`no element for ${selector}${within ? ` within ${within}` : ''}`);
}

/** The count pill next to the library title. */
export async function readCount(page) {
  return page.evaluate(() => {
    const el = document.querySelector('main h1 + span');
    const n = Number((el?.textContent ?? '').replace(/[^\d]/g, ''));
    return el && /\d/.test(el.textContent ?? '') ? n : null;
  });
}

export async function waitCount(page, predicate, { timeout = 8000 } = {}) {
  const deadline = Date.now() + timeout;
  let last = null;
  while (Date.now() < deadline) {
    last = await readCount(page);
    if (last !== null && predicate(last)) return last;
    await sleep(80);
  }
  throw new Error(`count condition not met (last=${last})`);
}

/** Ids of rendered items (any layout). */
export function renderedIds(page) {
  return page.evaluate(() => [...new Set([...document.querySelectorAll('main [data-id]')].map((e) => e.getAttribute('data-id')))]);
}

export function currentLayout(page) {
  return page.evaluate(() => {
    if (document.querySelector('main tr[data-id]')) return 'table';
    if (document.querySelector('main article[data-id]')) return 'grid';
    if (document.querySelector('main div[data-id]')) return 'list';
    if (document.querySelector('main [data-vkey] img, main [data-vkey] button')) return 'gallery';
    return 'none';
  });
}

/** Horizontal overflow + the widest offenders (to point at the culprit). */
export function overflowReport(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const sw = document.documentElement.scrollWidth;
    const offenders = [];
    if (sw > vw + 1) {
      const scrollers = (el) => {
        for (let p = el.parentElement; p; p = p.parentElement) {
          const s = getComputedStyle(p);
          if (/(auto|scroll|hidden|clip)/.test(s.overflowX) && p !== document.body && p !== document.documentElement) return true;
        }
        return false;
      };
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0 || r.right <= vw + 1) continue;
        if (getComputedStyle(el).position === 'fixed') continue;
        if (scrollers(el)) continue;
        const id = el.id ? `#${el.id}` : '';
        const cls = typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/).slice(0, 4).join('.')}` : '';
        offenders.push({ sel: `${el.tagName.toLowerCase()}${id}${cls}`, right: Math.round(r.right), width: Math.round(r.width), text: (el.textContent ?? '').trim().slice(0, 50) });
        if (offenders.length > 40) break;
      }
      // Keep the outermost offenders (children of an offender are noise).
    }
    return { vw, sw, overflow: sw > vw + 1, offenders: offenders.slice(0, 6) };
  });
}

/** Text that is cut off without an ellipsis (overflow hidden / clipped, no text-overflow). */
export function clippedText(page, root = 'body') {
  return page.evaluate((rootSel) => {
    const out = [];
    for (const el of document.querySelectorAll(`${rootSel} *`)) {
      if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1)) continue;
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || s.visibility === 'hidden' || Number(s.opacity) === 0) continue;
      // Screen-reader-only text (Tailwind sr-only: 1×1px, clipped) is meant to be invisible.
      if (r.width <= 1 || r.height <= 1) continue;
      if (s.textOverflow === 'ellipsis' || s.webkitLineClamp !== 'none' || /line-clamp/.test(el.className)) continue;
      const clipsX = /(hidden|clip)/.test(s.overflowX) && el.scrollWidth > el.clientWidth + 2;
      const clipsY = /(hidden|clip)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 4 && s.whiteSpace !== 'nowrap';
      if (clipsX || clipsY) out.push({ tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 80), text: el.textContent.trim().slice(0, 60), sw: el.scrollWidth, cw: el.clientWidth });
      if (out.length > 20) break;
    }
    return out;
  }, root);
}

/* ------------------------------------------------------------------ IndexedDB */
/* Raw IndexedDB access to the app's Dexie database ("twtdash"). Writes made
 * this way bypass Dexie's live queries, so reload the page afterwards. */

export function idbAll(page, store) {
  return page.evaluate(
    (s) =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open('twtdash');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(s)) {
            db.close();
            return resolve([]);
          }
          const r = db.transaction(s, 'readonly').objectStore(s).getAll();
          r.onsuccess = () => {
            db.close();
            resolve(r.result);
          };
          r.onerror = () => reject(r.error);
        };
      }),
    store,
  );
}

export function idbPut(page, store, rows) {
  return page.evaluate(
    (s, list) =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open('twtdash');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(s, 'readwrite');
          for (const row of list) tx.objectStore(s).put(row);
          tx.oncomplete = () => {
            db.close();
            resolve(list.length);
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    store,
    rows,
  );
}

export function idbClear(page, store) {
  return page.evaluate(
    (s) =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open('twtdash');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(s, 'readwrite');
          tx.objectStore(s).clear();
          tx.oncomplete = () => {
            db.close();
            resolve(true);
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    store,
  );
}

export async function idbGet(page, store, id) {
  return (await idbAll(page, store)).find((r) => r.id === id);
}

/** Poll IndexedDB until `predicate(rows)` is truthy. */
export async function waitIdb(page, store, predicate, { timeout = 6000 } = {}) {
  const deadline = Date.now() + timeout;
  let rows;
  while (Date.now() < deadline) {
    rows = await idbAll(page, store);
    const v = predicate(rows);
    if (v) return v;
    await sleep(100);
  }
  throw new Error(`IndexedDB ${store} condition not met`);
}

/** Visible sonner toast action button (e.g. Undo). */
export async function clickToastAction(page, re = L.undo, timeout = 5000) {
  await clickText(page, '[data-sonner-toast] button[data-button]', re, { timeout });
}

/**
 * Get open toasts out of the way without touching the DOM tree: sonner's toasts
 * are React-managed, and removing their nodes makes React's next insert crash
 * (NotFoundError in insertBefore). Hide them; sonner removes them on its own.
 */
export async function dismissToasts(page) {
  await page.evaluate(() =>
    document.querySelectorAll('[data-sonner-toast]').forEach((t) => {
      t.style.visibility = 'hidden';
      t.style.pointerEvents = 'none';
    }),
  );
}

/** Run a quick, deterministic interaction-free sanity on the current screen. */
export function screenSanity(page) {
  return page.evaluate(() => {
    const root = document.querySelector('#root');
    const main = document.querySelector('main') ?? root;
    return {
      rootChildren: root?.children.length ?? 0,
      mainText: (main?.innerText ?? '').trim().length,
      h1: [...document.querySelectorAll('h1')].map((h) => h.textContent.trim()).filter(Boolean)[0] ?? null,
      dark: document.documentElement.classList.contains('dark'),
      bg: getComputedStyle(document.body).backgroundColor,
    };
  });
}

/** Focus an input (handle or selector), select everything and type a replacement. */
export async function replaceText(page, target, text) {
  const el = typeof target === 'string' ? await page.waitForSelector(target, { timeout: 3000 }) : target;
  await el.focus();
  await page.keyboard.down('Control');
  await page.keyboard.press('a');
  await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  if (text) await page.keyboard.type(text, { delay: 5 });
}
