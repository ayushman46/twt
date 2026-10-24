import clsx from "clsx";
import {
  BarChart3,
  Bookmark,
  Command,
  FileDown,
  FolderOpen,
  Keyboard,
  LayoutGrid,
  MoonStar,
  RefreshCw,
  Search,
  Sparkles,
  SquareCheckBig,
  StickyNote,
  Tags,
  Wand2,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { getCategory, shortName, SITE_CATEGORIES } from "@/lib/categories";
import type { Dictionary } from "@/lib/i18n/types";
import { CategoryChip } from "./category-chip";

function FeatureCard({
  icon: Icon,
  title,
  children,
  visual,
  className,
  delay = 0,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  visual?: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <Reveal
      delay={delay}
      className={clsx("group panel relative isolate flex flex-col overflow-hidden p-6 transition-colors duration-300 hover:border-white/[0.13] sm:p-7", className)}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 -z-10 size-64 rounded-full bg-[radial-gradient(closest-side,rgb(177_76_242/0.16),transparent)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-8 top-0 h-px bg-[linear-gradient(90deg,transparent,rgb(188_170_255/0.5),transparent)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
      />
      <span className="icon-tile-soft flex size-10 items-center justify-center rounded-xl">
        <Icon className="size-[1.15rem]" aria-hidden="true" />
      </span>
      <h3 className="mt-5 text-[1.0625rem] font-semibold tracking-[-0.02em] text-white">{title}</h3>
      <div className="mt-2 text-[0.9375rem] leading-relaxed text-zinc-400">{children}</div>
      {visual ? (
        <div aria-hidden="true" className="mt-6 flex flex-1 items-end">
          <div className="w-full">{visual}</div>
        </div>
      ) : null}
    </Reveal>
  );
}

type T = Dictionary["features"];
type Names = Record<string, string> | undefined;

function SyncVisual({ t }: { t: T["sync"] }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-black/25 p-4">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-2 text-zinc-300">
          <RefreshCw className="size-3.5 animate-spin text-brand-soft [animation-duration:2.5s]" />
          {t.syncing}
        </span>
        <span className="font-mono tabular-nums text-zinc-500">924 / 1,284</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="bg-brand-gradient h-full w-[72%] rounded-full shadow-[0_0_12px_rgb(177_76_242/0.6)]" />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 text-[11.5px] sm:grid-cols-3">
        {t.modes.map(([a, b]) => (
          <div key={a} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
            <div className="font-medium text-zinc-200">{a}</div>
            <div className="text-zinc-500">{b}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CaptureVisual({ t, names }: { t: T["capture"]; names: Names }) {
  const ai = getCategory("ai");
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-black/25 p-3">
      <span className="icon-tile-brand flex size-8 shrink-0 items-center justify-center rounded-lg">
        <Bookmark className="size-4 fill-current" />
      </span>
      <div className="min-w-0 flex-1 text-xs">
        <div className="font-medium text-zinc-200">{t.saved}</div>
        <div className="truncate text-zinc-500">{t.from}</div>
      </div>
      <CategoryChip category={ai} label={shortName(ai, names)} size="xs" />
    </div>
  );
}

function CategoriesVisual({ t, names }: { t: T["categories"]; names: Names }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {["ai", "dev", "sports", "finance", "health"].map((id) => {
        const c = getCategory(id);
        return <CategoryChip key={id} category={c} label={shortName(c, names)} />;
      })}
      <span className="inline-flex items-center rounded-full border border-dashed border-white/20 px-2 py-0.5 text-[11px] text-zinc-400">
        {t.yourOwn}
      </span>
    </div>
  );
}

function AiVisual({ t }: { t: T["ai"] }) {
  return (
    <div className="rounded-xl border border-brand/25 bg-[linear-gradient(135deg,rgb(123_97_255/0.12),rgb(255_92_157/0.06))] p-3 text-xs">
      <div className="flex items-center gap-1.5 font-medium text-violet-100">
        <Sparkles className="size-3.5 text-brand-soft" />
        {t.gist}
      </div>
      <p className="mt-1 leading-snug text-zinc-300">{t.gistText}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {["evals", "prompting", "llm ops"].map((t) => (
          <span key={t} className="rounded-full bg-white/[0.06] px-1.5 py-px text-[10.5px] text-zinc-400">
            #{t}
          </span>
        ))}
      </div>
    </div>
  );
}

function SearchVisual({ t }: { t: T["search"] }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-black/25 p-3">
      <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 font-mono text-[11.5px]">
        <Search className="size-3.5 shrink-0 text-zinc-500" />
        <span className="min-w-0 truncate">
          <span className="text-brand-soft">from:</span>
          <span className="text-accent">mayabuilds</span> <span className="text-brand-soft">has:</span>
          <span className="text-accent">link</span> <span className="text-brand-soft">tag:</span>
          <span className="text-accent">evals</span>
        </span>
      </div>
      <div className="mt-2.5 flex items-center justify-between px-1 text-[11px] text-zinc-500">
        <span>{t.results}</span>
        <span className="flex items-center gap-1">
          <span className="kbd h-5 min-w-5 text-[10px]">/</span> {t.toSearch}
        </span>
      </div>
    </div>
  );
}

function LibraryVisual({ t }: { t: T["library"] }) {
  return (
    <div className="grid grid-cols-2 gap-1.5 text-[11.5px]">
      {t.views.map((v, i) => (
        <div
          key={v}
          className={clsx(
            "rounded-lg border px-2.5 py-2 text-center",
            i === 0
              ? "border-brand/45 bg-[linear-gradient(135deg,rgb(123_97_255/0.18),rgb(255_92_157/0.08))] text-white"
              : "border-white/[0.07] bg-white/[0.02] text-zinc-400",
          )}
        >
          {v}
        </div>
      ))}
    </div>
  );
}

// Deterministic sample data for the insights visual.
const BARS = [22, 30, 26, 41, 38, 52, 47, 60, 55, 72, 66, 84];
const HEAT = Array.from({ length: 7 * 16 }, (_, i) => {
  const day = i % 7;
  const week = Math.floor(i / 7);
  const v = (Math.sin(week * 1.7 + day * 2.3) + Math.cos(week * 0.6 - day)) / 2;
  return Math.max(0.06, Math.min(1, 0.45 + v * 0.55 + (day === 6 || day === 0 ? 0.15 : 0)));
});

function InsightsVisual({ t }: { t: T["insights"] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-white/[0.07] bg-black/25 p-3">
        <div className="text-[11px] text-zinc-500">{t.overTime}</div>
        <div className="mt-3 flex h-20 items-end gap-1">
          {BARS.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-[3px] bg-gradient-to-t from-brand-violet/45 via-brand-purple/75 to-brand-pink/90"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-white/[0.07] bg-black/25 p-3">
        <div className="text-[11px] text-zinc-500">{t.when}</div>
        <div className="mt-3 grid grid-flow-col grid-rows-7 gap-[3px]">
          {HEAT.map((v, i) => (
            <div key={i} className="aspect-square rounded-[2px] bg-brand-purple" style={{ opacity: Number(v.toFixed(2)) }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ExportVisual({ t }: { t: T["export"] }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {t.formats.map(([fmt, note]) => (
        <div key={fmt} className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-black/25 px-3 py-2">
          <FileDown className="size-3.5 text-brand-soft" />
          <span className="font-mono font-medium text-zinc-200">.{fmt}</span>
          <span className="text-zinc-500">{note}</span>
        </div>
      ))}
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-white/15 px-3 py-2 text-zinc-400">
        {t.importLabel}
      </div>
    </div>
  );
}

const EXTRA_ICONS: LucideIcon[] = [Command, Keyboard, RefreshCw, StickyNote, SquareCheckBig, Tags, FolderOpen, MoonStar];

export function Features({ t, categoryNames }: { t: T; categoryNames?: Record<string, string> }) {
  return (
    <section id="features" aria-labelledby="features-title" className="cv-auto relative scroll-mt-20 py-24 sm:py-32">
      <div aria-hidden="true" className="hairline pointer-events-none absolute inset-x-0 top-0" />
      <div className="container-page">
        <SectionHeading id="features-title" eyebrow={t.eyebrow} title={t.title} description={t.description} />

        <div className="mt-16 grid gap-4 md:grid-flow-dense md:grid-cols-2 lg:grid-cols-4">
          <FeatureCard icon={RefreshCw} title={t.sync.title} className="md:col-span-2" visual={<SyncVisual t={t.sync} />}>
            {t.sync.body}
          </FeatureCard>
          <FeatureCard icon={Zap} title={t.capture.title} delay={0.05} visual={<CaptureVisual t={t.capture} names={categoryNames} />}>
            {t.capture.body}
          </FeatureCard>
          <FeatureCard
            icon={Tags}
            title={t.categories.title}
            delay={0.1}
            visual={<CategoriesVisual t={t.categories} names={categoryNames} />}
          >
            {t.categories.body(SITE_CATEGORIES.length)}
          </FeatureCard>

          <FeatureCard icon={Wand2} title={t.ai.title} visual={<AiVisual t={t.ai} />}>
            {t.ai.body}
          </FeatureCard>
          <FeatureCard icon={Search} title={t.search.title} delay={0.05} className="lg:col-span-2" visual={<SearchVisual t={t.search} />}>
            {t.search.body}
          </FeatureCard>
          <FeatureCard icon={LayoutGrid} title={t.library.title} delay={0.1} visual={<LibraryVisual t={t.library} />}>
            {t.library.body}
          </FeatureCard>

          <FeatureCard icon={BarChart3} title={t.insights.title} className="md:col-span-2" visual={<InsightsVisual t={t.insights} />}>
            {t.insights.body}
          </FeatureCard>
          <FeatureCard icon={FileDown} title={t.export.title} delay={0.05} className="lg:col-span-2" visual={<ExportVisual t={t.export} />}>
            {t.export.body}
          </FeatureCard>
        </div>

        <Reveal className="mt-10">
          <ul className="flex flex-wrap justify-center gap-2">
            {t.extras.map((label, i) => {
              const Icon = EXTRA_ICONS[i] ?? Command;
              return (
                <li
                  key={label}
                  className="inline-flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.025] px-3.5 py-2 text-sm text-zinc-300 shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]"
                >
                  <Icon className="size-4 text-brand-soft/80" aria-hidden="true" />
                  {label}
                </li>
              );
            })}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
