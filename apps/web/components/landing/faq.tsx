import { Plus } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import type { Dictionary } from "@/lib/i18n/types";

/**
 * Native <details> accordion: accessible by default, works without JS and
 * ships no client code. `name` makes it exclusive (one open at a time) where
 * supported; the open/close animation is CSS-only (globals.css).
 */
export function Faq({ t }: { t: Dictionary["faq"] }) {
  return (
    <section id="faq" aria-labelledby="faq-title" className="cv-auto relative scroll-mt-20 py-24 sm:py-32">
      <div className="container-page">
        <SectionHeading id="faq-title" eyebrow={t.eyebrow} title={t.title} description={t.description} />
        <Reveal className="panel mx-auto mt-14 max-w-3xl overflow-hidden">
          {t.items.map((item, i) => (
            <details
              key={item.q}
              id={item.id}
              name="faq"
              open={i === 0}
              className="faq-item group scroll-mt-24 border-b border-line last:border-b-0"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 px-5 py-5 text-left text-zinc-100 transition-colors hover:text-white sm:px-6 [&::-webkit-details-marker]:hidden">
                <h3 className="text-[0.9875rem] font-medium">{item.q}</h3>
                <span
                  className="flex size-7 shrink-0 items-center justify-center rounded-full border border-white/10 text-zinc-400 transition-transform duration-300 group-open:rotate-45 group-open:border-brand/40 group-open:text-brand-soft"
                  aria-hidden="true"
                >
                  <Plus className="size-3.5" />
                </span>
              </summary>
              <p className="px-5 pb-5 pr-14 text-[0.9375rem] leading-relaxed text-zinc-400 sm:px-6 sm:pr-16">{item.a}</p>
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
