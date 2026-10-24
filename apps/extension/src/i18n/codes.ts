/**
 * Supported UI languages (codes only — tiny, safe to import from the
 * background and content scripts). Metadata lives in ./languages.ts.
 */
export const LOCALES = ['en', 'hi', 'bn', 'mr', 'te', 'ta', 'gu', 'kn', 'ml', 'pa'] as const;

export type Locale = (typeof LOCALES)[number];

/** Settings value: a fixed language, or follow the browser. */
export type LanguagePref = 'auto' | Locale;

export function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (LOCALES as readonly string[]).includes(v);
}

export function isLanguagePref(v: unknown): v is LanguagePref {
  return v === 'auto' || isLocale(v);
}
