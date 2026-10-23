# Store listing copy

Ready-to-paste text for the Chrome Web Store / Edge Add-ons / Firefox AMO.

## Name
twtdash — X Bookmarks Organizer

## Short description (≤ 132 chars)
Sync, auto-categorize and beautifully browse your X (Twitter) bookmarks. Instant search, collections, tags & insights. Local-first.

## Category
Productivity

## Detailed description

Your X bookmarks, finally organized.

You bookmark great posts on X every day — threads, tools, ideas, tutorials — and then never find them again. twtdash turns that endless list into a library you'll actually use.

★ ONE-CLICK SYNC
Click "Sync" and twtdash opens your bookmarks and scrolls through them for you. No X API key, no paid X plan, no password. Quick sync grabs only what's new; full sync refreshes everything. Import your Likes too.

★ AUTOMATIC CATEGORIES
Every post is sorted into 17 smart categories — AI & ML, Programming, Design, Startups, Marketing, Finance, Crypto, Productivity, Career, Science, Health, Learning, Tools, News, Culture, Humor — right on your device. Add your own categories and keywords.

★ REAL-TIME CAPTURE
Bookmark a post on X and it appears in twtdash instantly. X Premium bookmark folders become collections automatically.

★ SEARCH LIKE A PRO
Instant full-text search across everything you've saved, with operators: from:author, has:video, has:link, is:thread, cat:design, tag:react, after:30d, min_likes:1k, "exact phrase", -exclude.

★ A DASHBOARD YOU'LL ENJOY
Grid, list, table and media-gallery views. Collections, tags, private notes, stars, read/unread and archive. Bulk actions. Command palette (Ctrl/⌘ K) and keyboard shortcuts. Dark and light themes. "Rediscover" resurfaces gems you forgot about.

★ INSIGHTS
See what you save over time, your category mix, who you learn from most, and when you bookmark.

★ OPTIONAL AI (CLAUDE)
Turn on AI to get sharper categories, automatic tags and one-line gists — free with your own Anthropic API key, or with twtdash Pro (no key needed).

★ PRIVATE BY DESIGN
Your library lives in your browser. No account, no tracking, no ads. Nothing leaves your device unless you switch on AI.

★ YOURS TO KEEP
Export to Markdown (Obsidian/Notion-ready), CSV or JSON any time.

Try it instantly with sample data — no X account required.

twtdash is not affiliated with or endorsed by X Corp.

## Single purpose (Chrome)
twtdash helps users organize, search and revisit the posts they have bookmarked (and optionally liked) on X (x.com / twitter.com).

## Permission justifications (Chrome)

- **storage** — Saves the user's settings (theme, layout, sync options, optional API/license key) locally.
- **unlimitedStorage** — The user's bookmark library is stored locally in IndexedDB and can exceed the default quota for large libraries.
- **Host permission: https://x.com/*, https://twitter.com/*** — Required to read the bookmark/like data X loads for the signed-in user on their own bookmarks page, to auto-scroll that page during a sync the user starts, and to capture posts the user bookmarks in real time. The extension does not run on any other site.
- **Optional host permission: https://api.anthropic.com/*** — Requested only if the user chooses to enable AI with their own Anthropic API key, so post text can be sent directly to Anthropic for categorization.
- **Remote code** — None. All code ships in the package.

## Data usage disclosures (Chrome privacy tab)

- Collects: **Website content** (posts the user has bookmarked/liked on X) — stored locally only. If the user enables AI, post text, author handle and link domains are sent to Anthropic (directly, or via the twtdash API for Pro users) solely to categorize them; not stored by twtdash.
- Not sold to third parties; not used for unrelated purposes; not used for creditworthiness or lending.
- Privacy policy URL: https://twtdash.app/privacy

## Reviewer notes
No X login is needed to evaluate the UI: open the dashboard (toolbar icon → Open dashboard) and click **Explore with sample data**. To test sync, log in to x.com with any account that has bookmarks, then click the toolbar icon → **Sync my bookmarks**.

## Screenshots (1280×800)
Run `npm run ext:preview` and capture:
1. `http://localhost:5199/?demo#/home` — Home
2. `http://localhost:5199/?demo#/library/all` — Library grid
3. `http://localhost:5199/?demo#/library/all` with a post open — detail panel
4. `http://localhost:5199/?demo#/insights` — Insights
5. `http://localhost:5199/?demo#/settings/ai` — AI options
