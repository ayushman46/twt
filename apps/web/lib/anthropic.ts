import Anthropic from "@anthropic-ai/sdk";
import {
  DEFAULT_AI_MODEL,
  SERVER_FALLBACK_BETA,
  buildCategorizeRequest,
  parseCategorizeOutput,
  supportsServerFallback,
  type ApiErrorCode,
  type CategorizeApiRequest,
  type CategorizeApiResponse,
} from "@twtdash/shared";

/**
 * Hosted twtdash Pro categorization, powered by Claude.
 *
 * Uses the exact same prompt builder and output parser as the extension's
 * bring-your-own-key path (`@twtdash/shared`), so results are identical
 * whichever path a user takes. Post contents are never logged.
 */

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export function getModel(): string {
  return process.env.TWTDASH_AI_MODEL?.trim() || DEFAULT_AI_MODEL;
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  // Reads ANTHROPIC_API_KEY from the environment. One retry and a timeout that
  // fits inside the route's maxDuration; the SDK retries 429/5xx/connection errors.
  client ??= new Anthropic({ maxRetries: 1, timeout: 100_000 });
  return client;
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

export async function categorizeWithClaude(request: CategorizeApiRequest): Promise<CategorizeApiResponse> {
  if (!isAiConfigured()) {
    throw new CategorizeError(500, "server_misconfigured", "AI categorization is not configured on this server.");
  }

  const { categories, tweets, summaries } = request;
  const model = getModel();

  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await getClient().beta.messages.create({
      ...buildCategorizeRequest({ categories, tweets, summaries }),
      model,
      // Server-side refusal fallback is only offered on the Opus / Sonnet / Fable lines.
      ...(supportsServerFallback(model) ? { betas: [SERVER_FALLBACK_BETA], fallbacks: "default" as const } : {}),
    });
  } catch (err) {
    throw mapAnthropicError(err, model);
  }

  // Always check why generation stopped before reading content.
  if (response.stop_reason === "refusal") {
    throw new CategorizeError(422, "refusal", "Claude declined to categorize this batch of posts.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new CategorizeError(502, "upstream_error", "The AI response was truncated — send fewer posts per request.");
  }

  const text = response.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  let results;
  try {
    results = parseCategorizeOutput(
      text,
      tweets.map((t) => t.id),
      categories.map((c) => c.id),
    );
  } catch (err) {
    console.error("[categorize] could not parse model output", {
      model: response.model,
      reason: err instanceof Error ? err.message : "unknown",
    });
    throw new CategorizeError(502, "upstream_error", "The AI returned an unexpected response. Please try again.");
  }

  return {
    results,
    model: response.model,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  };
}

/** Map SDK errors onto API error codes, most specific class first. */
function mapAnthropicError(err: unknown, model: string): CategorizeError {
  if (err instanceof Anthropic.RateLimitError) {
    const retryAfter = err.headers?.get("retry-after");
    logUpstream("rate limited", err, model);
    return new CategorizeError(
      429,
      "rate_limited",
      "The AI service is busy right now. Please try again shortly.",
      retryAfter ? { "Retry-After": retryAfter } : undefined,
    );
  }
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    logUpstream("credentials rejected", err, model);
    return new CategorizeError(500, "server_misconfigured", "AI categorization is not configured correctly on this server.");
  }
  // In the TypeScript SDK APIConnectionError extends APIError, so check it first.
  if (err instanceof Anthropic.APIConnectionError) {
    logUpstream("connection error", err, model);
    return new CategorizeError(502, "upstream_error", "Could not reach the AI service. Please try again.");
  }
  if (err instanceof Anthropic.APIError) {
    logUpstream("api error", err, model);
    return new CategorizeError(502, "upstream_error", "The AI service returned an error. Please try again.");
  }
  console.error("[categorize] unexpected error", { model, name: err instanceof Error ? err.name : typeof err });
  return new CategorizeError(502, "upstream_error", "Something went wrong while categorizing. Please try again.");
}

function logUpstream(what: string, err: InstanceType<typeof Anthropic.APIError>, model: string): void {
  // Status, error type and request id only — never request contents or keys.
  console.error(`[categorize] anthropic ${what}`, {
    model,
    status: err.status,
    type: err.type,
    requestId: err.requestID,
  });
}
