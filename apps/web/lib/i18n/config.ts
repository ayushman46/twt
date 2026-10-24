/**
 * Site locales. English lives at the root (`/`, `/install`, …) and Hindi under
 * `/hi`. Each locale has its own root layout (app/(en)/layout.tsx and
 * app/hi/layout.tsx) so `<html lang>` is correct on every page.
 */
export const LOCALES = ["en", "hi"] as const;
export type Locale = (typeof LOCALES)[number];

/** Pages that exist in Hindi, keyed by their English path. */
const TRANSLATED_PATHS = ["/", "/install"] as const;
type TranslatedPath = (typeof TRANSLATED_PATHS)[number];

export const LOCALE_META: Record<Locale, { htmlLang: string; hreflang: string; ogLocale: string; native: string; short: string }> = {
  en: { htmlLang: "en", hreflang: "en-IN", ogLocale: "en_IN", native: "English", short: "EN" },
  hi: { htmlLang: "hi", hreflang: "hi-IN", ogLocale: "hi_IN", native: "हिन्दी", short: "हिं" },
};

/** Prefix an English path with the locale ("/install" → "/hi/install", "/" → "/hi"). Hashes are kept. */
export function localePath(locale: Locale, path: string): string {
  if (locale === "en") return path;
  if (path === "/" || path === "") return "/hi";
  if (path.startsWith("/#")) return `/hi${path.slice(1)}`;
  return `/hi${path}`;
}

/** The English path a pathname belongs to ("/hi/install" → "/install"). */
export function englishPath(pathname: string): string {
  if (pathname === "/hi" || pathname === "/hi/") return "/";
  if (pathname.startsWith("/hi/")) return pathname.slice(3);
  return pathname;
}

export function localeOfPath(pathname: string): Locale {
  return pathname === "/hi" || pathname.startsWith("/hi/") ? "hi" : "en";
}

/**
 * Where the language switcher sends you: the same page in the other language
 * when it exists, otherwise that language's home page.
 */
export function switchLocaleHref(pathname: string, to: Locale): string {
  const en = englishPath(pathname);
  const translated = (TRANSLATED_PATHS as readonly string[]).includes(en);
  if (to === "en") return en;
  return translated ? localePath("hi", en) : "/hi";
}

/** hreflang alternates for a page that exists in both languages. */
export function languageAlternates(path: TranslatedPath) {
  return {
    "en-IN": path,
    "hi-IN": localePath("hi", path),
    "x-default": path,
  } as const;
}
