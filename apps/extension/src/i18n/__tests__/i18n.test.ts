import { afterAll, describe, expect, it } from 'vitest';
import { getFormatLocale, getLocale, interpolate, setLocale, t, tMaybe, type Messages } from '@/i18n/core';
import { LOCALES } from '@/i18n/codes';
import { en } from '@/i18n/en';
import { LANGUAGES } from '@/i18n/languages';
import { fmtCompact, fmtNumber, fmtShortDate } from '@/lib/format';

const EXTRA = /^(cat|catDesc|sort|op)\./;

/** Top-level argument names: "{count}" and "{count, plural, …}" → "count". */
function args(msg: string): string[] {
  const out: string[] = [];
  let depth = 0;
  for (let i = 0; i < msg.length; i++) {
    if (msg[i] === '{') {
      if (depth === 0) out.push(msg.slice(i + 1).match(/^\s*(\w+)/)?.[1] ?? '?');
      depth++;
    } else if (msg[i] === '}') depth--;
  }
  return out.sort();
}

function balanced(msg: string): boolean {
  let depth = 0;
  for (const ch of msg) {
    if (ch === '{') depth++;
    if (ch === '}' && --depth < 0) return false;
  }
  return depth === 0;
}

/** Beta locales ship a core subset of the UI; every other locale must be fully translated. */
const BETA_MIN_KEYS = 150;
const isBeta = (code: string) => LANGUAGES.find((l) => l.code === code)?.beta === true;

const tags = (msg: string) => [...msg.matchAll(/<(\/?\w+)>/g)].map((m) => m[1]).sort();
const codeSpans = (msg: string) => [...msg.matchAll(/<c>([\s\S]*?)<\/c>/g)].map((m) => m[1]);

async function load(lang: string): Promise<Messages> {
  return (await import(`../locales/${lang}.ts`)).default as Messages;
}

describe('runtime', () => {
  afterAll(() => setLocale('en'));

  it('interpolates and pluralizes in English', async () => {
    await setLocale('en');
    expect(t('nav.home')).toBe('Home');
    expect(t('common.posts', { count: 1 })).toBe('1 post');
    expect(t('common.posts', { count: 12345 })).toMatch(/^12,345 posts$|^12,345 posts$/);
    expect(t('home.summary', { posts: 2, cats: 1 })).toBe('2 posts stashed across 1 category');
    expect(t('palette.searchAll', { query: 'rust' })).toBe('Search all bookmarks for “rust”');
    expect(interpolate('{n, select, a {A} other {O}}', { n: 'a' })).toBe('A');
    expect(interpolate('{n, plural, =0 {none} one {# one} other {# many}}', { n: 0 })).toBe('none');
    expect(interpolate('keep {missing}', {})).toBe('keep {missing}');
  });

  it('loads Hindi lazily, falls back to English per key, and formats Indian numbers', async () => {
    await setLocale('hi');
    expect(getLocale()).toBe('hi');
    expect(getFormatLocale()).toBe('hi-IN-u-nu-latn');
    expect(t('nav.home')).toBe('होम');
    expect(t('bulk.archived', { count: 1 })).toBe('1 पोस्ट आर्काइव की गई');
    expect(t('bulk.archived', { count: 5 })).toBe('5 पोस्ट आर्काइव की गईं');
    expect(t('common.posts', { count: 123456 })).toBe('1,23,456 पोस्ट');
    expect(tMaybe('cat.sports')).toBe('खेल');
    expect(fmtNumber(1234567)).toBe('12,34,567');
    expect(fmtCompact(999)).toBe('999');
    expect(fmtCompact(123456)).toBe('1.2 लाख');
    expect(fmtCompact(34_000_000)).toBe('3.4 करोड़');
    expect(fmtShortDate(Date.now() - 30_000)).toBe('अभी');
  });

  it('uses lakh/crore words where CLDR compact uses millions', async () => {
    await setLocale('ta');
    expect(fmtNumber(1234567)).toBe('12,34,567');
    expect(fmtCompact(250_000)).toBe('2.5 லட்சம்');
    expect(fmtCompact(34_000_000)).toBe('3.4 கோடி');
    await setLocale('te');
    expect(fmtCompact(100_000)).toBe('1 లక్ష');
    expect(fmtCompact(34_000_000)).toBe('3.4 కోట్లు');
  });

  it('resolves unknown languages to English', async () => {
    await setLocale('xx');
    expect(getLocale()).toBe('en');
  });
});

describe('dictionaries', () => {
  const enKeys = Object.keys(en) as Array<keyof typeof en>;

  it('English messages are well-formed', () => {
    for (const k of enKeys) expect(balanced(en[k]), k).toBe(true);
  });

  it('every language has metadata and a loader', () => {
    expect(LANGUAGES.map((l) => l.code).sort()).toEqual([...LOCALES].sort());
  });

  for (const code of LOCALES.filter((l) => l !== 'en')) {
    it(`${code}: keys exist, placeholders and tags match English, coverage`, async () => {
      const msgs = (await load(code)) as Record<string, string>;
      const problems: string[] = [];
      for (const [k, v] of Object.entries(msgs)) {
        if (!EXTRA.test(k) && !(k in en)) problems.push(`unknown key ${k}`);
        if (typeof v !== 'string' || !v.trim()) problems.push(`empty ${k}`);
        if (!balanced(v)) problems.push(`unbalanced braces in ${k}`);
        const source = (en as Record<string, string>)[k];
        if (!source) continue;
        if (args(v).join() !== args(source).join()) problems.push(`placeholders differ in ${k}: ${args(v)} vs ${args(source)}`);
        if (tags(v).join() !== tags(source).join()) problems.push(`tags differ in ${k}`);
        if (codeSpans(v).join('|') !== codeSpans(source).join('|')) problems.push(`<c> code changed in ${k}`);
        if (/\{\w+,\s*plural/.test(v) && !/other\s*\{/.test(v)) problems.push(`plural without other in ${k}`);
      }
      const missing = enKeys.filter((k) => !(k in msgs));
      if (isBeta(code)) {
        const present = enKeys.length - missing.length;
        if (present < BETA_MIN_KEYS) problems.push(`only ${present} keys present, need ${BETA_MIN_KEYS}`);
      } else if (missing.length) {
        problems.push(`missing ${missing.length}: ${missing.slice(0, 12).join(', ')}`);
      }
      for (const id of ['ai', 'dev', 'design', 'startups', 'marketing', 'finance', 'crypto', 'productivity', 'career', 'science', 'health', 'learning', 'tools', 'news', 'sports', 'culture', 'humor', 'other']) {
        if (!msgs[`cat.${id}`]) problems.push(`missing cat.${id}`);
        if (!msgs[`catDesc.${id}`]) problems.push(`missing catDesc.${id}`);
      }
      expect(problems).toEqual([]);
    });
  }
});
