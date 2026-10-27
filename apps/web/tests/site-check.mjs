#!/usr/bin/env node
/**
 * twtdash website check: a re-runnable end-to-end QA pass over the marketing
 * site and the hosted API.
 *
 *   node tests/site-check.mjs [baseUrl]        (default http://localhost:3302)
 *
 * Run it against a production build (`npx next build && npx next start -p 3302`).
 * Exit code is 1 when any check fails. Results: tests/results/site-check.json.
 *
 * Page matrix — every page × dark/light × desktop 1440×900 / phone 390×844:
 *   HTTP 200 · no console/page errors · no failed same-origin requests ·
 *   no unused preloads · no horizontal overflow ·
 *   axe-core WCAG 2.1 AA (no critical/serious; also with the mobile menu open
 *   and with ₹ + monthly selected) ·
 *   SEO basics · image alt text · accessible names for links and buttons.
 * Site-wide: internal links and #anchors resolve, sitemap/robots, 404 page.
 * Functional: ₹/$ and monthly/yearly toggles (+ persistence), India detection
 *   by time zone, language switcher, FAQ keyboard + expanded state, mobile
 *   menu, install-page downloads.
 * API: /api/health shape, CORS preflight, auth, malformed/oversized bodies,
 *   wrong methods, unknown routes, no 500s, no HTML or stack traces.
 *
 * Optional environment:
 *   SITE_CHECK_DEV_LICENSE  the server's TWTDASH_DEV_LICENSE (test value), so
 *                           body validation behind auth on /api/categorize and
 *                           /api/ask is exercised too.
 *   SITE_CHECK_CONCURRENCY  parallel pages for the matrix (default 4).
 *   CHROME_PATH             Chrome executable (default: the Windows install path).
 *
 * Dependencies are borrowed from apps/extension/node_modules (puppeteer-core,
 * axe-core) so the web app needs no extra installs.
 */

import { createRequire } from "node:module";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const extensionRequire = createRequire(resolve(here, "../../extension/package.json"));
const puppeteer = extensionRequire("puppeteer-core");
const AXE_SOURCE = readFileSync(extensionRequire.resolve("axe-core/axe.min.js"), "utf8");

const BASE = (process.argv[2] || "http://localhost:3302").replace(/\/+$/, "");
const ORIGIN = new URL(BASE).origin;
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const CONCURRENCY = Math.max(1, Number(process.env.SITE_CHECK_CONCURRENCY) || 4);
const DEV_LICENSE = process.env.SITE_CHECK_DEV_LICENSE?.trim() || "";
const RESULTS_DIR = join(here, "results");

/** Production origin baked into canonical / og:image URLs; mapped onto BASE for fetching. */
const PROD_ORIGINS = new Set(["https://twtdash.vercel.app"]);

const PAGES = [
  { path: "/", lang: "en", hreflang: true },
  { path: "/install", lang: "en" },
  { path: "/privacy", lang: "en" },
  { path: "/terms", lang: "en" },
  { path: "/hi", lang: "hi", hreflang: true },
  { path: "/hi/install", lang: "hi" },
];
const SCHEMES = ["dark", "light"];
const VIEWPORTS = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  phone: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/* -------------------------------------------------------------------------- */
/* Result bookkeeping                                                          */
/* -------------------------------------------------------------------------- */

const results = [];

/** Record one check. status: "pass" | "fail" | "warn". */
function record(group, name, status, details = "", context = {}) {
  results.push({ group, name, status, details: typeof details === "string" ? details : JSON.stringify(details), ...context });
}
const check = (group, name, ok, details, context) => record(group, name, ok ? "pass" : "fail", ok ? "" : details, context);

function toBaseUrl(url) {
  const u = new URL(url, BASE);
  if (PROD_ORIGINS.has(u.origin)) return `${BASE}${u.pathname}${u.search}`;
  return u.href;
}

function isInternal(url) {
  const u = new URL(url, BASE);
  return u.origin === ORIGIN || PROD_ORIGINS.has(u.origin);
}

const fetchCache = new Map();
/** GET once per URL (the response body is read so the connection is released). */
function cachedGet(url) {
  if (!fetchCache.has(url)) {
    fetchCache.set(
      url,
      fetch(url, { redirect: "follow" })
        .then(async (res) => ({ status: res.status, type: res.headers.get("content-type") || "", url: res.url, body: await res.text() }))
        .catch((err) => ({ status: 0, type: "", url, body: "", error: String(err) })),
    );
  }
  return fetchCache.get(url);
}

async function pool(items, limit, worker) {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) await worker(queue.shift());
  });
  await Promise.all(runners);
}

/* -------------------------------------------------------------------------- */
/* Browser helpers                                                             */
/* -------------------------------------------------------------------------- */

async function newPage(context, { viewport = "desktop", scheme = "dark", timezone = "America/New_York" } = {}) {
  const page = await context.newPage();
  await page.setViewport(VIEWPORTS[viewport]);
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);
  await page.emulateTimezone(timezone);
  await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });
  page.setDefaultTimeout(20_000);
  return page;
}

/** Collects console errors, uncaught exceptions and failed same-origin requests. */
function watch(page) {
  const log = { console: [], pageErrors: [], failed: [], aborted: [], unusedPreloads: [] };
  page.on("console", (msg) => {
    if (msg.type() === "error") log.console.push(`${msg.text()} ${msg.location()?.url ?? ""}`.trim());
    // Chrome warns ~3 s after load when a <link rel=preload> resource went unused (wasted bandwidth).
    if (/preloaded using link preload but not used/i.test(msg.text())) log.unusedPreloads.push(msg.text().slice(0, 200));
  });
  page.on("pageerror", (err) => log.pageErrors.push(String(err?.message ?? err)));
  page.on("response", (res) => {
    if (new URL(res.url()).origin === ORIGIN && res.status() >= 400) log.failed.push(`${res.status()} ${res.url()}`);
  });
  page.on("requestfailed", (req) => {
    if (new URL(req.url()).origin !== ORIGIN) return;
    const reason = req.failure()?.errorText ?? "failed";
    (reason === "net::ERR_ABORTED" ? log.aborted : log.failed).push(`${reason} ${req.url()}`);
  });
  return log;
}

async function waitForHydration(page, selector) {
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      return Boolean(el && Object.keys(el).some((k) => k.startsWith("__reactFiber") || k.startsWith("__reactProps")));
    },
    { timeout: 15_000 },
    selector,
  );
}

/** Scroll the whole page so reveal-on-scroll and lazy sections render, then go back up. */
async function scrollThrough(page) {
  await page.evaluate(async () => {
    const step = Math.max(200, Math.floor(window.innerHeight * 0.7));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo({ top: y, behavior: "instant" });
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
    await new Promise((r) => setTimeout(r, 150));
    window.scrollTo({ top: 0, behavior: "instant" });
    // Reveal animations are 0.45s plus small stagger delays.
    await new Promise((r) => setTimeout(r, 900));
  });
}

async function runAxe(page) {
  if (!(await page.evaluate(() => Boolean(window.axe)))) await page.evaluate(AXE_SOURCE);
  return page.evaluate(async (tags) => {
    // Render every content-visibility:auto section so contrast is computed everywhere (stricter, not looser).
    const style = document.createElement("style");
    style.textContent = ".cv-auto{content-visibility:visible!important}";
    document.head.appendChild(style);
    try {
      // Sections that were skipped restyle now; let their color transitions settle before measuring.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await Promise.race([Promise.allSettled(document.getAnimations().map((a) => a.finished)), new Promise((r) => setTimeout(r, 2000))]);
      const r = await window.axe.run(document, { runOnly: { type: "tag", values: tags }, resultTypes: ["violations"] });
      return r.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.slice(0, 5).map((n) => ({ target: n.target.join(" "), summary: (n.failureSummary || "").slice(0, 300) })),
        count: v.nodes.length,
      }));
    } finally {
      style.remove();
    }
  }, AXE_TAGS);
}

/** axe in an interactive state (menu open, toggles flipped…), in both color schemes. Leaves the page dark. */
async function axeInBothSchemes(page, group, name, ctx) {
  for (const scheme of SCHEMES) {
    // runAxe waits for the color transitions this live theme switch starts.
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);
    const severe = (await runAxe(page)).filter((v) => v.impact === "critical" || v.impact === "serious");
    check(group, `${name}: axe WCAG 2.1 AA (critical/serious)`, severe.length === 0, severe, { ...ctx, scheme });
  }
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
}

/** Links/buttons/images without an accessible name, from Chrome's computed accessibility tree. */
async function unnamedControls(page) {
  const cdp = await page.createCDPSession();
  try {
    await cdp.send("Accessibility.enable");
    const { nodes } = await cdp.send("Accessibility.getFullAXTree");
    const bad = [];
    for (const n of nodes) {
      if (n.ignored) continue;
      const role = n.role?.value;
      if (!["link", "button", "image", "img", "menuitem", "tab", "checkbox", "switch", "DisclosureTriangle"].includes(role)) continue;
      const name = String(n.name?.value ?? "").trim();
      if (name) continue;
      let html = "";
      if (n.backendDOMNodeId) {
        try {
          const { object } = await cdp.send("DOM.resolveNode", { backendNodeId: n.backendDOMNodeId });
          const { result } = await cdp.send("Runtime.callFunctionOn", {
            objectId: object.objectId,
            functionDeclaration: "function(){return (this.outerHTML||String(this)).slice(0,160)}",
            returnByValue: true,
          });
          html = result.value;
        } catch {
          // Node went away; the role is still reported.
        }
      }
      bad.push(`${role}: ${html}`);
    }
    return bad;
  } finally {
    await cdp.detach().catch(() => {});
  }
}

/* -------------------------------------------------------------------------- */
/* Page matrix                                                                 */
/* -------------------------------------------------------------------------- */

/** Rendered DOM data per page path (ids for anchor checks, hrefs for the crawl). */
const rendered = new Map();

async function checkPageCombo(browser, spec, scheme, viewport) {
  const ctx = { page: spec.path, scheme, viewport };
  const group = "page";
  const context = await browser.createBrowserContext();
  try {
    const page = await newPage(context, { viewport, scheme });
    const log = watch(page);
    const res = await page.goto(`${BASE}${spec.path}`, { waitUntil: "networkidle0", timeout: 45_000 });
    const loadedAt = Date.now();
    check(group, "HTTP 200", res?.status() === 200, `status ${res?.status()}`, ctx);

    await scrollThrough(page);

    // Overflow (after everything has rendered).
    const overflow = await page.evaluate(() => {
      const de = document.documentElement;
      const vw = window.innerWidth;
      const offenders = [];
      if (de.scrollWidth > vw + 1) {
        for (const el of document.body.querySelectorAll("*")) {
          const r = el.getBoundingClientRect();
          if (r.width && r.right > vw + 1) {
            let clipped = false;
            for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
              const ox = getComputedStyle(p).overflowX;
              if (ox !== "visible") {
                clipped = true;
                break;
              }
            }
            if (!clipped) offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} right=${Math.round(r.right)}`);
          }
          if (offenders.length >= 5) break;
        }
      }
      return { scrollWidth: de.scrollWidth, innerWidth: vw, offenders };
    });
    check(
      group,
      "no horizontal overflow",
      overflow.scrollWidth <= overflow.innerWidth + 1,
      `scrollWidth ${overflow.scrollWidth} > innerWidth ${overflow.innerWidth}; ${overflow.offenders.join(" | ")}`,
      ctx,
    );

    // axe-core WCAG 2.1 AA.
    const violations = await runAxe(page);
    const severe = violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    check(group, "axe WCAG 2.1 AA (critical/serious)", severe.length === 0, severe, ctx);
    const minor = violations.filter((v) => !(v.impact === "critical" || v.impact === "serious"));
    if (minor.length) record(group, "axe WCAG 2.1 AA (moderate/minor)", "warn", minor, ctx);

    // SEO basics.
    const seo = await page.evaluate(() => {
      const meta = (sel) => document.querySelector(sel)?.getAttribute("content")?.trim() ?? "";
      return {
        h1: document.querySelectorAll("h1").length,
        title: document.title.trim(),
        description: meta('meta[name="description"]'),
        canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? "",
        alternates: [...document.querySelectorAll('link[rel="alternate"][hreflang]')].map((l) => ({
          hreflang: l.getAttribute("hreflang"),
          href: l.getAttribute("href"),
        })),
        ogImage: meta('meta[property="og:image"]'),
        twitterImage: meta('meta[name="twitter:image"]'),
        lang: document.documentElement.lang,
        robots: meta('meta[name="robots"]'),
      };
    });
    check(group, "SEO: exactly one <h1>", seo.h1 === 1, `${seo.h1} <h1> elements`, ctx);
    check(group, "SEO: <title>", seo.title.length > 0, "empty <title>", ctx);
    check(group, "SEO: meta description", seo.description.length >= 50, `description "${seo.description}"`, ctx);
    let canonicalPath = "";
    try {
      canonicalPath = new URL(seo.canonical).pathname.replace(/\/$/, "") || "/";
    } catch {
      // Reported below.
    }
    check(group, "SEO: canonical", canonicalPath === spec.path, `canonical "${seo.canonical}" for ${spec.path}`, ctx);
    check(group, "SEO: html lang", seo.lang === spec.lang, `lang="${seo.lang}", expected "${spec.lang}"`, ctx);
    check(group, "SEO: indexable", !/noindex/i.test(seo.robots), `robots "${seo.robots}"`, ctx);
    if (spec.hreflang || seo.alternates.length) {
      const langs = new Set(seo.alternates.map((a) => a.hreflang));
      const missing = ["en-IN", "hi-IN", "x-default"].filter((l) => !langs.has(l));
      const targets = await Promise.all(seo.alternates.map(async (a) => ({ ...a, res: await cachedGet(toBaseUrl(a.href)) })));
      const broken = targets.filter((t) => t.res.status !== 200).map((t) => `${t.hreflang} ${t.href} → ${t.res.status}`);
      const selfRef = seo.alternates.some((a) => (new URL(a.href).pathname.replace(/\/$/, "") || "/") === spec.path);
      check(
        group,
        "SEO: hreflang alternates",
        missing.length === 0 && broken.length === 0 && selfRef,
        `missing ${missing.join(",") || "none"}; broken ${broken.join(",") || "none"}; self-reference ${selfRef}`,
        ctx,
      );
    }
    for (const [label, url] of [
      ["og:image", seo.ogImage],
      ["twitter:image", seo.twitterImage],
    ]) {
      if (!url) {
        check(group, `SEO: ${label}`, false, `no ${label}`, ctx);
        continue;
      }
      const r = await cachedGet(toBaseUrl(url));
      check(group, `SEO: ${label} returns 200`, r.status === 200 && r.type.startsWith("image/"), `${url} → ${r.status} ${r.type}`, ctx);
    }

    // Images and accessible names.
    const imgs = await page.evaluate(() =>
      [...document.querySelectorAll("img, input[type=image]")].filter((i) => !i.hasAttribute("alt")).map((i) => i.outerHTML.slice(0, 160)),
    );
    check(group, "images have alt text", imgs.length === 0, imgs, ctx);
    const unnamed = await unnamedControls(page);
    check(group, "links/buttons/images have accessible names", unnamed.length === 0, unnamed, ctx);

    // Collect DOM data for the link crawl (once per page path).
    if (!rendered.has(spec.path)) {
      const dom = await page.evaluate(() => ({
        ids: [...document.querySelectorAll("[id]")].map((e) => e.id),
        links: [...document.querySelectorAll("a[href], area[href]")].map((a) => ({ raw: a.getAttribute("href"), abs: a.href })),
      }));
      rendered.set(spec.path, dom);
    }

    // Let late requests (prefetches) and Chrome's unused-preload warning (~3 s after load) arrive, then judge.
    await new Promise((r) => setTimeout(r, Math.max(300, 3500 - (Date.now() - loadedAt))));
    check(group, "no unused preloads", log.unusedPreloads.length === 0, log.unusedPreloads, ctx);
    check(group, "no console errors", log.console.length === 0, log.console, ctx);
    check(group, "no page errors", log.pageErrors.length === 0, log.pageErrors, ctx);
    check(group, "no failed same-origin requests", log.failed.length === 0, log.failed, ctx);
    await page.close();
  } catch (err) {
    check(group, "page run", false, String(err?.stack ?? err), ctx);
  } finally {
    await context.close();
  }
}

/* -------------------------------------------------------------------------- */
/* Links & anchors                                                             */
/* -------------------------------------------------------------------------- */

async function idsOf(path) {
  if (rendered.has(path)) return new Set(rendered.get(path).ids);
  const r = await cachedGet(`${BASE}${path}`);
  return new Set([...r.body.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
}

async function checkLinks() {
  const group = "links";
  const targets = new Map(); // url (no hash) -> Set(source pages)
  const anchors = []; // { from, path, hash }
  const external = new Set();
  for (const [from, dom] of rendered) {
    for (const { raw, abs } of dom.links) {
      if (!raw || raw === "#") {
        check(group, "no empty href", false, `href="${raw}" on ${from}`, { page: from });
        continue;
      }
      if (/^javascript:/i.test(raw)) {
        check(group, "no javascript: links", false, `${raw} on ${from}`, { page: from });
        continue;
      }
      if (/^(mailto|tel):/i.test(raw)) continue;
      if (!isInternal(abs)) {
        external.add(abs);
        continue;
      }
      const url = new URL(toBaseUrl(abs));
      const key = `${url.origin}${url.pathname}${url.search}`;
      if (!targets.has(key)) targets.set(key, new Set());
      targets.get(key).add(from);
      if (url.hash && url.hash !== "#") anchors.push({ from, path: url.pathname.replace(/\/$/, "") || "/", hash: decodeURIComponent(url.hash.slice(1)) });
    }
  }

  for (const [url, from] of targets) {
    const r = await cachedGet(url);
    check(group, `internal link resolves: ${new URL(url).pathname}`, r.status === 200, `${r.status} ${r.error ?? ""} (linked from ${[...from].join(", ")})`, {
      page: [...from].join(", "),
    });
  }

  const seen = new Set();
  for (const a of anchors) {
    const key = `${a.path}#${a.hash}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const ids = await idsOf(a.path);
    check(group, `anchor exists: ${key}`, ids.has(a.hash), `#${a.hash} not found on ${a.path} (linked from ${a.from})`, { page: a.from });
  }
  record(group, "external links (not fetched)", "pass", [...external].sort().join(" "));
}

/* -------------------------------------------------------------------------- */
/* Site-wide extras: sitemap, robots, 404                                      */
/* -------------------------------------------------------------------------- */

async function checkSiteFiles(browser) {
  const group = "site";
  const sitemap = await cachedGet(`${BASE}/sitemap.xml`);
  const locs = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const paths = locs.map((l) => new URL(l).pathname.replace(/\/$/, "") || "/");
  const missing = PAGES.map((p) => p.path).filter((p) => !paths.includes(p));
  check(group, "sitemap.xml lists every page", sitemap.status === 200 && missing.length === 0, `status ${sitemap.status}; missing ${missing.join(", ")}`);
  const brokenLocs = [];
  for (const l of locs) {
    const r = await cachedGet(toBaseUrl(l));
    if (r.status !== 200) brokenLocs.push(`${l} → ${r.status}`);
  }
  check(group, "sitemap.xml URLs return 200", brokenLocs.length === 0, brokenLocs);

  const robots = await cachedGet(`${BASE}/robots.txt`);
  check(group, "robots.txt references the sitemap", robots.status === 200 && /sitemap:\s*\S+\/sitemap\.xml/i.test(robots.body), robots.body.slice(0, 300));
  check(group, "robots.txt keeps /api out of the index", /disallow:\s*\/api/i.test(robots.body), robots.body.slice(0, 300));

  // Unknown page: a real 404 with a working, accessible page.
  const context = await browser.createBrowserContext();
  try {
    const page = await newPage(context, { viewport: "phone", scheme: "light" });
    const log = watch(page);
    const res = await page.goto(`${BASE}/does-not-exist`, { waitUntil: "networkidle0" });
    check(group, "unknown page returns 404", res?.status() === 404, `status ${res?.status()}`);
    const info = await page.evaluate(() => ({
      h1: document.querySelectorAll("h1").length,
      robots: document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? "",
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      home: Boolean(document.querySelector('a[href="/"]')),
    }));
    check(group, "404 page: one <h1>, link home, noindex", info.h1 === 1 && info.home && /noindex/.test(info.robots), info);
    check(group, "404 page: no overflow", !info.overflow, "horizontal overflow");
    const severe = (await runAxe(page)).filter((v) => v.impact === "critical" || v.impact === "serious");
    check(group, "404 page: axe (critical/serious)", severe.length === 0, severe);
    const failed = log.failed.filter((f) => !f.includes("/does-not-exist"));
    const consoleErrs = log.console.filter((c) => !/404/.test(c));
    check(group, "404 page: no errors", consoleErrs.length === 0 && log.pageErrors.length === 0 && failed.length === 0, {
      console: consoleErrs,
      pageErrors: log.pageErrors,
      failed,
    });
  } finally {
    await context.close();
  }
}

/* -------------------------------------------------------------------------- */
/* Functional checks                                                           */
/* -------------------------------------------------------------------------- */

/** Prices currently visible in the pricing section. */
async function visiblePrices(page) {
  return page.evaluate(() => {
    const section = document.getElementById("pricing");
    section.scrollIntoView({ behavior: "instant", block: "center" });
    const text = section.innerText;
    return (text.match(/[₹$]\s?[\d,]+(?:\.\d+)?/g) || []).join(" ");
  });
}
const pressed = (page, sel) => page.$eval(sel, (el) => el.getAttribute("aria-pressed"));

async function periodButton(page, which) {
  const handles = await page.$$('#pricing [role="group"] button:not([data-cur-btn])');
  return handles[which === "monthly" ? 0 : 1];
}

async function checkPricing(browser) {
  const group = "functional";
  for (const viewport of ["desktop", "phone"]) {
    const ctx = { page: "/", viewport };
    const context = await browser.createBrowserContext();
    try {
      const page = await newPage(context, { viewport, timezone: "America/New_York" });
      const log = watch(page);
      await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
      await waitForHydration(page, "[data-cur-btn]");

      const usd = await visiblePrices(page);
      check(group, "pricing: $ shown by default outside India", /\$/.test(usd) && !/₹/.test(usd), usd, ctx);

      await page.click('[data-cur-btn="inr"]');
      const inr = await visiblePrices(page);
      check(group, "currency toggle: ₹ shows rupee prices", /₹/.test(inr) && !/\$/.test(inr), inr, ctx);
      check(group, "currency toggle: aria-pressed follows choice", (await pressed(page, '[data-cur-btn="inr"]')) === "true" && (await pressed(page, '[data-cur-btn="usd"]')) === "false", "aria-pressed mismatch", ctx);

      const yearly = await visiblePrices(page);
      await (await periodButton(page, "monthly")).click();
      const monthly = await visiblePrices(page);
      check(group, "period toggle: monthly changes prices", monthly !== yearly && /₹/.test(monthly), `yearly "${yearly}" vs monthly "${monthly}"`, ctx);
      const monthlyPressed = await (await periodButton(page, "monthly")).evaluate((b) => b.getAttribute("aria-pressed"));
      check(group, "period toggle: aria-pressed follows choice", monthlyPressed === "true", `aria-pressed=${monthlyPressed}`, ctx);
      await axeInBothSchemes(page, group, "pricing with ₹ + monthly selected", ctx);

      await page.reload({ waitUntil: "networkidle0" });
      await waitForHydration(page, "[data-cur-btn]");
      const afterReload = await visiblePrices(page);
      check(group, "currency choice persists after reload", /₹/.test(afterReload) && !/\$/.test(afterReload), afterReload, ctx);
      const periodAfter = await (await periodButton(page, "monthly")).evaluate((b) => b.getAttribute("aria-pressed"));
      check(group, "period choice persists after reload", afterReload === monthly && periodAfter === "true", `after reload "${afterReload}", expected "${monthly}" (monthly aria-pressed=${periodAfter})`, ctx);

      await page.click('[data-cur-btn="usd"]');
      await (await periodButton(page, "yearly")).click();
      const back = await visiblePrices(page);
      check(group, "toggles switch back to $ yearly", back === usd, `"${back}" vs initial "${usd}"`, ctx);
      check(group, "pricing: no errors", log.console.length === 0 && log.pageErrors.length === 0, { console: log.console, pageErrors: log.pageErrors }, ctx);
    } catch (err) {
      check(group, "pricing run", false, String(err?.stack ?? err), ctx);
    } finally {
      await context.close();
    }
  }
}

async function checkIndiaDetection(browser) {
  const group = "functional";
  for (const [timezone, want] of [
    ["Asia/Kolkata", "₹"],
    ["America/New_York", "$"],
  ]) {
    for (const path of ["/", "/install", "/#pricing"]) {
      const context = await browser.createBrowserContext();
      try {
        const page = await newPage(context, { timezone });
        await page.evaluateOnNewDocument(() => {
          document.addEventListener("DOMContentLoaded", () => {
            window.__currencyAtDcl = document.documentElement.getAttribute("data-currency");
          });
        });
        await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0" });
        // The time-zone check runs when the browser is idle (at most 1.5 s after load): let it settle.
        await new Promise((r) => setTimeout(r, 1800));
        const env = await page.evaluate(() => ({
          atDcl: window.__currencyAtDcl,
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
          langs: navigator.languages.join(","),
          cur: document.documentElement.getAttribute("data-currency"),
        }));
        if (/-IN\b/i.test(env.langs)) {
          check(group, "test environment: browser languages are not Indian", false, `navigator.languages=${env.langs}`);
        }
        const expected = want === "₹" ? "inr" : "usd";
        if (path === "/#pricing") {
          check(group, `India detection: ${timezone} → ${want} before first paint when opening /#pricing`, env.atDcl === expected, `data-currency at DOMContentLoaded=${env.atDcl}`, { page: path });
        }
        let shown = env.cur;
        if (path !== "/install") shown = (await visiblePrices(page)).includes(want) ? expected : `prices "${await visiblePrices(page)}"`;
        check(
          group,
          `India detection: ${timezone} → ${want} on ${path}`,
          env.cur === expected && shown === expected,
          `tz=${env.tz} langs=${env.langs} data-currency=${env.cur} shown=${shown}`,
          { page: path },
        );
      } finally {
        await context.close();
      }
    }
  }
}

async function visibleHandle(page, selector) {
  for (const h of await page.$$(selector)) {
    if (await h.isVisible()) return h;
  }
  return null;
}

async function checkLanguageSwitch(browser) {
  const group = "functional";
  for (const viewport of ["desktop", "phone"]) {
    const context = await browser.createBrowserContext();
    try {
      const page = await newPage(context, { viewport });
      for (const [from, to, hreflang] of [
        ["/", "/hi", "hi"],
        ["/hi", "/", "en"],
        ["/install", "/hi/install", "hi"],
        ["/hi/install", "/install", "en"],
      ]) {
        const ctx = { page: from, viewport };
        await page.goto(`${BASE}${from}`, { waitUntil: "networkidle0" });
        const link = await visibleHandle(page, `header a[hreflang="${hreflang}"]`);
        if (!link) {
          check(group, `language switcher ${from} → ${to}`, false, "no visible switcher link in the header", ctx);
          continue;
        }
        await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), link.click()]);
        const now = await page.evaluate(() => ({ path: location.pathname, lang: document.documentElement.lang }));
        check(group, `language switcher ${from} → ${to}`, now.path === to && now.lang === hreflang, now, ctx);
      }
    } catch (err) {
      check(group, "language switcher run", false, String(err?.stack ?? err), { viewport });
    } finally {
      await context.close();
    }
  }
}

async function axExpanded(page, handle) {
  const snap = await page.accessibility.snapshot({ root: handle, interestingOnly: false });
  return snap?.expanded === true;
}

async function checkFaq(browser) {
  const group = "functional";
  for (const path of ["/", "/hi"]) {
    const ctx = { page: path };
    const context = await browser.createBrowserContext();
    try {
      const page = await newPage(context, { viewport: "desktop" });
      await page.goto(`${BASE}${path}#faq`, { waitUntil: "networkidle0" });
      const items = await page.$$("#faq details");
      check(group, "FAQ: has items", items.length >= 3, `${items.length} items`, ctx);
      if (items.length < 2) continue;
      const summaries = await page.$$("#faq details > summary");
      const state = async (i) => ({
        open: await items[i].evaluate((d) => d.open),
        expanded: await axExpanded(page, summaries[i]),
        attr: await summaries[i].evaluate((s) => s.getAttribute("aria-expanded")),
      });
      const consistent = (s) => s.open === s.expanded && (s.attr === null || s.attr === String(s.open));

      const first = await state(0);
      check(group, "FAQ: first item open with expanded=true", first.open && consistent(first), first, ctx);
      const second = await state(1);
      check(group, "FAQ: other items closed with expanded=false", !second.open && consistent(second), second, ctx);

      await summaries[1].focus();
      await page.keyboard.press("Enter");
      await new Promise((r) => setTimeout(r, 150));
      const afterEnter = await state(1);
      check(group, "FAQ: Enter opens an item (expanded=true)", afterEnter.open && consistent(afterEnter), afterEnter, ctx);

      await page.keyboard.press("Space");
      await new Promise((r) => setTimeout(r, 150));
      const afterSpace = await state(1);
      check(group, "FAQ: Space closes it again (expanded=false)", !afterSpace.open && consistent(afterSpace), afterSpace, ctx);

      await page.keyboard.press("Space");
      await new Promise((r) => setTimeout(r, 150));
      const reopened = await state(1);
      check(group, "FAQ: Space opens it", reopened.open && consistent(reopened), reopened, ctx);

      const focusVisible = await summaries[1].evaluate((s) => s.matches(":focus-visible") && getComputedStyle(s).outlineStyle !== "none");
      check(group, "FAQ: keyboard focus is visible", focusVisible, "summary has no visible focus outline", ctx);
    } catch (err) {
      check(group, "FAQ run", false, String(err?.stack ?? err), ctx);
    } finally {
      await context.close();
    }
  }
}

async function checkMobileMenu(browser) {
  const group = "functional";
  for (const path of ["/", "/hi/install"]) {
    const ctx = { page: path, viewport: "phone" };
    const context = await browser.createBrowserContext();
    try {
      const page = await newPage(context, { viewport: "phone" });
      const log = watch(page);
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0" });
      const toggleSel = 'button[aria-controls="mobile-nav"]';
      await waitForHydration(page, toggleSel);
      const menuState = () =>
        page.evaluate((sel) => {
          const btn = document.querySelector(sel);
          const nav = document.getElementById("mobile-nav");
          return {
            expanded: btn.getAttribute("aria-expanded"),
            label: btn.getAttribute("aria-label"),
            visible: nav.checkVisibility(),
            focusInMenu: nav.contains(document.activeElement),
            focusOnToggle: document.activeElement === btn,
            active: document.activeElement?.outerHTML.slice(0, 80) ?? "",
            bodyOverflow: getComputedStyle(document.body).overflow + "/" + getComputedStyle(document.documentElement).overflow,
          };
        }, toggleSel);

      const closed = await menuState();
      check(group, "mobile menu: starts closed", closed.expanded === "false" && !closed.visible && Boolean(closed.label), closed, ctx);

      await page.click(toggleSel);
      const open = await menuState();
      check(group, "mobile menu: opens (aria-expanded=true, visible)", open.expanded === "true" && open.visible && open.label !== closed.label, open, ctx);
      check(group, "mobile menu: page scroll not locked", !/hidden/.test(open.bodyOverflow), open.bodyOverflow, ctx);
      await axeInBothSchemes(page, group, "mobile menu open", ctx);

      // Focus moves through the menu and out of it: nothing is trapped.
      const focusables = await page.$$eval("#mobile-nav a, #mobile-nav button", (els) => els.length);
      await page.focus(toggleSel);
      for (let i = 0; i < focusables; i++) await page.keyboard.press("Tab");
      const lastInMenu = await menuState();
      await page.keyboard.press("Tab");
      const outside = await menuState();
      check(group, "mobile menu: Tab walks the menu then leaves it (no trap)", lastInMenu.focusInMenu && !outside.focusInMenu && !outside.focusOnToggle, { lastInMenu: lastInMenu.active, after: outside.active }, ctx);

      // Escape from inside the menu closes it and returns focus to the toggle.
      await page.keyboard.down("Shift");
      await page.keyboard.press("Tab");
      await page.keyboard.up("Shift");
      await page.keyboard.press("Escape");
      const escaped = await menuState();
      check(group, "mobile menu: Escape closes and returns focus to the toggle", escaped.expanded === "false" && !escaped.visible && escaped.focusOnToggle, escaped, ctx);

      // Toggle button closes it too.
      await page.click(toggleSel);
      await page.click(toggleSel);
      const toggled = await menuState();
      check(group, "mobile menu: toggle button closes it", toggled.expanded === "false" && !toggled.visible, toggled, ctx);

      // Following a link closes the menu.
      await page.click(toggleSel);
      const firstLink = await page.$("#mobile-nav a");
      const href = await firstLink.evaluate((a) => a.getAttribute("href"));
      await firstLink.click();
      await new Promise((r) => setTimeout(r, 800));
      const afterNav = await menuState();
      check(group, `mobile menu: closes after following a link (${href})`, afterNav.expanded === "false" && !afterNav.visible, afterNav, ctx);
      check(group, "mobile menu: no errors", log.console.length === 0 && log.pageErrors.length === 0, { console: log.console, pageErrors: log.pageErrors }, ctx);
    } catch (err) {
      check(group, "mobile menu run", false, String(err?.stack ?? err), ctx);
    } finally {
      await context.close();
    }
  }
}

async function checkDownloads(browser) {
  const group = "functional";
  const expected = ["/downloads/twtdash-chrome.zip", "/downloads/twtdash-firefox.zip"];
  for (const path of ["/install", "/hi/install"]) {
    const context = await browser.createBrowserContext();
    try {
      const page = await newPage(context);
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0" });
      const hrefs = await page.$$eval('a[href$=".zip"]', (as) => as.map((a) => ({ href: a.getAttribute("href"), download: a.hasAttribute("download") })));
      const got = [...new Set(hrefs.map((h) => h.href))].sort();
      check(group, "install: download links point at the zips", JSON.stringify(got) === JSON.stringify(expected), got, { page: path });
      check(group, "install: download links carry the download attribute", hrefs.every((h) => h.download), hrefs, { page: path });
    } finally {
      await context.close();
    }
  }
  for (const file of expected) {
    const res = await fetch(`${BASE}${file}`);
    const type = res.headers.get("content-type") || "";
    const bytes = new Uint8Array(await res.arrayBuffer());
    const magic = bytes[0] === 0x50 && bytes[1] === 0x4b; // "PK"
    check(group, `download ${file}: 200, zip type, zip bytes`, res.status === 200 && /zip/.test(type) && magic, `${res.status} ${type} ${bytes.length}B magic=${magic}`);
  }
}

/* -------------------------------------------------------------------------- */
/* API                                                                         */
/* -------------------------------------------------------------------------- */

const API_ROUTES = ["/api/health", "/api/categorize", "/api/ask", "/api/license/activate", "/api/license/validate"];
const POST_ROUTES = API_ROUTES.slice(1);
const AUTH_ROUTES = ["/api/categorize", "/api/ask"];
const STACK_RE = /\n\s+at\s|\bat\s+\S+\s+\([^)]*:\d+:\d+\)|node_modules|webpack-internal|\.(?:ts|js|mjs):\d+:\d+|<!DOCTYPE|<html/i;

async function api(path, { method = "GET", headers = {}, body, duplex } = {}) {
  try {
    const res = await fetch(`${BASE}${path}`, { method, headers, body, duplex, redirect: "manual" });
    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      json = undefined;
    }
    return { status: res.status, headers: res.headers, type: res.headers.get("content-type") || "", text, json };
  } catch (err) {
    return { status: 0, headers: new Headers(), type: "", text: String(err), json: undefined };
  }
}

const isErrorBody = (r) => typeof r.json?.error?.code === "string" && typeof r.json?.error?.message === "string" && r.json.error.message.length > 0;
const short = (r) => `${r.status} ${r.type} ${r.text.slice(0, 200)}`;

/** Every API response, good or bad: no 5xx for bad input, JSON (or empty), no HTML, no stack trace. */
function checkClean(group, name, r, { allowStatuses } = {}) {
  const htmlish = /text\/html/i.test(r.type) || /<!DOCTYPE|<html/i.test(r.text);
  const ok =
    r.status !== 0 &&
    (allowStatuses ? allowStatuses.includes(r.status) : r.status < 500) &&
    !htmlish &&
    !STACK_RE.test(r.text) &&
    (r.text === "" || /application\/json/i.test(r.type));
  check(group, name, ok, short(r));
}

async function checkApi() {
  const group = "api";
  const json = { "content-type": "application/json" };
  const auth = DEV_LICENSE ? { authorization: `Bearer ${DEV_LICENSE}`, "x-twtdash-instance": "site-check" } : null;

  // Health.
  const health = await api("/api/health");
  check(
    group,
    "GET /api/health → {ok:true, ai:boolean, licensing:boolean}",
    health.status === 200 && /application\/json/.test(health.type) && health.json?.ok === true && typeof health.json?.ai === "boolean" && typeof health.json?.licensing === "boolean",
    short(health),
  );
  check(group, "GET /api/health is not cached", /no-store/.test(health.headers.get("cache-control") || ""), health.headers.get("cache-control"));
  check(group, "GET /api/health sends CORS headers", health.headers.get("access-control-allow-origin") === "*", health.headers.get("access-control-allow-origin"));

  // CORS preflight on every route.
  for (const route of API_ROUTES) {
    const r = await api(route, {
      method: "OPTIONS",
      headers: {
        origin: "chrome-extension://abcdefghijklmnopabcdefghijklmnop",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type,authorization,x-twtdash-instance",
      },
    });
    const allowHeaders = (r.headers.get("access-control-allow-headers") || "").toLowerCase();
    const allowMethods = (r.headers.get("access-control-allow-methods") || "").toUpperCase();
    check(
      group,
      `OPTIONS ${route} → CORS preflight`,
      (r.status === 204 || r.status === 200) &&
        r.headers.get("access-control-allow-origin") === "*" &&
        allowMethods.includes("POST") &&
        ["content-type", "authorization", "x-twtdash-instance"].every((h) => allowHeaders.includes(h)),
      `${r.status} ACAO=${r.headers.get("access-control-allow-origin")} ACAM=${allowMethods} ACAH=${allowHeaders}`,
    );
  }

  // Auth on the Pro endpoints.
  const minimalCategorize = JSON.stringify({ categories: [{ id: "a", name: "A" }], tweets: [{ id: "1", author: "x", text: "hi" }] });
  for (const route of AUTH_ROUTES) {
    const noAuth = await api(route, { method: "POST", headers: json, body: minimalCategorize });
    check(group, `POST ${route} without auth → 401 {error:{code,message}}`, noAuth.status === 401 && isErrorBody(noAuth), short(noAuth));
    check(group, `POST ${route} 401 carries CORS headers`, noAuth.headers.get("access-control-allow-origin") === "*", noAuth.headers.get("access-control-allow-origin"));
    const noInstance = await api(route, { method: "POST", headers: { ...json, authorization: "Bearer not-a-real-key" }, body: minimalCategorize });
    check(group, `POST ${route} without instance header → 401`, noInstance.status === 401 && isErrorBody(noInstance), short(noInstance));
    const badScheme = await api(route, { method: "POST", headers: { ...json, authorization: "Basic Zm9vOmJhcg==", "x-twtdash-instance": "x" }, body: minimalCategorize });
    check(group, `POST ${route} with a non-Bearer scheme → 401`, badScheme.status === 401 && isErrorBody(badScheme), short(badScheme));
    const hugeKey = await api(route, { method: "POST", headers: { ...json, authorization: `Bearer ${"k".repeat(5000)}`, "x-twtdash-instance": "x" }, body: minimalCategorize });
    check(group, `POST ${route} with an absurd key → 401`, hugeKey.status === 401 && isErrorBody(hugeKey), short(hugeKey));
    // Junk credentials: the license check answers (401 invalid, or 502 if the license server is unreachable), never a 500.
    const junk = await api(route, { method: "POST", headers: { ...json, authorization: "Bearer junk-license-key", "x-twtdash-instance": "junk" }, body: minimalCategorize });
    checkClean(group, `POST ${route} with junk credentials → clean JSON error`, junk, { allowStatuses: [401, 502] });
    check(group, `POST ${route} with junk credentials → error body`, isErrorBody(junk), short(junk));
  }

  // Bad bodies. Every POST route must answer 400/401/413 with JSON — never 500, never HTML.
  const big = JSON.stringify({ licenseKey: "x", instanceName: "y", pad: "a".repeat(2_100_000) });
  const badBodies = [
    ["malformed JSON", "{not json"],
    ["truncated JSON", '{"licenseKey": "abc"'],
    ["empty body", ""],
    ["JSON array", "[1,2,3]"],
    ["JSON string", '"hello"'],
    ["JSON null", "null"],
    ["wrong field types", JSON.stringify({ licenseKey: 42, instanceName: ["x"], categories: "nope", tweets: {}, question: 7 })],
    ["deeply nested JSON", `${"[".repeat(5000)}${"]".repeat(5000)}`],
    ["invalid UTF-8", Buffer.from([0x7b, 0x22, 0xff, 0xfe, 0x22, 0x3a, 0x31, 0x7d])],
  ];
  for (const route of POST_ROUTES) {
    const headerSets = !AUTH_ROUTES.includes(route)
      ? [["", json]]
      : [...(auth ? [["authorized", { ...json, ...auth }]] : []), ["unauthenticated", json]];
    for (const [who, headers] of headerSets) {
      const tag = who ? ` (${who})` : "";
      const expect400 = !AUTH_ROUTES.includes(route) || who === "authorized";
      for (const [label, body] of badBodies) {
        const r = await api(route, { method: "POST", headers, body });
        checkClean(group, `POST ${route} ${label}${tag} → clean 4xx`, r, { allowStatuses: expect400 ? [400] : [400, 401] });
        if (r.status >= 400) check(group, `POST ${route} ${label}${tag} → error body`, isErrorBody(r), short(r));
      }
      // Oversized: declared length and streamed (chunked, no content-length).
      const declared = await api(route, { method: "POST", headers, body: big });
      checkClean(group, `POST ${route} oversized body${tag} → 400/413`, declared, { allowStatuses: expect400 ? [400, 413] : [400, 401, 413] });
      // A 64 MB chunked upload must be refused once it passes the cap, not buffered in full.
      let pulled = 0;
      const chunk = new TextEncoder().encode("a".repeat(64 * 1024));
      const stream = new ReadableStream({
        pull(controller) {
          if (pulled >= 64 * 1024 * 1024) return controller.close();
          pulled += chunk.byteLength;
          controller.enqueue(chunk);
        },
      });
      const chunked = await api(route, { method: "POST", headers, body: stream, duplex: "half" });
      checkClean(group, `POST ${route} oversized chunked body${tag} → 400/413`, chunked, { allowStatuses: expect400 ? [400, 413] : [400, 401, 413] });
      check(
        group,
        `POST ${route} oversized chunked body${tag} is cut off early`,
        pulled < 8 * 1024 * 1024,
        `server read ${(pulled / 1048576).toFixed(1)} MB of a 64 MB upload before answering`,
      );
    }
  }

  // Authorized but semantically invalid payloads (needs the server's dev license).
  if (auth) {
    for (const [route, body] of [
      ["/api/categorize", { categories: [], tweets: [] }],
      ["/api/categorize", { categories: [{ id: "a", name: "A" }], tweets: Array.from({ length: 500 }, (_, i) => ({ id: String(i), author: "", text: "" })) }],
      ["/api/ask", { question: "" }],
      ["/api/ask", { question: "q".repeat(100_000), posts: [] }],
      ["/api/ask", { mode: "translate" }],
    ]) {
      const r = await api(route, { method: "POST", headers: { ...json, ...auth }, body: JSON.stringify(body) });
      checkClean(group, `POST ${route} invalid payload (authorized) → 400`, r, { allowStatuses: [400] });
    }
  } else {
    record(group, "authorized body validation (/api/categorize, /api/ask)", "warn", "skipped: set SITE_CHECK_DEV_LICENSE to the server's TWTDASH_DEV_LICENSE");
  }

  // License endpoints with junk keys: a clean JSON answer.
  const activate = await api("/api/license/activate", { method: "POST", headers: json, body: JSON.stringify({ licenseKey: "JUNK-0000-0000-0000", instanceName: "site-check" }) });
  checkClean(group, "POST /api/license/activate with a junk key → clean JSON", activate, { allowStatuses: [200, 400, 401, 502] });
  check(
    group,
    "POST /api/license/activate with a junk key → valid:false or an error body",
    activate.json?.valid === false || isErrorBody(activate),
    short(activate),
  );
  const validate = await api("/api/license/validate", { method: "POST", headers: json, body: JSON.stringify({ licenseKey: "JUNK-0000-0000-0000", instanceId: "nope" }) });
  checkClean(group, "POST /api/license/validate with a junk key → clean JSON", validate, { allowStatuses: [200, 400, 401, 502] });
  check(group, "POST /api/license/validate with a junk key → valid:false or an error body", validate.json?.valid === false || isErrorBody(validate), short(validate));
  const longKey = await api("/api/license/activate", { method: "POST", headers: json, body: JSON.stringify({ licenseKey: "x".repeat(5000), instanceName: "y" }) });
  checkClean(group, "POST /api/license/activate with a 5,000-char key → 400", longKey, { allowStatuses: [400] });

  // Wrong methods and unknown routes.
  for (const route of POST_ROUTES) {
    for (const method of ["GET", "PUT", "DELETE", "PATCH"]) {
      const r = await api(route, { method, headers: method === "GET" ? {} : json, body: method === "GET" ? undefined : "{}" });
      checkClean(group, `${method} ${route} → 405, no HTML`, r, { allowStatuses: [405] });
    }
  }
  const healthPost = await api("/api/health", { method: "POST", headers: json, body: "{}" });
  checkClean(group, "POST /api/health → 405, no HTML", healthPost, { allowStatuses: [405] });
  for (const route of ["/api/does-not-exist", "/api/license", "/api/license/does-not-exist"]) {
    for (const method of ["GET", "POST"]) {
      const r = await api(route, { method, headers: method === "POST" ? json : {}, body: method === "POST" ? "{}" : undefined });
      checkClean(group, `${method} ${route} → JSON 404`, r, { allowStatuses: [404] });
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Output                                                                      */
/* -------------------------------------------------------------------------- */

const pad = (s, n) => String(s).padEnd(n).slice(0, n);
const mark = (s) => (s === "pass" ? "PASS" : s === "fail" ? "FAIL" : "warn");

function printReport(durationMs) {
  const pass = results.filter((r) => r.status === "pass").length;
  const fail = results.filter((r) => r.status === "fail").length;
  const warn = results.filter((r) => r.status === "warn").length;

  // Page matrix: one row per page × scheme × viewport, one column per check family.
  const families = [
    ["HTTP", (n) => n === "HTTP 200"],
    ["console", (n) => n === "no console errors" || n === "no page errors"],
    ["requests", (n) => n === "no failed same-origin requests" || n === "no unused preloads"],
    ["overflow", (n) => n === "no horizontal overflow"],
    ["axe", (n) => n === "axe WCAG 2.1 AA (critical/serious)"],
    ["SEO", (n) => n.startsWith("SEO:")],
    ["names/alt", (n) => n.startsWith("images") || n.startsWith("links/buttons")],
  ];
  const rows = results.filter((r) => r.group === "page");
  const order = (p) => PAGES.findIndex((x) => x.path === p);
  const combos = [...new Set(rows.map((r) => `${r.page}|${r.scheme}|${r.viewport}`))].sort((a, b) => {
    const [pa, ...ra] = a.split("|");
    const [pb, ...rb] = b.split("|");
    return order(pa) - order(pb) || ra.join().localeCompare(rb.join());
  });
  console.log("\nPage matrix");
  console.log(`${pad("page", 13)}${pad("scheme", 7)}${pad("viewport", 9)}${families.map(([f]) => pad(f, 10)).join("")}`);
  for (const combo of combos) {
    const [p, s, v] = combo.split("|");
    const mine = rows.filter((r) => r.page === p && r.scheme === s && r.viewport === v);
    const cells = families.map(([, match]) => {
      const rs = mine.filter((r) => match(r.name));
      if (!rs.length) return "-";
      return rs.some((r) => r.status === "fail") ? "FAIL" : "PASS";
    });
    const crashed = mine.some((r) => r.name === "page run" && r.status === "fail");
    console.log(`${pad(p, 13)}${pad(s, 7)}${pad(v, 9)}${cells.map((c) => pad(crashed ? "CRASH" : c, 10)).join("")}`);
  }

  for (const group of ["links", "site", "functional", "api"]) {
    const rs = results.filter((r) => r.group === group);
    if (!rs.length) continue;
    const gp = rs.filter((r) => r.status === "pass").length;
    console.log(`\n${group} (${gp}/${rs.length} pass)`);
    for (const r of rs) {
      const where = [r.page, r.viewport].filter(Boolean).join(" ");
      console.log(`  ${mark(r.status)}  ${r.name}${where ? `  [${where}]` : ""}`);
    }
  }

  const failures = results.filter((r) => r.status === "fail");
  if (failures.length) {
    console.log("\nFailures");
    for (const r of failures) {
      const where = [r.page, r.scheme, r.viewport].filter(Boolean).join(" ");
      console.log(`  - [${r.group}] ${r.name}${where ? ` (${where})` : ""}\n      ${r.details.slice(0, 2500)}`);
    }
  }
  console.log(`\n${pass} passed, ${fail} failed, ${warn} warnings in ${(durationMs / 1000).toFixed(1)}s`);
  return { pass, fail, warn };
}

/* -------------------------------------------------------------------------- */
/* Main                                                                        */
/* -------------------------------------------------------------------------- */

async function main() {
  const started = Date.now();
  const up = await api("/api/health");
  if (up.status === 0) {
    console.error(`Cannot reach ${BASE}. Start the site first: npx next build && npx next start -p 3302`);
    process.exit(2);
  }

  const profile = mkdtempSync(join(tmpdir(), "twtdash-site-check-"));
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    userDataDir: profile,
    args: ["--no-first-run", "--no-default-browser-check", "--lang=en-US", "--accept-lang=en-US", "--disable-features=Translate", "--hide-scrollbars"],
  });
  let summary;
  try {
    const version = await browser.version();
    console.log(`site-check ${BASE} · ${version}`);

    const combos = [];
    for (const spec of PAGES) for (const scheme of SCHEMES) for (const viewport of Object.keys(VIEWPORTS)) combos.push([spec, scheme, viewport]);
    let done = 0;
    await pool(combos, CONCURRENCY, async ([spec, scheme, viewport]) => {
      await checkPageCombo(browser, spec, scheme, viewport);
      done++;
      process.stdout.write(`\r  page matrix ${done}/${combos.length}`);
    });
    process.stdout.write("\n");

    await checkLinks();
    await checkSiteFiles(browser);
    console.log("  functional checks…");
    await checkPricing(browser);
    await checkIndiaDetection(browser);
    await checkLanguageSwitch(browser);
    await checkFaq(browser);
    await checkMobileMenu(browser);
    await checkDownloads(browser);
    console.log("  API checks…");
    await checkApi();

    const durationMs = Date.now() - started;
    summary = printReport(durationMs);
    mkdirSync(RESULTS_DIR, { recursive: true });
    writeFileSync(
      join(RESULTS_DIR, "site-check.json"),
      `${JSON.stringify(
        {
          baseUrl: BASE,
          finishedAt: new Date().toISOString(),
          durationMs,
          browser: version,
          devLicenseChecks: Boolean(DEV_LICENSE),
          summary: { total: results.length, passed: summary.pass, failed: summary.fail, warnings: summary.warn },
          checks: results,
        },
        null,
        2,
      )}\n`,
    );
    console.log(`Results written to ${join(RESULTS_DIR, "site-check.json")}`);
  } finally {
    await browser.close();
    rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  }
  process.exit(summary.fail ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
