import type { ReactNode } from "react";
import type { Locale } from "./config";

/**
 * Copy for the whole marketing site in one language. Server components read
 * it directly; client components only receive the plain-string slices they
 * need (functions and JSX stay on the server).
 */

export type NavLink = { href: string; label: string; hrefLang?: string };

export interface HeaderCopy {
  nav: NavLink[];
  installGuide: NavLink;
  homeAria: string;
  cta: string;
  ctaLong: string;
  openMenu: string;
  closeMenu: string;
  mainNav: string;
  mobileNav: string;
  language: string;
}

export interface MockupCopy {
  caption: string;
  tab: string;
  nav: { home: string; library: string; insights: string };
  categories: string;
  collections: string;
  collectionNames: [string, string, string];
  more: string;
  liveCapture: string;
  synced: string;
  all: string;
  thread: string;
}

export interface Dictionary {
  locale: Locale;
  /** Locale for Intl number formatting. */
  numberLocale: string;
  meta: {
    title: string;
    titleTemplate: string;
    description: string;
    keywords: string[];
    ogAlt: string;
    install: { title: string; description: string };
  };
  shell: { skipToContent: string };
  header: HeaderCopy;
  footer: {
    tagline: string;
    worksIn: string;
    columns: Array<{ title: string; links: NavLink[] }>;
    rights: string;
    disclaimer: string;
  };
  hero: {
    pillBadge: string;
    pillShort: string;
    pillLong: string;
    titleLine1: string;
    titleAccent: string;
    description: string;
    ctaChrome: string;
    ctaFirefox: string;
    badges: string[];
    worksIn: string;
    languagesLabel: string;
    mobile: { text: string; whatsapp: string; copy: string; copied: string; shareText: string };
    mockup: MockupCopy;
  };
  how: {
    eyebrow: string;
    title: ReactNode;
    description: string;
    steps: Array<{ title: string; body: string; detail: string }>;
  };
  whatsNew: {
    eyebrow: string;
    title: ReactNode;
    description: string;
    newBadge: string;
    recall: {
      title: string;
      body: string;
      today: string;
      progress: string;
      streak: string;
      minutes: string;
      savedAgo: string;
      post: string;
      ratings: [string, string, string];
      why: string;
    };
    ask: {
      title: string;
      body: string;
      question: string;
      answer: ReactNode;
      sources: string;
      languages: string;
      key: string;
    };
    shelf: {
      title: string;
      body: string;
      kinds: Array<{ id: "repo" | "paper" | "video" | "article" | "tool" | "book" | "course"; label: string; count: number }>;
      items: Array<{ kind: "repo" | "paper" | "video" | "book"; title: string; meta: string }>;
      onDevice: string;
    };
    wrapped: {
      title: string;
      body: string;
      year: string;
      saved: string;
      savedCount: string;
      personaLabel: string;
      persona: string;
      topCategory: string;
      share: string;
    };
    voice: {
      title: string;
      body: string;
      listening: string;
      transcript: string;
      result: string;
      translate: string;
      original: string;
      translated: string;
    };
  };
  india: {
    eyebrow: string;
    title: ReactNode;
    description: string;
    languages: { title: string; body: string; beta: string; /** English, Hindi, Bengali, … in UI_LANGUAGES order. */ names: string[] };
    hinglish: { title: string; body: string; post: string; sortedInto: string; author: string };
    voice: { title: string; body: string };
    numbers: { title: string; body: string; ours: string; theirs: string; label: string };
    lowEnd: { title: string; body: string };
    freeAi: { title: string; body: string };
    privacy: { title: string; body: string };
  };
  features: {
    eyebrow: string;
    title: ReactNode;
    description: string;
    sync: {
      title: string;
      body: string;
      syncing: string;
      modes: Array<[string, string]>;
    };
    capture: { title: string; body: string; saved: string; from: string };
    categories: { title: string; body: (n: number) => string; yourOwn: string };
    ai: { title: string; body: string; gist: string; gistText: string };
    search: { title: string; body: ReactNode; results: string; toSearch: string };
    library: { title: string; body: string; views: [string, string, string, string] };
    insights: { title: string; body: string; overTime: string; when: string };
    export: { title: string; body: string; formats: Array<[string, string]>; importLabel: string };
    extras: string[];
  };
  categories: {
    eyebrow: string;
    title: (n: number) => ReactNode;
    description: string;
    listLabel: string;
    yourOwn: string;
    note: string;
    /** Display names by category id; missing ids fall back to the English taxonomy name. */
    names?: Record<string, string>;
  };
  search: {
    eyebrow: string;
    title: ReactNode;
    description: string;
    operators: string[];
    demo: { label: string; results: string; examples: Array<{ label: string; caption: string }> };
  };
  privacy: {
    eyebrow: string;
    title: ReactNode;
    description: string;
    points: Array<{ title: string; body: string }>;
    link: string;
    diagram: { caption: string; browser: string; bookmarks: string; onDevice: string; nvidia: string; nvidiaNote: string };
  };
  pricing: {
    eyebrow: string;
    title: ReactNode;
    description: string;
    periodLabel: string;
    monthly: string;
    yearly: string;
    currencyLabel: string;
    perMonth: string;
    perYear: string;
    yearlyNote: (perMonth: string) => string;
    monthlyNote: (perYear: string, pct: number) => string;
    free: {
      name: string;
      tagline: string;
      forever: string;
      cta: string;
      aiBanner: string;
      aiBannerNote: string;
      features: string[];
    };
    pro: { name: string; badge: string; tagline: string; cta: string; features: string[]; fine: string };
  };
  faq: {
    eyebrow: string;
    title: ReactNode;
    description: ReactNode;
    items: Array<{ q: string; a: ReactNode; id?: string }>;
  };
  cta: { title: ReactNode; body: string; chrome: string; firefox: string; footnote: string };
}
