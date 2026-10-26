import {
  ChartColumn,
  Check,
  FileDown,
  LayoutGrid,
  RefreshCw,
  ScanText,
  Search,
  Tags,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Reveal } from "@/components/ui/reveal";
import { Section, SectionHeading } from "@/components/ui/section-heading";
import { SITE_CATEGORIES } from "@/lib/categories";
import type { Dictionary } from "@/lib/i18n/types";

type T = Dictionary["features"];

function Cell({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <li className="flex flex-col bg-bg p-6">
      <Icon className="size-[18px] text-muted" aria-hidden="true" />
      <h3 className="mt-5 text-[15px] font-semibold tracking-[-0.01em] text-fg">{title}</h3>
      <p className="mt-1.5 text-pretty text-[14.5px] leading-relaxed text-muted">{children}</p>
    </li>
  );
}

export function Features({ t }: { t: T }) {
  return (
    <Section id="features" labelledBy="features-title">
      <SectionHeading id="features-title" title={t.title} description={t.description} />

      <Reveal as="ul" className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        <Cell icon={RefreshCw} title={t.sync.title}>
          {t.sync.body}
        </Cell>
        <Cell icon={Zap} title={t.capture.title}>
          {t.capture.body}
        </Cell>
        <Cell icon={Tags} title={t.categories.title}>
          {t.categories.body(SITE_CATEGORIES.length)}
        </Cell>
        <Cell icon={ScanText} title={t.ai.title}>
          {t.ai.body}
        </Cell>
        <Cell icon={Search} title={t.search.title}>
          {t.search.body}
        </Cell>
        <Cell icon={LayoutGrid} title={t.library.title}>
          {t.library.body}
        </Cell>
        <Cell icon={ChartColumn} title={t.insights.title}>
          {t.insights.body}
        </Cell>
        <Cell icon={FileDown} title={t.export.title}>
          {t.export.body}
        </Cell>
      </Reveal>

      <ul className="mt-8 grid grid-cols-1 gap-x-6 gap-y-2.5 text-[14px] text-fg-2 sm:grid-cols-2 lg:grid-cols-4">
        {t.extras.map((label) => (
          <li key={label} className="flex items-start gap-2">
            <Check className="mt-[3px] size-3.5 shrink-0 text-muted" aria-hidden="true" />
            {label}
          </li>
        ))}
      </ul>
    </Section>
  );
}
