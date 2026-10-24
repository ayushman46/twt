import { INSTANCE_HEADER } from "@twtdash/shared";
import { ASK_COST, AskError, TRANSLATE_COST, answerQuestion, streamQuestion, translatePost, validateAskRequest } from "@/lib/ask";
import { CORS_HEADERS, apiError, json, preflight, readJsonBody } from "@/lib/cors";
import { LicenseServerError, licenseFingerprint, validateLicenseCached } from "@/lib/license";
import { isAiConfigured } from "@/lib/llm";
import { checkRateLimit, recordPosts } from "@/lib/rate-limit";

export const runtime = "nodejs";
// A streamed answer normally finishes in well under a minute.
export const maxDuration = 120;

/** Ask bodies are small: 20 posts × 2,500 characters plus a little history. */
const MAX_ASK_BODY_BYTES = 200_000;

/**
 * POST /api/ask — twtdash Pro "Ask your bookmarks" and post translation.
 *
 * Headers: `Authorization: Bearer <licenseKey>`, `x-twtdash-instance: <instanceId>`
 * Body:    AskApiRequest → AskApiResponse, or SSE when `stream: true`
 *          TranslateApiRequest (`mode: "translate"`) → TranslateApiResponse
 *
 * Order: auth → license → body → server config → rate limit → AI.
 * Questions, posts, answers and license keys are never logged.
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
    if (!license.valid) return apiError(401, "license_invalid", license.error || "This license is not active.");
  } catch (err) {
    if (err instanceof LicenseServerError) return apiError(502, "upstream_error", err.message);
    console.error("[ask] license check failed", { name: err instanceof Error ? err.name : typeof err });
    return apiError(502, "upstream_error", "Could not verify your license. Try again in a moment.");
  }

  // 3. Body
  const body = await readJsonBody(request, MAX_ASK_BODY_BYTES);
  if (!body.ok) return body.response;
  const parsed = validateAskRequest(body.data);
  if (!parsed.ok) return apiError(400, "bad_request", parsed.message);
  const payload = parsed.value;

  // 4. Server configuration (checked before consuming any quota)
  if (!isAiConfigured()) return apiError(500, "server_misconfigured", "AI is not configured on this server.");

  // 5. Rate limits — a separate budget from categorization, same limiter (see lib/rate-limit.ts)
  const limiterKey = `ask:${licenseFingerprint(licenseKey)}`;
  const cost = payload.mode === "translate" ? TRANSLATE_COST : ASK_COST;
  const limit = checkRateLimit(limiterKey, cost);
  if (!limit.ok) {
    const minutes = Math.ceil(limit.retryAfterSeconds / 60);
    const message =
      limit.retryAfterSeconds <= 60
        ? `Too many AI requests. Try again in ${limit.retryAfterSeconds} seconds.`
        : `Daily Pro AI limit reached. Try again in ${minutes >= 90 ? `about ${Math.round(minutes / 60)} hours` : `${minutes} minutes`}.`;
    return apiError(429, "rate_limited", message, { "Retry-After": String(limit.retryAfterSeconds) });
  }

  // 6. AI (NVIDIA API catalog by default)
  const upstreamAbort = new AbortController();
  const signal = AbortSignal.any([request.signal, upstreamAbort.signal, AbortSignal.timeout(110_000)]);
  try {
    if (payload.mode === "translate") {
      const result = await translatePost(payload, signal);
      recordPosts(limiterKey, cost);
      return json(result);
    }
    if (payload.stream) {
      const stream = await streamQuestion(payload, signal, upstreamAbort);
      recordPosts(limiterKey, cost);
      return new Response(stream, {
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-store, no-transform",
          "X-Accel-Buffering": "no",
        },
      });
    }
    const result = await answerQuestion(payload, signal);
    recordPosts(limiterKey, cost);
    return json(result);
  } catch (err) {
    if (err instanceof AskError) return apiError(err.status, err.code, err.message, err.headers);
    console.error("[ask] unexpected error", { name: err instanceof Error ? err.name : typeof err });
    return apiError(502, "upstream_error", "Something went wrong. Please try again.");
  }
}

export function OPTIONS() {
  return preflight();
}
