import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@twtdash/shared";
import { LegalPage } from "@/components/legal/legal-page";
import { pageMetadata } from "@/lib/metadata";
import { LEGAL_EFFECTIVE_DATE, SITE_URL, SUPPORT_LABEL, SUPPORT_URL } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy",
  description:
    "How twtdash handles your data: your library stays in your browser, the extension only runs on x.com and twitter.com, and AI features are strictly opt-in.",
  path: "/privacy",
});

const mail = <a href={SUPPORT_URL}>{SUPPORT_LABEL}</a>;

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy Policy"
      effectiveDate={LEGAL_EFFECTIVE_DATE}
      intro={
        <p>
          twtdash is local-first. Your bookmarks, notes and settings live in your own browser. We don&apos;t run accounts,
          we don&apos;t use analytics or ads, and we never sell data. This policy explains exactly what the twtdash browser
          extension and the {SITE_URL.replace(/^https?:\/\//, "")} website handle, and when anything leaves your device.
        </p>
      }
    >
      <h2 id="summary">Summary</h2>
      <ul>
        <li>
          <strong>Your library is stored locally</strong> in your browser (IndexedDB and the extension&apos;s own storage).
          It is not uploaded to us.
        </li>
        <li>
          <strong>The extension runs only on x.com and twitter.com</strong>, to read the bookmark and like data that X loads
          for you while you&apos;re signed in.
        </li>
        <li>
          <strong>No analytics, no ads, no tracking, no selling or sharing of your data.</strong>
        </li>
        <li>
          <strong>AI features are off by default.</strong> If you turn them on, the posts being categorized are sent to
          NVIDIA&apos;s API — directly from your browser with your own API key, or through the twtdash API if you use
          twtdash Pro. We do not store them.
        </li>
        <li>
          <strong>Pro licenses are checked with LemonSqueezy</strong>, our payment provider.
        </li>
      </ul>

      <h2 id="who-we-are">Who we are</h2>
      <p>
        &ldquo;{BRAND.name}&rdquo;, &ldquo;we&rdquo; and &ldquo;us&rdquo; refer to the makers of the twtdash browser
        extension and the twtdash Pro service at <a href={SITE_URL}>{SITE_URL.replace(/^https?:\/\//, "")}</a>. You can
        reach us about anything in this policy at {mail}.
      </p>

      <h2 id="data-the-extension-handles">Data the extension handles</h2>
      <p>To do its job, the extension works with the following information:</p>
      <ul>
        <li>
          <strong>Bookmarked and liked posts you sync</strong> — post text, author name and handle, profile image links,
          media and link previews, links, post dates, engagement counts (such as likes and reposts), and the names of any X
          Premium bookmark folders. Likes are only imported if you choose to import them.
        </li>
        <li>
          <strong>What you add in twtdash</strong> — categories (including custom categories and their keywords),
          collections, tags, private notes, and star, archive and read states.
        </li>
        <li>
          <strong>Settings</strong> — your preferences, and, if you provide them, your own NVIDIA API key and your
          twtdash Pro license key, together with the license details returned when it is activated (plan, status, expiry,
          and the name and email address on the purchase).
        </li>
      </ul>
      <p>
        twtdash does not collect your X password, does not ask you to sign in to anything, and does not read your
        browsing on any other website.
      </p>

      <h2 id="where-data-is-stored">Where your data is stored</h2>
      <p>
        All of the above is stored locally on your device, in your browser&apos;s IndexedDB and the extension&apos;s
        storage area (<code>chrome.storage</code> / <code>browser.storage</code>). twtdash has no user accounts and no
        server-side database of bookmarks, so we cannot see, access or recover your library. Categorization runs on your
        device unless you turn on AI features (see below).
      </p>
      <p>
        You can export your library at any time as JSON, CSV or Markdown, and import a JSON backup. Removing the extension
        deletes its local data from your browser, so export a backup first if you want to keep it.
      </p>

      <h2 id="website-access">Website access and permissions</h2>
      <p>
        The extension&apos;s content scripts run only on <code>x.com</code> and <code>twitter.com</code>. There, twtdash
        reads the bookmark and like data that X&apos;s own pages load for you — for example when you click &ldquo;Sync
        bookmarks&rdquo; and twtdash scrolls through your bookmarks page, or when you bookmark a post and twtdash captures
        it in real time. It uses this data only to build your local library. twtdash does not use the X API, and it does
        not need an X API key or a paid X plan.
      </p>

      <h2 id="ai-features">Optional AI features</h2>
      <p>
        AI categorization, auto-tags and one-line gists are <strong>opt-in</strong> and off by default. When you turn them
        on, twtdash sends the posts being categorized — post ID, post text, author handle and display name, links, quoted
        post text, link-preview titles and a short description of attached media (for example &ldquo;2 images&rdquo;) —
        together with your category names and descriptions. Nothing else from your library is sent. There are two ways to
        use AI:
      </p>
      <h3>Bring your own NVIDIA API key (free)</h3>
      <p>
        The extension sends the fields above <strong>directly from your browser to NVIDIA&apos;s API</strong>{" "}
        (<code>integrate.api.nvidia.com</code>), authenticated with your own API key. These requests do not pass through
        twtdash servers, and we never see your key or the content. Your key is stored only in the extension&apos;s local
        storage and is sent only to NVIDIA. NVIDIA processes these requests under the NVIDIA API Trial Terms of Service you
        accepted when creating your key and under its privacy policy, available at{" "}
        <a href="https://www.nvidia.com/en-us/about-nvidia/privacy-policy/">nvidia.com/en-us/about-nvidia/privacy-policy</a>.
      </p>
      <h3>twtdash Pro (no API key needed)</h3>
      <p>
        The extension sends the same fields over HTTPS to the twtdash API (<code>/api/categorize</code>), together with
        your license key and device instance ID so we can confirm your subscription. The twtdash API forwards the content
        to NVIDIA&apos;s API to generate categories, tags and gists, returns the results to your browser, and{" "}
        <strong>does not store the content</strong>. It is processed in memory only for the duration of the request, and we
        do not log post contents or license keys. To enforce fair-use limits we keep short-lived, in-memory request counts
        keyed to a one-way hash of your license key. NVIDIA processes the content as our service provider under the
        terms of our NVIDIA API account.
      </p>
      <p>
        Like most web services, our hosting provider may record standard technical request metadata — such as IP address,
        time, URL path and response status — for security and reliability. These logs never contain post contents.
      </p>

      <h2 id="licensing-and-payments">Licensing and payments</h2>
      <p>
        twtdash Pro is sold through{" "}
        <a href="https://www.lemonsqueezy.com/">LemonSqueezy</a>, which acts as the merchant of record and processes your
        payment and billing details under its own privacy policy. We never see your full card details.
      </p>
      <p>
        When you activate or check a license, the extension (via the twtdash API) sends your license key, a device label
        (for example &ldquo;Chrome on macOS&rdquo;) and, after activation, the device instance ID to LemonSqueezy&apos;s
        License API. LemonSqueezy returns the license status, plan, expiry date and the customer name and email address on
        the purchase, which the extension stores locally to show your plan. Positive license checks are cached in server
        memory for about ten minutes to keep the service fast; nothing is written to a database.
      </p>

      <h2 id="what-we-dont-do">What we don&apos;t do</h2>
      <ul>
        <li>We don&apos;t use analytics, telemetry, advertising, tracking pixels or fingerprinting — in the extension or on this website.</li>
        <li>We don&apos;t sell, rent or share your data with data brokers, advertisers or anyone else.</li>
        <li>We don&apos;t use your data to determine creditworthiness or for lending purposes.</li>
        <li>We don&apos;t use your data for any purpose unrelated to twtdash&apos;s features.</li>
        <li>We don&apos;t let people read your data. We never have access to your local library.</li>
      </ul>

      <h2 id="limited-use">Chrome Web Store User Data Policy — Limited Use</h2>
      <p>
        twtdash&apos;s use of information received through the extension adheres to the{" "}
        <a href="https://developer.chrome.com/docs/webstore/program-policies/policies">Chrome Web Store User Data Policy</a>,
        including the Limited Use requirements. Specifically:
      </p>
      <ul>
        <li>
          We use the data only to provide and improve twtdash&apos;s single purpose — syncing, organizing and searching your
          X bookmarks — and features that are prominent in its user interface.
        </li>
        <li>
          We transfer data only when needed to provide a feature you have turned on (sending posts to NVIDIA for AI
          categorization, or your license key to LemonSqueezy for verification), to comply with applicable law, or to
          protect against malware, spam, phishing or other fraud or abuse.
        </li>
        <li>We do not use or transfer data for personalized advertising, and we do not sell it.</li>
        <li>
          We do not allow humans to read your data, except with your explicit consent (for example, content you send us in a
          support request), when necessary for security purposes or to comply with applicable law.
        </li>
      </ul>

      <h2 id="this-website">This website</h2>
      <p>
        {SITE_URL.replace(/^https?:\/\//, "")} does not use cookies, analytics or third-party trackers, and fonts are served
        from our own domain. If you contact us, we use your message only to reply and keep a record of the
        conversation.
      </p>

      <h2 id="retention">Retention and deletion</h2>
      <p>
        Your library stays on your device until you delete it in twtdash or remove the extension. We don&apos;t hold a copy
        to delete. AI request content handled by the twtdash API is discarded as soon as the response is returned. Billing
        records are kept by LemonSqueezy as required for tax and accounting. Support emails are kept for as long as needed
        to help you, then deleted.
      </p>

      <h2 id="your-rights">Your rights</h2>
      <p>
        Depending on where you live (for example under the GDPR or CCPA), you may have the right to access, correct, delete
        or export personal data, and to object to or restrict its processing. Because your library is stored only on your
        device, you can exercise most of these rights directly in twtdash — export or delete anything at any time. For
        anything we or LemonSqueezy hold about you, such as purchase records, contact {mail} and we&apos;ll respond within 30
        days. You may also lodge a complaint with your local data-protection authority.
      </p>

      <h2 id="security">Security</h2>
      <p>
        All network requests twtdash makes — to x.com, to NVIDIA, to the twtdash API and to LemonSqueezy — use HTTPS.
        Your API key and license key stay in your browser&apos;s extension storage. Keep your device and browser profile
        secure, as anyone with access to them can access your local library.
      </p>

      <h2 id="children">Children</h2>
      <p>
        twtdash is not directed to children under 13 (or the minimum age required in your country), and we do not knowingly
        collect data from them.
      </p>

      <h2 id="changes">Changes to this policy</h2>
      <p>
        If we change how twtdash handles data, we&apos;ll update this page and its effective date, and describe material
        changes in the extension&apos;s release notes before they take effect. We will never start uploading your library
        without asking you first.
      </p>

      <h2 id="contact">Contact</h2>
      <p>
        Questions or requests about privacy: {mail}. See also our <Link href="/terms">Terms of Service</Link>.
      </p>
      <p>
        <em>twtdash is not affiliated with or endorsed by X Corp.</em>
      </p>
    </LegalPage>
  );
}
