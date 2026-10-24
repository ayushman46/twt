/**
 * Tiny zero-dependency i18n runtime (no React — see ./index.ts for hooks).
 *
 * - English (./en.ts) is bundled and is the typed source of truth.
 * - Other languages are lazy chunks (./locales/*.ts) and fall back to English
 *   per key.
 * - Messages support `{name}` interpolation (numbers are locale-formatted) and
 *   ICU-style `{count, plural, one {# post} other {# posts}}` /
 *   `{x, select, a {…} other {…}}` using Intl.PluralRules.
 */
import { DEFAULT_CATEGORIES } from '@twtdash/shared';
import type { SortKey } from '@/lib/query';
import { mergeSettings, settingsItem } from '@/lib/storage';
import { isLocale, LOCALES, type LanguagePref, type Locale } from './codes';
import { en } from './en';
import { overlayStringsItem, type OverlayKey, type OverlayStrings } from './overlay-en';

export { LOCALES, isLocale, type LanguagePref, type Locale };
export type MessageKey = keyof typeof en;
export type Vars = Record<string, string | number | null | undefined>;

/** Built-in category ids that have display-name translations. */
export type CategoryId =
  | 'ai'
  | 'dev'
  | 'design'
  | 'startups'
  | 'marketing'
  | 'finance'
  | 'crypto'
  | 'productivity'
  | 'career'
  | 'science'
  | 'health'
  | 'learning'
  | 'tools'
  | 'news'
  | 'culture'
  | 'humor'
  | 'sports'
  | 'other';

/** Search operators from lib/query OPERATOR_HELP (English lives there). */
export type OperatorId = 'from:' | 'cat:' | 'tag:' | 'in:' | 'has:' | 'is:' | 'after:' | 'before:' | 'min_likes:' | 'domain:' | 'lang:' | '-word' | '"…"';

/** Keys whose English text lives elsewhere (taxonomy, lib/query) — translations only. */
export type ExtraKey = `cat.${CategoryId}` | `catDesc.${CategoryId}` | `sort.${SortKey}` | `op.${OperatorId}`;

/** Shape of a translation file. Every key is optional and falls back to English. */
export type Messages = Partial<Record<MessageKey | ExtraKey, string>>;

const LOADERS: Record<Exclude<Locale, 'en'>, () => Promise<{ default: Messages }>> = {
  hi: () => import('./locales/hi'),
  bn: () => import('./locales/bn'),
  mr: () => import('./locales/mr'),
  te: () => import('./locales/te'),
  ta: () => import('./locales/ta'),
  gu: () => import('./locales/gu'),
  kn: () => import('./locales/kn'),
  ml: () => import('./locales/ml'),
  pa: () => import('./locales/pa'),
};

const CACHE_KEY = 'twtdash:locale';
const EMPTY: Messages = {};
const enMessages = en as Record<string, string>;

let locale: Locale = 'en';
let messages: Record<string, string> = EMPTY;
let formatLocale = 'en-US';
let version = 0;
let wanted: Locale = 'en';
let started: Promise<void> | null = null;
const listeners = new Set<() => void>();
const loaded = new Map<Locale, Promise<Messages>>();

/* ------------------------------------------------------------ Lookup */

/** Translate a key. Missing translations fall back to English. */
export function t(key: MessageKey, vars?: Vars): string {
  const msg = messages[key] ?? enMessages[key] ?? key;
  return vars ? interpolate(msg, vars) : msg;
}

/** Translate a dynamic key, or `undefined` when no language has it. */
export function tMaybe(key: string, vars?: Vars): string | undefined {
  const msg = messages[key] ?? enMessages[key];
  return msg === undefined ? undefined : vars ? interpolate(msg, vars) : msg;
}

/** Translate a key whose English text lives elsewhere (e.g. lib/query labels). */
export function tOr(key: ExtraKey, fallback: string, vars?: Vars): string {
  return tMaybe(key, vars) ?? fallback;
}

export function getLocale(): Locale {
  return locale;
}

/** BCP 47 locale for Intl formatters (numbers, dates). */
export function getFormatLocale(): string {
  return formatLocale;
}

/** Increments on every language change (for React's useSyncExternalStore). */
export function getVersion(): number {
  return version;
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

/* ---------------------------------------------------- Interpolation */

const pluralRules = new Map<string, Intl.PluralRules>();
const numberFormats = new Map<string, Intl.NumberFormat>();

/** Cached Intl.NumberFormat for the active locale. */
export function numberFormat(options?: Intl.NumberFormatOptions, loc = formatLocale): Intl.NumberFormat {
  const id = options ? `${loc}|${JSON.stringify(options)}` : loc;
  let f = numberFormats.get(id);
  if (!f) {
    try {
      f = new Intl.NumberFormat(loc, options);
    } catch {
      f = new Intl.NumberFormat('en-US', options);
    }
    numberFormats.set(id, f);
  }
  return f;
}

function pluralCategory(n: number): Intl.LDMLPluralRule {
  let r = pluralRules.get(locale);
  if (!r) {
    r = new Intl.PluralRules(locale);
    pluralRules.set(locale, r);
  }
  return r.select(n);
}

function formatValue(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  return typeof v === 'number' ? numberFormat().format(v) : v;
}

/** Index of the brace that closes the one at `open`. */
function closing(s: string, open: number): number {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}' && --depth === 0) return i;
  }
  return -1;
}

/** `one {…} other {…}` → { one: '…', other: '…' } */
function parseOptions(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  let i = 0;
  while (i < body.length) {
    const open = body.indexOf('{', i);
    if (open < 0) break;
    const sel = body.slice(i, open).trim();
    const end = closing(body, open);
    if (end < 0) break;
    out[sel] = body.slice(open + 1, end);
    i = end + 1;
  }
  return out;
}

function formatArg(inner: string, vars: Vars): string {
  const c1 = inner.indexOf(',');
  if (c1 < 0) {
    const name = inner.trim();
    return name in vars ? formatValue(vars[name]) : `{${inner}}`;
  }
  const name = inner.slice(0, c1).trim();
  const rest = inner.slice(c1 + 1);
  const c2 = rest.indexOf(',');
  const type = rest.slice(0, c2).trim();
  const options = parseOptions(rest.slice(c2 + 1));
  const value = vars[name];
  if (type === 'plural') {
    const n = Number(value ?? 0);
    const branch = options[`=${n}`] ?? options[pluralCategory(n)] ?? options.other ?? '';
    return interpolate(branch.replace(/#/g, formatValue(n)), vars);
  }
  return interpolate(options[String(value)] ?? options.other ?? '', vars);
}

export function interpolate(msg: string, vars: Vars): string {
  if (msg.indexOf('{') < 0) return msg;
  let out = '';
  let i = 0;
  while (i < msg.length) {
    const open = msg.indexOf('{', i);
    if (open < 0) {
      out += msg.slice(i);
      break;
    }
    const end = closing(msg, open);
    if (end < 0) {
      out += msg.slice(i);
      break;
    }
    out += msg.slice(i, open) + formatArg(msg.slice(open + 1, end), vars);
    i = end + 1;
  }
  return out;
}

/* ---------------------------------------------------------- Locales */

function browserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return ['en-US'];
  return navigator.languages?.length ? navigator.languages : [navigator.language || 'en-US'];
}

/** 'auto' → the first browser language we support, else English. */
export function resolveLocale(pref: LanguagePref | string | undefined | null): Locale {
  if (pref && pref !== 'auto' && isLocale(pref)) return pref;
  for (const tag of browserLanguages()) {
    const base = tag.split('-')[0]!.toLowerCase();
    if (isLocale(base)) return base;
  }
  return 'en';
}

const INDIAN = new Set<string>(LOCALES.filter((l) => l !== 'en'));

/**
 * Indian languages format with Western digits and Indian grouping
 * (1,23,456). English follows the browser's region (en-IN → lakh/crore).
 */
function computeFormatLocale(loc: Locale): string {
  if (loc !== 'en') return `${loc}-IN-u-nu-latn`;
  const langs = browserLanguages();
  const first = langs[0] ?? 'en-US';
  if (/^en(-|$)/i.test(first)) return first;
  const region = /-([A-Za-z]{2})(?:-|$)/.exec(first)?.[1]?.toUpperCase() ?? (langs.some((l) => INDIAN.has(l.split('-')[0]!.toLowerCase())) ? 'IN' : '');
  const candidate = region ? `en-${region}` : 'en-US';
  try {
    return Intl.NumberFormat.supportedLocalesOf([candidate]).length ? candidate : 'en-US';
  } catch {
    return 'en-US';
  }
}

function loadMessages(loc: Locale): Promise<Messages> {
  if (loc === 'en') return Promise.resolve(EMPTY);
  let p = loaded.get(loc);
  if (!p) {
    p = LOADERS[loc]().then((m) => m.default);
    p.catch(() => loaded.delete(loc));
    loaded.set(loc, p);
  }
  return p;
}

function apply(next: Locale, msgs: Messages) {
  const changed = next !== locale || msgs !== messages;
  locale = next;
  messages = msgs as Record<string, string>;
  formatLocale = computeFormatLocale(next);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = next;
    document.documentElement.dir = 'ltr';
  }
  try {
    localStorage.setItem(CACHE_KEY, next);
  } catch {
    /* storage unavailable */
  }
  if (!changed) return;
  version++;
  for (const fn of listeners) fn();
  scheduleOverlaySync();
}

/** Switch language (loads its dictionary first). Resolves once applied. */
export async function setLocale(pref: LanguagePref | string | undefined | null): Promise<void> {
  const next = resolveLocale(pref);
  wanted = next;
  let msgs: Messages;
  try {
    msgs = await loadMessages(next);
  } catch {
    // A missing chunk must never break the UI: stay readable in English.
    if (wanted === next) apply('en', EMPTY);
    return;
  }
  if (wanted !== next) return; // a newer request won
  apply(next, msgs);
}

function readCache(): Locale | null {
  try {
    const v = localStorage.getItem(CACHE_KEY);
    return isLocale(v) ? v : null;
  } catch {
    return null;
  }
}

/**
 * Call (and await) before the first render. Uses the last resolved language
 * (cached synchronously in localStorage) so English needs no async work and
 * other languages render without an English flash; then confirms against the
 * stored setting and follows changes from Settings, the popup or other tabs.
 */
export function initI18n(): Promise<void> {
  if (started) return started;
  started = setLocale(readCache() ?? 'auto');
  try {
    void settingsItem
      .getValue()
      .then((s) => setLocale(mergeSettings(s).language))
      .catch(() => undefined);
    settingsItem.watch((s) => void setLocale(mergeSettings(s).language));
  } catch {
    /* no extension storage (tests) */
  }
  return started;
}

/** True once initI18n() has been called. */
export function i18nStarted(): boolean {
  return started !== null;
}

/* ------------------------------------------------ Domain helpers */

const DEFAULT_BY_ID = new Map(DEFAULT_CATEGORIES.map((c) => [c.id, c]));

/** Display name for a category: built-in names are translated unless the user renamed them. */
export function catName(c: { id: string; name: string; builtin?: boolean }): string {
  if (locale === 'en' || c.builtin === false) return c.name;
  const def = DEFAULT_BY_ID.get(c.id);
  if (!def || def.name !== c.name) return c.name;
  return messages[`cat.${c.id}`] ?? c.name;
}

/** Description for a category (built-in descriptions are translated unless edited). */
export function catDescription(c: { id: string; description: string; builtin?: boolean }): string {
  if (locale === 'en' || c.builtin === false) return c.description;
  const def = DEFAULT_BY_ID.get(c.id);
  if (!def || def.description !== c.description) return c.description;
  return messages[`catDesc.${c.id}`] ?? c.description;
}

/* ------------------------------------------- Content-script strings */

let overlayTimer: ReturnType<typeof setTimeout> | undefined;

/** Hand the overlay (x.com content script) its strings for the active language. */
function scheduleOverlaySync() {
  clearTimeout(overlayTimer);
  overlayTimer = setTimeout(() => void syncOverlayStrings(), 1500);
}

async function syncOverlayStrings() {
  try {
    const strings: Partial<Record<OverlayKey, string>> = {};
    for (const key of Object.keys(messages)) if (key.startsWith('overlay.')) strings[key as OverlayKey] = messages[key];
    const next: OverlayStrings | null = locale === 'en' && formatLocale === 'en-US' ? null : { locale: formatLocale, strings };
    const current = await overlayStringsItem.getValue();
    if (JSON.stringify(current) !== JSON.stringify(next)) await overlayStringsItem.setValue(next);
  } catch {
    /* not in an extension context */
  }
}
