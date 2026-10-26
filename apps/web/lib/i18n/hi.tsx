import Link from "next/link";
import { BRAND } from "@twtdash/shared";
import { BROWSERS, SUPPORT_URL } from "@/lib/site";
import type { Dictionary } from "./types";

const link = "link-inline";
const browsersList = `${BROWSERS.slice(0, -1).join(", ")} या ${BROWSERS.at(-1)}`;

export const hi: Dictionary = {
  locale: "hi",
  numberLocale: "hi-IN",
  meta: {
    title: `${BRAND.name} — आपके X bookmarks, अब पूरे सलीके से`,
    titleTemplate: `%s · ${BRAND.name}`,
    description:
      "twtdash आपके X पर save किए हर post को sync करता है, उन्हें अपने-आप smart categories में बाँटता है और एक तेज़, सुंदर library देता है — Hindi, Hinglish और Indian भाषाओं के साथ। सब कुछ आपके browser में, पूरी तरह private। हमेशा मुफ़्त।",
    keywords: [
      "X bookmarks",
      "Twitter bookmarks हिंदी",
      "bookmark manager हिंदी",
      "X bookmarks कैसे organize करें",
      "Twitter bookmarks search",
      "Hindi browser extension",
      "Hinglish",
      "twtdash",
    ],
    ogAlt: "twtdash — आपके X bookmarks, अब पूरे सलीके से।",
    install: {
      title: "Install करें",
      description:
        "twtdash को Chrome, Edge, Brave, Arc, Opera या Firefox में install करें और कुछ ही clicks में अपने X bookmarks की पहली sync चलाएँ।",
    },
  },
  shell: { skipToContent: "सीधे content पर जाएँ" },
  header: {
    nav: [
      { href: "/hi#features", label: "Features" },
      { href: "/hi#new", label: "नया क्या है" },
      { href: "/hi#pricing", label: "Pricing" },
      { href: "/hi#faq", label: "सवाल-जवाब" },
    ],
    installGuide: { href: "/hi/install", label: "Install guide" },
    homeAria: "twtdash होम",
    cta: "Chrome में जोड़ें",
    ctaLong: "Chrome में जोड़ें — मुफ़्त",
    openMenu: "Menu खोलें",
    closeMenu: "Menu बंद करें",
    mainNav: "मुख्य",
    mobileNav: "Mobile menu",
    language: "भाषा",
  },
  footer: {
    tagline: "आपके X bookmarks, अब पूरे सलीके से।",
    columns: [
      {
        title: "Product",
        links: [
          { href: "/hi#features", label: "Features" },
          { href: "/hi#new", label: "नया क्या है" },
          { href: "/hi#pricing", label: "Pricing" },
          { href: "/hi#faq", label: "सवाल-जवाब" },
        ],
      },
      {
        title: "शुरुआत करें",
        links: [
          { href: "/hi/install", label: "Install करें" },
          { href: "/hi/install#first-sync", label: "पहली sync" },
          { href: "/", label: "View in English", hrefLang: "en" },
          { href: SUPPORT_URL, label: "संपर्क करें" },
        ],
      },
      {
        title: "Legal",
        links: [
          { href: "/privacy", label: "Privacy (English)", hrefLang: "en" },
          { href: "/terms", label: "Terms (English)", hrefLang: "en" },
        ],
      },
    ],
    rights: `© 2026 ${BRAND.name}. सर्वाधिकार सुरक्षित।`,
    disclaimer: "twtdash का X Corp. से कोई संबंध नहीं है और न ही X इसका समर्थन करता है।",
  },
  hero: {
    pillBadge: "नया",
    pillShort: "Recall, Shelf, Ask और Wrapped",
    pillLong: "Recall, Shelf, Ask your bookmarks और Wrapped",
    titleLine1: "आपके X bookmarks,",
    titleAccent: "अब पूरे सलीके से।",
    description:
      "twtdash आपके X पर save किए हर post को sync करता है, उन्हें आपके device पर ही categories में बाँटता है, और सब कुछ पल भर में खोजने लायक बना देता है।",
    ctaChrome: "Chrome में जोड़ें — मुफ़्त",
    ctaFirefox: "Firefox में जोड़ें",
    badges: ["हमेशा मुफ़्त", "कोई account नहीं", "डेटा आपके browser में"],
    mobile: {
      text: "Phone पर हैं? twtdash laptop/PC के browser में चलता है। Link ख़ुद को भेज लें।",
      whatsapp: "WhatsApp",
      copy: "Link copy करें",
      copied: "Link copy हो गया",
      shareText: "twtdash: अपने सारे X bookmarks sync करें, सलीके से रखें और तुरंत खोजें। Laptop पर install करें:",
    },
    mockup: {
      caption:
        "twtdash library की झलक: बाईं ओर sections और categories वाला sidebar, ऊपर search bar जिसमें “after:2025-06-01 min_likes:500 -crypto” query चल रही है, और नीचे save किए गए posts का grid — हर post पर उसकी category।",
      tab: "twtdash — Library",
      search: "Search करें या कहीं भी जाएँ…",
      nav: {
        home: "होम",
        all: "सभी bookmarks",
        unread: "बिना पढ़े",
        starred: "Starred",
        archive: "Archive",
        insights: "Insights",
        recall: "Recall",
        shelf: "Shelf",
        ask: "Bookmarks से पूछें",
        wrapped: "Wrapped",
      },
      discover: "Discover",
      categories: "Categories",
      title: "सभी bookmarks",
      filters: "Filters",
      sort: "हाल में save किए",
      all: "सभी",
      thread: "Thread",
    },
  },
  how: {
    title: "Bookmarks के ढेर से library तक, बस तीन steps में",
    description: "न कोई script, न API key, न export का झंझट। मेहनत वाला काम twtdash करता है।",
    steps: [
      {
        title: "Extension install करें",
        body: `twtdash को ${browsersList} में जोड़ें। न account बनाना है, न कुछ setup करना है।`,
      },
      {
        title: "एक click में sync",
        body: "twtdash आपके X bookmarks में आपके लिए scroll करता है और X का अपना page data पढ़ता है। न X API key, न paid X plan।",
      },
      {
        title: "कुछ भी, तुरंत ढूँढें",
        body: "हर post आपके device पर ही सही category में पहुँच जाता है। Operators से search करें, सवाल पूछें, tag और star करें।",
      },
    ],
  },
  whatsNew: {
    title: "Posts सिर्फ़ save न करें, काम में लाएँ।",
    description: "ज़्यादातर bookmarks दोबारा कभी नहीं खुलते। ये features आपकी save की हुई सबसे अच्छी चीज़ें वापस आपके सामने लाते हैं।",
    recall: {
      title: "Recall",
      body: "रोज़ 5 मिनट का review, जो save किए posts को सही समय पर दोबारा सामने लाता है — ताकि काम की बातें याद रहें।",
      today: "आज का Recall",
      progress: "4 / 10",
      streak: "12 दिन की streak",
      savedAgo: "3 महीने पहले save किया",
      post: "Most React performance problems are just state living too high in the tree. Move it down, memo less, ship faster.",
      ratings: ["दोबारा", "ठीक है", "याद हो गया"],
      why: "Review का समय",
    },
    ask: {
      title: "अपने bookmarks से पूछें",
      body: "Hindi, English या किसी भी Indian भाषा में सवाल पूछें — जवाब आपके अपने save किए posts से बनेगा, sources के साथ।",
      question: "बिना ads के पहले customers कैसे लाएँ — इस पर मैंने क्या save किया था?",
      answer: (
        <>
          दो posts सबसे काम के हैं: एक cold-email template जिससे 40 demos book हुए<sup>1</sup>, और एक UPI startup का playbook कि
          उन्होंने शहर-दर-शहर merchants कैसे जोड़े<sup>2</sup>।
        </>
      ),
      sources: "Sources",
      languages: "हिन्दी, English और कई भाषाएँ",
      key: "अपनी NVIDIA key से मुफ़्त, या Pro",
    },
    shelf: {
      title: "Shelf",
      body: "आपके bookmarks में छिपे हर repo, paper, video, article, tool, किताब और course — अपने-आप अलग, आपके device पर ही।",
      kinds: [
        { id: "repo", label: "Repos", count: 42 },
        { id: "paper", label: "Papers", count: 18 },
        { id: "video", label: "Videos", count: 63 },
        { id: "article", label: "Articles", count: 120 },
        { id: "tool", label: "Tools", count: 37 },
        { id: "book", label: "किताबें", count: 9 },
        { id: "course", label: "Courses", count: 14 },
      ],
      items: [
        { kind: "repo", title: "vercel/next.js", meta: "GitHub · @diegoships से" },
        { kind: "paper", title: "Attention Is All You Need", meta: "arXiv · @mayabuilds से" },
        { kind: "video", title: "Distributed systems, lecture 1", meta: "YouTube · @theoreads से" },
        { kind: "book", title: "Designing Data-Intensive Applications", meta: "किताब · @priyamakes से" },
      ],
      onDevice: "आपके device पर ही निकाला गया",
    },
    wrapped: {
      title: "Wrapped",
      body: "आपका पूरा साल bookmarks में, एक shareable story: top topics, save करने की आदतें और आपकी bookmark persona।",
      year: "2026 Wrapped",
      saved: "posts save किए",
      savedCount: "1,284",
      personaLabel: "आपकी persona",
      persona: "The Night Owl Researcher",
      topCategory: "Top: AI और ML",
      share: "Share",
    },
    voice: {
      title: "Voice search और translate",
      body: "Hindi, Tamil, Bengali या दूसरी भाषाओं में बोलकर search करें। किसी भी post को एक tap में अपनी भाषा में पढ़ें।",
      listening: "सुन रहा है · हिन्दी",
      transcript: "क्रिकेट वाले posts दिखाओ",
      result: "23 posts",
      translate: "English से translate किया",
      original: "Yesterday’s match was absolutely worth it",
      translated: "कल का मैच एकदम पैसा वसूल था",
    },
  },
  india: {
    title: "भारत जैसे bookmark करता है, वैसा ही",
    description: "आपकी भाषा, आपका number system, आपका laptop और आपका डेटा — twtdash उसी तरह बना है जैसे भारत X चलाता है।",
    languages: {
      title: "पूरा app, आपकी भाषा में",
      body: "twtdash को English या हिन्दी में चलाएँ — साथ में 8 और Indian भाषाएँ beta में।",
      beta: "beta",
      names: ["अंग्रेज़ी", "हिन्दी", "बांग्ला", "मराठी", "तेलुगु", "तमिल", "गुजराती", "कन्नड़", "मलयालम", "पंजाबी"],
    },
    hinglish: {
      title: "Hinglish भी समझता है",
      body: "Device पर होने वाली sorting Hindi, Hinglish और Indian भाषाओं के posts पढ़ लेती है — cricket वाला post सीधे Sports में जाता है, “Other” में नहीं।",
      post: "Kal ka match ekdum paisa vasool tha, last over mein 18 chahiye the",
      sortedInto: "यहाँ पहुँचा",
      author: "@rohanbats",
    },
    voice: {
      title: "बोलकर खोजें",
      body: "Mic दबाएँ और Hindi, Tamil, Telugu, Bengali या किसी भी supported भाषा में search करें।",
    },
    numbers: {
      title: "लाख और करोड़",
      body: "गिनती और insights, भारतीय number system में।",
      ours: "1,28,400",
      theirs: "128,400",
      label: "posts save किए",
    },
    lowEnd: {
      title: "पुराने laptop पर भी तेज़",
      body: "Local library जो budget laptops पर भी smooth चलती है — 10,000+ posts के साथ भी।",
    },
    freeAi: {
      title: "AI, बिल्कुल ₹0 में",
      body: "Ask, AI sorting और gists आपकी अपनी NVIDIA key से मुफ़्त चलते हैं। न card, न subscription।",
    },
    privacy: {
      title: "डेटा आपके पास",
      body: "न account, न cloud copy। आपकी पूरी library आपके browser में, आपके device पर रहती है।",
    },
  },
  features: {
    title: "जो भी save किया, अब काम का",
    description: "twtdash कभी न ख़त्म होने वाली bookmark list को ऐसी library बना देता है जिसमें आप खोज सकें, छाँट सकें और लौटकर आ सकें।",
    sync: {
      title: "एक click में sync",
      body: "आपके लिए bookmarks में scroll करता है और X का अपना page data पढ़ता है। न API key, न paid X plan।",
    },
    capture: {
      title: "Real-time capture",
      body: "X पर कोई post bookmark करें और वह तुरंत twtdash में दिखता है। Premium folders collections बन जाते हैं।",
    },
    categories: {
      title: "Smart categories",
      body: (n) => `हर post आपके device पर ही ${n} categories में बँट जाता है। अपने keywords के साथ अपनी categories भी बनाएँ।`,
    },
    ai: {
      title: "AI gists और auto-tags",
      body: "AI sorting, tags और एक-लाइन gists, अगर चाहें। अपनी NVIDIA key से मुफ़्त, या Pro के साथ बिना key के।",
    },
    search: {
      title: "Operators के साथ search",
      body: (
        <>
          पूरे text में search, <code className="font-mono text-[0.9em] text-fg-2">from:</code>,{" "}
          <code className="font-mono text-[0.9em] text-fg-2">has:video</code> और{" "}
          <code className="font-mono text-[0.9em] text-fg-2">is:thread</code> जैसे operators के साथ। Command palette के लिए{" "}
          <span className="text-fg-2">⌘K</span> दबाएँ।
        </>
      ),
    },
    library: {
      title: "Library, आपके हिसाब से",
      body: "Masonry, list, table या media gallery में देखें। 10,000+ posts के साथ भी smooth।",
    },
    insights: {
      title: "Insights",
      body: "समय के साथ bookmarks, categories का mix, top authors और आप कब save करते हैं — उसका heatmap।",
    },
    export: {
      title: "कहीं भी export करें",
      body: "Obsidian, Notion या spreadsheet के लिए Markdown, CSV या JSON। JSON backup से कभी भी restore करें।",
    },
    extras: [
      "Command palette (Ctrl/⌘ K)",
      "j / k, s, e, o, / shortcuts",
      "होम पर पुराने posts दोबारा",
      "Private notes",
      "Star, archive और read",
      "Tags और bulk actions",
      "X Premium folders, collections के रूप में",
      "Dark और light theme",
    ],
  },
  categories: {
    title: (n) => `${n} categories, बिना किसी मेहनत के`,
    description:
      "twtdash हर post का text, links और domains पढ़ता है — English, Hindi या Hinglish — और उसे आपके browser में ही सही जगह रख देता है। और सटीक sorting के लिए AI चालू करें।",
    listLabel: "Built-in categories",
    yourOwn: "अपनी categories, अपने keywords के साथ",
    note: "Keyword sorting आपके device पर चलती है। AI optional है।",
    names: {
      ai: "AI और ML",
      dev: "Programming",
      design: "Design और UI",
      startups: "Startups और Business",
      marketing: "Marketing और Growth",
      finance: "पैसा और निवेश",
      crypto: "Crypto और Web3",
      productivity: "Productivity और Mindset",
      career: "Career और नौकरी",
      science: "Science और Tech",
      health: "सेहत और Fitness",
      learning: "पढ़ाई और Resources",
      tools: "Tools और Apps",
      news: "ख़बरें और राजनीति",
      culture: "Culture और मनोरंजन",
      humor: "हँसी-मज़ाक और Memes",
      sports: "खेल",
      other: "अन्य",
    },
  },
  search: {
    title: "Search, जो सच में ढूँढ दे",
    description:
      "कुछ शब्द लिखें और twtdash आपकी save की हुई हर चीज़ का पूरा text तुरंत खोज देता है — आपके browser में ही। Operators जोड़कर library को जैसे चाहें छाँटें।",
    operators: [
      "किसी एक author के posts",
      "Video वाले posts",
      "Link वाले posts",
      "सिर्फ़ threads",
      "एक category",
      "किसी tag वाले posts",
      "किसी collection के posts",
      "किसी तारीख़ के बाद",
      "किसी तारीख़ से पहले",
      "कम से कम 500 likes",
      "किसी भाषा के posts",
      "कोई शब्द या filter हटाएँ",
    ],
    demo: {
      label: "Search के उदाहरण",
      results: "results",
      examples: [
        { label: "Author से", caption: "Maya के share किए सारे links जो आपने save किए" },
        { label: "Popular AI", caption: "Prompting पर ख़ूब पसंद किए गए AI posts" },
        { label: "Threads", caption: "जनवरी 2025 से अब तक के threads, crypto छोड़कर" },
        { label: "हिन्दी", caption: "Video वाले हिन्दी posts" },
      ],
    },
  },
  privacy: {
    title: "आपकी library आपके browser से बाहर नहीं जाती",
    description: "twtdash ऐसा बना है कि leak होने के लिए कुछ है ही नहीं: न accounts, न आपका डेटा रखने वाले servers, न बेचने को कुछ।",
    points: [
      {
        title: "आपके device पर",
        body: "आपकी library आपके browser के IndexedDB में रहती है। twtdash के पास आपके bookmarks की कोई cloud copy नहीं है।",
      },
      {
        title: "न account, न tracking",
        body: "न sign-up, न analytics, न ads। twtdash सिर्फ़ x.com और twitter.com पर चलता है, ताकि आपके खोले bookmarks पढ़ सके।",
      },
      {
        title: "AI आपकी मर्ज़ी से",
        body: "अपनी NVIDIA key लगाएँ तो posts सीधे आपके browser से NVIDIA जाते हैं। Pro में वे हमारे API से होकर जाते हैं और कभी store नहीं होते।",
      },
      {
        title: "जहाँ चाहें ले जाएँ",
        body: "सब कुछ कभी भी Markdown, CSV या JSON में export करें, और JSON backup से restore करें।",
      },
    ],
    link: "Privacy policy पढ़ें (English)",
    diagram: {
      caption:
        "Diagram: आपके browser के अंदर twtdash आपका X bookmarks page पढ़ता है और library को IndexedDB में रखता है। सिर्फ़ AI चालू करने पर ही posts का text NVIDIA के API को जाता है।",
      browser: "आपका browser",
      bookmarks: "आपके bookmarks",
      onDevice: "इसी device पर",
      nvidia: "NVIDIA API",
      nvidiaNote: "सिर्फ़ AI चालू करने पर: post का text, author और links",
    },
  },
  pricing: {
    title: "हमेशा मुफ़्त। AI बिना झंझट चाहिए तो Pro।",
    description:
      "twtdash में सब कुछ मुफ़्त है — AI भी, आपकी अपनी मुफ़्त NVIDIA key के साथ। Pro में hosted AI मिलता है, ताकि key सँभालने का झंझट न रहे।",
    periodLabel: "Billing period",
    monthly: "महीने का",
    yearly: "साल का",
    currencyLabel: "Currency",
    perMonth: "/ महीना",
    perYear: "/ साल",
    yearlyNote: (perMonth) => `यानी ${perMonth}/महीना, साल में एक बार billing`,
    monthlyNote: (perYear, pct) => `या ${perYear}/साल, ${pct}% की बचत`,
    free: {
      name: "Free",
      tagline: "X पर bookmark करने वाले हर किसी के लिए।",
      forever: "हमेशा",
      cta: "Chrome में जोड़ें — मुफ़्त",
      aiBanner: "AI भी शामिल, आपकी मुफ़्त NVIDIA key से",
      aiBannerNote: "Ask, AI sorting और gists। Credit card नहीं चाहिए।",
      features: [
        "एक click में sync, real-time capture और likes import",
        "Hindi और Hinglish समझने वाली smart categories",
        "Recall, Shelf और Wrapped",
        "अपने bookmarks से पूछें (आपकी NVIDIA key से)",
        "Voice search और translate",
        "Search operators, ⌘K और keyboard shortcuts",
        "Masonry, list, table और gallery views",
        "Insights और Markdown / CSV / JSON export",
        "English, हिन्दी + 8 Indian भाषाएँ (beta)",
      ],
    },
    pro: {
      name: "Pro",
      badge: "API key की ज़रूरत नहीं",
      tagline: "Hosted AI, zero setup।",
      cta: "twtdash Pro लें",
      features: [
        "Free का सब कुछ",
        "Hosted AI, key बनाने या सँभालने की ज़रूरत नहीं",
        "AI sorting, auto-tags और एक-लाइन gists",
        "बिना key के अपने bookmarks से पूछें",
        "Priority support",
        "नए features सबसे पहले",
      ],
      fine: "आपकी license key email पर आती है। उसे twtdash में paste करें और Pro चालू। कभी भी cancel करें; 14 दिन के अंदर refund।",
    },
  },
  faq: {
    title: "आपके सवाल, हमारे जवाब",
    description: (
      <>
        जो ढूँढ रहे हैं वह नहीं मिला?{" "}
        <a href={BRAND.supportUrl} className="link-inline">
          {BRAND.supportLabel}
        </a>{" "}
        पर पूछें — Hindi में भी।
      </>
    ),
    items: [
      {
        q: "क्या twtdash इस्तेमाल करना safe है?",
        a: (
          <>
            हाँ। twtdash सिर्फ़ x.com और twitter.com पर चलता है, और सिर्फ़ वही bookmark और like data पढ़ता है जो sign-in होने
            पर आपका browser ख़ुद load करता है। जो भी save होता है, आपके browser में ही रहता है — twtdash का कोई server आपकी
            library नहीं रखता, न analytics, न ads। AI features तब तक बंद रहते हैं जब तक आप उन्हें चालू न करें।
          </>
        ),
      },
      {
        id: "nvidia-key",
        q: "मुफ़्त NVIDIA API key कैसे बनाएँ?",
        a: (
          <>
            बस एक मिनट लगता है, credit card की ज़रूरत नहीं:
            <span className="mt-3 block">
              <strong className="font-medium text-fg-2">1.</strong>{" "}
              <a href="https://build.nvidia.com" className={link} rel="noopener">
                build.nvidia.com
              </a>{" "}
              पर जाएँ और मुफ़्त NVIDIA account से sign in करें।
            </span>
            <span className="mt-1.5 block">
              <strong className="font-medium text-fg-2">2.</strong> कोई भी model खोलें और{" "}
              <strong className="font-medium text-fg-2">Get API Key</strong> पर click करें। Key copy करें — यह{" "}
              <code className="font-mono text-fg-2">nvapi-</code> से शुरू होती है।
            </span>
            <span className="mt-1.5 block">
              <strong className="font-medium text-fg-2">3.</strong> twtdash में{" "}
              <strong className="font-medium text-fg-2">Settings → AI organization</strong> खोलें,{" "}
              <strong className="font-medium text-fg-2">Free NVIDIA key</strong> चुनें और key paste कर दें।
            </span>
            <span className="mt-3 block">
              इसके बाद requests सीधे आपके browser से NVIDIA जाती हैं। Key का झंझट नहीं चाहिए तो Pro लें।
            </span>
          </>
        ),
      },
      {
        id: "languages",
        q: "क्या twtdash हिन्दी और दूसरी Indian भाषाओं में चलता है?",
        a: (
          <>
            हाँ। पूरा extension English और हिन्दी में है, और বাংলা, मराठी, తెలుగు, தமிழ், ગુજરાતી, ಕನ್ನಡ, മലയാളം और ਪੰਜਾਬੀ
            beta में हैं। Sorting Hindi और Hinglish posts समझती है, आप Indian भाषाओं में बोलकर search कर सकते हैं और सवाल
            पूछ सकते हैं, और गिनती लाख-करोड़ में दिखती है।
          </>
        ),
      },
      {
        q: "क्या इसे मेरा X password चाहिए?",
        a: (
          <>
            नहीं। twtdash कभी आपका X password, X API key या कोई और login नहीं माँगता। यह आपके browser में पहले से चल रहे X
            session के साथ काम करता है — अगर आप x.com पर अपने bookmarks देख सकते हैं, तो twtdash उन्हें sync कर सकता है।
          </>
        ),
      },
      {
        id: "mobile",
        q: "क्या मैं इसे phone पर इस्तेमाल कर सकता हूँ?",
        a: (
          <>
            अभी नहीं। twtdash desktop browsers का extension है — आपके laptop या PC पर Chrome, Edge, Brave, Arc, Opera और
            Firefox। Install करने के लिए यह page अपने computer पर खोलें; X app में किए गए bookmarks भी वहाँ आ जाते हैं।
          </>
        ),
      },
      {
        q: "क्या यह X Premium bookmark folders के साथ चलता है?",
        a: (
          <>
            हाँ। अगर आप X Premium में bookmarks को folders में रखते हैं, तो twtdash उन folders को collections के रूप में ले
            आता है — आपकी पहले की मेहनत बेकार नहीं जाती।
          </>
        ),
      },
      {
        q: "मेरा डेटा कहाँ store होता है?",
        a: (
          <>
            आपके browser के IndexedDB में, आपके device पर। twtdash पर कुछ भी upload नहीं होता। क्योंकि library local है,
            extension हटाने पर वह भी मिट जाती है — रखना चाहें तो पहले backup export कर लें। पूरी जानकारी हमारी{" "}
            <Link href="/privacy" hrefLang="en" className={link}>
              privacy policy (English)
            </Link>{" "}
            में है।
          </>
        ),
      },
      {
        q: "अगर X अपनी website बदल दे तो?",
        a: (
          <>
            X समय-समय पर अपनी site बदलता है। twtdash screen पर दिखने वाली चीज़ों की जगह X का अपना page data पढ़ता है, इसलिए
            यह मज़बूत रहता है — और कुछ बदलता है तो हम extension update कर देते हैं। जो पहले से sync हो चुका है, वह आपके
            browser में सुरक्षित रहता है।
          </>
        ),
      },
      {
        q: "क्या यह Firefox में चलता है?",
        a: (
          <>
            हाँ — twtdash desktop के Firefox के साथ-साथ Chrome, Edge, Brave, Arc और Opera में भी चलता है।{" "}
            <Link href="/hi/install" className={link}>
              Install guide
            </Link>{" "}
            में हर browser के steps हैं।
          </>
        ),
      },
      {
        q: "Refund policy क्या है?",
        a: (
          <>
            अगर Pro आपके काम का न लगे, तो खरीदने के 14 दिन के अंदर{" "}
            <a href={BRAND.supportUrl} className={link}>
              {BRAND.supportLabel}
            </a>{" "}
            पर हमसे संपर्क करें — पूरा refund मिलेगा। आप कभी भी cancel कर सकते हैं, और जितने समय का भुगतान किया है, तब तक Pro
            चलता रहेगा।
          </>
        ),
      },
    ],
  },
  cta: {
    title: "अच्छे posts को लंबी list में खोने न दें",
    body: "twtdash install करें, एक बार sync करें — और आपका save किया हर bookmark सलीके से, खोजने लायक और हमेशा आपका।",
    chrome: "Chrome में जोड़ें",
    firefox: "Firefox में जोड़ें",
    footnote: "हमेशा मुफ़्त · कोई account नहीं · डेटा आपके device पर",
  },
};
