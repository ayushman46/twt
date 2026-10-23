import { Cpu, Plus } from "lucide-react";
import { DEFAULT_CATEGORIES } from "@twtdash/shared";
import { Reveal } from "@/components/ui/reveal";
import { Accent, SectionHeading } from "@/components/ui/section-heading";
import { CategoryChip } from "./category-chip";

export function CategoriesShowcase() {
  return (
    <section aria-labelledby="categories-title" className="relative isolate py-24 sm:py-32">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[32rem] w-[min(64rem,130vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(123_97_255/0.12),rgb(255_92_157/0.04)_60%,transparent)]" />
        <div className="bg-dots absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_50%_45%_at_50%_60%,#000_10%,transparent_75%)]" />
      </div>
      <div className="container-page">
        <SectionHeading
          id="categories-title"
          eyebrow="Smart categories"
          title={
            <>
              {DEFAULT_CATEGORIES.length} categories, <Accent gradient>zero effort</Accent>
            </>
          }
          description="twtdash reads each post's text, links and domains and sorts it right in your browser — nothing leaves your device. Add your own categories with custom keywords, or switch on AI for even sharper sorting."
        />

        <Reveal className="mx-auto mt-14 max-w-4xl">
          <ul className="flex flex-wrap justify-center gap-2.5" aria-label="Built-in categories">
            {DEFAULT_CATEGORIES.map((category) => (
              <li key={category.id} title={category.description}>
                <CategoryChip category={category} size="md" className="transition-transform duration-200 hover:-translate-y-0.5" />
                <span className="sr-only">: {category.description}</span>
              </li>
            ))}
            <li>
              <span className="inline-flex items-center gap-2 rounded-full border border-dashed border-white/20 px-3.5 py-2 text-sm font-medium text-zinc-300">
                <Plus className="size-4" aria-hidden="true" />
                Your own, with your keywords
              </span>
            </li>
          </ul>
          <p className="mt-8 flex items-center justify-center gap-2 text-xs text-zinc-500">
            <Cpu className="size-3.5 text-brand-soft" aria-hidden="true" />
            Keyword sorting runs entirely on your device — AI is optional
          </p>
        </Reveal>
      </div>
    </section>
  );
}
