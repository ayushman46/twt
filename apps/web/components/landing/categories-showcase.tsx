import { Cpu, Plus } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { Section, SectionHeading } from "@/components/ui/section-heading";
import { categoryName, SITE_CATEGORIES } from "@/lib/categories";
import type { Dictionary } from "@/lib/i18n/types";
import { CategoryGlyph } from "./category-glyph";

export function CategoriesShowcase({ t, lang }: { t: Dictionary["categories"]; lang: string }) {
  return (
    <Section id="categories" labelledBy="categories-title">
      <SectionHeading id="categories-title" title={t.title(SITE_CATEGORIES.length)} description={t.description} />

      <Reveal>
        <ul className="mt-12 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" aria-label={t.listLabel}>
          {SITE_CATEGORIES.map((category) => (
            <li
              key={category.id}
              title={lang === "en" ? category.description : undefined}
              className="flex min-h-11 items-center gap-2.5 rounded-lg border border-line bg-panel px-3 py-2 text-[13.5px] text-fg-2"
            >
              <CategoryGlyph id={category.id} className="text-[16px] text-muted" />
              <span className="min-w-0">{categoryName(category, t.names)}</span>
              {/* Descriptions come from the shared (English) taxonomy. */}
              {lang === "en" ? <span className="sr-only">: {category.description}</span> : null}
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-col gap-2 text-[13.5px] text-muted sm:flex-row sm:items-center sm:gap-6">
          <span className="inline-flex items-center gap-2">
            <Plus className="size-4 shrink-0" aria-hidden="true" />
            {t.yourOwn}
          </span>
          <span className="inline-flex items-center gap-2">
            <Cpu className="size-4 shrink-0" aria-hidden="true" />
            {t.note}
          </span>
        </div>
      </Reveal>
    </Section>
  );
}
