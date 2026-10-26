# twtdash performance work

All numbers are **medians of 3 runs**, measured on a **production build** with a **synthetic 10,000-post library** (the size of a heavy X bookmarker) in headless Chrome. Stage-by-stage comparisons use **4× CPU throttling** (a mid-range laptop) so differences are visible; the final row set is also measured at **full speed on this PC**.

Reproduce: `cd apps/extension && node bench/run.mjs <label> [--runs 3] [--cpu 4]`, then `node bench/summary.mjs`. Profiling helpers: `bench/profile.mjs`, `bench/trace.mjs`, `bench/experiment.mjs`, `bench/insights-prefetch.mjs`. Functional check: `node bench/smoke.mjs` (15 interaction checks, all passing).

## Where the time actually went (baseline)

| Gap | Evidence | Share |
|---|---|---|
| Building a full-text search index (MiniSearch) for every post before first paint | CPU profile: MiniSearch `add`/`addTerm`/`tokenize` ≈ 22 s of a 50 s startup profile | biggest |
| Reading and deserializing **every** post from IndexedDB up front — and again after **every** change | `toArray()` of 10k rows ≈ 7.7 s; a single star re-read the whole table | large |
| Rendering cards that aren't visible (progressive "load 36 more" list, no virtualization), each mounting Radix menus/tooltips | DOM grew to 4.7k nodes after 4 s of scrolling; the oldest post was never reachable within 60 s | large |
| Popup walking 10k records with a cursor to count categories | 30 s popup at 4× | large |
| Shipping chart, animation and AI SDK code on the startup path | 1.66 MB of startup JS | medium |
| Browser text shaping for content off-screen | Trace: 1.9 s of a 2.7 s layout was `ShapeText` (inflated ~14× by throttling; ~135 ms at full speed) | medium |

Hypotheses that were **tested and rejected** (no measurable effect): blur/backdrop filters, gradients, masks, animations, box-shadows, the variable web font, OpenType features/letter-spacing, grid `fr` tracks, `text-wrap: balance`.

## Fixes, one at a time (4× CPU, 10k posts)

| Metric | Baseline | 1 · Scan search | 2 · Incremental store | 3 · Virtualized lists | 4/5 · Off-screen skip + index counts | 3b · Scroll tuning | 6 · Code split | 6b · Prefetch timing | 7 · Custom chart (final) |
|---|---|---|---|---|---|---|---|---|---|
| Startup → library painted | 43.0 s | 28.5 s | 20.6 s | 13.6 s | 12.4 s | 12.9 s | 12.3 s | 12.2 s | **12.9 s** |
| JS evaluated | 5.7 s | 3.8 s | 3.6 s | 3.3 s | 3.5 s | 3.4 s | 2.1 s | 1.9 s | **2.0 s** |
| Main-thread long tasks at startup | 40.7 s | 26.2 s | 19.6 s | 12.9 s | 11.4 s | 11.9 s | 11.3 s | 11.3 s | **11.7 s** |
| Switch → Library | 5.2 s | 7.0 s | 6.6 s | 2.7 s | 3.0 s | 2.7 s | 2.4 s | 3.0 s | **2.9 s** |
| Switch → Category | 5.4 s | 5.1 s | 6.4 s | 1.9 s | 2.3 s | 1.9 s | 2.2 s | 2.5 s | **2.4 s** |
| Switch → Insights | 5.2 s | 6.0 s | 5.3 s | 4.4 s | 3.8 s | 4.6 s | 5.9 s | 6.6 s | **3.2 s** |
| Star a post → UI updated | 3.3 s | 3.1 s | 1.6 s | 1.0 s | 0.8 s | 1.3 s | 1.0 s | 1.0 s | **1.1 s** |
| Search keystroke → results | 2.0 s | 3.2 s | 2.7 s | 1.3 s | 1.4 s | 1.4 s | 1.7 s | 1.8 s | **1.3 s** |
| Scrolling FPS | 24 | 24 | 24 | 18 | 16 | 31 | 32 | 28 | **30** |
| Reach the oldest post | never (>60 s) | never | never | 1.2 s | 1.6 s | 2.4 s | 4.5 s | 2.0 s | **3.3 s** |
| Popup open → counts | 30.3 s | 28.5 s | 17.3 s | 19.0 s | 7.9 s | 7.6 s | 5.4 s | 6.5 s | **7.3 s** |
| DOM nodes after scrolling | 4,731 | 4,732 | 4,732 | 1,867 | 1,874 | 1,867 | 1,874 | 1,881 | **1,811** |
| JS heap | 55 MB | 31 MB | 24 MB | 23 MB | 32 MB | 22 MB | 27 MB | 25 MB | **26 MB** |
| Total JS shipped (preview build) | 1,648 KB | 1,635 KB | 1,635 KB | 1,639 KB | 1,639 KB | 1,640 KB | 1,505 KB | 1,506 KB | **1,157 KB** |

Run-to-run noise on this machine is roughly ±20–25 %, so only larger moves are meaningful.

**What each fix did**

1. **Scan search** — replaced the inverted index with a substring scan over lazily built, cached lowercase haystacks (warmed in idle time). Index build 12.9 s → 0; heap 55 → 31 MB. Trade-off: no typo-tolerant ("fuzzy") matching; prefix/partial-word matches still work.
2. **Incremental store** — newest 150 posts load first (≈ 30 ms at full speed), the rest stream in yielding pages; afterwards only rows changed since the last read are fetched via a new `updatedAt` index. Star 3.1 → 1.6 s; popup 28 → 17 s.
3. **Virtualized grid/list/table/gallery** — only on-screen items are mounted; heights are measured; the scroll height covers the whole library. Oldest post: never → 1.2 s; DOM after scrolling −60 %; Library switch 6.6 → 2.7 s. **It made scrolling worse** at first (p95 frame 67 → 367 ms) — fixed in 3b.
4. **Off-screen skip** (`content-visibility: auto` on below-the-fold sections) + explicit emoji font — Insights 4.4 → 3.8 s; no measurable change on Home.
5. **Index-only counts** for the popup and the X-page button — popup 19 → 7.9 s.
3b. **Scroll tuning** — low-priority (`startTransition`) mounting, synchronous re-layout only for on-screen measurements, menus/tooltips/lightbox mounted on first use, layout containment per item. FPS 16 → 31, p95 frame 467 → 117 ms.
6. **Code splitting** — Anthropic SDK loads only when AI runs; charts screen lazy; `motion` replaced by CSS animations. Startup JS 1,663 KB → 792 KB; JS evaluation 3.4 → 2.1 s.
6b. **Prefetch timing** — lazy screens prefetch on hover/focus of their nav link and ~4 s after the library settles (not during startup, where it competed with the first screen).
7. **Custom SVG chart** instead of recharts (one chart used it); Settings back in the main bundle (27 KB). Insights 6.6 → 3.2 s; Settings 0.83 → 0.44 s; JS shipped −350 KB.

## Final — full speed on this PC (no throttling, 10k posts)

| Interaction | Time |
|---|---|
| First content on screen | **1.09 s** (full library streamed in by 1.95 s) |
| Switch → Library / Category | **199 / 168 ms** |
| Switch → Home | **254 ms** |
| Switch → Insights | **452 ms** |
| Switch → Settings | **50 ms** |
| Star a post | **79 ms** |
| Search, per keystroke | **108 ms** median |
| Scrolling | **59.5 FPS, p95 frame 16.8 ms, 0 janky frames** |
| Jump to the oldest post | **81 ms** |
| Popup (preview harness) | **1.14 s** |

Real extension bundles: dashboard startup JS **749 KB** (was ≈1.57 MB), popup **408 KB**, AI SDK (310 KB) and Insights (15 KB) on demand; Chrome zip **624 KB** (was 771 KB).

*Update:* AI now runs on NVIDIA's free OpenAI-compatible API through a small `fetch` client. The on-demand AI chunk shrank from 310 KB to **4 KB**, and the Chrome zip from 624 KB to **554 KB**.

## After the redesign and new features (October 27, 2026)

The interface was redesigned and Recall, Shelf, Ask, Wrapped, voice search, translation and nine UI languages were added. The same benchmark (`node bench/run.mjs <label> --runs 3 --cpu 1`, 10,000 posts, full speed on this PC) was rerun to check for regressions. Run-to-run noise is about ±20 %.

| Interaction | Before the redesign | After |
|---|---:|---:|
| Library on screen | 1,086 ms | **1,029 ms** |
| Full library loaded | 1,947 ms | **1,571 ms** |
| Main-thread long tasks at startup | 669 ms | **609 ms** |
| Switch → Home | 254 ms | **170 ms** |
| Switch → Insights | 452 ms | **409 ms** |
| Switch → Library | 199 ms | 237 ms |
| Switch → Settings | 50 ms | 109 ms |
| Star a post | 79 ms | **75 ms** |
| Search, per keystroke | 108 ms | 131 ms |
| Scrolling | 59.5 FPS, p95 16.8 ms | 58 FPS, p95 17 ms, 0 janky frames |
| Jump to the oldest post | 81 ms | **80 ms** |
| Total JS shipped (all lazy chunks included) | 1,157 KB | 1,423 KB |

Startup did not regress; the new screens and language packs load on demand. Settings and search are slightly slower (the redesigned settings page renders more rows; search now also matches Indian scripts).

**50,000 posts** (same benchmark, `--n 50000 --runs 1`): library on screen **1.0 s**, full library loaded **3.8 s**, search **250 ms** per keystroke, star **204 ms**, scrolling **55 FPS** (p95 33 ms), oldest post **145 ms**, JS heap **112 MB**.

## Known trade-offs / not fixed

- Under 4× throttling, scroll p95 frame (133 ms) is worse than the baseline's 33 ms: the baseline only scrolled through cards it had already rendered (and covered less distance), while virtualization mounts new cards as you go. At full speed scrolling is a locked 60 FPS.
- The full library still takes about as long to finish loading as before (18.3 s vs 19.8 s at 4×) — the win is that the first screen appears ~3.3× sooner and the UI stays responsive while the rest streams in.
- The popup number is measured in the preview harness, which loads the whole dashboard bundle; the real popup ships less than half the JS.
