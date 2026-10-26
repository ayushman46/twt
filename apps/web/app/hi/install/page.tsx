import type { Metadata } from "next";
import { ArrowRight, Download, Languages, Laptop, LifeBuoy } from "lucide-react";
import { CopyCode } from "@/components/install/copy-button";
import { GuideSection, Kbd, Note, Step, Steps } from "@/components/install/steps";
import { ButtonLink } from "@/components/ui/button-link";
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

const code = "font-mono text-[0.9em] text-fg-2";

/** Concise Hindi install guide (the full English one lives at /install). */
export default function HindiInstallPage() {
  const chromeHref = CHROME_STORE_URL || "#chrome";
  const firefoxHref = FIREFOX_ADDON_URL || "#firefox";
  const storesLive = Boolean(CHROME_STORE_URL || FIREFOX_ADDON_URL);

  return (
    <div className="container-page">
      <div className="mx-auto max-w-3xl pb-20 pt-12 sm:pb-28 sm:pt-20">
        <header>
          <h1 className="text-balance text-[2.5rem] font-semibold leading-[1.05] tracking-[-0.04em] text-fg sm:text-[3.25rem]">
            twtdash, बस एक मिनट में
          </h1>
          <p className="mt-4 max-w-xl text-pretty text-[17px] leading-relaxed text-muted">
            twtdash Chrome, Edge, Brave, Arc, Opera और Firefox में चलता है। न account, न API key — install करें और पहली sync
            चलाएँ।
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={chromeHref} size="lg" className="w-full sm:w-auto">
              {CHROME_STORE_URL ? "Chrome Web Store से जोड़ें" : "Chrome में install करें"}
            </ButtonLink>
            <ButtonLink href={firefoxHref} size="lg" variant="secondary" className="w-full sm:w-auto">
              {FIREFOX_ADDON_URL ? "Firefox Add-ons से जोड़ें" : "Firefox में install करें"}
            </ButtonLink>
          </div>
          <p className="mt-5 text-[14px] text-muted">
            {storesLive
              ? "ख़ुद install करना चाहें तो नीचे steps दिए हैं।"
              : "Store listing जल्द आ रही है। तब तक नीचे दिए steps से install करें।"}
          </p>
          <p className="mt-2 text-[14px]">
            <a href="/install" hrefLang="en" lang="en" className="link-inline inline-flex items-center gap-1.5">
              <Languages className="size-4" aria-hidden="true" />
              Read the full guide in English
            </a>
          </p>
        </header>

        <div className="mt-12">
          <Note icon={Laptop}>
            twtdash laptop या PC के browser का extension है, phone पर install नहीं होता। X app में किए गए आपके bookmarks computer
            पर sync हो जाते हैं।
          </Note>
        </div>

        <GuideSection id="chrome" title="Chrome, Edge, Brave, Arc और Opera" lead="twtdash को unpacked extension की तरह load करें — लगभग एक मिनट लगता है।">
          <Steps>
            <Step n={1} title="Chrome build download करें">
              <p>
                <ButtonLink href={DOWNLOADS.chrome} download variant="secondary" size="sm">
                  <Download aria-hidden="true" />
                  twtdash-chrome.zip
                </ButtonLink>
              </p>
            </Step>
            <Step n={2} title="Zip को unzip करें">
              <p>
                इसे किसी ऐसे folder में निकालें जो आप रखेंगे, जैसे <code className={code}>Documents/twtdash</code>। Browser इसी folder
                से extension चलाता है, इसलिए इसे बाद में delete न करें।
              </p>
            </Step>
            <Step n={3} title="Extensions page खोलें">
              <p>यह address bar में paste करें:</p>
              <p>
                <CopyCode value="chrome://extensions" />
              </p>
              <p className="text-[14px]">
                Edge, Brave और Opera में: <code className={code}>edge://extensions</code>, <code className={code}>brave://extensions</code>,{" "}
                <code className={code}>opera://extensions</code>।
              </p>
            </Step>
            <Step n={4} title="Developer mode चालू करें">
              <p>
                <Kbd>Developer mode</Kbd> का switch on करें। Chrome में यह ऊपर दाईं ओर है (Edge में बाईं sidebar में)।
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
          </Steps>
          <div className="mt-3">
            <Note>
              हाथ से install किया extension अपने-आप update नहीं होता। Update के लिए नई zip download करें, folder की चीज़ें बदल दें
              और <code className={code}>chrome://extensions</code> में twtdash card पर reload icon दबाएँ। आपकी library सुरक्षित
              रहती है।
            </Note>
          </div>
        </GuideSection>

        <GuideSection
          id="firefox"
          title="Firefox (desktop)"
          lead={
            FIREFOX_ADDON_URL ? (
              <>
                सबसे आसान तरीका:{" "}
                <a href={FIREFOX_ADDON_URL} className="link-inline">
                  Firefox Add-ons पर signed add-on
                </a>
                । ख़ुद आज़माना हो तो temporary add-on की तरह load करें।
              </>
            ) : (
              "Signed add-on आने तक twtdash को temporary add-on की तरह load करें।"
            )
          }
        >
          <Steps>
            <Step n={1} title="Firefox build download करें">
              <p>
                <ButtonLink href={DOWNLOADS.firefox} download variant="secondary" size="sm">
                  <Download aria-hidden="true" />
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
                फिर unzip किए folder के अंदर <code className={code}>manifest.json</code> file चुनें। twtdash तुरंत toolbar में दिखने
                लगेगा।
              </p>
            </Step>
          </Steps>
          <div className="mt-3">
            <Note>Firefox restart होने पर temporary add-ons हट जाते हैं। हमेशा के लिए install करने के लिए signed version आने पर उसे इस्तेमाल करें।</Note>
          </div>
        </GuideSection>

        <GuideSection id="first-sync" title="आपकी पहली sync" lead="twtdash X का अपना page data पढ़ता है — न API key चाहिए, न paid X plan।">
          <Steps>
            <Step n={1} title="x.com पर login करें">
              <p>उसी browser में x.com खोलें और sign in रहें। twtdash कभी आपका password नहीं माँगता।</p>
            </Step>
            <Step n={2} title="twtdash icon, फिर “Sync bookmarks”">
              <p>
                twtdash आपके X bookmarks खोलकर आपके लिए scroll करता है। बाद में quick sync सिर्फ़ नए posts लाता है और full sync सब
                कुछ दोबारा पढ़ता है। चाहें तो Likes भी import करें।
              </p>
            </Step>
            <Step n={3} title="Scroll होने तक tab खुला रखें">
              <p>Sync पूरी होने तक X वाला tab खुला रखें। बड़ी libraries में कुछ मिनट लग सकते हैं।</p>
            </Step>
            <Step n={4} title="अपनी library देखें, हिन्दी में भी">
              <p>
                Dashboard खोलें, search करें, category से filter करें, tag और star करें। twtdash आपके browser की भाषा अपने-आप पकड़
                लेता है; चाहें तो Settings में जाकर हिन्दी चुनें। AI के लिए{" "}
                <a href="/hi#nvidia-key" className="link-inline">
                  मुफ़्त NVIDIA key
                </a>{" "}
                लगाएँ।
              </p>
            </Step>
          </Steps>
        </GuideSection>

        <section aria-labelledby="help-title" className="mt-14">
          <div className="flex flex-col items-start gap-5 rounded-xl border border-line bg-panel p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <LifeBuoy className="mt-[5px] size-4 shrink-0 text-muted" aria-hidden="true" />
              <div>
                <h2 id="help-title" className="text-[15px] font-semibold text-fg">
                  कहीं अटक गए?
                </h2>
                <p className="mt-1 text-[14px] text-muted">
                  <a className="link-inline" href={SUPPORT_URL}>
                    {SUPPORT_LABEL}
                  </a>{" "}
                  पर issue खोलें — हम setup में मदद करेंगे। Hindi में लिखें, चलेगा।
                </p>
              </div>
            </div>
            <ButtonLink href="/hi#features" variant="secondary" size="md">
              twtdash क्या-क्या करता है
              <ArrowRight aria-hidden="true" />
            </ButtonLink>
          </div>
        </section>
      </div>
    </div>
  );
}
