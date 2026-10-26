import Link from "next/link";
import { BRAND } from "@twtdash/shared";
import { BROWSERS, SUPPORT_URL } from "@/lib/site";
import type { Dictionary } from "./types";

const link = "link-inline";
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
    pillShort: "Recall, Shelf, Ask and Wrapped",
    pillLong: "Recall, Shelf, Ask your bookmarks and Wrapped",
    titleLine1: "Your X bookmarks,",
    titleAccent: "finally organized.",
    description:
      "twtdash syncs everything you’ve saved on X, sorts it into categories on your device, and makes all of it searchable in seconds.",
    ctaChrome: "Add to Chrome — it’s free",
    ctaFirefox: "Add to Firefox",
    badges: ["Free forever", "No account", "Stays in your browser"],
    mobile: {
      text: "On your phone? twtdash runs in desktop browsers. Send yourself the link.",
      whatsapp: "WhatsApp",
      copy: "Copy link",
      copied: "Link copied",
      shareText: "twtdash: sync, sort and search all your X bookmarks. Install it on your laptop:",
    },
    mockup: {
      caption:
        "Preview of the twtdash library: a sidebar with sections and categories, a search bar running the query “after:2025-06-01 min_likes:500 -crypto”, and a grid of saved posts, each tagged with a category.",
      tab: "twtdash — Library",
      search: "Search or jump to…",
      nav: {
        home: "Home",
        all: "All bookmarks",
        unread: "Unread",
        starred: "Starred",
        archive: "Archive",
        insights: "Insights",
        recall: "Recall",
        shelf: "Shelf",
        ask: "Ask your bookmarks",
        wrapped: "Wrapped",
      },
      discover: "Discover",
      categories: "Categories",
      title: "All bookmarks",
      filters: "Filters",
      sort: "Recently saved",
      all: "All",
      thread: "Thread",
    },
  },
  how: {
    title: "From bookmark pile to library in three steps",
    description: "No scripts, no API keys, no exports to wrangle. twtdash does the tedious part for you.",
    steps: [
      {
        title: "Install the extension",
        body: `Add twtdash to ${browsersList}. There’s no account to create and nothing to configure.`,
      },
      {
        title: "Sync in one click",
        body: "twtdash scrolls through your X bookmarks for you and reads X’s own page data. No X API key, no paid X plan.",
      },
      {
        title: "Find anything",
        body: "Every post is sorted into a category on your device. Search with operators, ask questions, tag and star.",
      },
    ],
  },
  whatsNew: {
    title: "Don’t just save posts. Use them.",
    description: "Most bookmarks are never opened again. These features bring the best of what you saved back to you.",
    recall: {
      title: "Recall",
      body: "A five-minute daily review that resurfaces saved posts on a spaced schedule, so the good ones stick.",
      today: "Today’s Recall",
      progress: "4 / 10",
      streak: "12-day streak",
      savedAgo: "saved 3 months ago",
      post: "Most React performance problems are just state living too high in the tree. Move it down, memo less, ship faster.",
      ratings: ["Again", "Good", "Mastered"],
      why: "Due for review",
    },
    ask: {
      title: "Ask your bookmarks",
      body: "Ask in English, हिन्दी or any Indian language and get an answer built from your own saved posts, with sources.",
      question: "What did I save about getting first customers without ads?",
      answer: (
        <>
          Two posts stand out: a cold-email template that booked 40 demos<sup>1</sup>, and a UPI startup’s playbook for
          onboarding merchants city by city<sup>2</sup>.
        </>
      ),
      sources: "Sources",
      languages: "English, हिन्दी and more",
      key: "Free with your NVIDIA key, or with Pro",
    },
    shelf: {
      title: "Shelf",
      body: "Every repo, paper, video, article, tool, book and course in your bookmarks, pulled out automatically on your device.",
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
        { kind: "video", title: "Distributed systems, lecture 1", meta: "YouTube · from @theoreads" },
        { kind: "book", title: "Designing Data-Intensive Applications", meta: "Book · from @priyamakes" },
      ],
      onDevice: "Extracted on your device",
    },
    wrapped: {
      title: "Wrapped",
      body: "Your year in bookmarks as a shareable story: top topics, saving habits and your bookmark persona.",
      year: "2026 Wrapped",
      saved: "posts saved",
      savedCount: "1,284",
      personaLabel: "Your persona",
      persona: "The Night Owl Researcher",
      topCategory: "Top: AI & ML",
      share: "Share",
    },
    voice: {
      title: "Voice search and translate",
      body: "Search by speaking Hindi, Tamil, Bengali and more. Translate any saved post into your language in one tap.",
      listening: "Listening · हिन्दी",
      transcript: "क्रिकेट वाले posts दिखाओ",
      result: "23 posts",
      translate: "Translated from Hinglish",
      original: "Kal ka match ekdum paisa vasool tha",
      translated: "Yesterday’s match was absolutely worth it",
    },
  },
  india: {
    title: "Made for how India uses X",
    description: "Your language, your number system, your laptop and your data. twtdash is built around the way India bookmarks.",
    languages: {
      title: "Your language, all the way",
      body: "Use twtdash in English or हिन्दी, with eight more Indian languages in beta.",
      beta: "beta",
      names: ["English", "Hindi", "Bengali", "Marathi", "Telugu", "Tamil", "Gujarati", "Kannada", "Malayalam", "Punjabi"],
    },
    hinglish: {
      title: "Understands Hinglish",
      body: "On-device sorting reads Hindi, Hinglish and Indian-language posts, so a cricket rant lands in Sports, not Other.",
      post: "Kal ka match ekdum paisa vasool tha, last over mein 18 chahiye the",
      sortedInto: "Sorted into",
      author: "@rohanbats",
    },
    voice: {
      title: "Speak to search",
      body: "Tap the mic and search in Hindi, Tamil, Telugu, Bengali or any supported Indian language.",
    },
    numbers: {
      title: "Lakh and crore",
      body: "Counts and insights in the Indian number system.",
      ours: "1,28,400",
      theirs: "128,400",
      label: "posts saved",
    },
    lowEnd: {
      title: "Light on old laptops",
      body: "A local library tuned to stay quick on budget machines, even with 10,000+ posts.",
    },
    freeAi: {
      title: "AI that costs ₹0",
      body: "Ask, AI sorting and gists run free with your own NVIDIA key. No card, no subscription.",
    },
    privacy: {
      title: "Your data stays home",
      body: "No account and no cloud copy. Your whole library lives in your browser, on your device.",
    },
  },
  features: {
    title: "Everything you saved, finally useful",
    description: "twtdash turns an endless bookmark list into a library you can search, sort and come back to.",
    sync: {
      title: "One-click sync",
      body: "Scrolls through your bookmarks for you and reads X’s own page data. No API key or paid X plan.",
    },
    capture: {
      title: "Real-time capture",
      body: "Bookmark a post on X and it appears in twtdash instantly. Premium folders become collections.",
    },
    categories: {
      title: "Smart categories",
      body: (n) => `Every post is sorted on your device into ${n} categories. Add your own with custom keywords.`,
    },
    ai: {
      title: "AI gists and auto-tags",
      body: "Optional AI sorting, tags and one-line gists. Free with your NVIDIA key, or with Pro and no key at all.",
    },
    search: {
      title: "Search with operators",
      body: (
        <>
          Full-text search with operators like <code className="font-mono text-[0.9em] text-fg-2">from:</code>,{" "}
          <code className="font-mono text-[0.9em] text-fg-2">has:video</code> and{" "}
          <code className="font-mono text-[0.9em] text-fg-2">is:thread</code>. Press <span className="text-fg-2">⌘K</span> for the
          command palette.
        </>
      ),
    },
    library: {
      title: "A library your way",
      body: "Browse as masonry, list, table or a media gallery. Smooth even with 10,000+ posts.",
    },
    insights: {
      title: "Insights",
      body: "Bookmarks over time, category mix, top authors and a heatmap of when you save.",
    },
    export: {
      title: "Export anywhere",
      body: "Markdown, CSV or JSON for Obsidian, Notion or a spreadsheet. Restore from a JSON backup any time.",
    },
    extras: [
      "Command palette (Ctrl/⌘ K)",
      "j / k, s, e, o, / shortcuts",
      "Rediscover on Home",
      "Private notes",
      "Star, archive and read states",
      "Tags and bulk actions",
      "X Premium folders become collections",
      "Dark and light themes",
    ],
  },
  categories: {
    title: (n) => `${n} categories, sorted on your device`,
    description:
      "twtdash reads each post’s text, links and domains, in English, Hindi or Hinglish, and files it right in your browser. Switch on AI for even sharper sorting.",
    listLabel: "Built-in categories",
    yourOwn: "Add your own, with your keywords",
    note: "Keyword sorting runs on your device. AI is optional.",
  },
  search: {
    title: "Search like you mean it",
    description:
      "Type a few words to search the full text of everything you’ve saved, instantly and in your browser. Add operators to slice your library any way you like.",
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
    title: "Your library never leaves your browser",
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
        body: "With your own NVIDIA key, posts go straight from your browser to NVIDIA. With Pro, they pass through our API and are never stored.",
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
      nvidiaNote: "Only if you turn on AI: post text, author and links",
    },
  },
  pricing: {
    title: "Free forever. Pro if you want AI without the setup.",
    description:
      "Everything in twtdash is free, including AI with your own free NVIDIA key. Pro adds hosted AI, so you never have to manage a key.",
    periodLabel: "Billing period",
    monthly: "Monthly",
    yearly: "Yearly",
    currencyLabel: "Currency",
    perMonth: "/ month",
    perYear: "/ year",
    yearlyNote: (perMonth) => `That’s ${perMonth}/month, billed yearly`,
    monthlyNote: (perYear, pct) => `Or ${perYear}/year and save ${pct}%`,
    free: {
      name: "Free",
      tagline: "For everyone who bookmarks on X.",
      forever: "forever",
      cta: "Add to Chrome — it’s free",
      aiBanner: "Includes AI with your free NVIDIA key",
      aiBannerNote: "Ask, AI sorting and gists. No credit card.",
      features: [
        "One-click sync, real-time capture and likes import",
        "Smart categories that understand Hindi and Hinglish",
        "Recall, Shelf and Wrapped",
        "Ask your bookmarks (with your NVIDIA key)",
        "Voice search and translate",
        "Search operators, ⌘K and keyboard shortcuts",
        "Masonry, list, table and gallery views",
        "Insights and export to Markdown, CSV or JSON",
        "English, हिन्दी and 8 Indian languages (beta)",
      ],
    },
    pro: {
      name: "Pro",
      badge: "No API key needed",
      tagline: "Hosted AI, zero setup.",
      cta: "Get twtdash Pro",
      features: [
        "Everything in Free",
        "Hosted AI, with no key to create or manage",
        "AI sorting, auto-tags and one-line gists",
        "Ask your bookmarks without a key",
        "Priority support",
        "Early access to new features",
      ],
      fine: "Your license key arrives by email. Paste it into twtdash to unlock Pro. Cancel anytime; refunds within 14 days.",
    },
  },
  faq: {
    title: "Questions and answers",
    description: (
      <>
        Can’t find what you need? Ask on{" "}
        <a href={BRAND.supportUrl} className="link-inline">
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
              <strong className="font-medium text-fg-2">1.</strong> Go to{" "}
              <a href="https://build.nvidia.com" className={link} rel="noopener">
                build.nvidia.com
              </a>{" "}
              and sign in with a free NVIDIA account.
            </span>
            <span className="mt-1.5 block">
              <strong className="font-medium text-fg-2">2.</strong> Open any model and click{" "}
              <strong className="font-medium text-fg-2">Get API Key</strong>. Copy the key — it starts with{" "}
              <code className="font-mono text-fg-2">nvapi-</code>.
            </span>
            <span className="mt-1.5 block">
              <strong className="font-medium text-fg-2">3.</strong> In twtdash, open{" "}
              <strong className="font-medium text-fg-2">Settings → AI organization</strong>, choose{" "}
              <strong className="font-medium text-fg-2">Free NVIDIA key</strong> and paste it.
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
    title: "Stop losing great posts in an endless list",
    body: "Install twtdash, sync once, and every bookmark you’ve ever saved is sorted, searchable and yours.",
    chrome: "Add to Chrome",
    firefox: "Add to Firefox",
    footnote: "Free forever · No account · Local-first",
  },
};
