import Link from "next/link";
import { BRAND } from "@twtdash/shared";
import { Accent } from "@/components/ui/section-heading";
import { BROWSERS, SUPPORT_URL } from "@/lib/site";
import type { Dictionary } from "./types";

const link = "text-brand-soft underline decoration-brand-soft/40 underline-offset-2 hover:decoration-current";
const browsersList = `${BROWSERS.slice(0, -1).join(", ")} or ${BROWSERS.at(-1)}`;

export const en: Dictionary = {
  locale: "en",
  numberLocale: "en-US",
  meta: {
    title: `${BRAND.name} — ${BRAND.tagline}`,
    titleTemplate: `%s · ${BRAND.name}`,
    description: BRAND.description,
    keywords: [
      "X bookmarks",
      "Twitter bookmarks",
      "bookmark manager",
      "organize X bookmarks",
      "search Twitter bookmarks",
      "export X bookmarks",
      "spaced repetition bookmarks",
      "Hindi bookmark manager",
      "browser extension",
      "local-first",
    ],
    ogAlt: "twtdash — Your X bookmarks, finally organized.",
    install: {
      title: "Install",
      description:
        "Install twtdash in Chrome, Edge, Brave, Arc, Opera or Firefox, then run your first sync of your X bookmarks in a couple of clicks.",
    },
  },
  shell: { skipToContent: "Skip to content" },
  header: {
    nav: [
      { href: "/#features", label: "Features" },
      { href: "/#new", label: "What’s new" },
      { href: "/#pricing", label: "Pricing" },
      { href: "/#faq", label: "FAQ" },
    ],
    installGuide: { href: "/install", label: "Install guide" },
    homeAria: "twtdash home",
    cta: "Add to Chrome",
    ctaLong: "Add to Chrome — it’s free",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    mainNav: "Main",
    mobileNav: "Mobile",
    language: "Language",
  },
  footer: {
    tagline: BRAND.tagline,
    worksIn: `Works in ${BROWSERS.join(", ").replace(/, (?=[^,]*$)/, " and ")}. In English, हिन्दी and 8 more Indian languages.`,
    columns: [
      {
        title: "Product",
        links: [
          { href: "/#features", label: "Features" },
          { href: "/#new", label: "What’s new" },
          { href: "/#pricing", label: "Pricing" },
          { href: "/#faq", label: "FAQ" },
        ],
      },
      {
        title: "Get started",
        links: [
          { href: "/install", label: "Install" },
          { href: "/install#first-sync", label: "First sync" },
          { href: "/hi", label: "हिन्दी में देखें", hrefLang: "hi" },
          { href: SUPPORT_URL, label: "Contact" },
        ],
      },
      {
        title: "Legal",
        links: [
          { href: "/privacy", label: "Privacy" },
          { href: "/terms", label: "Terms" },
        ],
      },
    ],
    rights: `© 2026 ${BRAND.name}. All rights reserved.`,
    disclaimer: "twtdash is not affiliated with or endorsed by X Corp.",
  },
  hero: {
    pillBadge: "New",
    pillShort: "Recall, Shelf, Ask & Wrapped",
    pillLong: "Recall, Shelf, Ask your bookmarks & Wrapped",
    titleLine1: "Your X bookmarks,",
    titleAccent: "finally organized.",
    description: BRAND.description,
    ctaChrome: "Add to Chrome — it’s free",
    ctaFirefox: "Add to Firefox",
    badges: ["Free forever", "No account", "Local-first"],
    worksIn: `Works in ${BROWSERS.join(" · ")}`,
    languagesLabel: "Now in",
    mobile: {
      text: "On your phone? twtdash runs in desktop browsers — send yourself the link.",
      whatsapp: "Send on WhatsApp",
      copy: "Copy link",
      copied: "Link copied",
      shareText: "twtdash — sync, sort and search all your X bookmarks. Install it on your laptop:",
    },
    mockup: {
      caption:
        "Preview of the twtdash dashboard: a sidebar of categories with bookmark counts, a search bar running the query “after:2025-06-01 min_likes:500 lang:en -crypto”, and a masonry grid of saved posts, each tagged with a category.",
      tab: "twtdash — Library",
      nav: { home: "Home", library: "Library", insights: "Insights" },
      categories: "Categories",
      collections: "Collections",
      collectionNames: ["Read later", "Design refs", "Launch ideas"],
      more: "more",
      liveCapture: "Live capture on",
      synced: "Synced 2 min ago · 12 new",
      all: "All",
      thread: "Thread",
    },
  },
  how: {
    eyebrow: "How it works",
    title: (
      <>
        From bookmark chaos to a library in <Accent gradient>three steps</Accent>
      </>
    ),
    description: "No scripts to run, no API keys, no exports to wrangle. twtdash does the tedious part while you watch.",
    steps: [
      {
        title: "Install the extension",
        body: `Add twtdash to ${browsersList}. There’s no account to create and nothing to configure.`,
        detail: "No account needed",
      },
      {
        title: "Sync in one click",
        body: "twtdash opens your X bookmarks and scrolls through them for you, reading X’s own page data — no X API key or paid X plan. Quick sync grabs only what’s new; full sync re-reads everything. Pull in your Likes too, if you want.",
        detail: "Quick or full sync",
      },
      {
        title: "Find anything, instantly",
        body: "Every post is sorted into a category on your device. Search with operators, ask questions, tag, star and rediscover what you saved — all in a fast local dashboard.",
        detail: "Instant full-text search",
      },
    ],
  },
  whatsNew: {
    eyebrow: "New in twtdash",
    title: (
      <>
        Don’t just save posts. <Accent gradient>Use them.</Accent>
      </>
    ),
    description:
      "Most bookmarks are never opened again. These new features bring the best of what you saved back to you — built right into the extension.",
    newBadge: "New",
    recall: {
      title: "Recall",
      body: "A 5-minute daily session that resurfaces saved posts on a spaced schedule, so the good stuff actually sticks. Rate each card and keep your streak alive.",
      today: "Today’s Recall",
      progress: "4 / 10",
      streak: "12-day streak",
      minutes: "≈ 5 min",
      savedAgo: "saved 3 months ago",
      post: "Most React performance problems are just state living too high in the tree. Move it down, memo less, ship faster.",
      ratings: ["Again", "Good", "Mastered"],
      why: "Due for review",
    },
    ask: {
      title: "Ask your bookmarks",
      body: "Ask a question in English, हिन्दी or any Indian language and get an answer built from your own saved posts — with citations you can click.",
      question: "What did I save about getting first customers without ads?",
      answer: (
        <>
          Two posts stand out: a cold-email template that booked 40 demos <sup>[1]</sup>, and a UPI startup’s playbook for
          onboarding merchants city by city <sup>[2]</sup>.
        </>
      ),
      sources: "Sources",
      languages: "Works in English, हिन्दी & more",
      key: "Free with your NVIDIA key · or Pro",
    },
    shelf: {
      title: "Shelf",
      body: "Every GitHub repo, paper, video, article, tool, book and course hiding in your bookmarks — pulled out automatically, on your device.",
      kinds: [
        { id: "repo", label: "Repos", count: 42 },
        { id: "paper", label: "Papers", count: 18 },
        { id: "video", label: "Videos", count: 63 },
        { id: "article", label: "Articles", count: 120 },
        { id: "tool", label: "Tools", count: 37 },
        { id: "book", label: "Books", count: 9 },
        { id: "course", label: "Courses", count: 14 },
      ],
      items: [
        { kind: "repo", title: "vercel/next.js", meta: "GitHub · from @diegoships" },
        { kind: "paper", title: "Attention Is All You Need", meta: "arXiv · from @mayabuilds" },
        { kind: "video", title: "Distributed systems — lecture 1", meta: "YouTube · from @theoreads" },
        { kind: "book", title: "Designing Data-Intensive Applications", meta: "Book · from @priyamakes" },
      ],
      onDevice: "Extracted on-device",
    },
    wrapped: {
      title: "Wrapped",
      body: "Your year in bookmarks as a shareable story — top topics, saving habits and your bookmark persona.",
      year: "2026 Wrapped",
      saved: "posts saved",
      savedCount: "1,284",
      personaLabel: "Your persona",
      persona: "The Night Owl Researcher",
      topCategory: "Top: AI & ML",
      share: "Share",
    },
    voice: {
      title: "Voice search & translate",
      body: "Search by speaking in Hindi, Tamil, Bengali and more. Translate any saved post into your language with one tap.",
      listening: "Listening · हिन्दी",
      transcript: "क्रिकेट वाले posts दिखाओ",
      result: "23 posts",
      translate: "Translate",
      original: "Kal ka match ekdum paisa vasool tha 🏏",
      translated: "Yesterday’s match was absolutely worth it 🏏",
    },
  },
  india: {
    eyebrow: "Built for India 🇮🇳",
    title: (
      <>
        Made for how India <Accent gradient>bookmarks</Accent>
      </>
    ),
    description:
      "Your language, your number system, your laptop and your data. twtdash is designed around the way India uses X.",
    languages: {
      title: "Your language, all the way",
      body: "Use twtdash in English or हिन्दी, with eight more Indian languages in beta.",
      beta: "beta",
      names: ["English", "Hindi", "Bengali", "Marathi", "Telugu", "Tamil", "Gujarati", "Kannada", "Malayalam", "Punjabi"],
    },
    hinglish: {
      title: "Understands Hinglish",
      body: "On-device sorting reads Hindi, Hinglish and Indian-language posts — so a cricket rant lands in Sports, not “Other”.",
      post: "Kal ka match ekdum paisa vasool tha 🔥 last over mein 18 chahiye the",
      sortedInto: "Sorted into",
      author: "@rohanbats",
    },
    voice: {
      title: "Speak to search",
      body: "Tap the mic and search in Hindi, Tamil, Telugu, Bengali or any supported Indian language.",
    },
    numbers: {
      title: "Lakh & crore",
      body: "Counts and insights in the Indian number system.",
      ours: "1,28,400",
      theirs: "128,400",
      label: "posts saved",
    },
    lowEnd: {
      title: "Light on old laptops",
      body: "A local library tuned to stay quick on budget machines — even with 10,000+ posts.",
    },
    freeAi: {
      title: "AI that costs ₹0",
      body: "Ask, AI sorting and gists run free with your own NVIDIA key. No credit card, no subscription.",
    },
    privacy: {
      title: "Your data stays home",
      body: "No account and no cloud copy. Your whole library lives in your browser, on your device.",
    },
  },
  features: {
    eyebrow: "Features",
    title: (
      <>
        Everything you saved, <Accent gradient>finally useful</Accent>
      </>
    ),
    description: "twtdash turns a never-ending bookmark list into a library you can actually search, sort and come back to.",
    sync: {
      title: "One-click sync",
      body: "twtdash opens your X bookmarks and scrolls through them for you. It reads X’s own page data, so you don’t need an X API key or a paid X plan.",
      syncing: "Syncing bookmarks…",
      modes: [
        ["Quick sync", "only new posts"],
        ["Full sync", "re-read everything"],
        ["Likes", "optional import"],
      ],
    },
    capture: {
      title: "Real-time capture",
      body: "Bookmark a post on X and it appears in twtdash instantly. X Premium bookmark folders become collections.",
      saved: "Saved to twtdash",
      from: "just now · from your X tab",
    },
    categories: {
      title: "Smart categories",
      body: (n) => `Every post is sorted on-device into ${n} categories. Add custom categories with your own keywords.`,
      yourOwn: "+ your own",
    },
    ai: {
      title: "AI gists & auto-tags",
      body: "Optional AI categorization, tags and one-line gists from open models on NVIDIA’s API — free with your own NVIDIA key, or with twtdash Pro and no key at all.",
      gist: "Gist",
      gistText: "Graders written before prompts lifted eval pass rate to 89%.",
    },
    search: {
      title: "Instant search with operators",
      body: (
        <>
          Full-text search across everything you’ve saved, with operators like <code className="font-mono text-zinc-300">from:</code>,{" "}
          <code className="font-mono text-zinc-300">has:video</code>, <code className="font-mono text-zinc-300">is:thread</code> and{" "}
          <code className="font-mono text-zinc-300">min_likes:</code>. Press <span className="font-mono text-zinc-300">⌘K</span> for the command
          palette.
        </>
      ),
      results: "14 results",
      toSearch: "to search",
    },
    library: {
      title: "A library your way",
      body: "Browse as masonry, list, table or a media gallery. Smooth even with 10,000+ posts.",
      views: ["Masonry", "List", "Table", "Media gallery"],
    },
    insights: {
      title: "Insights",
      body: "See your bookmarks over time, category mix, top authors, content types and a when-you-bookmark heatmap.",
      overTime: "Bookmarks over time",
      when: "When you bookmark",
    },
    export: {
      title: "Export anywhere",
      body: "Export to Markdown, CSV or JSON that drops straight into Obsidian, Notion or a spreadsheet — and import JSON backups whenever you like. Your library is never locked in.",
      formats: [
        ["md", "Obsidian & Notion"],
        ["csv", "spreadsheets"],
        ["json", "full backup"],
      ],
      importLabel: "Import a JSON backup",
    },
    extras: [
      "Command palette (Ctrl/⌘ K)",
      "j / k, s, e, o, / shortcuts",
      "Rediscover on Home",
      "Private notes",
      "Star, archive & read states",
      "Tags & bulk actions",
      "X Premium folders → collections",
      "Dark & light themes",
    ],
  },
  categories: {
    eyebrow: "Smart categories",
    title: (n) => (
      <>
        {n} categories, <Accent gradient>zero effort</Accent>
      </>
    ),
    description:
      "twtdash reads each post’s text, links and domains — in English, Hindi or Hinglish — and sorts it right in your browser. Add your own categories with custom keywords, or switch on AI for even sharper sorting.",
    listLabel: "Built-in categories",
    yourOwn: "Your own, with your keywords",
    note: "Keyword sorting runs entirely on your device — AI is optional",
  },
  search: {
    eyebrow: "Search",
    title: (
      <>
        Search like you <Accent gradient>mean it</Accent>
      </>
    ),
    description:
      "Type a few words and twtdash searches the full text of everything you’ve saved — instantly, right in your browser. Add operators to slice your library any way you like, and combine as many as you need.",
    operators: [
      "Posts by one author",
      "Posts with a video",
      "Posts that include a link",
      "Threads only",
      "One category",
      "Posts with a tag",
      "Posts in a collection",
      "After a date",
      "Before a date",
      "At least 500 likes",
      "Posts in a language",
      "Leave out a word or filter",
    ],
    demo: {
      label: "Example searches",
      results: "results",
      examples: [
        { label: "By author", caption: "Every link Maya shared that you saved" },
        { label: "Popular AI", caption: "Widely liked AI posts about prompting" },
        { label: "Threads", caption: "Threads since January 2025, minus crypto" },
        { label: "Hindi", caption: "Hindi posts with a video" },
      ],
    },
  },
  privacy: {
    eyebrow: "Local-first",
    title: (
      <>
        Your library never leaves <Accent gradient>your browser</Accent>
      </>
    ),
    description: "twtdash is built so there’s nothing to breach: no accounts, no servers holding your data, nothing to sell.",
    points: [
      {
        title: "Stored on your device",
        body: "Your library lives in your browser’s IndexedDB. There is no twtdash cloud copy of your bookmarks.",
      },
      {
        title: "No account, no tracking",
        body: "No sign-up, no analytics, no ads. twtdash only runs on x.com and twitter.com to read the bookmarks you load.",
      },
      {
        title: "AI is opt-in",
        body: "Bring your own free NVIDIA key and posts go straight from your browser to NVIDIA. With Pro, they pass through our API to NVIDIA and are never stored.",
      },
      {
        title: "Yours to take anywhere",
        body: "Export everything to Markdown, CSV or JSON at any time, and restore from a JSON backup.",
      },
    ],
    link: "Read the privacy policy",
    diagram: {
      caption:
        "Diagram: inside your browser, twtdash reads your X bookmarks page and stores your library in IndexedDB. Only if you turn on AI are post texts sent to NVIDIA’s API.",
      browser: "Your browser",
      bookmarks: "your bookmarks",
      onDevice: "on this device",
      nvidia: "NVIDIA API",
      nvidiaNote: "Only if you turn on AI — post text, author and links",
    },
  },
  pricing: {
    eyebrow: "Pricing",
    title: (
      <>
        Free forever. <Accent gradient>Pro</Accent> if you want AI on autopilot.
      </>
    ),
    description:
      "Everything in twtdash is free — including AI, with your own free NVIDIA key. Pro adds hosted AI so you never have to manage a key.",
    periodLabel: "Billing period",
    monthly: "Monthly",
    yearly: "Yearly",
    currencyLabel: "Currency",
    perMonth: "/ month",
    perYear: "/ year",
    yearlyNote: (perMonth) => `That’s ${perMonth}/month, billed yearly`,
    monthlyNote: (perYear, pct) => `Or ${perYear}/year — save ${pct}%`,
    free: {
      name: "Free",
      tagline: "For everyone who bookmarks on X.",
      forever: "forever",
      cta: "Add to Chrome — it’s free",
      aiBanner: "Includes AI with your free NVIDIA key",
      aiBannerNote: "Ask, AI sorting & gists. No credit card.",
      features: [
        "One-click sync, real-time capture & likes import",
        "Smart categories that understand Hindi & Hinglish",
        "Recall, Shelf & Wrapped",
        "Ask your bookmarks (with your NVIDIA key)",
        "Voice search & translate",
        "Search operators, ⌘K & keyboard shortcuts",
        "Masonry, list, table & gallery views",
        "Insights & export to Markdown / CSV / JSON",
        "English, हिन्दी + 8 Indian languages (beta)",
      ],
    },
    pro: {
      name: "Pro",
      badge: "No API key needed",
      tagline: "Hosted AI, zero setup.",
      cta: "Get twtdash Pro",
      features: [
        "Everything in Free",
        "Hosted AI — no key to create or manage",
        "AI sorting, auto-tags & one-line gists",
        "Ask your bookmarks without a key",
        "Priority support",
        "Early access to new features",
      ],
      fine: "Your license key arrives by email — paste it into twtdash to unlock Pro. Cancel anytime; refunds within 14 days.",
    },
  },
  faq: {
    eyebrow: "FAQ",
    title: (
      <>
        Questions, <Accent gradient>answered</Accent>
      </>
    ),
    description: (
      <>
        Can’t find what you need? Ask on{" "}
        <a href={BRAND.supportUrl} className="text-zinc-200 underline decoration-white/30 underline-offset-2 hover:decoration-current">
          {BRAND.supportLabel}
        </a>
        .
      </>
    ),
    items: [
      {
        q: "Is twtdash safe to use?",
        a: (
          <>
            Yes. twtdash only runs on x.com and twitter.com, and only reads the bookmark and like data your own browser loads
            while you’re signed in. Everything it saves stays in your browser — there are no twtdash servers holding your
            library, no analytics and no ads. AI features stay off until you turn them on.
          </>
        ),
      },
      {
        id: "nvidia-key",
        q: "How do I get a free NVIDIA API key?",
        a: (
          <>
            It takes about a minute and needs no credit card:
            <span className="mt-3 block">
              <strong className="font-medium text-zinc-200">1.</strong> Go to{" "}
              <a href="https://build.nvidia.com" className={link} rel="noopener">
                build.nvidia.com
              </a>{" "}
              and sign in with a free NVIDIA account.
            </span>
            <span className="mt-1.5 block">
              <strong className="font-medium text-zinc-200">2.</strong> Open any model and click{" "}
              <strong className="font-medium text-zinc-200">Get API Key</strong>. Copy the key — it starts with{" "}
              <code className="font-mono text-zinc-300">nvapi-</code>.
            </span>
            <span className="mt-1.5 block">
              <strong className="font-medium text-zinc-200">3.</strong> In twtdash, open{" "}
              <strong className="font-medium text-zinc-200">Settings → AI organization</strong>, choose{" "}
              <strong className="font-medium text-zinc-200">Free NVIDIA key</strong> and paste it.
            </span>
            <span className="mt-3 block">
              Requests then go straight from your browser to NVIDIA. Pro is for people who would rather not manage a key.
            </span>
          </>
        ),
      },
      {
        id: "languages",
        q: "Does twtdash work in Hindi and other Indian languages?",
        a: (
          <>
            Yes. The whole extension is available in English and हिन्दी, with বাংলা, मराठी, తెలుగు, தமிழ், ગુજરાતી, ಕನ್ನಡ,
            മലയാളം and ਪੰਜਾਬੀ in beta. Sorting understands Hindi and Hinglish posts, you can search by voice and ask
            questions in Indian languages, and counts use lakh and crore. This site is also available{" "}
            <a href="/hi" hrefLang="hi" lang="hi" className={link}>
              in हिन्दी
            </a>
            .
          </>
        ),
      },
      {
        q: "Does it need my X password?",
        a: (
          <>
            No. twtdash never asks for your X password, an X API key or any other login. It works with the X session you
            already have in your browser — if you can see your bookmarks on x.com, twtdash can sync them.
          </>
        ),
      },
      {
        id: "mobile",
        q: "Can I use it on my phone?",
        a: (
          <>
            Not today. twtdash is an extension for desktop browsers — Chrome, Edge, Brave, Arc, Opera and Firefox on your
            laptop or PC. Open this page on your computer to install it; your bookmarks from the X app show up there too.
          </>
        ),
      },
      {
        q: "Does it work with X Premium bookmark folders?",
        a: (
          <>
            Yes. If you organize bookmarks into folders with X Premium, twtdash brings those folders in as collections, so
            the organizing you’ve already done carries over.
          </>
        ),
      },
      {
        q: "Where is my data stored?",
        a: (
          <>
            In your browser’s IndexedDB, on your device. Nothing is uploaded to twtdash. Because your library is local,
            removing the extension deletes it — export a backup first if you want to keep it. Details are in our{" "}
            <Link href="/privacy" className={link}>
              privacy policy
            </Link>
            .
          </>
        ),
      },
      {
        q: "What happens if X changes its website?",
        a: (
          <>
            X updates its site from time to time. twtdash reads X’s own page data rather than what’s drawn on screen,
            which keeps it resilient — and when something does change, we update the extension. Either way, everything
            you’ve already synced stays safe in your browser.
          </>
        ),
      },
      {
        q: "Does it work in Firefox?",
        a: (
          <>
            Yes — twtdash works in Firefox on desktop as well as Chrome, Edge, Brave, Arc and Opera. The{" "}
            <Link href="/install" className={link}>
              install guide
            </Link>{" "}
            covers each browser.
          </>
        ),
      },
      {
        q: "What is your refund policy?",
        a: (
          <>
            If Pro isn’t right for you, contact us on{" "}
            <a href={BRAND.supportUrl} className={link}>
              {BRAND.supportLabel}
            </a>{" "}
            within 14 days of your purchase for a full refund. You can cancel anytime and keep Pro until the end of the period
            you’ve paid for.
          </>
        ),
      },
    ],
  },
  cta: {
    title: (
      <>
        Stop losing great posts in an <Accent gradient>endless list</Accent>
      </>
    ),
    body: "Install twtdash, sync once, and every bookmark you’ve ever saved is sorted, searchable and yours.",
    chrome: "Add to Chrome",
    firefox: "Add to Firefox",
    footnote: "Free forever · No account · Local-first",
  },
};
