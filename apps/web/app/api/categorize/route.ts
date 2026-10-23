import { INSTANCE_HEADER } from "@twtdash/shared";
import { CategorizeError, categorizeWithClaude, isAiConfigured } from "@/lib/anthropic";
import { apiError, json, preflight, readJsonBody } from "@/lib/cors";
import { LicenseServerError, licenseFingerprint, validateLicenseCached } from "@/lib/license";
import { checkRateLimit, recordPosts } from "@/lib/rate-limit";
import { validateCategorizeRequest } from "@/lib/validate";

export const runtime = "nodejs";
// A 50-post batch at low effort normally finishes well inside this.
export const maxDuration = 120;

/**
 * POST /api/categorize — twtdash Pro hosted AI categorization.
 *
 * Headers: `Authorization: Bearer <licenseKey>`, `x-twtdash-instance: <instanceId>`
 * Body:    CategorizeApiRequest → CategorizeApiResponse
 *
 * Order: auth → license → body → server config → rate limit → Claude.
 * Post contents and license keys are never logged.
 */
export async function POST(request: Request) {
  // 1. Credentials
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  const licenseKey = match?.[1]?.trim();
  if (!licenseKey || licenseKey.length > 200) {
    return apiError(401, "unauthorized", "Missing license key. Send it as `Authorization: Bearer <licenseKey>`.");
  }
  const instanceId = request.headers.get(INSTANCE_HEADER)?.trim();
  if (!instanceId || instanceId.length > 200) {
    return apiError(401, "unauthorized", `Missing ${INSTANCE_HEADER} header. Activate your license first.`);
  }

  // 2. License (positive results cached ~10 minutes)
  try {
    const license = await validateLicenseCached(licenseKey, instanceId);
    if (!license.valid) {
      return apiError(401, "license_invalid", license.error || "This license is not active.");
    }
  } catch (err) {
    if (err instanceof LicenseServerError) return apiError(502, "upstream_error", err.message);
    console.error("[categorize] license check failed", { name: err instanceof Error ? err.name : typeof err });
    return apiError(502, "upstream_error", "Could not verify your license. Try again in a moment.");
  }

  // 3. Body
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const parsed = validateCategorizeRequest(body.data);
  if (!parsed.ok) return apiError(400, "bad_request", parsed.message);
  const payload = parsed.value;

  // 4. Server configuration (checked before consuming any quota)
  if (!isAiConfigured()) {
    return apiError(500, "server_misconfigured", "AI categorization is not configured on this server.");
  }

  // 5. Rate limits (per license, in-memory — see lib/rate-limit.ts)
  const limiterKey = licenseFingerprint(licenseKey);
  const limit = checkRateLimit(limiterKey, payload.tweets.length);
  if (!limit.ok) {
    return apiError(429, "rate_limited", limit.message, { "Retry-After": String(limit.retryAfterSeconds) });
  }

  // 6. Claude
  try {
    const result = await categorizeWithClaude(payload);
    recordPosts(limiterKey, payload.tweets.length);
    return json(result);
  } catch (err) {
    if (err instanceof CategorizeError) return apiError(err.status, err.code, err.message, err.headers);
    console.error("[categorize] unexpected error", { name: err instanceof Error ? err.name : typeof err });
    return apiError(502, "upstream_error", "Something went wrong while categorizing. Please try again.");
  }
}

export function OPTIONS() {
  return preflight();
}
