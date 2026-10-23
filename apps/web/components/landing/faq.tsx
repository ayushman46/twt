"use client";

import { useId, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Plus } from "lucide-react";
import { BRAND } from "@twtdash/shared";
import { Reveal } from "@/components/ui/reveal";
import { Accent, SectionHeading } from "@/components/ui/section-heading";

const FAQS: Array<{ q: string; a: React.ReactNode }> = [
  {
    q: "Is twtdash safe to use?",
    a: (
      <>
        Yes. twtdash only runs on x.com and twitter.com, and only reads the bookmark and like data your own browser loads
        while you&apos;re signed in. Everything it saves stays in your browser — there are no twtdash servers holding your
        library, no analytics and no ads. AI features stay off until you turn them on.
      </>
    ),
  },
  {
    q: "Does it need my X password?",
    a: (
      <>
        No. twtdash never asks for your X password, an X API key or any other login. It works with the X session you
        already have in your browser — if you can see your bookmarks on x.com, twtdash can sync them.
      </>
    ),
  },
  {
    q: "Does it work with X Premium bookmark folders?",
    a: (
      <>
        Yes. If you organize bookmarks into folders with X Premium, twtdash brings those folders in as collections, so
        the organizing you&apos;ve already done carries over.
      </>
    ),
  },
  {
    q: "What happens if X changes its website?",
    a: (
      <>
        X updates its site from time to time. twtdash reads X&apos;s own page data rather than what&apos;s drawn on screen,
        which keeps it resilient — and when something does change, we update the extension. Either way, everything
        you&apos;ve already synced stays safe in your browser.
      </>
    ),
  },
  {
    q: "Where is my data stored?",
    a: (
      <>
        In your browser&apos;s IndexedDB, on your device. Nothing is uploaded to twtdash. Because your library is local,
        removing the extension deletes it — export a backup first if you want to keep it. Details are in our{" "}
        <Link href="/privacy" className="text-brand-soft underline decoration-brand-soft/40 underline-offset-2 hover:decoration-current">
          privacy policy
        </Link>
        .
      </>
    ),
  },
  {
    q: "Can I export my bookmarks?",
    a: (
      <>
        Anytime. Export your whole library as JSON, CSV or Markdown (formatted to drop straight into Obsidian or Notion),
        and import a JSON backup to restore it in another browser.
      </>
    ),
  },
  {
    q: "Does it work in Firefox?",
    a: (
      <>
        Yes — twtdash works in Firefox as well as Chrome, Edge, Brave, Arc and Opera. The{" "}
        <Link href="/install" className="text-brand-soft underline decoration-brand-soft/40 underline-offset-2 hover:decoration-current">
          install guide
        </Link>{" "}
        covers each browser.
      </>
    ),
  },
  {
    q: "Do I need Pro to use AI?",
    a: (
      <>
        No. AI categorization, auto-tags and gists are free with your own NVIDIA API key — it takes a minute to create one
        at build.nvidia.com, needs no credit card, and requests go straight from your browser to NVIDIA. Pro is for people
        who would rather not manage a key at all.
      </>
    ),
  },
  {
    q: "What is your refund policy?",
    a: (
      <>
        If Pro isn&apos;t right for you, contact us on{" "}
        <a
          href={BRAND.supportUrl}
          className="text-brand-soft underline decoration-brand-soft/40 underline-offset-2 hover:decoration-current"
        >
          {BRAND.supportLabel}
        </a>{" "}
        within 14 days of your purchase for a full refund. You can cancel anytime and keep Pro until the end of the period
        you&apos;ve paid for.
      </>
    ),
  },
];

function FaqItem({ q, a, defaultOpen = false }: { q: string; a: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const buttonId = `${id}-button`;
  const panelId = `${id}-panel`;

  return (
    <div className="border-b border-line last:border-b-0">
      <h3>
        <button
          id={buttonId}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-6 px-5 py-5 text-left text-[0.9875rem] font-medium text-zinc-100 transition-colors hover:text-white sm:px-6"
        >
          {q}
          <span
            className={clsx(
              "flex size-7 shrink-0 items-center justify-center rounded-full border border-white/10 text-zinc-400 transition-transform duration-300",
              open && "rotate-45 border-brand/40 text-brand-soft",
            )}
            aria-hidden="true"
          >
            <Plus className="size-3.5" />
          </span>
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        inert={!open}
        className={clsx(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <p className="px-5 pb-5 pr-14 text-[0.9375rem] leading-relaxed text-zinc-400 sm:px-6 sm:pr-16">{a}</p>
        </div>
      </div>
    </div>
  );
}

export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="relative scroll-mt-20 py-24 sm:py-32">
      <div className="container-page">
        <SectionHeading
          id="faq-title"
          eyebrow="FAQ"
          title={
            <>
              Questions, <Accent gradient>answered</Accent>
            </>
          }
          description={
            <>
              Can&apos;t find what you need? Ask on{" "}
              <a href={BRAND.supportUrl} className="text-zinc-200 underline decoration-white/30 underline-offset-2 hover:decoration-current">
                {BRAND.supportLabel}
              </a>
              .
            </>
          }
        />
        <Reveal className="panel mx-auto mt-14 max-w-3xl overflow-hidden">
          {FAQS.map((item, i) => (
            <FaqItem key={item.q} q={item.q} a={item.a} defaultOpen={i === 0} />
          ))}
        </Reveal>
      </div>
    </section>
  );
}
