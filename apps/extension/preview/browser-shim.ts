/**
 * Preview-only stand-in for the WebExtension API, so the dashboard and popup
 * can run in a normal tab (design work, screenshots, store listing assets).
 */
import { fakeBrowser } from '@webext-core/fake-browser';

const shim = fakeBrowser as typeof fakeBrowser & Record<string, unknown>;
shim.runtime.getManifest = (() => ({ manifest_version: 3, name: 'twtdash', version: '1.0.0' })) as typeof shim.runtime.getManifest;

/*
 * The fake storage lives in memory, so settings (theme, language, AI choice…)
 * would reset on every reload. The real extension keeps them in
 * chrome.storage.local; mirror that here with localStorage.
 */
const KEY = '__twtdash_preview_storage';
const local = shim.storage.local;
try {
  const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Record<string, unknown> | null;
  if (saved && Object.keys(saved).length) await local.set(saved);
} catch {
  /* private mode or corrupt data: start empty */
}
const persist = async () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(await local.get(null)));
  } catch {
    /* quota or private mode: preview keeps working in memory */
  }
};
for (const method of ['set', 'remove', 'clear'] as const) {
  const original = local[method].bind(local) as (...a: unknown[]) => Promise<void>;
  (local as unknown as Record<string, unknown>)[method] = async (...a: unknown[]) => {
    await original(...a);
    await persist();
  };
}

export const browser = shim;
export default shim;
