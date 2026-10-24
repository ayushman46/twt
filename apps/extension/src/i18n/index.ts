/**
 * i18n for extension pages: re-exports the runtime plus React hooks.
 *
 *   const t = useT();          // re-renders on language change
 *   t('nav.home')              // "Home" / "होम"
 *   t('common.posts', { count: 3 })
 *   rich(t('home.powerSearchBody'), { c: (s) => <code>{s}</code> })
 */
import { createElement, Fragment, useSyncExternalStore, type ReactNode } from 'react';
import { getLocale, getVersion, i18nStarted, initI18n, subscribe, t, type Locale } from './core';

export * from './core';
export { LANGUAGES, type LanguageInfo } from './languages';

function ensureStarted() {
  // Entries await initI18n() before rendering; this is a safety net (e.g. the preview harness).
  if (!i18nStarted()) queueMicrotask(() => void initI18n());
}

/** Returns `t` and re-renders the component when the language changes. */
export function useT(): typeof t {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  ensureStarted();
  return t;
}

/** The active UI language (re-renders on change). */
export function useLocale(): Locale {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  ensureStarted();
  return getLocale();
}

const TAG_RE = /<(\w+)>([\s\S]*?)<\/\1>/g;

/**
 * Render a translated string containing simple tags, e.g.
 * `"Press <k>?</k> for help"` with `{ k: (s) => <Kbd>{s}</Kbd> }`.
 * Translators may move tags around; unknown tags render as plain text.
 */
export function rich(text: string, tags: Record<string, (chunk: string) => ReactNode>): ReactNode {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(TAG_RE)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    const render = tags[m[1]!];
    out.push(createElement(Fragment, { key: i++ }, render ? render(m[2]!) : m[2]));
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.length === 1 ? out[0] : out;
}
