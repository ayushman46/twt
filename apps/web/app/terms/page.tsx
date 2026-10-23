import type { Metadata } from "next";
import Link from "next/link";
import { PRICING } from "@twtdash/shared";
import { LegalPage } from "@/components/legal/legal-page";
import { pageMetadata } from "@/lib/metadata";
import { LEGAL_EFFECTIVE_DATE, SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Terms of Service",
  description: "The terms for using the twtdash browser extension and twtdash Pro.",
  path: "/terms",
});

const mail = <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>;

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of Service"
      effectiveDate={LEGAL_EFFECTIVE_DATE}
      intro={
        <p>
          These terms cover your use of the twtdash browser extension, the twtdash website and the optional twtdash Pro
          subscription. By installing twtdash or buying Pro, you agree to them. They&apos;re short — please read them.
        </p>
      }
    >
      <h2 id="the-service">1. The service</h2>
      <p>
        twtdash is a browser extension that syncs the posts you have bookmarked (and, optionally, liked) on X, organizes
        them into categories, and lets you search and manage them in a local dashboard. The core extension is free.{" "}
        <strong>twtdash Pro</strong> is an optional paid subscription that adds hosted AI categorization, auto-tagging and
        one-line gists without needing your own API key, plus priority support and early access to new features.
      </p>
      <p>
        We grant you a personal, non-exclusive, non-transferable, revocable license to use twtdash for your own purposes,
        subject to these terms.
      </p>

      <h2 id="x">2. X and other third parties</h2>
      <p>
        <strong>twtdash is not affiliated with or endorsed by X Corp.</strong> &ldquo;X&rdquo; and related marks belong to
        their owners. twtdash works with the X account you are already signed in to in your browser and only reads data
        that X shows you. You are responsible for your use of X and for complying with X&apos;s terms. Because X can change
        its website at any time, some features may stop working until we release an update.
      </p>
      <p>
        Optional AI features rely on Anthropic, and payments are handled by LemonSqueezy. Your use of those services is
        also subject to their terms. See our <Link href="/privacy">Privacy Policy</Link> for what is shared with them and
        when.
      </p>

      <h2 id="your-data">3. Your data</h2>
      <p>
        Your library belongs to you and is stored locally in your browser. We don&apos;t have a copy, so you are responsible
        for keeping backups — use the built-in JSON, CSV or Markdown export. If you use your own Anthropic API key, you are
        responsible for that key and for any charges Anthropic bills you.
      </p>

      <h2 id="subscriptions">4. Pro subscriptions and billing</h2>
      <ul>
        <li>
          Pro costs ${PRICING.pro.monthly} per month or ${PRICING.pro.yearly} per year (in {PRICING.currency}, plus any
          applicable taxes), unless a different price is shown at checkout.
        </li>
        <li>
          Purchases are processed by LemonSqueezy as merchant of record. Your subscription renews automatically at the end
          of each billing period until you cancel.
        </li>
        <li>
          You can cancel anytime from the link in your LemonSqueezy receipt or by emailing us. Cancellation stops future
          renewals; you keep Pro until the end of the period you&apos;ve paid for.
        </li>
        <li>
          Your license key is for you. You may activate it on your own devices up to the activation limit shown at
          purchase, but you may not share, resell or publish it.
        </li>
        <li>
          If we change Pro pricing, we&apos;ll tell you in advance, and the new price applies from your next renewal after
          the notice.
        </li>
        <li>
          Hosted AI is subject to fair-use limits (currently up to 30 requests per minute and 3,000 posts per day per
          license) to keep the service fast and affordable for everyone.
        </li>
      </ul>

      <h2 id="refunds">5. Refunds</h2>
      <p>
        If Pro isn&apos;t right for you, email {mail} within <strong>14 days</strong> of your initial purchase or of a
        renewal charge, and we&apos;ll refund that payment in full — no questions asked. After 14 days, payments are
        non-refundable except where required by law.
      </p>

      <h2 id="acceptable-use">6. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>use twtdash to break the law or infringe anyone else&apos;s rights;</li>
        <li>
          use twtdash to collect other people&apos;s data at scale, or for anything other than organizing your own
          bookmarks and likes;
        </li>
        <li>
          share, resell or publish license keys, or access the twtdash API other than through the extension or as we
          document;
        </li>
        <li>
          attempt to bypass rate limits or license checks, overload or disrupt our services, or probe them for
          vulnerabilities without our permission (good-faith security reports to {mail} are welcome);
        </li>
        <li>send content to the hosted AI that violates Anthropic&apos;s usage policies.</li>
      </ul>
      <p>We may suspend or revoke a license that is used in breach of these rules.</p>

      <h2 id="ai-output">7. AI output</h2>
      <p>
        AI-generated categories, tags and gists can be wrong or incomplete. They are suggestions to help you organize your
        library, not advice — review anything that matters to you.
      </p>

      <h2 id="disclaimers">8. Disclaimers</h2>
      <p>
        twtdash is provided <strong>&ldquo;as is&rdquo; and &ldquo;as available&rdquo;</strong>, without warranties of any
        kind, whether express or implied, including merchantability, fitness for a particular purpose and
        non-infringement. We don&apos;t guarantee that twtdash will be uninterrupted or error-free, that it will keep
        working with X, or that data stored in your browser can&apos;t be lost.
      </p>

      <h2 id="liability">9. Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, we are not liable for any indirect, incidental, special, consequential or
        punitive damages, or for any loss of data, profits or goodwill, arising from your use of twtdash. Our total
        liability for any claim relating to twtdash is limited to the amount you paid us for Pro in the 12 months before
        the claim (or US$20 if you haven&apos;t paid anything). Some jurisdictions don&apos;t allow these limitations, so
        they may not apply to you; nothing in these terms limits rights you have under consumer-protection law.
      </p>

      <h2 id="termination">10. Ending these terms</h2>
      <p>
        You can stop using twtdash at any time by removing the extension and cancelling Pro. We may discontinue twtdash
        or Pro; if we discontinue Pro, we&apos;ll give reasonable notice and refund any unused, prepaid portion of your
        subscription. Your locally stored library stays usable and exportable regardless.
      </p>

      <h2 id="changes">11. Changes to these terms</h2>
      <p>
        We may update these terms from time to time. We&apos;ll post the new version here with a new effective date, and
        for material changes we&apos;ll give notice before they take effect. Continuing to use twtdash after that means you
        accept the updated terms.
      </p>

      <h2 id="contact">12. Contact</h2>
      <p>Questions about these terms: {mail}.</p>
    </LegalPage>
  );
}
