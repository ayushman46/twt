import { DEFAULT_CATEGORIES, FALLBACK_CATEGORY_ID, type CategoryDefinition } from "@twtdash/shared";

const byId = new Map(DEFAULT_CATEGORIES.map((c) => [c.id, c]));

export function getCategory(id: string): CategoryDefinition {
  return byId.get(id) ?? byId.get(FALLBACK_CATEGORY_ID)!;
}

/** Short label for tight UI (e.g. "Startups & Business" → "Startups"). */
export function shortName(category: CategoryDefinition): string {
  return category.name.split(" & ")[0]!;
}
