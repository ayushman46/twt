import clsx from "clsx";
import {
  ArrowUpRight,
  BookOpen,
  BookOpenCheck,
  CirclePlay,
  FileText,
  FolderGit2,
  Gift,
  GraduationCap,
  HardDrive,
  KeyRound,
  Languages,
  Library,
  MessageSquareText,
  Mic,
  Newspaper,
  Share2,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { Section, SectionHeading } from "@/components/ui/section-heading";
import { categoryName, getCategory } from "@/lib/categories";
import type { Dictionary } from "@/lib/i18n/types";
import { CategoryChip } from "./category-chip";
import { FeatureCard, Initials, Inset } from "./feature-card";

/*
 * Recall, Ask, Shelf, Wrapped, Voice + Translate. Each card carries a small
 * coded illustration drawn in the extension's own neutral style.
 * People, handles and posts are fictional.
 */

type T = Dictionary["whatsNew"];

/* ------------------------------------------------------------------ Recall */

function RecallVisual({ t }: { t: T["recall"] }) {
  return (
    <Inset>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-fg">{t.today}</span>
        <span className="tabular-nums text-muted">
          {t.progress} · {t.streak}
        </span>
      </div>
      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-panel-3">
        <div className="h-full w-[40%] rounded-full bg-accent" />
      </div>
      <div className="mt-4 rounded-lg border border-line bg-panel p-3.5">
        <div className="flex items-center gap-2.5">
          <Initials name="Diego Alvarez" />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[12.5px] font-medium text-fg">Diego Alvarez</div>
            <div className="truncate text-[11.5px] text-muted">@diegoships · {t.savedAgo}</div>
          </div>
          <span className="hidden shrink-0 text-[11px] text-muted min-[420px]:block">{t.why}</span>
        </div>
        <p lang="en" className="mt-2.5 text-[13px] leading-[1.55] text-fg-2">
          {t.post}
        </p>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-[12.5px] font-medium">
        {t.ratings.map((label, i) => (
          <span
            key={label}
            className={clsx(
              "flex min-h-8 items-center justify-center rounded-lg border px-2 text-center",
              i === 1 ? "border-accent/40 bg-accent-soft text-accent" : "border-line bg-panel text-fg-2",
            )}
          >
            {label}
          </span>
        ))}
      </div>
    </Inset>
  );
}

/* --------------------------------------------------------------------- Ask */

const SOURCES = [
  { n: 1, handle: "samfounds", title: "How we booked our first 40 demos without ads" },
  { n: 2, handle: "arjunbuilds", title: "UPI merchant onboarding, pura playbook" },
];

function AskVisual({ t }: { t: T["ask"] }) {
  return (
    <Inset>
      <div className="flex justify-end">
        <p className="max-w-[88%] rounded-xl rounded-br-sm bg-panel-3 px-3 py-2 text-[13px] leading-snug text-fg">{t.question}</p>
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-fg-2 [&_sup]:ml-0.5 [&_sup]:font-mono [&_sup]:text-[10px] [&_sup]:font-medium [&_sup]:text-accent">
        {t.answer}
      </p>
      <div className="mt-3 text-[11.5px] text-muted">{t.sources}</div>
      <ul className="mt-1.5 space-y-1.5">
        {SOURCES.map((s) => (
          <li key={s.n} className="flex h-8 items-center gap-2 rounded-lg border border-line bg-panel px-2.5">
            <span className="font-mono text-[10.5px] text-muted">{s.n}</span>
            <span lang="en" className="min-w-0 flex-1 truncate text-[12px] text-fg-2">
              <span className="text-muted">@{s.handle} · </span>
              {s.title}
            </span>
            <ArrowUpRight className="size-3.5 shrink-0 text-muted" />
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-muted">
        <span className="flex items-center gap-1.5">
          <Languages className="size-3.5" />
          {t.languages}
        </span>
        <span className="flex items-center gap-1.5">
          <KeyRound className="size-3.5" />
          {t.key}
        </span>
      </div>
    </Inset>
  );
}

/* ------------------------------------------------------------------- Shelf */

const KIND_ICON: Record<T["shelf"]["kinds"][number]["id"], LucideIcon> = {
  repo: FolderGit2,
  paper: FileText,
  video: CirclePlay,
  article: Newspaper,
  tool: Wrench,
  book: BookOpen,
  course: GraduationCap,
};

function ShelfVisual({ t }: { t: T["shelf"] }) {
  return (
    <Inset>
      <div className="flex gap-1 overflow-hidden">
        {t.kinds.slice(0, 4).map((k, i) => (
          <span
            key={k.id}
            className={clsx(
              "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-[12px]",
              i === 0 ? "bg-panel-3 text-fg" : "text-muted",
            )}
          >
            {k.label}
            <span className="tabular-nums text-muted">{k.count}</span>
          </span>
        ))}
      </div>
      <ul className="mt-3 space-y-1.5">
        {t.items.slice(0, 3).map((item) => {
          const Icon = KIND_ICON[item.kind];
          return (
            <li key={item.title} className="flex items-center gap-3 rounded-lg border border-line bg-panel p-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-panel-2">
                <Icon className="size-4 text-muted" />
              </span>
              <span className="min-w-0">
                <span lang="en" className="block truncate text-[12.5px] font-medium text-fg">
                  {item.title}
                </span>
                <span className="block truncate text-[11.5px] text-muted">{item.meta}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex items-center gap-1.5 text-[11.5px] text-muted">
        <HardDrive className="size-3.5" />
        {t.onDevice}
      </div>
    </Inset>
  );
}

/* ----------------------------------------------------------------- Wrapped */

function WrappedVisual({ t }: { t: T["wrapped"] }) {
  const ai = getCategory("ai");
  return (
    <Inset className="flex justify-center py-5">
      <div className="w-full max-w-[13.5rem] rounded-xl border border-line bg-panel p-4">
        <div className="flex gap-1">
          {[1, 1, 0.5, 0, 0].map((v, i) => (
            <span key={i} className="h-0.5 flex-1 overflow-hidden rounded-full bg-panel-3">
              <span className="block h-full rounded-full bg-fg-2" style={{ width: `${v * 100}%` }} />
            </span>
          ))}
        </div>
        <div className="mt-4 text-[11.5px] text-muted">{t.year}</div>
        <div className="mt-2 text-[2.25rem] font-semibold leading-none tracking-[-0.04em] text-fg tabular-nums">{t.savedCount}</div>
        <div className="mt-1 text-xs text-muted">{t.saved}</div>
        <div className="mt-4 rounded-lg bg-panel-2 px-3 py-2.5">
          <div className="text-[11px] text-muted">{t.personaLabel}</div>
          <div lang="en" className="mt-0.5 text-[13px] font-medium leading-snug text-fg">
            {t.persona}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <CategoryChip category={ai} label={t.topCategory} />
          <span className="inline-flex h-6 items-center gap-1 rounded-md border border-line-strong px-2 text-[11.5px] font-medium text-fg-2">
            <Share2 className="size-3" />
            {t.share}
          </span>
        </div>
      </div>
    </Inset>
  );
}

/* ---------------------------------------------------------- Voice + translate */

const WAVE = Array.from({ length: 40 }, (_, i) => Number((0.25 + 0.75 * Math.abs(Math.sin(i * 1.3) * Math.cos(i * 0.45))).toFixed(2)));

function VoiceVisual({ t, categoryNames }: { t: T["voice"]; categoryNames?: Record<string, string> }) {
  const sports = getCategory("sports");
  return (
    <Inset>
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg">
          <Mic className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[11.5px] text-muted">{t.listening}</div>
          <div lang="hi" className="truncate text-[14px] font-medium text-fg">
            “{t.transcript}”
          </div>
        </div>
      </div>
      <div className="mt-3 flex h-6 items-center justify-between">
        {WAVE.map((h, i) => (
          <span key={i} className="w-0.5 shrink-0 rounded-full bg-faint" style={{ height: `${Math.round(h * 24)}px` }} />
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <CategoryChip category={sports} label={categoryName(sports, categoryNames)} />
        <span className="text-[11.5px] tabular-nums text-muted">{t.result}</span>
      </div>
      <div className="mt-4 border-t border-line pt-3">
        <p className="text-[12.5px] leading-snug text-muted">{t.original}</p>
        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted">
          <Languages className="size-3.5" />
          {t.translate}
        </div>
        <p className="mt-1.5 text-[13px] font-medium leading-snug text-fg">{t.translated}</p>
      </div>
    </Inset>
  );
}

export function WhatsNew({ t, categoryNames }: { t: T; categoryNames?: Record<string, string> }) {
  return (
    <Section id="new" labelledBy="new-title">
      <SectionHeading id="new-title" title={t.title} description={t.description} />
      <Reveal className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6">
        <FeatureCard icon={BookOpenCheck} title={t.recall.title} className="lg:col-span-3" visual={<RecallVisual t={t.recall} />}>
          {t.recall.body}
        </FeatureCard>
        <FeatureCard icon={MessageSquareText} title={t.ask.title} className="lg:col-span-3" visual={<AskVisual t={t.ask} />}>
          {t.ask.body}
        </FeatureCard>
        <FeatureCard icon={Library} title={t.shelf.title} className="lg:col-span-2" visual={<ShelfVisual t={t.shelf} />}>
          {t.shelf.body}
        </FeatureCard>
        <FeatureCard icon={Gift} title={t.wrapped.title} className="lg:col-span-2" visual={<WrappedVisual t={t.wrapped} />}>
          {t.wrapped.body}
        </FeatureCard>
        <FeatureCard
          icon={Mic}
          title={t.voice.title}
          className="md:col-span-2 lg:col-span-2"
          visual={<VoiceVisual t={t.voice} categoryNames={categoryNames} />}
        >
          {t.voice.body}
        </FeatureCard>
      </Reveal>
    </Section>
  );
}
