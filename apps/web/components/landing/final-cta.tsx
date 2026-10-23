import { Globe, Puzzle } from "lucide-react";
import { LogoMark } from "@/components/site/logo";
import { Aurora } from "@/components/ui/aurora";
import { ButtonLink } from "@/components/ui/button-link";
import { Reveal } from "@/components/ui/reveal";
import { Accent } from "@/components/ui/section-heading";
import { CHROME_INSTALL_HREF, FIREFOX_INSTALL_HREF } from "@/lib/site";

export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="relative pb-24 pt-8 sm:pb-32">
      <div className="container-page">
        <Reveal className="ring-gradient relative isolate overflow-hidden rounded-[1.75rem] bg-ink-raised px-6 py-16 text-center shadow-[0_40px_120px_-50px_rgb(177_76_242/0.6)] sm:px-12 sm:py-24">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
            <Aurora className="-inset-x-[15%] -top-[45%] h-[110%] opacity-70" />
            <div className="bg-grid absolute inset-0 opacity-70 [mask-image:radial-gradient(ellipse_at_center,#000_20%,transparent_70%)]" />
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink-raised to-transparent" />
            <div className="absolute inset-x-[20%] top-0 h-px bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.5),transparent)]" />
          </div>
          <LogoMark id="cta" className="mx-auto size-16 drop-shadow-[0_14px_36px_rgb(177_76_242/0.7)]" />
          <h2 id="cta-title" className="mx-auto mt-8 max-w-2xl text-balance text-[2rem] font-semibold leading-[1.08] tracking-[-0.04em] text-white sm:text-5xl">
            Stop losing great posts in an <Accent gradient>endless list</Accent>
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-pretty text-zinc-300/80 sm:text-lg">
            Install twtdash, sync once, and every bookmark you&apos;ve ever saved is sorted, searchable and yours.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink href={CHROME_INSTALL_HREF} size="lg" className="w-full sm:w-auto">
              <Puzzle className="size-[1.1rem]" aria-hidden="true" />
              Add to Chrome
            </ButtonLink>
            <ButtonLink href={FIREFOX_INSTALL_HREF} size="lg" variant="secondary" className="w-full sm:w-auto">
              <Globe className="size-[1.1rem]" aria-hidden="true" />
              Add to Firefox
            </ButtonLink>
          </div>
          <p className="mt-6 text-sm text-zinc-500">Free forever · No account · Local-first</p>
        </Reveal>
      </div>
    </section>
  );
}
