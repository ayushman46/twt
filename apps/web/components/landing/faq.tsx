import { Plus } from "lucide-react";
import { Section, SectionHeading } from "@/components/ui/section-heading";
import type { Dictionary } from "@/lib/i18n/types";

/**
 * Native <details> accordion: accessible by default, works without JS and
 * ships no client code. `name` makes it exclusive (one open at a time) where
 * supported; the open/close animation is CSS-only (globals.css).
 */
export function Faq({ t }: { t: Dictionary["faq"] }) {
  return (
    <Section id="faq" labelledBy="faq-title">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-16">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <SectionHeading id="faq-title" title={t.title} description={t.description} />
        </div>
        <div className="border-t border-line">
          {t.items.map((item, i) => (
            <details key={item.q} id={item.id} name="faq" open={i === 0} className="faq-item group scroll-mt-24 border-b border-line">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 rounded-md py-5 text-left text-fg transition-colors duration-150 hover:text-fg-2 [&::-webkit-details-marker]:hidden">
                <h3 className="text-[15.5px] font-medium tracking-[-0.01em]">{item.q}</h3>
                <Plus
                  className="size-4 shrink-0 text-muted transition-transform duration-200 ease-out group-open:rotate-45"
                  aria-hidden="true"
                />
              </summary>
              <div className="pb-6 pr-10 text-[15px] leading-relaxed text-muted">{item.a}</div>
            </details>
          ))}
        </div>
      </div>
    </Section>
  );
}
