# twtdash — web

The marketing site and hosted Pro API for **twtdash**, the browser extension that syncs your X bookmarks,
auto-categorizes them and gives you a fast, local-first library.

- **Site:** landing page (`/`), install guide (`/install`), privacy policy (`/privacy`), terms (`/terms`), plus
  Open Graph/Twitter images, `sitemap.xml`, `robots.txt` and icons.
- **API:** the endpoints the extension calls, implementing the contract in
  [`packages/shared/src/api.ts`](../../packages/shared/src/api.ts): health, license activation/validation
  (LemonSqueezy) and hosted AI categorization (Claude).

Stack: Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 · `@anthropic-ai/sdk`.

## Project layout

```
app/
  page.tsx                    landing page
  install/ privacy/ terms/    secondary pages
  api/health/                 GET  /api/health
  api/license/activate/       POST /api/license/activate
  api/license/validate/       POST /api/license/validate
  api/categorize/             POST /api/categorize
  opengraph-image.tsx, twitter-image.tsx, apple-icon.tsx, icon.svg, sitemap.ts, robots.ts
components/                   site chrome, landing sections, UI primitives
lib/
  cors.ts                     CORS headers, JSON + ApiErrorBody helpers, body parsing
  license.ts                  LemonSqueezy License API + dev license + validation cache
  rate-limit.ts               in-memory sliding-window limits
  anthropic.ts                Claude call + SDK error mapping
  validate.ts                 request-body validation
  site.ts                     public env-driven config (store URLs, checkout, site URL)
public/downloads/             drop twtdash-chrome.zip / twtdash-firefox.zip here
```

`@twtdash/shared` is consumed as raw TypeScript via `"file:../../packages/shared"`. `next.config.ts` sets
`transpilePackages`, and points `turbopack.root` and `outputFileTracingRoot` at the monorepo root so the linked
package resolves in `next dev`, `next build` and the traced server output.

## Run locally

This app has its own `package.json` / `package-lock.json` (it is not an npm workspace). Run npm inside `apps/web`:

```bash
cd apps/web
npm install
cp .env.example .env.local   # fill in what you need
npm run dev                  # http://localhost:3000
```

Other scripts:

```bash
npm run build      # production build
npm run start      # serve the production build
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
```

## Deploy to Vercel

1. Import the repository in Vercel and set **Root Directory** to `apps/web`. Framework preset: Next.js.
2. Keep **"Include files outside the root directory in the Build Step"** enabled (the default) — the build needs
   `packages/shared`.
3. Add the environment variables below (at least `ANTHROPIC_API_KEY`, `LEMONSQUEEZY_STORE_ID` and
   `NEXT_PUBLIC_CHECKOUT_URL` for production), then deploy.

`/api/categorize` exports `maxDuration = 120` seconds; a 50-post batch normally finishes well inside that.

## Environment variables

| Variable | Scope | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | server | Enables hosted AI. Without it `/api/categorize` returns `500 server_misconfigured`. |
| `TWTDASH_AI_MODEL` | server | Claude model. Default `claude-opus-5-5`; `claude-haiku-5-5` is far cheaper for high volume. |
| `LEMONSQUEEZY_STORE_ID` | server | Reject license keys from other LemonSqueezy stores (recommended). |
| `LEMONSQUEEZY_PRODUCT_IDS` | server | Optional comma list of product IDs that count as Pro. |
| `TWTDASH_DEV_LICENSE` | server | A key that is always valid (`plan: "Pro (dev)"`) without calling LemonSqueezy. Dev only. |
| `NEXT_PUBLIC_CHECKOUT_URL` | public | LemonSqueezy checkout link for Pro (falls back to `#pricing`). |
| `NEXT_PUBLIC_CHROME_STORE_URL` | public | Chrome Web Store listing. Unset → buttons go to the manual-install steps. |
| `NEXT_PUBLIC_FIREFOX_ADDON_URL` | public | Firefox Add-ons listing. Unset → buttons go to the manual-install steps. |
| `NEXT_PUBLIC_SITE_URL` | public | Canonical URL for metadata, OG images, sitemap (default `https://twtdash.app`). |

`NEXT_PUBLIC_*` values are inlined at build time — redeploy after changing them.

## API

All `/api/*` routes speak JSON, allow CORS from any origin (`Access-Control-Allow-Origin: *`; allowed headers
`content-type, authorization, x-twtdash-instance`; methods `GET, POST, OPTIONS`), answer `OPTIONS` preflights and
return errors as `ApiErrorBody`:

```json
{ "error": { "code": "license_invalid", "message": "This license has expired." } }
```

| Code | Status | When |
| --- | --- | --- |
| `bad_request` | 400 | Invalid JSON or body |
| `unauthorized` | 401 | Missing `Authorization` or `x-twtdash-instance` |
| `license_invalid` | 401 | License not found, inactive instance, expired, disabled, or wrong store/product |
| `refusal` | 422 | Claude declined the batch |
| `rate_limited` | 429 | Per-license limit hit, or Anthropic is rate limiting (`Retry-After` is set) |
| `server_misconfigured` | 500 | No / rejected `ANTHROPIC_API_KEY` |
| `upstream_error` | 502 | LemonSqueezy or Anthropic unreachable/failed, truncated or unparseable output |

### `GET /api/health`

```json
{ "ok": true, "ai": true, "licensing": true }
```

`ai` is true when `ANTHROPIC_API_KEY` is set. `licensing` is true when license checks are locked to your store
(`LEMONSQUEEZY_STORE_ID` / `LEMONSQUEEZY_PRODUCT_IDS`) or a dev license is configured.

### Licensing — `POST /api/license/activate` and `POST /api/license/validate`

Pro is sold through LemonSqueezy with license keys enabled on the product. The extension never talks to
LemonSqueezy directly; it calls these endpoints, which call LemonSqueezy's public
[License API](https://docs.lemonsqueezy.com/api/license-api) (form-encoded, no LemonSqueezy API key needed):

- **activate** `{ licenseKey, instanceName }` → `POST https://api.lemonsqueezy.com/v1/licenses/activate`
  (`license_key`, `instance_name`). Returns the new `instanceId`, which the extension stores and sends as
  `x-twtdash-instance` from then on. When store/product restrictions are configured the key is validated first, so a
  foreign key never consumes an activation.
- **validate** `{ licenseKey, instanceId? }` → `POST https://api.lemonsqueezy.com/v1/licenses/validate`
  (`license_key`, `instance_id`).

Both return a `LicenseResponse` (`valid`, `status`, `instanceId`, `plan` from the variant name, `customerName`,
`customerEmail`, `expiresAt`, `error`). License problems — unknown key, activation limit reached, expired — come back
as **200 with `valid: false`** and an `error` message; only malformed requests (400) and LemonSqueezy outages (502)
use `ApiErrorBody`. If `LEMONSQUEEZY_STORE_ID` is set, keys whose `meta.store_id` differs are rejected; if
`LEMONSQUEEZY_PRODUCT_IDS` is set, `meta.product_id` must be in the list.

### Hosted AI — `POST /api/categorize`

Headers: `Authorization: Bearer <licenseKey>` and `x-twtdash-instance: <instanceId>`. Body: `CategorizeApiRequest`
(1–50 tweets, ≤ 40 categories, string ids, bounded string lengths). Response: `CategorizeApiResponse` with `results`,
`model` and token `usage`.

Pipeline: auth headers → license validation (positive results cached in memory for 10 minutes) → body validation →
server config check → rate limit → Claude → `parseCategorizeOutput`.

The Claude request is built with the same `buildCategorizeRequest` the extension uses for bring-your-own-key, so
results match either way. Opus/Sonnet/Fable models also get Anthropic's server-side refusal fallback
(`server-side-fallback-2026-07-01`, `fallbacks: "default"`). The route checks `stop_reason` before reading output
(`refusal` → 422, `max_tokens` → 502) and maps SDK errors by class. Post contents and license keys are never logged.

**Rate limits** (per license): 30 requests per rolling minute and 3,000 posts per rolling 24 hours. They live in
process memory (`lib/rate-limit.ts`), and so does the license cache. **Serverless instances don't share memory**, so
on Vercel these limits are best-effort per instance. For production, swap `lib/rate-limit.ts` for a shared store such
as Upstash Redis (`@upstash/ratelimit`) — the route only depends on `checkRateLimit` / `recordPosts`.

#### Try it with the dev license

```bash
# .env.local
TWTDASH_DEV_LICENSE=sm-dev-123
ANTHROPIC_API_KEY=sk-ant-...      # omit to see 500 server_misconfigured
```

```bash
curl -s http://localhost:3000/api/categorize \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sm-dev-123" \
  -H "x-twtdash-instance: dev" \
  -d '{
    "summaries": true,
    "categories": [
      { "id": "ai", "name": "AI & ML", "description": "Artificial intelligence, LLMs, machine learning, AI products, prompting and agents." },
      { "id": "dev", "name": "Programming", "description": "Software engineering, code, languages, frameworks and devtools." },
      { "id": "other", "name": "Other", "description": "Anything that does not clearly fit another category." }
    ],
    "tweets": [
      { "id": "1", "author": "@mayabuilds (Maya Chen)", "text": "Spent the weekend turning our support tickets into an eval set. Biggest lesson: write the grader before the prompt." },
      { "id": "2", "author": "@diegoships (Diego Alvarez)", "text": "Most React performance problems are just state living too high in the tree.", "links": ["https://react.dev/learn"] }
    ]
  }'
```

```json
{
  "results": [
    { "id": "1", "category": "ai", "tags": ["evals", "prompting"], "summary": "Write evaluation graders before prompts when building eval sets." },
    { "id": "2", "category": "dev", "tags": ["react", "performance", "state management"], "summary": "" }
  ],
  "model": "claude-opus-5-5",
  "usage": { "input_tokens": 1234, "output_tokens": 210 }
}
```

(Output above is illustrative.)

## Downloads

Put the built extension archives in `public/downloads/` — the install page links to
`/downloads/twtdash-chrome.zip` and `/downloads/twtdash-firefox.zip`.
