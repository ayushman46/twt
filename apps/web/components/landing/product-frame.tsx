import clsx from "clsx";
import {
  Archive,
  BookOpenCheck,
  ChartColumn,
  ChevronDown,
  Gift,
  Heart,
  House,
  Image as ImageIcon,
  Inbox,
  LayoutGrid,
  Library,
  Link2,
  List,
  ListFilter,
  MessageSquareText,
  Play,
  Repeat2,
  Search,
  Star,
  Table2,
  Layers,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { LogoMark } from "@/components/site/logo";
import { getCategory, shortName } from "@/lib/categories";
import type { MockupCopy } from "@/lib/i18n/types";
import { CategoryChip } from "./category-chip";
import { CategoryGlyph } from "./category-glyph";

/*
 * A coded (HTML/CSS only) preview of the twtdash library, drawn in the
 * extension's own design language. Every person, handle and post is fictional.
 */

type Post = {
  name: string;
  handle: string;
  date: string;
  category: string;
  text: string;
  /** Language of the post text ("hi-Latn" = Hinglish). */
  lang?: string;
  tag: string;
  likes: string;
  reposts: string;
  starred?: boolean;
  thread?: boolean;
  media?: "type" | "video";
  link?: { domain: string; title: string };
};

const POSTS: Post[] = [
  {
    name: "Maya Chen",
    handle: "mayabuilds",
    date: "Sep 14",
    category: "ai",
    text: "Spent the weekend turning our support tickets into an eval set. Biggest lesson: write the grader before the prompt. Pass rate went from 61% to 89% without touching the model.",
    tag: "evals",
    likes: "2.4K",
    reposts: "318",
    starred: true,
  },
  {
    name: "Priya Nair",
    handle: "priyamakes",
    date: "Sep 3",
    category: "design",
    text: "Tiny typography rule I use everywhere: line-height shrinks as font size grows. 1.5 for body, 1.25 for headings, 1.05 for display.",
    tag: "typography",
    likes: "3.7K",
    reposts: "529",
    media: "type",
  },
  {
    name: "Arjun Mehta",
    handle: "arjunbuilds",
    date: "Aug 18",
    category: "startups",
    lang: "hi-Latn",
    text: "Bhai ye thread zaroor padho. Ek UPI startup ne 6 mahine mein Indore, Surat aur Nagpur ke merchants kaise onboard kiye, pura playbook numbers ke saath.",
    tag: "upi",
    likes: "4.1K",
    reposts: "860",
    thread: true,
  },
  {
    name: "Rohan Iyer",
    handle: "rohanbats",
    date: "Sep 9",
    category: "sports",
    lang: "hi-Latn",
    text: "Kal ka match ekdum paisa vasool tha. Last over mein 18 chahiye the aur do balls pehle hi game khatam.",
    tag: "cricket",
    likes: "12K",
    reposts: "1.9K",
    starred: true,
    media: "video",
  },
  {
    name: "Diego Alvarez",
    handle: "diegoships",
    date: "Aug 30",
    category: "dev",
    text: "Most React performance problems are just state living too high in the tree. Move it down, memo less, ship faster.",
    tag: "react",
    likes: "1.8K",
    reposts: "240",
    thread: true,
  },
  {
    name: "Theo Park",
    handle: "theoreads",
    date: "Jun 28",
    category: "learning",
    text: "Rewatched a full university course on distributed systems this summer. Still the best free resource out there. My notes for all 23 lectures:",
    tag: "courses",
    likes: "5.2K",
    reposts: "1.1K",
    link: { domain: "notes.theopark.dev", title: "Distributed systems: lecture notes" },
  },
];

const SIDEBAR_CATEGORIES: Array<[string, number]> = [
  ["ai", 342],
  ["dev", 287],
  ["design", 164],
  ["startups", 131],
  ["learning", 98],
  ["sports", 76],
  ["finance", 64],
];

const FILTER_CHIPS: Array<[string, number]> = [
  ["ai", 342],
  ["dev", 287],
  ["design", 164],
  ["sports", 76],
  ["learning", 98],
];

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);
}

function NavItem({ icon: Icon, label, count, active }: { icon: LucideIcon; label: string; count?: string; active?: boolean }) {
  return (
    <div className={clsx("flex h-8 items-center gap-2.5 rounded-md px-2", active ? "bg-panel-2 text-fg" : "text-fg-2")}>
      <Icon className={clsx("size-4", active ? "text-fg" : "text-muted")} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count ? <span className="text-[11.5px] tabular-nums text-muted">{count}</span> : null}
    </div>
  );
}

function PostCard({ post, names, threadLabel }: { post: Post; names?: Record<string, string>; threadLabel: string }) {
  const category = getCategory(post.category);
  return (
    <div className="mb-3 break-inside-avoid rounded-xl border border-line bg-panel p-4">
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-panel-2 text-[11px] font-medium text-muted">
          {initials(post.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium leading-tight text-fg">{post.name}</div>
          <div className="truncate text-xs leading-tight text-muted">
            @{post.handle} · {post.date}
          </div>
        </div>
        {post.starred ? <Star className="size-3.5 shrink-0 fill-current text-fg-2" /> : null}
      </div>

      <p lang={post.lang ?? "en"} className="mt-3 text-[13px] leading-[1.55] text-fg-2">
        {post.text}
      </p>

      {post.media === "type" ? (
        <div className="mt-3 flex items-end justify-between overflow-hidden rounded-lg border border-line bg-inset px-4 pb-3 pt-4">
          <span lang="en" className="text-[44px] font-semibold leading-none tracking-[-0.04em] text-fg">
            Aa
          </span>
          <span className="flex flex-col items-end gap-1 font-mono text-[10.5px] text-muted">
            <span>1.05 display</span>
            <span>1.25 heading</span>
            <span>1.5 body</span>
          </span>
        </div>
      ) : null}

      {post.media === "video" ? (
        <div className="relative mt-3 flex aspect-[16/8] items-center justify-center rounded-lg border border-line bg-inset">
          <span lang="en" className="absolute left-2.5 top-2 font-mono text-[10.5px] tabular-nums text-muted">
            IND 186/4 · 19.4 ov
          </span>
          <span className="flex size-9 items-center justify-center rounded-full border border-line-strong bg-panel">
            <Play className="ml-0.5 size-3.5 fill-current text-fg-2" />
          </span>
          <span className="absolute inset-x-2.5 bottom-2.5 h-0.5 rounded-full bg-panel-3">
            <span className="block h-full w-[38%] rounded-full bg-fg-2" />
          </span>
          <span className="absolute bottom-4 right-2.5 text-[10px] tabular-nums text-muted">0:42</span>
        </div>
      ) : null}

      {post.link ? (
        <div className="mt-3 flex items-center gap-2.5 rounded-lg border border-line p-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-panel-2">
            <Link2 className="size-3.5 text-muted" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[11px] text-muted">{post.link.domain}</span>
            <span className="block truncate text-xs font-medium text-fg-2">{post.link.title}</span>
          </span>
        </div>
      ) : null}

      <div className="mt-3 flex items-center gap-1.5">
        <CategoryChip category={category} label={shortName(category, names)} size="xs" />
        {post.thread ? (
          <span className="inline-flex h-5 items-center gap-1 rounded-full bg-panel-2 px-1.5 text-[10.5px] text-fg-2">
            <List className="size-3 text-muted" />
            {threadLabel}
          </span>
        ) : (
          <span className="truncate text-[11px] text-muted">#{post.tag}</span>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-2.5 text-[11px] tabular-nums text-muted">
          <span className="flex items-center gap-1">
            <Repeat2 className="size-3" />
            {post.reposts}
          </span>
          <span className="flex items-center gap-1">
            <Heart className="size-3" />
            {post.likes}
          </span>
        </span>
      </div>
    </div>
  );
}

export function ProductFrame({ t, categoryNames }: { t: MockupCopy; categoryNames?: Record<string, string> }) {
  return (
    <figure className="relative">
      <figcaption className="sr-only">{t.caption}</figcaption>
      <div aria-hidden="true" className="pointer-events-none select-none overflow-hidden rounded-xl border border-line-strong bg-bg">
        {/* browser tab strip */}
        <div className="flex h-10 items-center gap-3 border-b border-line bg-inset-KEEP px-4">
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-line-strong" />
            <span className="size-2.5 rounded-full bg-line-strong" />
            <span className="size-2.5 rounded-full bg-line-strong" />
          </div>
          <div className="mx-auto flex h-6 min-w-0 items-center gap-1.5 rounded-md border border-line bg-panel px-3 text-[11.5px] text-muted">
            <LogoMark className="size-3.5" />
            <span className="truncate">{t.tab}</span>
          </div>
          <div className="w-[42px]" />
        </div>

        <div className="grid h-[30rem] md:h-[34rem] md:grid-cols-[13.5rem_minmax(0,1fr)] lg:h-[37rem] lg:grid-cols-[15rem_minmax(0,1fr)]">
          {/* sidebar */}
          <div className="hidden flex-col gap-4 overflow-hidden border-r border-line px-3 py-3.5 text-[13px] md:flex">
            <div className="flex items-center gap-2 px-1">
              <LogoMark className="size-5" />
              <span lang="en" className="text-[14px] font-semibold tracking-[-0.02em] text-fg">
                twtdash
              </span>
              <span className="ml-auto rounded-md border border-line px-1.5 text-[10.5px] font-medium leading-[18px] text-muted">Pro</span>
            </div>
            <div className="flex h-8 items-center gap-2 rounded-lg border border-line bg-panel px-2.5 text-[12.5px] text-muted">
              <Search className="size-3.5 text-muted" />
              <span className="min-w-0 flex-1 truncate">{t.search}</span>
              <span className="kbd h-[18px] min-w-[18px] text-[10px]">⌘K</span>
            </div>
            <div className="flex flex-col gap-px">
              <NavItem icon={House} label={t.nav.home} />
              <NavItem icon={Layers} label={t.nav.all} count="1,284" active />
              <NavItem icon={Inbox} label={t.nav.unread} count="212" />
              <NavItem icon={Star} label={t.nav.starred} count="96" />
              <NavItem icon={Archive} label={t.nav.archive} />
              <NavItem icon={ChartColumn} label={t.nav.insights} />
            </div>
            <div>
              <div className="flex items-center gap-1 px-2 pb-1 text-xs text-muted">
                <ChevronDown className="size-3" />
                {t.discover}
              </div>
              <div className="flex flex-col gap-px">
                <NavItem icon={BookOpenCheck} label={t.nav.recall} count="10" />
                <NavItem icon={Library} label={t.nav.shelf} />
                <NavItem icon={MessageSquareText} label={t.nav.ask} />
                <NavItem icon={Gift} label={t.nav.wrapped} />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1 px-2 pb-1 text-xs text-muted">
                <ChevronDown className="size-3" />
                {t.categories}
              </div>
              <div className="flex flex-col gap-px">
                {SIDEBAR_CATEGORIES.map(([id, count]) => {
                  const c = getCategory(id);
                  return (
                    <div key={id} className="flex h-8 items-center gap-2.5 rounded-md px-2 text-fg-2">
                      <CategoryGlyph id={id} className="text-[16px] text-muted" />
                      <span className="min-w-0 flex-1 truncate">{shortName(c, categoryNames)}</span>
                      <span className="text-[11.5px] tabular-nums text-muted">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* main */}
          <div className="min-w-0 overflow-hidden p-4 sm:p-6">
            <div className="flex items-center gap-2.5">
              <span className="text-[20px] font-semibold tracking-[-0.02em] text-fg">{t.title}</span>
              <span className="rounded-full bg-panel-2 px-2 text-xs leading-5 tabular-nums text-muted">1,284</span>
              <div className="ml-auto hidden items-center rounded-lg border border-line p-0.5 sm:flex">
                {[LayoutGrid, List, Table2, ImageIcon].map((Icon, i) => (
                  <span
                    key={i}
                    className={clsx("flex size-7 items-center justify-center rounded-md", i === 0 ? "bg-panel-3 text-fg" : "text-muted")}
                  >
                    <Icon className="size-4" />
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line-strong bg-panel px-3">
                <Search className="size-4 shrink-0 text-muted" />
                <div lang="en" className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden whitespace-nowrap font-mono text-[12px]">
                  <span>
                    <span className="text-muted">after:</span>
                    <span className="text-fg">2025-06-01</span>
                  </span>
                  <span className="hidden sm:inline">
                    <span className="text-muted">min_likes:</span>
                    <span className="text-fg">500</span>
                  </span>
                  <span className="text-fg">-crypto</span>
                  <span className="-ml-1.5 h-4 w-px bg-fg" />
                </div>
              </div>
              <div className="hidden h-9 items-center gap-1.5 rounded-lg border border-line bg-panel px-3 text-[13px] text-fg-2 lg:flex">
                <ListFilter className="size-4 text-muted" />
                {t.filters}
              </div>
              <div className="hidden h-9 items-center gap-1.5 rounded-lg border border-line bg-panel px-3 text-[13px] text-fg-2 sm:flex">
                {t.sort}
                <ChevronDown className="size-3.5 text-muted" />
              </div>
            </div>

            <div className="mt-3 flex items-center gap-1.5 overflow-hidden">
              <span className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border border-accent/30 bg-accent-soft px-2.5 text-xs font-medium text-accent">
                {t.all}
                <span className="tabular-nums">128</span>
              </span>
              {FILTER_CHIPS.map(([id, count]) => {
                const c = getCategory(id);
                return <CategoryChip key={id} category={c} label={shortName(c, categoryNames)} count={count} className="shrink-0" />;
              })}
            </div>

            <div className="mt-4 columns-1 gap-3 sm:columns-2 xl:columns-3">
              {POSTS.map((post) => (
                <PostCard key={post.handle} post={post} names={categoryNames} threadLabel={t.thread} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </figure>
  );
}
