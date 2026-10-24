import { DEFAULT_CATEGORIES, FALLBACK_CATEGORY_ID, type CategoryDefinition } from "@twtdash/shared";

/**
 * Categories the site shows even if the shared taxonomy in this checkout
 * predates them (the shared package wins as soon as it defines the id).
 */
const SITE_EXTRAS: CategoryDefinition[] = [
  {
    id: "sports",
    name: "Sports",
    emoji: "🏏",
    color: "#22C55E",
    description: "Cricket, football and every other sport — matches, players, scores and fan takes.",
    terms: {},
  },
];

const byId = new Map<string, CategoryDefinition>(DEFAULT_CATEGORIES.map((c) => [c.id, c]));
for (const extra of SITE_EXTRAS) if (!byId.has(extra.id)) byId.set(extra.id, extra);

export function getCategory(id: string): CategoryDefinition {
  return byId.get(id) ?? byId.get(FALLBACK_CATEGORY_ID)!;
}

/** Display name, using a translated name when one is given. */
export function categoryName(category: CategoryDefinition, names?: Record<string, string>): string {
  return names?.[category.id] ?? category.name;
}

/** Short label for tight UI (e.g. "Startups & Business" → "Startups", "Startups और Business" → "Startups"). */
export function shortName(category: CategoryDefinition, names?: Record<string, string>): string {
  return categoryName(category, names).split(/ & | और /)[0]!;
}

/** Every category the site lists (shared taxonomy + extras), with "Other" kept last. */
export const SITE_CATEGORIES: CategoryDefinition[] = (() => {
  const list = DEFAULT_CATEGORIES.filter((c) => c.id !== FALLBACK_CATEGORY_ID);
  for (const extra of SITE_EXTRAS) if (!list.some((c) => c.id === extra.id)) list.push(extra);
  const fallback = DEFAULT_CATEGORIES.find((c) => c.id === FALLBACK_CATEGORY_ID);
  return fallback ? [...list, fallback] : list;
})();
