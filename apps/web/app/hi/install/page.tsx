import type { Metadata } from "next";
import { ArrowRight, Download, Globe, Languages, LifeBuoy, Laptop, Puzzle } from "lucide-react";
import { CopyCode } from "@/components/install/copy-button";
import { InstallBackdrop, Kbd, Note, Step } from "@/components/install/steps";
import { ButtonLink } from "@/components/ui/button-link";
import { Eyebrow } from "@/components/ui/section-heading";
import { hi } from "@/lib/i18n/hi";
import { pageMetadata } from "@/lib/metadata";
import { CHROME_STORE_URL, DOWNLOADS, FIREFOX_ADDON_URL, SUPPORT_LABEL, SUPPORT_URL } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: hi.meta.install.title,
  description: hi.meta.install.description,
  path: "/install",
  locale: "hi",
  translated: "/install",
  ogAlt: hi.meta.ogAlt,
});

const code = "font-mono text-zinc-300";

/** Concise Hindi install guide (the full English one lives at /install). */
export default function HindiInstallPage() {
  const chromeHref = CHROME_STORE_URL || "#chrome";
  const firefoxHref = FIREFOX_ADDON_URL || "#firefox";
  const storesLive = Boolean(CHROME_STORE_URL || FIREFOX_ADDON_URL);

  return (
    <InstallBackdrop>
      <div className="container-page max-w-4xl py-16 sm:py-24">
        <header className="text-center">
          <Eyebrow>Install guide</Eyebrow>
          <h1 className="mt-5 text-balance text-[2.5rem] font-semibold leading-[1.05] tracking-[-0.04em] text-white sm:text-6xl">
            twtdash, बस{" "}
            <span className="text-brand-gradient pr-[0.08em] font-display text-[1.06em] font-normal italic tracking-[-0.01em]">एक मिनट में</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-zinc-400 sm:text-lg">
            twtdash Chrome, Edge, Brave, Arc, Opera और Firefox में चलता है। न account, न API key — install करें और पहली sync
            चलाएँ।
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink href={chromeHref} size="lg" className="w-full sm:w-auto">
              <Puzzle className="size-[1.1rem]" aria-hidden="true" />
              {CHROME_STORE_URL ? "Chrome Web Store से जोड़ें" : "Chrome में install करें"}
            </ButtonLink>
            <ButtonLink href={firefoxHref} size="lg" variant="secondary" className="w-full sm:w-auto">
              <Globe className="size-[1.1rem]" aria-hidden="true" />
              {FIREFOX_ADDON_URL ? "Firefox Add-ons से जोड़ें" : "Firefox में install करें"}
            </ButtonLink>
          </div>
          <p className="mt-4 text-sm text-zinc-400">
            {storesLive
              ? "ख़ुद install करना चाहें तो नीचे steps दिए हैं।"
              : "Store listing जल्द आ रही है — तब तक नीचे दिए steps से install करें।"}
          </p>
          <p className="mt-3 text-sm">
            <a
              href="/install"
              hrefLang="en"
              lang="en"
              className="inline-flex items-center gap-1.5 text-brand-soft underline decoration-brand-soft/40 underline-offset-2 hover:decoration-current"
            >
              <Languages className="size-4" aria-hidden="true" />
              Read the full guide in English
            </a>
          </p>
        </header>

        <div className="mt-14">
          <Note>
            <span className="flex items-start gap-2">
              <Laptop className="mt-0.5 size-4 shrink-0 text-brand-soft" aria-hidden="true" />
              <span>
                twtdash laptop या PC के browser का extension है — phone पर install नहीं होता। X app में किए गए आपके
                bookmarks computer पर sync हो जाते हैं।
              </span>
            </span>
          </Note>
        </div>

        {/* Chrome / Chromium */}
        <section id="chrome" aria-labelledby="chrome-title" className="mt-16 scroll-mt-24">
          <h2 id="chrome-title" className="text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">
            Chrome, Edge, Brave, Arc और Opera
          </h2>
          <p className="mt-3 text-zinc-400">twtdash को unpacked extension की तरह load करें — लगभग एक मिनट लगता है।</p>
          <ol className="panel mt-8 p-6 sm:p-8">
            <Step n={1} title="Chrome build download करें">
              <p>
                <ButtonLink href={DOWNLOADS.chrome} download variant="secondary" size="sm">
                  <Download className="size-4" aria-hidden="true" />
                  twtdash-chrome.zip
                </ButtonLink>
              </p>
            </Step>
            <Step n={2} title="Zip को unzip करें">
              <p>
                इसे किसी ऐसे folder में निकालें जो आप रखेंगे, जैसे <code className={code}>Documents/twtdash</code>। Browser इसी
                folder से extension चलाता है, इसलिए इसे बाद में delete न करें।
              </p>
            </Step>
            <Step n={3} title="Extensions page खोलें">
              <p>यह address bar में paste करें:</p>
              <p>
                <CopyCode value="chrome://extensions" />
              </p>
              <p className="text-sm text-zinc-400">
                Edge, Brave और Opera में: <code className="font-mono">edge://extensions</code>,{" "}
                <code className="font-mono">brave://extensions</code>, <code className="font-mono">opera://extensions</code>।
              </p>
            </Step>
            <Step n={4} title="Developer mode चालू करें">
              <p>
                <Kbd>Developer mode</Kbd> का switch on करें — Chrome में यह ऊपर दाईं ओर है (Edge में बाईं sidebar में)।
              </p>
            </Step>
            <Step n={5} title="“Load unpacked” पर click करें">
              <p>
                <Kbd>Load unpacked</Kbd> चुनें और unzip किया हुआ folder select करें — वही जिसमें{" "}
                <code className={code}>manifest.json</code> है।
              </p>
            </Step>
            <Step n={6} title="twtdash को pin करें">
              <p>
                Toolbar में puzzle वाले icon पर click करें और <Kbd>twtdash</Kbd> को pin कर दें, ताकि यह हमेशा एक click दूर रहे।
              </p>
            </Step>
          </ol>
          <div className="mt-4">
            <Note>
              हाथ से install किया extension अपने-आप update नहीं होता। Update के लिए नई zip download करें, folder की चीज़ें
              बदल दें और <code className="font-mono">chrome://extensions</code> में twtdash card पर reload icon दबाएँ। आपकी
              library सुरक्षित रहती है।
            </Note>
          </div>
        </section>

        {/* Firefox */}
        <section id="firefox" aria-labelledby="firefox-title" className="mt-16 scroll-mt-24">
          <h2 id="firefox-title" className="text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">
            Firefox (desktop)
          </h2>
          <p className="mt-3 text-zinc-400">
            {FIREFOX_ADDON_URL ? (
              <>
                सबसे आसान तरीका:{" "}
                <a href={FIREFOX_ADDON_URL} className="text-brand-soft underline decoration-brand-soft/40 underline-offset-2 hover:decoration-current">
                  Firefox Add-ons पर signed add-on
                </a>
                । ख़ुद आज़माना हो तो temporary add-on की तरह load करें:
              </>
            ) : (
              "Signed add-on आने तक twtdash को temporary add-on की तरह load करें:"
            )}
          </p>
          <ol className="panel mt-8 p-6 sm:p-8">
            <Step n={1} title="Firefox build download करें">
              <p>
                <ButtonLink href={DOWNLOADS.firefox} download variant="secondary" size="sm">
                  <Download className="size-4" aria-hidden="true" />
                  twtdash-firefox.zip
                </ButtonLink>
              </p>
              <p>इसे किसी ऐसे folder में unzip करें जो आप रखेंगे।</p>
            </Step>
            <Step n={2} title="Debugging page खोलें">
              <p>यह address bar में paste करें:</p>
              <p>
                <CopyCode value="about:debugging#/runtime/this-firefox" />
              </p>
            </Step>
            <Step n={3} title="“Load Temporary Add-on…” पर click करें">
              <p>
                फिर unzip किए folder के अंदर <code className={code}>manifest.json</code> file चुनें। twtdash तुरंत toolbar में
                दिखने लगेगा।
              </p>
            </Step>
          </ol>
          <div className="mt-4">
            <Note>Firefox restart होने पर temporary add-ons हट जाते हैं। हमेशा के लिए install करने के लिए signed version आने पर उसे इस्तेमाल करें।</Note>
          </div>
        </section>

        {/* First sync */}
        <section id="first-sync" aria-labelledby="sync-title" className="mt-16 scroll-mt-24">
          <h2 id="sync-title" className="text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">
            आपकी पहली sync
          </h2>
          <p className="mt-3 text-zinc-400">twtdash X का अपना page data पढ़ता है — न API key चाहिए, न paid X plan।</p>
          <ol className="panel mt-8 p-6 sm:p-8">
            <Step n={1} title="x.com पर login करें">
              <p>उसी browser में x.com खोलें और sign in रहें। twtdash कभी आपका password नहीं माँगता।</p>
            </Step>
            <Step n={2} title="twtdash icon → “Sync bookmarks”">
              <p>
                twtdash आपके X bookmarks खोलकर आपके लिए scroll करता है। बाद में quick sync सिर्फ़ नए posts लाता है और full
                sync सब कुछ दोबारा पढ़ता है। चाहें तो Likes भी import करें।
              </p>
            </Step>
            <Step n={3} title="Scroll होने तक tab खुला रखें">
              <p>Sync पूरी होने तक X वाला tab खुला रखें — बड़ी libraries में कुछ मिनट लग सकते हैं।</p>
            </Step>
            <Step n={4} title="अपनी library देखें — हिन्दी में भी">
              <p>
                Dashboard खोलें, search करें, category से filter करें, tag और star करें। twtdash आपके browser की भाषा अपने-आप
                पकड़ लेता है; चाहें तो Settings में जाकर हिन्दी चुनें। AI के लिए{" "}
                <a href="/hi#nvidia-key" className="text-brand-soft underline decoration-brand-soft/40 underline-offset-2 hover:decoration-current">
                  मुफ़्त NVIDIA key
                </a>{" "}
                लगाएँ।
              </p>
            </Step>
          </ol>
        </section>

        <section aria-labelledby="help-title" className="mt-16">
          <div className="panel flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="flex gap-4">
              <LifeBuoy className="mt-1 size-6 shrink-0 text-brand-soft" aria-hidden="true" />
              <div>
                <h2 id="help-title" className="text-lg font-semibold text-white">
                  कहीं अटक गए?
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  <a className="text-zinc-200 underline decoration-white/30 underline-offset-2 hover:decoration-current" href={SUPPORT_URL}>
                    {SUPPORT_LABEL}
                  </a>{" "}
                  पर issue खोलें — हम setup में मदद करेंगे। Hindi में लिखें, चलेगा।
                </p>
              </div>
            </div>
            <ButtonLink href="/hi#features" variant="ghost" size="sm">
              twtdash क्या-क्या करता है <ArrowRight className="size-4" aria-hidden="true" />
            </ButtonLink>
          </div>
        </section>
      </div>
    </InstallBackdrop>
  );
}
