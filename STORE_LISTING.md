# Store listing copy

Ready-to-paste text for the Chrome Web Store / Edge Add-ons / Firefox AMO.

## Name
twtdash — X Bookmarks Organizer

## Short description (≤ 132 chars)
Sync, auto-sort and search your X bookmarks. Recall, Shelf, Wrapped and Ask help you revisit them. Local-first, in Hindi and more.

## Category
Productivity

## Detailed description

Your X bookmarks, finally organized.

You bookmark great posts on X every day — threads, tools, ideas, tutorials — and then never find them again. twtdash turns that endless list into a library you'll actually use.

★ ONE-CLICK SYNC
Click "Sync" and twtdash opens your bookmarks and scrolls through them for you. No X API key, no paid X plan, no password. Quick sync grabs only what's new; full sync refreshes everything. Import your Likes too.

★ AUTOMATIC CATEGORIES
Every post is sorted into 17 smart categories — AI & ML, Programming, Design, Startups, Marketing, Finance, Crypto, Productivity, Career, Science, Health, Learning, Tools, News, Sports, Culture, Humor — plus Other for anything else, all right on your device. Add your own categories and keywords. Romanized Hindi (Hinglish) is understood too.

★ REAL-TIME CAPTURE
Bookmark a post on X and it appears in twtdash instantly. X Premium bookmark folders become collections automatically.

★ SEARCH LIKE A PRO
Instant full-text search across everything you've saved, with operators: from:author, has:video, has:link, is:thread, cat:design, tag:react, after:30d, min_likes:1k, "exact phrase", -exclude. You can also speak your search (Chrome, Edge and Safari) in English (India) or ten Indian languages.

★ A DASHBOARD YOU'LL ENJOY
Grid, list, table and media-gallery views. Collections, tags, private notes, stars, read/unread and archive. Bulk actions. Command palette (Ctrl/⌘ K) and keyboard shortcuts. Dark and light themes. "Rediscover" resurfaces gems you forgot about.

★ INSIGHTS
See what you save over time, your category mix, who you learn from most, and when you bookmark.

★ RECALL
Saved posts come back on a daily schedule, spaced out so you see the ones you're starting to forget. Rate each card and keep your streak going. Runs on your device, with no AI key needed.

★ SHELF
Every link and resource in your saved posts, sorted by type (repos, papers, videos, articles, tools, books, courses and more), with who shared each one. Export the shelf to Markdown.

★ WRAPPED
A story-style recap of what you saved, from your top categories and authors to your longest streak, ending in a share image you can download or share.

★ ASK YOUR BOOKMARKS
Ask a question and get an answer built from your saved posts, with citations that link back to each one. Needs a free NVIDIA API key or twtdash Pro.

★ TRANSLATE ANY POST
Translate a post into English, Hindi, Hinglish or another Indian language. Needs a free NVIDIA API key or twtdash Pro.

★ OPTIONAL AI (FREE)
Turn on AI to get sharper categories, automatic tags, one-line gists, answers to your questions and post translations — free with your own NVIDIA API key (build.nvidia.com, no credit card), or with twtdash Pro (no key needed).

★ MADE FOR INDIA
Hindi covers the core app (library, search, settings, insights and the toolbar popup); Recall, Shelf, Ask and Wrapped are in English for now. Bengali, Marathi, Telugu, Tamil, Gujarati, Kannada, Malayalam and Punjabi are available in beta. Urdu works for voice and translation. Numbers group the Indian way (1,23,456) with lakh and crore, and categories understand Hinglish.

★ PRIVATE BY DESIGN
Your library lives in your browser. No account, no tracking, no ads. Nothing leaves your device unless you switch on AI or use voice search.

★ YOURS TO KEEP
Export to Markdown (Obsidian/Notion-ready), CSV or JSON any time.

Try it instantly with sample data — no X account required.

twtdash is not affiliated with or endorsed by X Corp.

## Single purpose (Chrome)
twtdash helps users organize, search and revisit the posts they have bookmarked (and optionally liked) on X (x.com / twitter.com).

## Permission justifications (Chrome)

- **storage** — Saves the user's settings (theme, layout, sync options, optional API/license key) and Recall's schedule and streak locally.
- **unlimitedStorage** — The user's bookmark library is stored locally in IndexedDB and can exceed the default quota for large libraries.
- **Host permission: https://x.com/*, https://twitter.com/*** — Required to read the bookmark/like data X loads for the signed-in user on their own bookmarks page, to auto-scroll that page during a sync the user starts, and to capture posts the user bookmarks in real time. The extension does not run on any other site.
- **Optional host permission: https://integrate.api.nvidia.com/*** — Requested only if the user chooses to enable AI with their own NVIDIA API key, so post text can be sent directly to NVIDIA's API for categorization, Ask answers and translation. It is the only optional host the extension requests.
- **Microphone (requested by the browser at runtime; not a manifest permission)** — Used only when the user presses the voice search button. The browser's speech recognition handles the audio; twtdash receives the recognized text only.
- **Remote code** — None. All code ships in the package.

## Data usage disclosures (Chrome privacy tab)

- Collects: **Website content** (posts the user has bookmarked/liked on X) — stored locally only. If the user enables AI, the post text, author handle and link domains needed for categories are sent to NVIDIA's API (directly, or via the twtdash API for Pro users) solely to categorize them; not stored by twtdash. For Ask, the question, recent conversation turns and up to 20 matching posts are sent; for translation, the text of the post being translated. These are used only to produce the answer and are not logged or stored by twtdash.
- Voice search: the browser's speech recognition handles the audio (Chrome sends it to its speech service). twtdash receives only the recognized text.
- Not sold to third parties; not used for unrelated purposes; not used for creditworthiness or lending.
- Privacy policy URL: https://twtdash.app/privacy

## Reviewer notes
No X login is needed to evaluate the UI: open the dashboard (toolbar icon → Open dashboard) and click **Explore with sample data**. To test sync, log in to x.com with any account that has bookmarks, then click the toolbar icon → **Sync my bookmarks**. Recall, Shelf and Wrapped work on the sample library and need no AI key. Ask and translation need an NVIDIA key (Settings → AI) or Pro; without one, Ask shows matching posts. Voice search needs Chrome, Edge or Safari.

## Screenshots (1280×800)
Run `npm run ext:preview` and capture:
1. `http://localhost:5199/?demo#/home` — Home
2. `http://localhost:5199/?demo#/library/all` — Library grid
3. `http://localhost:5199/?demo#/library/all` with a post open — detail panel
4. `http://localhost:5199/?demo#/insights` — Insights
5. `http://localhost:5199/?demo#/settings/ai` — AI options
