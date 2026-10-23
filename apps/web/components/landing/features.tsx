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
import { DEFAULT_CATEGORIES } from "@twtdash/shared";
import { Reveal } from "@/components/ui/reveal";
import { Accent, SectionHeading } from "@/components/ui/section-heading";
import { getCategory, shortName } from "@/lib/categories";
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

function SyncVisual() {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-black/25 p-4">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-2 text-zinc-300">
          <RefreshCw className="size-3.5 animate-spin text-brand-soft [animation-duration:2.5s]" />
          Syncing bookmarks…
        </span>
        <span className="font-mono tabular-nums text-zinc-500">924 / 1,284</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="bg-brand-gradient h-full w-[72%] rounded-full shadow-[0_0_12px_rgb(177_76_242/0.6)]" />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 text-[11.5px] sm:grid-cols-3">
        {[
          ["Quick sync", "only new posts"],
          ["Full sync", "re-read everything"],
          ["Likes", "optional import"],
        ].map(([a, b]) => (
          <div key={a} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
            <div className="font-medium text-zinc-200">{a}</div>
            <div className="text-zinc-500">{b}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CaptureVisual() {
  const ai = getCategory("ai");
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-black/25 p-3">
      <span className="icon-tile-brand flex size-8 shrink-0 items-center justify-center rounded-lg">
        <Bookmark className="size-4 fill-current" />
      </span>
      <div className="min-w-0 flex-1 text-xs">
        <div className="font-medium text-zinc-200">Saved to twtdash</div>
        <div className="truncate text-zinc-500">just now · from your X tab</div>
      </div>
      <CategoryChip category={ai} label={shortName(ai)} size="xs" />
    </div>
  );
}

function CategoriesVisual() {
  return (
    <div className="flex flex-wrap gap-1.5">
      {["ai", "dev", "design", "finance", "health"].map((id) => {
        const c = getCategory(id);
        return <CategoryChip key={id} category={c} label={shortName(c)} />;
      })}
      <span className="inline-flex items-center rounded-full border border-dashed border-white/20 px-2 py-0.5 text-[11px] text-zinc-400">
        + your own
      </span>
    </div>
  );
}

function AiVisual() {
  return (
    <div className="rounded-xl border border-brand/25 bg-[linear-gradient(135deg,rgb(123_97_255/0.12),rgb(255_92_157/0.06))] p-3 text-xs">
      <div className="flex items-center gap-1.5 font-medium text-violet-100">
        <Sparkles className="size-3.5 text-brand-soft" />
        Gist
      </div>
      <p className="mt-1 leading-snug text-zinc-300">Graders written before prompts lifted eval pass rate to 89%.</p>
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

function SearchVisual() {
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
        <span>14 results</span>
        <span className="flex items-center gap-1">
          <span className="kbd h-5 min-w-5 text-[10px]">/</span> to search
        </span>
      </div>
    </div>
  );
}

function LibraryVisual() {
  return (
    <div className="grid grid-cols-2 gap-1.5 text-[11.5px]">
      {["Masonry", "List", "Table", "Media gallery"].map((v, i) => (
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

function InsightsVisual() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-white/[0.07] bg-black/25 p-3">
        <div className="text-[11px] text-zinc-500">Bookmarks over time</div>
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
        <div className="text-[11px] text-zinc-500">When you bookmark</div>
        <div className="mt-3 grid grid-flow-col grid-rows-7 gap-[3px]">
          {HEAT.map((v, i) => (
            <div key={i} className="aspect-square rounded-[2px] bg-brand-purple" style={{ opacity: Number(v.toFixed(2)) }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ExportVisual() {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {[
        ["JSON", "full backup"],
        ["CSV", "spreadsheets"],
        ["Markdown", "Obsidian & Notion"],
      ].map(([fmt, note]) => (
        <div key={fmt} className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-black/25 px-3 py-2">
          <FileDown className="size-3.5 text-brand-soft" />
          <span className="font-mono font-medium text-zinc-200">.{fmt === "Markdown" ? "md" : fmt.toLowerCase()}</span>
          <span className="text-zinc-500">{note}</span>
        </div>
      ))}
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-white/15 px-3 py-2 text-zinc-400">
        Import a JSON backup
      </div>
    </div>
  );
}

const EXTRAS: Array<{ icon: LucideIcon; label: string }> = [
  { icon: Command, label: "Command palette (Ctrl/⌘ K)" },
  { icon: Keyboard, label: "j / k, s, e, o, / shortcuts" },
  { icon: RefreshCw, label: "Rediscover on Home" },
  { icon: StickyNote, label: "Private notes" },
  { icon: SquareCheckBig, label: "Star, archive & read states" },
  { icon: Tags, label: "Tags & bulk actions" },
  { icon: FolderOpen, label: "X Premium folders → collections" },
  { icon: MoonStar, label: "Dark & light themes" },
];

export function Features() {
  return (
    <section id="features" aria-labelledby="features-title" className="relative scroll-mt-20 py-24 sm:py-32">
      <div aria-hidden="true" className="hairline pointer-events-none absolute inset-x-0 top-0" />
      <div className="container-page">
        <SectionHeading
          id="features-title"
          eyebrow="Features"
          title={
            <>
              Everything you saved, <Accent gradient>finally useful</Accent>
            </>
          }
          description="twtdash turns a never-ending bookmark list into a library you can actually search, sort and come back to."
        />

        <div className="mt-16 grid gap-4 md:grid-flow-dense md:grid-cols-2 lg:grid-cols-4">
          <FeatureCard icon={RefreshCw} title="One-click sync" className="md:col-span-2" visual={<SyncVisual />}>
            twtdash opens your X bookmarks and scrolls through them for you. It reads X&apos;s own page data, so you
            don&apos;t need an X API key or a paid X plan.
          </FeatureCard>
          <FeatureCard icon={Zap} title="Real-time capture" delay={0.05} visual={<CaptureVisual />}>
            Bookmark a post on X and it appears in twtdash instantly. X Premium bookmark folders become collections.
          </FeatureCard>
          <FeatureCard icon={Tags} title="Smart categories" delay={0.1} visual={<CategoriesVisual />}>
            Every post is sorted on-device into {DEFAULT_CATEGORIES.length} categories. Add custom categories with your own keywords.
          </FeatureCard>

          <FeatureCard icon={Wand2} title="AI gists & auto-tags" visual={<AiVisual />}>
            Optional AI categorization, tags and one-line gists from open models on NVIDIA&apos;s API — free with your own
            NVIDIA key, or with twtdash Pro and no key at all.
          </FeatureCard>
          <FeatureCard icon={Search} title="Instant search with operators" delay={0.05} className="lg:col-span-2" visual={<SearchVisual />}>
            Full-text search across everything you&apos;ve saved, with operators like <code className="font-mono text-zinc-300">from:</code>,{" "}
            <code className="font-mono text-zinc-300">has:video</code>, <code className="font-mono text-zinc-300">is:thread</code> and{" "}
            <code className="font-mono text-zinc-300">min_likes:</code>.
          </FeatureCard>
          <FeatureCard icon={LayoutGrid} title="A library your way" delay={0.1} visual={<LibraryVisual />}>
            Browse as masonry, list, table or a media gallery. Organize with collections, tags and notes.
          </FeatureCard>

          <FeatureCard icon={BarChart3} title="Insights" className="md:col-span-2" visual={<InsightsVisual />}>
            See your bookmarks over time, category mix, top authors, content types and a when-you-bookmark heatmap.
          </FeatureCard>
          <FeatureCard icon={FileDown} title="Export anywhere" delay={0.05} className="lg:col-span-2" visual={<ExportVisual />}>
            Export to JSON, CSV or Markdown that drops straight into Obsidian or Notion — and import JSON backups whenever you
            like. Your library is never locked in.
          </FeatureCard>
        </div>

        <Reveal className="mt-10">
          <ul className="flex flex-wrap justify-center gap-2">
            {EXTRAS.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="inline-flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.025] px-3.5 py-2 text-sm text-zinc-300 shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]"
              >
                <Icon className="size-4 text-brand-soft/80" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
