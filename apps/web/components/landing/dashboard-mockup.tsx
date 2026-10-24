import clsx from "clsx";
import {
  BarChart3,
  FolderOpen,
  Heart,
  House,
  Image as ImageIcon,
  LayoutGrid,
  Library,
  Link2,
  List,
  Play,
  Lock,
  Repeat2,
  Search,
  Sparkles,
  Star,
  Table2,
} from "lucide-react";
import { LogoMark, WordmarkText } from "@/components/site/logo";
import { getCategory, shortName, SITE_CATEGORIES } from "@/lib/categories";
import type { MockupCopy } from "@/lib/i18n/types";
import { CategoryChip } from "./category-chip";

/*
 * A coded (HTML/CSS only) preview of the twtdash dashboard.
 * Every person, handle and post below is fictional.
 */

type Post = {
  name: string;
  handle: string;
  initials: string;
  avatar: string;
  date: string;
  category: string;
  text: string;
  /** Language of the post text ("hi-Latn" = Hinglish). */
  lang?: string;
  tags: string[];
  likes: string;
  reposts: string;
  starred?: boolean;
  thread?: string;
  gist?: string;
  media?: "images" | "video";
  link?: { domain: string; title: string };
};

const POSTS: Post[] = [
  {
    name: "Maya Chen",
    handle: "mayabuilds",
    initials: "MC",
    avatar: "from-violet-400 to-fuchsia-600",
    date: "Sep 14",
    category: "ai",
    text: "Spent the weekend turning our support tickets into an eval set. Biggest lesson: write the grader before the prompt. Pass rate went from 61% → 89% without touching the model.",
    tags: ["evals", "prompting"],
    likes: "2.4K",
    reposts: "318",
    starred: true,
    gist: "Writing graders first lifted eval pass rate from 61% to 89%.",
  },
  {
    name: "Priya Nair",
    handle: "priyamakes",
    initials: "PN",
    avatar: "from-pink-400 to-rose-600",
    date: "Sep 3",
    category: "design",
    text: "Tiny typography rule I use everywhere: line-height shrinks as font size grows. 1.5 for body, 1.25 for headings, 1.05 for display.",
    tags: ["typography"],
    likes: "3.7K",
    reposts: "529",
    media: "images",
  },
  {
    name: "Diego Alvarez",
    handle: "diegoships",
    initials: "DA",
    avatar: "from-sky-400 to-blue-600",
    date: "Aug 30",
    category: "dev",
    text: "Most React performance problems are just state living too high in the tree. Move it down, memo less, ship faster. 🧵",
    tags: ["react", "performance"],
    likes: "1.8K",
    reposts: "240",
    thread: "Thread",
  },
  {
    name: "Arjun Mehta",
    handle: "arjunbuilds",
    initials: "AM",
    avatar: "from-amber-300 to-orange-600",
    date: "Aug 18",
    category: "startups",
    lang: "hi-Latn",
    text: "Bhai ye thread zaroor padho 👇 Ek UPI startup ne 6 mahine mein Indore, Surat aur Nagpur ke merchants kaise onboard kiye — pura playbook, numbers ke saath.",
    tags: ["upi", "gtm"],
    likes: "4.1K",
    reposts: "860",
    thread: "Thread",
  },
  {
    name: "Rohan Iyer",
    handle: "rohanbats",
    initials: "RI",
    avatar: "from-emerald-300 to-teal-600",
    date: "Sep 9",
    category: "sports",
    lang: "hi-Latn",
    text: "Kal ka match ekdum paisa vasool tha 🔥 last over mein 18 chahiye the aur do balls pehle hi game khatam 🏏",
    tags: ["cricket"],
    likes: "12K",
    reposts: "1.9K",
    starred: true,
    media: "video",
  },
  {
    name: "Theo Park",
    handle: "theoreads",
    initials: "TP",
    avatar: "from-indigo-300 to-purple-600",
    date: "Jun 28",
    category: "learning",
    text: "Rewatched a full university course on distributed systems this summer. Still the best free resource out there — my notes for all 23 lectures:",
    tags: ["distributed systems", "courses"],
    likes: "5.2K",
    reposts: "1.1K",
    link: { domain: "notes.theopark.dev", title: "Distributed systems — lecture notes" },
  },
];

const SIDEBAR_CATEGORIES: Array<[string, number]> = [
  ["ai", 342],
  ["dev", 287],
  ["design", 164],
  ["startups", 131],
  ["learning", 98],
  ["sports", 76],
  ["productivity", 64],
  ["tools", 41],
  ["humor", 37],
];
const MORE_CATEGORIES = SITE_CATEGORIES.length - SIDEBAR_CATEGORIES.length;

const RESULT_CHIPS: Array<[string, number]> = [
  ["ai", 41],
  ["dev", 33],
  ["startups", 18],
  ["sports", 14],
  ["design", 12],
];

function QueryToken({ k, v, negate }: { k?: string; v: string; negate?: boolean }) {
  if (negate) {
    return <span className="rounded bg-rose-400/10 px-1 text-rose-300">-{v}</span>;
  }
  return (
    <span className="rounded bg-white/[0.06] px-1">
      <span className="text-brand-soft">{k}:</span>
      <span className="text-accent">{v}</span>
    </span>
  );
}

function PostCard({ post, names, threadLabel }: { post: Post; names?: Record<string, string>; threadLabel: string }) {
  const category = getCategory(post.category);
  return (
    <div className="mb-3 break-inside-avoid rounded-xl border border-white/[0.07] bg-[linear-gradient(180deg,rgb(255_255_255/0.035),rgb(255_255_255/0.015))] p-3.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]">
      <div className="flex items-start gap-2.5">
        <div
          className={clsx(
            "flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-semibold text-white/95 ring-1 ring-white/15",
            post.avatar,
          )}
        >
          {post.initials}
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[13px] font-medium text-zinc-100">{post.name}</div>
          <div className="truncate text-[11.5px] text-zinc-500">
            @{post.handle} · {post.date}
          </div>
        </div>
        <Star
          className={clsx("size-3.5 shrink-0", post.starred ? "fill-amber-300 text-amber-300" : "text-zinc-600")}
          aria-hidden="true"
        />
      </div>

      <p lang={post.lang ?? "en"} className="mt-2.5 text-[12.5px] leading-[1.55] text-zinc-300">
        {post.text}
      </p>

      {post.media === "video" ? (
        <div className="relative mt-2.5 flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-[radial-gradient(ellipse_at_30%_20%,rgb(52_211_153/0.55),transparent_60%),linear-gradient(135deg,#065f46,#0f172a)]">
          <div className="absolute inset-x-6 bottom-5 h-px bg-white/25" />
          <div className="absolute bottom-[1.1rem] left-1/2 h-3 w-px -translate-x-1/2 bg-white/40" />
          <span className="flex size-9 items-center justify-center rounded-full bg-black/45 ring-1 ring-white/25">
            <Play className="ml-0.5 size-4 fill-white text-white" />
          </span>
          <span className="absolute bottom-1.5 right-2 rounded bg-black/55 px-1 font-mono text-[9.5px] text-white/85">0:42</span>
        </div>
      ) : null}

      {post.media === "images" ? (
        <div className="mt-2.5 grid grid-cols-2 gap-1.5">
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-gradient-to-br from-rose-300/80 via-fuchsia-400/60 to-violet-500/70">
            <div className="absolute inset-x-3 top-3 h-1.5 rounded-full bg-white/70" />
            <div className="absolute inset-x-3 top-6 h-1 w-1/2 rounded-full bg-white/50" />
            <div className="absolute bottom-3 left-3 font-display text-2xl italic leading-none text-white/90">Aa</div>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-gradient-to-br from-zinc-200/90 to-zinc-400/80">
            <div className="absolute inset-3 flex flex-col justify-between">
              <div className="h-2.5 w-3/4 rounded-sm bg-zinc-800/80" />
              <div className="space-y-1">
                <div className="h-1 rounded-full bg-zinc-700/50" />
                <div className="h-1 w-5/6 rounded-full bg-zinc-700/50" />
                <div className="h-1 w-2/3 rounded-full bg-zinc-700/50" />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {post.link ? (
        <div className="mt-2.5 flex items-center gap-2.5 overflow-hidden rounded-lg border border-white/[0.07] bg-black/20 p-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-white/[0.06]">
            <Link2 className="size-3.5 text-zinc-400" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[10.5px] text-zinc-500">{post.link.domain}</div>
            <div className="truncate text-[11.5px] font-medium text-zinc-200">{post.link.title}</div>
          </div>
        </div>
      ) : null}

      {post.thread ? (
        <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-md bg-sky-400/10 px-1.5 py-0.5 text-[10.5px] font-medium text-sky-300">
          <List className="size-3" aria-hidden="true" />
          {threadLabel}
        </div>
      ) : null}

      {post.gist ? (
        <div className="mt-2.5 flex gap-1.5 rounded-lg border border-brand/25 bg-[linear-gradient(135deg,rgb(123_97_255/0.14),rgb(255_92_157/0.08))] px-2 py-1.5 text-[11px] leading-snug text-violet-100">
          <Sparkles className="mt-px size-3 shrink-0 text-brand-soft" aria-hidden="true" />
          <span>{post.gist}</span>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <CategoryChip category={category} label={shortName(category, names)} size="xs" />
        {post.tags.map((tag) => (
          <span key={tag} className="rounded-full bg-white/[0.05] px-1.5 py-px text-[10px] text-zinc-400">
            #{tag}
          </span>
        ))}
        <span className="ml-auto flex items-center gap-2.5 text-[10.5px] tabular-nums text-zinc-500">
          <span className="flex items-center gap-1">
            <Repeat2 className="size-3" aria-hidden="true" />
            {post.reposts}
          </span>
          <span className="flex items-center gap-1">
            <Heart className="size-3" aria-hidden="true" />
            {post.likes}
          </span>
        </span>
      </div>
    </div>
  );
}

export function DashboardMockup({
  t,
  categoryNames,
  className,
}: {
  t: MockupCopy;
  categoryNames?: Record<string, string>;
  className?: string;
}) {
  return (
    <figure className={clsx("relative", className)}>
      <figcaption className="sr-only">{t.caption}</figcaption>

      <div aria-hidden="true" className="pointer-events-none relative isolate select-none">
        <div className="ring-gradient overflow-hidden rounded-2xl bg-[#0b0b11]/95 shadow-[0_50px_140px_-40px_rgb(0_0_0/0.95),0_30px_80px_-40px_rgb(123_97_255/0.45)] sm:rounded-[1.25rem]">
          {/* top edge light */}
          <div className="absolute inset-x-[12%] top-0 h-px bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.55),transparent)]" />
          {/* window chrome */}
          <div className="flex h-10 items-center gap-3 border-b border-white/[0.07] bg-white/[0.02] px-4">
            <div className="flex gap-1.5">
              <span className="size-2.5 rounded-full bg-[#ff5f57]/80" />
              <span className="size-2.5 rounded-full bg-[#febc2e]/80" />
              <span className="size-2.5 rounded-full bg-[#28c840]/80" />
            </div>
            <div className="mx-auto flex h-6 min-w-0 max-w-xs flex-1 items-center justify-center gap-1.5 rounded-md border border-white/[0.05] bg-white/[0.035] px-3 text-[11px] text-zinc-500">
              <Lock className="size-3 shrink-0" />
              <LogoMark id="mockup-tab" className="size-3.5" />
              <span className="truncate">{t.tab}</span>
            </div>
            <div className="w-10" />
          </div>

          <div className="grid md:grid-cols-[15rem_minmax(0,1fr)]">
            {/* sidebar */}
            <div className="hidden flex-col gap-5 border-r border-white/[0.07] bg-white/[0.012] p-3 md:flex">
              <div className="flex items-center gap-2 px-1.5 pt-0.5">
                <LogoMark id="mockup-sidebar" className="size-6" />
                <WordmarkText className="text-[14px]" />
                <span className="ml-auto rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-[0.08em] text-zinc-300">
                  Pro
                </span>
              </div>
              <div className="flex flex-col gap-0.5 text-[12.5px]">
                {[
                  { icon: House, label: t.nav.home },
                  { icon: Library, label: t.nav.library, count: "1,284", active: true },
                  { icon: BarChart3, label: t.nav.insights },
                ].map(({ icon: Icon, label, count, active }) => (
                  <div
                    key={label}
                    className={clsx(
                      "flex items-center gap-2 rounded-lg px-2 py-1.5",
                      active
                        ? "bg-[linear-gradient(90deg,rgb(139_109_255/0.2),rgb(139_109_255/0.05))] text-white shadow-[inset_0_0_0_1px_rgb(139_109_255/0.22)]"
                        : "text-zinc-400",
                    )}
                  >
                    <Icon className={clsx("size-3.5", active && "text-brand-soft")} />
                    <span className="flex-1">{label}</span>
                    {count ? <span className="text-[11px] tabular-nums text-zinc-500">{count}</span> : null}
                  </div>
                ))}
              </div>

              <div>
                <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">{t.categories}</div>
                <div className="flex flex-col gap-px text-[12px]">
                  {SIDEBAR_CATEGORIES.map(([id, count]) => {
                    const c = getCategory(id);
                    return (
                      <div key={id} className="flex items-center gap-2 rounded-md px-2 py-[5px] text-zinc-400">
                        <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                        <span className="w-4 text-center text-[11px]">{c.emoji}</span>
                        <span className="min-w-0 flex-1 truncate">{shortName(c, categoryNames)}</span>
                        <span className="text-[10.5px] tabular-nums text-zinc-600">{count}</span>
                      </div>
                    );
                  })}
                  <div className="px-2 py-[5px] text-[11.5px] text-zinc-500">
                    + {MORE_CATEGORIES} {t.more}
                  </div>
                </div>
              </div>

              <div>
                <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">{t.collections}</div>
                <div className="flex flex-col gap-px text-[12px] text-zinc-400">
                  {t.collectionNames
                    .map((name, i) => [name, [23, 58, 17][i]] as const)
                    .map(([name, count]) => (
                    <div key={name} className="flex items-center gap-2 rounded-md px-2 py-[5px]">
                      <FolderOpen className="size-3.5 text-zinc-500" />
                      <span className="flex-1 truncate">{name}</span>
                      <span className="text-[10.5px] tabular-nums text-zinc-600">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-auto rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 text-[11px]">
                <div className="flex items-center gap-1.5 text-zinc-300">
                  <span className="relative flex size-1.5">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
                  </span>
                  {t.liveCapture}
                </div>
                <div className="mt-0.5 text-zinc-500">{t.synced}</div>
              </div>
            </div>

            {/* main */}
            <div className="relative min-w-0 p-3 sm:p-4">
              <div className="flex items-center gap-2">
                <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-brand/40 bg-white/[0.03] px-2.5 shadow-[0_0_0_3px_rgb(139_109_255/0.14),0_0_24px_-6px_rgb(177_76_242/0.45)]">
                  <Search className="size-3.5 shrink-0 text-zinc-500" />
                  <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden whitespace-nowrap font-mono text-[11.5px]">
                    <QueryToken k="after" v="2025-06-01" />
                    <span className="hidden sm:contents">
                      <QueryToken k="min_likes" v="500" />
                    </span>
                    <span className="hidden lg:contents">
                      <QueryToken k="lang" v="en" />
                    </span>
                    <QueryToken v="crypto" negate />
                    <span className="ml-px h-3.5 w-px animate-blink bg-brand-soft" />
                  </div>
                  <span className="kbd hidden h-5 min-w-5 text-[10px] sm:inline-flex">⌘K</span>
                </div>
                <div className="hidden items-center gap-0.5 rounded-lg border border-white/[0.08] bg-white/[0.03] p-0.5 sm:flex">
                  {[LayoutGrid, List, Table2, ImageIcon].map((Icon, i) => (
                    <span
                      key={i}
                      className={clsx("flex size-7 items-center justify-center rounded-md", i === 0 ? "bg-white/[0.08] text-white" : "text-zinc-500")}
                    >
                      <Icon className="size-3.5" />
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-3 flex items-center gap-1.5 overflow-hidden">
                <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-ink">
                  {t.all} 128
                </span>
                {RESULT_CHIPS.map(([id, count]) => {
                  const c = getCategory(id);
                  return <CategoryChip key={id} category={c} label={shortName(c, categoryNames)} count={count} className="shrink-0" />;
                })}
              </div>

              <div className="mt-3 max-h-[30rem] overflow-hidden sm:max-h-[34rem]">
                <div className="columns-1 gap-3 sm:columns-2 xl:columns-3">
                  {POSTS.map((post) => (
                    <PostCard key={post.handle} post={post} names={categoryNames} threadLabel={t.thread} />
                  ))}
                </div>
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#0b0b11] via-[#0b0b11]/70 to-transparent" />
            </div>
          </div>
        </div>
      </div>
    </figure>
  );
}
