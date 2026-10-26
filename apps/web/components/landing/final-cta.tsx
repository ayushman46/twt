import { LogoMark } from "@/components/site/logo";
import { ButtonLink } from "@/components/ui/button-link";
import { Reveal } from "@/components/ui/reveal";
import type { Dictionary } from "@/lib/i18n/types";
import { installHref } from "@/lib/site";

export function FinalCta({ t, locale }: { t: Dictionary["cta"]; locale: Dictionary["locale"] }) {
  return (
    <section aria-labelledby="cta-title" className="cv-auto">
      <div className="container-page pb-20 sm:pb-28">
        <Reveal className="flex flex-col items-center rounded-2xl border border-line bg-panel px-6 py-14 text-center sm:px-12 sm:py-20">
          <LogoMark className="size-10" />
          <h2 id="cta-title" className="mt-6 max-w-2xl text-balance text-[1.875rem] font-semibold leading-[1.1] tracking-[-0.03em] text-fg sm:text-[2.5rem] sm:leading-[1.05]">
            {t.title}
          </h2>
          <p className="mt-4 max-w-lg text-pretty text-base leading-relaxed text-muted sm:text-[17px]">{t.body}</p>
          <div className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
            <ButtonLink href={installHref("chrome", locale)} size="lg" className="w-full sm:w-auto">
              {t.chrome}
            </ButtonLink>
            <ButtonLink href={installHref("firefox", locale)} size="lg" variant="secondary" className="w-full sm:w-auto">
              {t.firefox}
            </ButtonLink>
          </div>
          <p className="mt-5 text-[13px] text-muted">{t.footnote}</p>
        </Reveal>
      </div>
    </section>
  );
}
