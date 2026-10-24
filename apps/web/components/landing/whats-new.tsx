import clsx from "clsx";
import {
  ArrowRight,
  BookOpen,
  CirclePlay,
  FileText,
  Flame,
  FolderGit2,
  GraduationCap,
  KeyRound,
  Languages,
  Library,
  Mic,
  MessageSquareText,
  Newspaper,
  Repeat2,
  Share2,
  Sparkles,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { categoryName, getCategory } from "@/lib/categories";
import type { Dictionary } from "@/lib/i18n/types";
import { CategoryChip } from "./category-chip";

/*
 * "What's new": Recall, Ask, Shelf, Wrapped, Voice + Translate. Each card has
 * a small coded (HTML/CSS) illustration of the feature — no screenshots.
 * People, handles and posts are fictional.
 */

type T = Dictionary["whatsNew"];

function NewCard({
  icon: Icon,
  title,
  badge,
  children,
  visual,
  className,
  delay = 0,
}: {
  icon: LucideIcon;
  title: string;
  badge: string;
  children: ReactNode;
  visual: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <Reveal
      delay={delay}
      className={clsx(
        "group panel relative isolate flex flex-col overflow-hidden p-6 transition-colors duration-300 hover:border-white/[0.13] sm:p-7",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 -z-10 size-64 rounded-full bg-[radial-gradient(closest-side,rgb(177_76_242/0.14),transparent)]"
      />
      <div className="flex items-center gap-3">
        <span className="icon-tile-brand flex size-10 items-center justify-center rounded-xl">
          <Icon className="size-[1.15rem]" aria-hidden="true" />
        </span>
        <h3 className="text-[1.125rem] font-semibold tracking-[-0.02em] text-white">{title}</h3>
        <span className="ml-auto rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand-soft">
          {badge}
        </span>
      </div>
      <p className="mt-3 text-[0.9375rem] leading-relaxed text-zinc-400">{children}</p>
      <div aria-hidden="true" className="mt-6 flex flex-1 items-end">
        <div className="w-full">{visual}</div>
      </div>
    </Reveal>
  );
}

/* ------------------------------------------------------------------ Recall */

function RecallVisual({ t }: { t: T["recall"] }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/25 p-4">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="flex items-center gap-2 font-medium text-zinc-200">
          <Repeat2 className="size-3.5 text-brand-soft" />
          {t.today}
          <span className="font-mono tabular-nums text-zinc-500">{t.progress}</span>
        </span>
        <span className="flex items-center gap-1 rounded-full bg-amber-400/10 px-2 py-0.5 font-medium text-amber-200">
          <Flame className="size-3.5 fill-amber-300/70 text-amber-300" />
          {t.streak}
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="bg-brand-gradient h-full w-[40%] rounded-full shadow-[0_0_12px_rgb(177_76_242/0.6)]" />
      </div>

      {/* card stack */}
      <div className="relative mt-5 pb-3">
        <div className="absolute inset-x-6 bottom-0 h-8 rounded-xl border border-white/[0.05] bg-white/[0.02]" />
        <div className="absolute inset-x-3 bottom-1.5 h-8 rounded-xl border border-white/[0.06] bg-white/[0.03]" />
        <div className="relative rounded-xl border border-white/[0.09] bg-[#111119] p-3.5 shadow-[0_18px_40px_-20px_rgb(0_0_0/0.9)]">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-blue-600 text-[10px] font-semibold text-white ring-1 ring-white/15">
              DA
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[12.5px] font-medium text-zinc-100">Diego Alvarez</div>
              <div className="truncate text-[11px] text-zinc-500">@diegoships · {t.savedAgo}</div>
            </div>
            <span className="shrink-0 rounded-full bg-sky-400/10 px-2 py-0.5 text-[10.5px] font-medium text-sky-300">{t.why}</span>
          </div>
          <p lang="en" className="mt-2.5 text-[12.5px] leading-[1.55] text-zinc-300">
            {t.post}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-[12px] font-medium">
        <span className="rounded-lg border border-rose-400/25 bg-rose-400/[0.07] px-2 py-2 text-center text-rose-200">{t.ratings[0]}</span>
        <span className="rounded-lg border border-brand/45 bg-[linear-gradient(135deg,rgb(123_97_255/0.22),rgb(255_92_157/0.1))] px-2 py-2 text-center text-white">
          {t.ratings[1]}
        </span>
        <span className="rounded-lg border border-emerald-400/25 bg-emerald-400/[0.07] px-2 py-2 text-center text-emerald-200">{t.ratings[2]}</span>
      </div>
      <div className="mt-3 text-center text-[11px] text-zinc-500">{t.minutes}</div>
    </div>
  );
}

/* --------------------------------------------------------------------- Ask */

const SOURCES = [
  { n: 1, initials: "SO", avatar: "from-amber-200 to-rose-500", handle: "samfounds", title: "How we booked our first 40 demos without ads" },
  { n: 2, initials: "AM", avatar: "from-amber-300 to-orange-600", handle: "arjunbuilds", title: "UPI merchant onboarding — pura playbook 🧵" },
];

function AskVisual({ t }: { t: T["ask"] }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/25 p-4">
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-white/[0.08] px-3.5 py-2 text-[13px] leading-snug text-zinc-100">
          {t.question}
        </p>
      </div>
      <div className="mt-3 flex gap-2.5">
        <span className="icon-tile-brand mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg">
          <Sparkles className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] leading-relaxed text-zinc-300 [&_sup]:ml-0.5 [&_sup]:rounded [&_sup]:bg-brand/20 [&_sup]:px-1 [&_sup]:text-[10px] [&_sup]:font-semibold [&_sup]:text-brand-soft">
            {t.answer}
          </p>
          <div className="mt-3 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-zinc-500">{t.sources}</div>
          <ul className="mt-1.5 space-y-1.5">
            {SOURCES.map((s) => (
              <li key={s.n} className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.025] px-2 py-1.5">
                <span className="font-mono text-[10px] font-semibold text-brand-soft">[{s.n}]</span>
                <span
                  className={clsx(
                    "flex size-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[8.5px] font-semibold text-white",
                    s.avatar,
                  )}
                >
                  {s.initials}
                </span>
                <span lang="en" className="min-w-0 flex-1 truncate text-[11.5px] text-zinc-300">
                  <span className="text-zinc-500">@{s.handle} · </span>
                  {s.title}
                </span>
                <ArrowRight className="size-3 shrink-0 text-zinc-500" />
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-white/[0.06] pt-3 text-[11px] text-zinc-400">
        <span className="flex items-center gap-1.5">
          <Languages className="size-3.5 text-brand-soft" />
          {t.languages}
        </span>
        <span className="flex items-center gap-1.5">
          <KeyRound className="size-3.5 text-brand-soft" />
          {t.key}
        </span>
      </div>
    </div>
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

const KIND_TINT: Record<T["shelf"]["items"][number]["kind"], string> = {
  repo: "from-zinc-300/25 to-zinc-500/10 text-zinc-200",
  paper: "from-sky-300/25 to-sky-500/10 text-sky-200",
  video: "from-rose-300/25 to-rose-500/10 text-rose-200",
  book: "from-amber-300/25 to-amber-500/10 text-amber-200",
};

function ShelfVisual({ t }: { t: T["shelf"] }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/25 p-4">
      <div className="flex flex-wrap gap-1.5">
        {t.kinds.map((k, i) => {
          const Icon = KIND_ICON[k.id];
          return (
            <span
              key={k.id}
              className={clsx(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px]",
                i === 0
                  ? "border-brand/45 bg-[linear-gradient(135deg,rgb(123_97_255/0.2),rgb(255_92_157/0.08))] text-white"
                  : "border-white/[0.07] bg-white/[0.025] text-zinc-400",
              )}
            >
              <Icon className="size-3.5" />
              {k.label}
              <span className="tabular-nums opacity-60">{k.count}</span>
            </span>
          );
        })}
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {t.items.map((item) => {
          const Icon = KIND_ICON[item.kind];
          return (
            <li key={item.title} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] p-2.5">
              <span className={clsx("flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br", KIND_TINT[item.kind])}>
                <Icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span lang="en" className="block truncate text-[12.5px] font-medium text-zinc-100">
                  {item.title}
                </span>
                <span className="block truncate text-[11px] text-zinc-500">{item.meta}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-zinc-500">
        <span className="size-1.5 rounded-full bg-emerald-400" />
        {t.onDevice}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- Wrapped */

function WrappedVisual({ t }: { t: T["wrapped"] }) {
  const ai = getCategory("ai");
  return (
    <div className="mx-auto w-full max-w-[15rem]">
      <div className="relative aspect-[9/14] overflow-hidden rounded-[1.4rem] bg-[radial-gradient(ellipse_at_20%_0%,rgb(123_97_255/0.85),transparent_55%),radial-gradient(ellipse_at_100%_100%,rgb(255_92_157/0.75),transparent_55%),linear-gradient(160deg,#1a1033,#0b0b11)] p-4 shadow-[0_30px_60px_-30px_rgb(177_76_242/0.8)] ring-1 ring-white/15">
        {/* story progress */}
        <div className="flex gap-1">
          {[1, 1, 0.5, 0, 0].map((v, i) => (
            <span key={i} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/25">
              <span className="block h-full rounded-full bg-white" style={{ width: `${v * 100}%` }} />
            </span>
          ))}
        </div>
        <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/75">{t.year}</div>
        <div className="mt-4 text-[2.6rem] font-semibold leading-none tracking-[-0.04em] text-white tabular-nums">{t.savedCount}</div>
        <div className="mt-1 text-[12px] text-white/75">{t.saved}</div>

        <div className="mt-5 rounded-xl bg-black/30 p-3 ring-1 ring-white/10">
          <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/60">{t.personaLabel}</div>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-2xl leading-none">🦉</span>
            <span lang="en" className="text-[13px] font-semibold leading-tight text-white">
              {t.persona}
            </span>
          </div>
        </div>
        <div className="mt-3">
          <CategoryChip category={ai} label={t.topCategory} />
        </div>

        <div className="absolute inset-x-4 bottom-4 flex items-center justify-center gap-1.5 rounded-full bg-white py-2 text-[12px] font-semibold text-ink">
          <Share2 className="size-3.5" />
          {t.share}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- Voice + translate */

function VoiceVisual({ t, categoryNames }: { t: T["voice"]; categoryNames?: Record<string, string> }) {
  const sports = getCategory("sports");
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/[0.07] bg-black/25 p-3.5">
        <div className="flex items-center gap-3">
          <span className="relative flex size-10 shrink-0 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-brand-pink/30 [animation-duration:2s]" />
            <span className="bg-brand-gradient relative flex size-10 items-center justify-center rounded-full shadow-[0_0_24px_rgb(255_92_157/0.55)]">
              <Mic className="size-4.5 text-white" />
            </span>
          </span>
          <div className="min-w-0">
            <div className="text-[10.5px] font-medium text-zinc-500">{t.listening}</div>
            <div lang="hi" className="truncate text-[14px] font-medium text-white">
              “{t.transcript}”
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <CategoryChip category={sports} label={categoryName(sports, categoryNames)} />
          <span className="text-[11px] tabular-nums text-zinc-500">{t.result}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-black/25 p-3.5">
        <p className="text-[12px] leading-snug text-zinc-500">{t.original}</p>
        <div className="my-2 flex items-center gap-2">
          <span className="h-px flex-1 bg-white/[0.07]" />
          <span className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-[10.5px] font-medium text-brand-soft">
            <Languages className="size-3" />
            {t.translate}
          </span>
          <span className="h-px flex-1 bg-white/[0.07]" />
        </div>
        <p className="text-[13px] font-medium leading-snug text-zinc-100">{t.translated}</p>
      </div>
    </div>
  );
}

export function WhatsNew({ t, categoryNames }: { t: T; categoryNames?: Record<string, string> }) {
  return (
    <section id="new" aria-labelledby="new-title" className="cv-auto relative isolate scroll-mt-20 py-24 sm:py-32">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-24 h-[36rem] w-[min(70rem,140vw)] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(123_97_255/0.13),rgb(255_92_157/0.04)_60%,transparent)]" />
      </div>
      <div className="container-page">
        <SectionHeading id="new-title" eyebrow={t.eyebrow} title={t.title} description={t.description} />

        <div className="mt-16 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <NewCard icon={Repeat2} title={t.recall.title} badge={t.newBadge} className="md:col-span-2" visual={<RecallVisual t={t.recall} />}>
            {t.recall.body}
          </NewCard>
          <NewCard
            icon={MessageSquareText}
            title={t.ask.title}
            badge={t.newBadge}
            className="md:col-span-2"
            delay={0.05}
            visual={<AskVisual t={t.ask} />}
          >
            {t.ask.body}
          </NewCard>
          <NewCard icon={Library} title={t.shelf.title} badge={t.newBadge} className="md:col-span-2" visual={<ShelfVisual t={t.shelf} />}>
            {t.shelf.body}
          </NewCard>
          <NewCard
            icon={Sparkles}
            title={t.wrapped.title}
            badge={t.newBadge}
            delay={0.05}
            visual={<WrappedVisual t={t.wrapped} />}
          >
            {t.wrapped.body}
          </NewCard>
          <NewCard icon={Mic} title={t.voice.title} badge={t.newBadge} delay={0.1} visual={<VoiceVisual t={t.voice} categoryNames={categoryNames} />}>
            {t.voice.body}
          </NewCard>
        </div>
      </div>
    </section>
  );
}
