import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ArrowRight, Download, Globe, Info, LifeBuoy, Puzzle } from "lucide-react";
import { CopyCode } from "@/components/install/copy-button";
import { Aurora } from "@/components/ui/aurora";
import { Eyebrow } from "@/components/ui/section-heading";
import { ButtonLink } from "@/components/ui/button-link";
import { pageMetadata } from "@/lib/metadata";
import { CHROME_STORE_URL, DOWNLOADS, FIREFOX_ADDON_URL, SUPPORT_LABEL, SUPPORT_URL } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Install",
  description:
    "Install twtdash in Chrome, Edge, Brave, Arc, Opera or Firefox, then run your first sync of your X bookmarks in a couple of clicks.",
  path: "/install",
});

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="group/step relative flex gap-4 pb-9 last:pb-0 sm:gap-5">
      <div
        aria-hidden="true"
        className="absolute bottom-0 left-[1.0625rem] top-10 w-px bg-[linear-gradient(180deg,rgb(139_109_255/0.35),rgb(255_255_255/0.06))] group-last/step:hidden"
      />
      <span
        aria-hidden="true"
        className="icon-tile-soft relative flex size-[2.125rem] shrink-0 items-center justify-center rounded-full font-mono text-sm font-medium text-white"
      >
        {n}
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <h3 className="font-semibold text-white">{title}</h3>
        <div className="mt-2 space-y-3 text-[0.9375rem] leading-relaxed text-zinc-400">{children}</div>
      </div>
    </li>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4 text-sm leading-relaxed text-zinc-400">
      <Info className="mt-0.5 size-4 shrink-0 text-brand-soft" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return <strong className="font-medium text-zinc-200">{children}</strong>;
}

export default function InstallPage() {
  const chromeHref = CHROME_STORE_URL || "#chrome";
  const firefoxHref = FIREFOX_ADDON_URL || "#firefox";
  const storesLive = Boolean(CHROME_STORE_URL || FIREFOX_ADDON_URL);

  return (
    <div className="relative isolate">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[36rem] overflow-hidden">
        <div className="bg-grid absolute inset-0" />
        <Aurora className="inset-x-[8%] -top-[60%] h-full opacity-60" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink to-transparent" />
      </div>

      <div className="container-page max-w-4xl py-16 sm:py-24">
        <header className="text-center">
          <Eyebrow>Install guide</Eyebrow>
          <h1 className="mt-5 text-balance text-[2.5rem] font-semibold leading-[1.05] tracking-[-0.04em] text-white sm:text-6xl">
            Get twtdash in{" "}
            <span className="text-brand-gradient pr-[0.08em] font-display text-[1.06em] font-normal italic tracking-[-0.01em]">a minute</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-zinc-400 sm:text-lg">
            twtdash works in Chrome, Edge, Brave, Arc, Opera and Firefox. No account, no API keys — install it, then run
            your first sync.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink href={chromeHref} size="lg" className="w-full sm:w-auto">
              <Puzzle className="size-[1.1rem]" aria-hidden="true" />
              {CHROME_STORE_URL ? "Add from Chrome Web Store" : "Install on Chrome"}
            </ButtonLink>
            <ButtonLink href={firefoxHref} size="lg" variant="secondary" className="w-full sm:w-auto">
              <Globe className="size-[1.1rem]" aria-hidden="true" />
              {FIREFOX_ADDON_URL ? "Add from Firefox Add-ons" : "Install on Firefox"}
            </ButtonLink>
          </div>
          <p className="mt-4 text-sm text-zinc-500">
            {storesLive
              ? "Prefer to install by hand? Manual steps are below."
              : "Store listings are on the way — until then, install manually with the steps below."}
          </p>
        </header>

        <div className="mt-16 grid gap-4 sm:grid-cols-2">
          <div className="panel p-5 transition-colors hover:border-white/[0.12]">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Chromium browsers</p>
            <p className="mt-2 text-white">Chrome, Edge, Brave, Arc &amp; Opera</p>
            <p className="mt-1 text-sm text-zinc-400">Use the Chrome build.</p>
          </div>
          <div className="panel p-5 transition-colors hover:border-white/[0.12]">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Firefox</p>
            <p className="mt-2 text-white">Firefox (desktop)</p>
            <p className="mt-1 text-sm text-zinc-400">Use the Firefox build.</p>
          </div>
        </div>

        {/* Chrome / Chromium */}
        <section id="chrome" aria-labelledby="chrome-title" className="mt-20 scroll-mt-24">
          <h2 id="chrome-title" className="text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">
            Manual install: Chrome, Edge, Brave, Arc &amp; Opera
          </h2>
          <p className="mt-3 text-zinc-400">Load twtdash as an unpacked extension. It takes about a minute.</p>
          <ol className="panel mt-8 p-6 sm:p-8">
            <Step n={1} title="Download the Chrome build">
              <p>
                <ButtonLink href={DOWNLOADS.chrome} download variant="secondary" size="sm">
                  <Download className="size-4" aria-hidden="true" />
                  twtdash-chrome.zip
                </ButtonLink>
              </p>
            </Step>
            <Step n={2} title="Unzip it">
              <p>
                Extract the zip into a folder you&apos;ll keep, for example <code className="font-mono text-zinc-300">Documents/twtdash</code>.
                Your browser loads the extension from this folder, so don&apos;t delete it afterwards.
              </p>
            </Step>
            <Step n={3} title="Open the extensions page">
              <p>Paste this into the address bar:</p>
              <p>
                <CopyCode value="chrome://extensions" />
              </p>
              <p className="text-sm text-zinc-500">
                Edge, Brave and Opera also have their own address: <code className="font-mono">edge://extensions</code>,{" "}
                <code className="font-mono">brave://extensions</code>, <code className="font-mono">opera://extensions</code>.
              </p>
            </Step>
            <Step n={4} title="Turn on Developer mode">
              <p>
                Flip the <Kbd>Developer mode</Kbd> switch — it&apos;s in the top-right corner in Chrome (in Edge, look in the
                left sidebar).
              </p>
            </Step>
            <Step n={5} title="Click “Load unpacked”">
              <p>
                Choose <Kbd>Load unpacked</Kbd> and select the folder you unzipped — the one that contains{" "}
                <code className="font-mono text-zinc-300">manifest.json</code>.
              </p>
            </Step>
            <Step n={6} title="Pin twtdash">
              <p>
                Click the puzzle-piece icon in your toolbar and pin <Kbd>twtdash</Kbd> so it&apos;s always one click away.
              </p>
            </Step>
          </ol>
          <div className="mt-4">
            <Note>
              Manually installed extensions don&apos;t update automatically. To update, download the new zip, replace the
              folder&apos;s contents and click the reload icon on the twtdash card in <code className="font-mono">chrome://extensions</code>.
              Your library is kept.
            </Note>
          </div>
        </section>

        {/* Firefox */}
        <section id="firefox" aria-labelledby="firefox-title" className="mt-20 scroll-mt-24">
          <h2 id="firefox-title" className="text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">
            Manual install: Firefox
          </h2>
          <p className="mt-3 text-zinc-400">
            {FIREFOX_ADDON_URL ? (
              <>
                The easiest way is the{" "}
                <a href={FIREFOX_ADDON_URL} className="text-brand-soft underline decoration-brand-soft/40 underline-offset-2 hover:decoration-current">
                  signed add-on on Firefox Add-ons
                </a>
                . To try a build by hand, load it as a temporary add-on:
              </>
            ) : (
              "Until the signed add-on is available, load twtdash as a temporary add-on:"
            )}
          </p>
          <ol className="panel mt-8 p-6 sm:p-8">
            <Step n={1} title="Download the Firefox build">
              <p>
                <ButtonLink href={DOWNLOADS.firefox} download variant="secondary" size="sm">
                  <Download className="size-4" aria-hidden="true" />
                  twtdash-firefox.zip
                </ButtonLink>
              </p>
              <p>Unzip it into a folder you&apos;ll keep.</p>
            </Step>
            <Step n={2} title="Open the debugging page">
              <p>Paste this into the address bar:</p>
              <p>
                <CopyCode value="about:debugging#/runtime/this-firefox" />
              </p>
            </Step>
            <Step n={3} title="Click “Load Temporary Add-on…”">
              <p>
                Then pick the <code className="font-mono text-zinc-300">manifest.json</code> file inside the folder you
                unzipped. twtdash appears in your toolbar right away.
              </p>
            </Step>
          </ol>
          <div className="mt-4">
            <Note>
              Firefox removes temporary add-ons when it restarts. For a permanent install, use the signed <code className="font-mono">.xpi</code>{" "}
              when it&apos;s available{FIREFOX_ADDON_URL ? " from Firefox Add-ons" : ""} — opening it in Firefox installs twtdash for good.
            </Note>
          </div>
        </section>

        {/* First sync */}
        <section id="first-sync" aria-labelledby="sync-title" className="mt-20 scroll-mt-24">
          <h2 id="sync-title" className="text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">
            Your first sync
          </h2>
          <p className="mt-3 text-zinc-400">twtdash reads X&apos;s own page data, so there&apos;s no API key or paid X plan involved.</p>
          <ol className="panel mt-8 p-6 sm:p-8">
            <Step n={1} title="Log in to x.com">
              <p>Open x.com in the same browser and make sure you&apos;re signed in. twtdash never asks for your password.</p>
            </Step>
            <Step n={2} title="Click the twtdash icon → “Sync bookmarks”">
              <p>
                twtdash opens your X bookmarks and scrolls through them for you. Later on, a quick sync fetches only
                what&apos;s new and a full sync re-reads everything. You can import your Likes too.
              </p>
            </Step>
            <Step n={3} title="Keep the tab open while it scrolls">
              <p>
                Leave the X tab open until the sync finishes — large libraries can take a few minutes.
              </p>
            </Step>
            <Step n={4} title="Explore your library">
              <p>
                Open the dashboard to search, filter by category, tag and star. From now on, posts you bookmark on X show
                up in twtdash instantly.
              </p>
            </Step>
          </ol>
        </section>

        <section aria-labelledby="help-title" className="mt-20">
          <div className="panel flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="flex gap-4">
              <LifeBuoy className="mt-1 size-6 shrink-0 text-brand-soft" aria-hidden="true" />
              <div>
                <h2 id="help-title" className="text-lg font-semibold text-white">
                  Stuck?
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Open an issue on <a className="text-zinc-200 underline decoration-white/30 underline-offset-2 hover:decoration-current" href={SUPPORT_URL}>{SUPPORT_LABEL}</a>{" "}
                  and we&apos;ll help you get set up.
                </p>
              </div>
            </div>
            <ButtonLink href="/#features" variant="ghost" size="sm">
              See what twtdash can do <ArrowRight className="size-4" aria-hidden="true" />
            </ButtonLink>
          </div>
        </section>
      </div>
    </div>
  );
}
