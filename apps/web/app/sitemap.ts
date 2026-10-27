import type { MetadataRoute } from "next";
import { languageAlternates, localePath } from "@/lib/i18n/config";
import { SITE_URL } from "@/lib/site";

const absolute = (path: string) => `${SITE_URL}${path}`;

/** hreflang alternates (en-IN, hi-IN, x-default) for a page that exists in both languages. */
function languages(path: "/" | "/install") {
  return Object.fromEntries(Object.entries(languageAlternates(path)).map(([lang, href]) => [lang, absolute(href)]));
}

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-10-23");
  // Pages that exist in English and हिन्दी: list both, each with the full set of alternates.
  const translated = [
    { path: "/" as const, changeFrequency: "weekly" as const, priority: 1 },
    { path: "/install" as const, changeFrequency: "monthly" as const, priority: 0.8 },
  ].flatMap(({ path, changeFrequency, priority }) =>
    (["en", "hi"] as const).map((locale) => ({
      url: absolute(localePath(locale, path)),
      lastModified,
      changeFrequency,
      priority,
      alternates: { languages: languages(path) },
    })),
  );
  return [
    ...translated,
    { url: absolute("/privacy"), lastModified, changeFrequency: "yearly", priority: 0.4 },
    { url: absolute("/terms"), lastModified, changeFrequency: "yearly", priority: 0.4 },
  ];
}
