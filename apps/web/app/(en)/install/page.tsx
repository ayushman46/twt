import type { Metadata } from "next";
import { ArrowRight, Download, Languages, LifeBuoy } from "lucide-react";
import { CopyCode } from "@/components/install/copy-button";
import { GuideSection, Kbd, Note, Step, Steps } from "@/components/install/steps";
import { ButtonLink } from "@/components/ui/button-link";
import { en } from "@/lib/i18n/en";
import { pageMetadata } from "@/lib/metadata";
import { CHROME_STORE_URL, DOWNLOADS, FIREFOX_ADDON_URL, SUPPORT_LABEL, SUPPORT_URL } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: en.meta.install.title,
  description: en.meta.install.description,
  path: "/install",
  translated: "/install",
  ogAlt: en.meta.ogAlt,
});

const code = "font-mono text-[0.9em] text-fg-2";

export default function InstallPage() {
  const chromeHref = CHROME_STORE_URL || "#chrome";
  const firefoxHref = FIREFOX_ADDON_URL || "#firefox";
  const storesLive = Boolean(CHROME_STORE_URL || FIREFOX_ADDON_URL);

  return (
    <div className="container-page">
      <div className="mx-auto max-w-3xl pb-20 pt-12 sm:pb-28 sm:pt-20">
        <header>
          <h1 className="text-balance text-[2.5rem] font-semibold leading-[1.05] tracking-[-0.04em] text-fg sm:text-[3.25rem]">
            Get twtdash in a minute
          </h1>
          <p className="mt-4 max-w-xl text-pretty text-[17px] leading-relaxed text-muted">
            twtdash works in Chrome, Edge, Brave, Arc, Opera and Firefox. No account, no API keys: install it, then run your
            first sync.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={chromeHref} size="lg" className="w-full sm:w-auto">
              {CHROME_STORE_URL ? "Add from Chrome Web Store" : "Install on Chrome"}
            </ButtonLink>
            <ButtonLink href={firefoxHref} size="lg" variant="secondary" className="w-full sm:w-auto">
              {FIREFOX_ADDON_URL ? "Add from Firefox Add-ons" : "Install on Firefox"}
            </ButtonLink>
          </div>
          <p className="mt-5 text-[14px] text-muted">
            {storesLive
              ? "Prefer to install by hand? Manual steps are below."
              : "Store listings are on the way. Until then, install manually with the steps below."}
          </p>
          <p className="mt-2 text-[14px]">
            <a href="/hi/install" hrefLang="hi" lang="hi" className="link-inline inline-flex items-center gap-1.5">
              <Languages className="size-4" aria-hidden="true" />
              यह guide हिन्दी में पढ़ें
            </a>
          </p>
        </header>

        <div className="mt-12 grid gap-3 sm:grid-cols-2">
          <a href="#chrome" className="group rounded-xl border border-line bg-panel p-5 transition-colors duration-150 hover:border-line-strong">
            <p className="text-[13px] text-muted">Chromium browsers</p>
            <p className="mt-1 text-[15px] font-medium text-fg">Chrome, Edge, Brave, Arc &amp; Opera</p>
            <p className="mt-1 flex items-center gap-1 text-[13.5px] text-muted">
              Use the Chrome build
              <ArrowRight className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
            </p>
          </a>
          <a href="#firefox" className="group rounded-xl border border-line bg-panel p-5 transition-colors duration-150 hover:border-line-strong">
            <p className="text-[13px] text-muted">Firefox</p>
            <p className="mt-1 text-[15px] font-medium text-fg">Firefox (desktop)</p>
            <p className="mt-1 flex items-center gap-1 text-[13.5px] text-muted">
              Use the Firefox build
              <ArrowRight className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
            </p>
          </a>
        </div>

        <GuideSection
          id="chrome"
          title="Manual install: Chrome, Edge, Brave, Arc & Opera"
          lead="Load twtdash as an unpacked extension. It takes about a minute."
        >
          <Steps>
            <Step n={1} title="Download the Chrome build">
              <p>
                <ButtonLink href={DOWNLOADS.chrome} download variant="secondary" size="sm">
                  <Download aria-hidden="true" />
                  twtdash-chrome.zip
                </ButtonLink>
              </p>
            </Step>
            <Step n={2} title="Unzip it">
              <p>
                Extract the zip into a folder you&apos;ll keep, for example <code className={code}>Documents/twtdash</code>. Your
                browser loads the extension from this folder, so don&apos;t delete it afterwards.
              </p>
            </Step>
            <Step n={3} title="Open the extensions page">
              <p>Paste this into the address bar:</p>
              <p>
                <CopyCode value="chrome://extensions" />
              </p>
              <p className="text-[14px]">
                Edge, Brave and Opera have their own address: <code className={code}>edge://extensions</code>,{" "}
                <code className={code}>brave://extensions</code>, <code className={code}>opera://extensions</code>.
              </p>
            </Step>
            <Step n={4} title="Turn on Developer mode">
              <p>
                Flip the <Kbd>Developer mode</Kbd> switch. It&apos;s in the top-right corner in Chrome (in Edge, look in the left
                sidebar).
              </p>
            </Step>
            <Step n={5} title="Click “Load unpacked”">
              <p>
                Choose <Kbd>Load unpacked</Kbd> and select the folder you unzipped, the one that contains{" "}
                <code className={code}>manifest.json</code>.
              </p>
            </Step>
            <Step n={6} title="Pin twtdash">
              <p>
                Click the puzzle-piece icon in your toolbar and pin <Kbd>twtdash</Kbd> so it&apos;s always one click away.
              </p>
            </Step>
          </Steps>
          <div className="mt-3">
            <Note>
              Manually installed extensions don&apos;t update automatically. To update, download the new zip, replace the
              folder&apos;s contents and click the reload icon on the twtdash card in <code className={code}>chrome://extensions</code>.
              Your library is kept.
            </Note>
          </div>
        </GuideSection>

        <GuideSection
          id="firefox"
          title="Manual install: Firefox"
          lead={
            FIREFOX_ADDON_URL ? (
              <>
                The easiest way is the{" "}
                <a href={FIREFOX_ADDON_URL} className="link-inline">
                  signed add-on on Firefox Add-ons
                </a>
                . To try a build by hand, load it as a temporary add-on.
              </>
            ) : (
              "Until the signed add-on is available, load twtdash as a temporary add-on."
            )
          }
        >
          <Steps>
            <Step n={1} title="Download the Firefox build">
              <p>
                <ButtonLink href={DOWNLOADS.firefox} download variant="secondary" size="sm">
                  <Download aria-hidden="true" />
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
                Then pick the <code className={code}>manifest.json</code> file inside the folder you unzipped. twtdash appears in
                your toolbar right away.
              </p>
            </Step>
          </Steps>
          <div className="mt-3">
            <Note>
              Firefox removes temporary add-ons when it restarts. For a permanent install, use the signed{" "}
              <code className={code}>.xpi</code> when it&apos;s available{FIREFOX_ADDON_URL ? " from Firefox Add-ons" : ""}. Opening it in
              Firefox installs twtdash for good.
            </Note>
          </div>
        </GuideSection>

        <GuideSection
          id="first-sync"
          title="Your first sync"
          lead="twtdash reads X’s own page data, so there’s no API key or paid X plan involved."
        >
          <Steps>
            <Step n={1} title="Log in to x.com">
              <p>Open x.com in the same browser and make sure you&apos;re signed in. twtdash never asks for your password.</p>
            </Step>
            <Step n={2} title="Click the twtdash icon, then “Sync bookmarks”">
              <p>
                twtdash opens your X bookmarks and scrolls through them for you. Later on, a quick sync fetches only what&apos;s new
                and a full sync re-reads everything. You can import your Likes too.
              </p>
            </Step>
            <Step n={3} title="Keep the tab open while it scrolls">
              <p>Leave the X tab open until the sync finishes. Large libraries can take a few minutes.</p>
            </Step>
            <Step n={4} title="Explore your library">
              <p>
                Open the dashboard to search, filter by category, tag and star. From now on, posts you bookmark on X show up in
                twtdash instantly.
              </p>
            </Step>
          </Steps>
        </GuideSection>

        <section aria-labelledby="help-title" className="mt-14">
          <div className="flex flex-col items-start gap-5 rounded-xl border border-line bg-panel p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <LifeBuoy className="mt-[3px] size-4 shrink-0 text-muted" aria-hidden="true" />
              <div>
                <h2 id="help-title" className="text-[15px] font-semibold text-fg">
                  Stuck?
                </h2>
                <p className="mt-1 text-[14px] text-muted">
                  Open an issue on{" "}
                  <a className="link-inline" href={SUPPORT_URL}>
                    {SUPPORT_LABEL}
                  </a>{" "}
                  and we&apos;ll help you get set up.
                </p>
              </div>
            </div>
            <ButtonLink href="/#features" variant="secondary" size="md">
              See what twtdash can do
              <ArrowRight aria-hidden="true" />
            </ButtonLink>
          </div>
        </section>
      </div>
    </div>
  );
}
