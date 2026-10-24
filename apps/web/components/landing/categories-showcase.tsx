import { Cpu, Plus } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { categoryName, SITE_CATEGORIES } from "@/lib/categories";
import type { Dictionary } from "@/lib/i18n/types";
import { CategoryChip } from "./category-chip";

export function CategoriesShowcase({ t, lang }: { t: Dictionary["categories"]; lang: string }) {
  return (
    <section aria-labelledby="categories-title" className="cv-auto relative isolate py-24 sm:py-32">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[32rem] w-[min(64rem,130vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(123_97_255/0.12),rgb(255_92_157/0.04)_60%,transparent)]" />
        <div className="bg-dots absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_50%_45%_at_50%_60%,#000_10%,transparent_75%)]" />
      </div>
      <div className="container-page">
        <SectionHeading id="categories-title" eyebrow={t.eyebrow} title={t.title(SITE_CATEGORIES.length)} description={t.description} />

        <Reveal className="mx-auto mt-14 max-w-4xl">
          <ul className="flex flex-wrap justify-center gap-2.5" aria-label={t.listLabel}>
            {SITE_CATEGORIES.map((category) => (
              <li key={category.id} title={lang === "en" ? category.description : undefined}>
                <CategoryChip
                  category={category}
                  label={categoryName(category, t.names)}
                  size="md"
                  className="transition-transform duration-200 hover:-translate-y-0.5"
                />
                {/* Descriptions come from the shared (English) taxonomy. */}
                {lang === "en" ? <span className="sr-only">: {category.description}</span> : null}
              </li>
            ))}
            <li>
              <span className="inline-flex items-center gap-2 rounded-full border border-dashed border-white/20 px-3.5 py-2 text-sm font-medium text-zinc-300">
                <Plus className="size-4" aria-hidden="true" />
                {t.yourOwn}
              </span>
            </li>
          </ul>
          <p className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-zinc-500">
            <Cpu className="size-3.5 shrink-0 text-brand-soft" aria-hidden="true" />
            {t.note}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
