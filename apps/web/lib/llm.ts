import {
  AiCallError,
  DEFAULT_AI_MODEL,
  NVIDIA_API_BASE,
  requestCategorization,
  type ApiErrorCode,
  type CategorizeApiRequest,
  type CategorizeApiResponse,
} from "@twtdash/shared";

/**
 * Hosted twtdash Pro categorization, powered by NVIDIA's free API catalog.
 *
 * Uses the exact same prompt builder, transport and output parser as the
 * extension's bring-your-own-key path (`@twtdash/shared`), so results are
 * identical whichever path a user takes. Post contents are never logged.
 *
 * `AI_BASE_URL` can point at any OpenAI-compatible chat-completions server
 * (for example a paid provider once you outgrow NVIDIA's free tier).
 */

export function isAiConfigured(): boolean {
  return Boolean(process.env.NVIDIA_API_KEY?.trim());
}

export function getModel(): string {
  return process.env.TWTDASH_AI_MODEL?.trim() || DEFAULT_AI_MODEL;
}

function getBaseUrl(): string {
  return process.env.AI_BASE_URL?.trim() || NVIDIA_API_BASE;
}

/** A failure that maps directly onto an `ApiErrorBody` response. */
export class CategorizeError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly headers?: Record<string, string>,
  ) {
    super(message);
    this.name = "CategorizeError";
  }
}

export async function categorizeWithAi(request: CategorizeApiRequest): Promise<CategorizeApiResponse> {
  const apiKey = process.env.NVIDIA_API_KEY?.trim();
  if (!apiKey) {
    throw new CategorizeError(500, "server_misconfigured", "AI categorization is not configured on this server.");
  }

  const model = getModel();
  try {
    // Fits inside the route's maxDuration with room for the license check.
    return await requestCategorization({ ...request, apiKey, model, baseUrl: getBaseUrl(), signal: AbortSignal.timeout(100_000) });
  } catch (err) {
    throw mapUpstreamError(err, model);
  }
}

/** Map transport errors onto API error codes. */
function mapUpstreamError(err: unknown, model: string): CategorizeError {
  if (!(err instanceof AiCallError)) {
    console.error("[categorize] unexpected error", { model, name: err instanceof Error ? err.name : typeof err });
    return new CategorizeError(502, "upstream_error", "Something went wrong while categorizing. Please try again.");
  }
  // Status and error kind only — never request contents or keys.
  console.error("[categorize] upstream failure", { model, kind: err.kind, status: err.status });
  switch (err.kind) {
    case "refusal":
      return new CategorizeError(422, "refusal", "The AI declined to categorize this batch of posts.");
    case "truncated":
      return new CategorizeError(502, "upstream_error", "The AI response was truncated — send fewer posts per request.");
    case "invalid_output":
      return new CategorizeError(502, "upstream_error", "The AI returned an unexpected response. Please try again.");
    case "network":
      return new CategorizeError(502, "upstream_error", "Could not reach the AI service. Please try again.");
    case "http":
      if (err.status === 429) {
        return new CategorizeError(
          429,
          "rate_limited",
          "The AI service is busy right now. Please try again shortly.",
          err.retryAfter ? { "Retry-After": err.retryAfter } : undefined,
        );
      }
      if (err.status === 401 || err.status === 403 || err.status === 404) {
        return new CategorizeError(500, "server_misconfigured", "AI categorization is not configured correctly on this server.");
      }
      return new CategorizeError(502, "upstream_error", "The AI service returned an error. Please try again.");
  }
}
