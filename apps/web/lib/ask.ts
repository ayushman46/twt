import {
  AiCallError,
  ASK_LIMITS,
  NVIDIA_API_BASE,
  finishAnswer,
  isTranslateLanguage,
  openAnswerStream,
  readChatStream,
  requestAnswer,
  requestTranslation,
  type ApiErrorCode,
  type AskApiRequest,
  type AskApiResponse,
  type AskHistoryTurn,
  type AskPostInput,
  type TranslateApiRequest,
  type TranslateApiResponse,
} from "@twtdash/shared";
import { isRecord } from "./cors";
import { getModel } from "./llm";
import type { ValidationResult } from "./validate";

/**
 * Hosted "Ask your bookmarks" and post translation for twtdash Pro.
 *
 * Same prompt builders, transport and stream parser as the extension's
 * bring-your-own-key path (`@twtdash/shared`), so answers match whichever
 * path a user takes. Questions, posts and answers are never logged.
 */

/** Rate-limit cost in "posts" (the limiter's unit): an answer reads up to 20 posts, a translation one. */
export const ASK_COST = 10;
export const TRANSLATE_COST = 2;

export function getAskModel(): string {
  return process.env.TWTDASH_ASK_MODEL?.trim() || getModel();
}

function getBaseUrl(): string {
  return process.env.AI_BASE_URL?.trim() || NVIDIA_API_BASE;
}

/** A failure that maps directly onto an `ApiErrorBody` response. */
export class AskError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly headers?: Record<string, string>,
  ) {
    super(message);
    this.name = "AskError";
  }
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

const LIMITS = {
  id: 64,
  author: 200,
  category: 80,
  quoted: 1_000,
  cardTitle: 400,
  note: 1_000,
  tags: 10,
  tag: 40,
} as const;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function fail<T>(message: string): ValidationResult<T> {
  return { ok: false, message };
}

function str(value: unknown, max: number, nonEmpty = false): value is string {
  return typeof value === "string" && value.length <= max && (!nonEmpty || value.trim().length > 0);
}

function optional(raw: Record<string, unknown>, field: string, max: number, where: string): ValidationResult<string | undefined> {
  const value = raw[field];
  if (value === undefined || value === null) return { ok: true, value: undefined };
  if (!str(value, max)) return fail(`${where}.${field} must be a string of at most ${max} characters.`);
  return { ok: true, value };
}

function validatePost(raw: unknown, index: number): ValidationResult<AskPostInput> {
  const where = `posts[${index}]`;
  if (!isRecord(raw)) return fail(`${where} must be an object.`);
  if (!str(raw.id, LIMITS.id, true)) return fail(`${where}.id must be a non-empty string of at most ${LIMITS.id} characters.`);
  if (!str(raw.author, LIMITS.author)) return fail(`${where}.author must be a string of at most ${LIMITS.author} characters.`);
  if (!str(raw.text, ASK_LIMITS.postChars)) return fail(`${where}.text must be a string of at most ${ASK_LIMITS.postChars} characters.`);
  const post: AskPostInput = { id: raw.id, author: raw.author, text: raw.text };

  if (raw.saved !== undefined && raw.saved !== null) {
    if (typeof raw.saved !== "string" || !DATE.test(raw.saved)) return fail(`${where}.saved must be a YYYY-MM-DD date.`);
    post.saved = raw.saved;
  }
  for (const [field, max] of [
    ["category", LIMITS.category],
    ["quoted", LIMITS.quoted],
    ["cardTitle", LIMITS.cardTitle],
    ["note", LIMITS.note],
  ] as const) {
    const result = optional(raw, field, max, where);
    if (!result.ok) return fail(result.message);
    if (result.value !== undefined) post[field] = result.value;
  }
  if (raw.tags !== undefined && raw.tags !== null) {
    if (!Array.isArray(raw.tags) || raw.tags.length > LIMITS.tags || !raw.tags.every((t) => str(t, LIMITS.tag))) {
      return fail(`${where}.tags must be an array of at most ${LIMITS.tags} strings of at most ${LIMITS.tag} characters.`);
    }
    post.tags = raw.tags as string[];
  }
  return { ok: true, value: post };
}

function validateHistory(raw: unknown): ValidationResult<AskHistoryTurn[] | undefined> {
  if (raw === undefined || raw === null) return { ok: true, value: undefined };
  if (!Array.isArray(raw) || raw.length > ASK_LIMITS.historyTurns) {
    return fail(`history must be an array of at most ${ASK_LIMITS.historyTurns} turns.`);
  }
  const turns: AskHistoryTurn[] = [];
  for (let i = 0; i < raw.length; i++) {
    const t = raw[i];
    if (!isRecord(t) || !str(t.question, ASK_LIMITS.questionChars, true) || !str(t.answer, ASK_LIMITS.historyChars)) {
      return fail(`history[${i}] must have a question (at most ${ASK_LIMITS.questionChars} characters) and an answer (at most ${ASK_LIMITS.historyChars}).`);
    }
    turns.push({ question: t.question, answer: t.answer });
  }
  return { ok: true, value: turns };
}

export type AskRouteRequest = (AskApiRequest & { mode: "ask" }) | TranslateApiRequest;

/**
 * Validate a POST /api/ask body. Unknown fields are dropped so only known,
 * size-checked data reaches the prompt builders.
 */
export function validateAskRequest(body: unknown): ValidationResult<AskRouteRequest> {
  if (!isRecord(body)) return fail("Body must be a JSON object.");
  const mode = body.mode ?? "ask";

  if (mode === "translate") {
    if (!str(body.text, ASK_LIMITS.translateChars, true)) {
      return fail(`text must be a non-empty string of at most ${ASK_LIMITS.translateChars} characters.`);
    }
    if (!isTranslateLanguage(body.target)) return fail("target must be a supported language code.");
    return { ok: true, value: { mode: "translate", text: body.text, target: body.target } };
  }
  if (mode !== "ask") return fail('mode must be "ask" or "translate".');

  if (!str(body.question, ASK_LIMITS.questionChars, true)) {
    return fail(`question must be a non-empty string of at most ${ASK_LIMITS.questionChars} characters.`);
  }
  if (!Array.isArray(body.posts) || body.posts.length === 0 || body.posts.length > ASK_LIMITS.posts) {
    return fail(`posts must be an array of 1 to ${ASK_LIMITS.posts} items.`);
  }
  const posts: AskPostInput[] = [];
  const ids = new Set<string>();
  for (let i = 0; i < body.posts.length; i++) {
    const result = validatePost(body.posts[i], i);
    if (!result.ok) return fail(result.message);
    if (ids.has(result.value.id)) return fail(`Duplicate post id at posts[${i}].`);
    ids.add(result.value.id);
    posts.push(result.value);
  }
  const history = validateHistory(body.history);
  if (!history.ok) return fail(history.message);
  if (body.today !== undefined && body.today !== null && (typeof body.today !== "string" || !DATE.test(body.today))) {
    return fail("today must be a YYYY-MM-DD date.");
  }
  if (body.stream !== undefined && typeof body.stream !== "boolean") return fail("stream must be a boolean.");

  const value: AskApiRequest & { mode: "ask" } = { mode: "ask", question: body.question, posts };
  if (history.value?.length) value.history = history.value;
  if (typeof body.today === "string") value.today = body.today;
  if (body.stream) value.stream = true;
  return { ok: true, value };
}

/* -------------------------------------------------------------------------- */
/* AI                                                                         */
/* -------------------------------------------------------------------------- */

function apiKey(): string {
  const key = process.env.NVIDIA_API_KEY?.trim();
  if (!key) throw new AskError(500, "server_misconfigured", "AI is not configured on this server.");
  return key;
}

/** Map transport errors onto API error codes. Status and error kind only are logged. */
export function mapAskError(err: unknown, model: string, what: "answer" | "translate" = "answer"): AskError {
  if (err instanceof AskError) return err;
  if (!(err instanceof AiCallError)) {
    console.error(`[ask] unexpected error`, { model, what, name: err instanceof Error ? err.name : typeof err });
    return new AskError(502, "upstream_error", "Something went wrong. Please try again.");
  }
  console.error(`[ask] upstream failure`, { model, what, kind: err.kind, status: err.status });
  switch (err.kind) {
    case "refusal":
      return new AskError(422, "refusal", what === "answer" ? "The AI declined to answer this question." : "The AI declined to translate this post.");
    case "truncated":
      return new AskError(502, "upstream_error", "The AI ran out of room before answering. Try a narrower question.");
    case "invalid_output":
      return new AskError(502, "upstream_error", "The AI returned an empty response. Please try again.");
    case "network":
      return new AskError(502, "upstream_error", /too long/.test(err.message) ? "The AI took too long to respond. Please try again." : "Could not reach the AI service. Please try again.");
    case "http":
      if (err.status === 429) {
        return new AskError(429, "rate_limited", "The AI service is busy right now. Please try again shortly.", err.retryAfter ? { "Retry-After": err.retryAfter } : undefined);
      }
      if (err.status === 401 || err.status === 403 || err.status === 404) {
        return new AskError(500, "server_misconfigured", "AI is not configured correctly on this server.");
      }
      return new AskError(502, "upstream_error", "The AI service returned an error. Please try again.");
  }
}

export async function answerQuestion(req: AskApiRequest, signal: AbortSignal): Promise<AskApiResponse> {
  const model = getAskModel();
  try {
    const r = await requestAnswer({ ...req, apiKey: apiKey(), model, baseUrl: getBaseUrl(), signal });
    return { answer: r.answer, model: r.model, truncated: r.truncated, usage: r.usage };
  } catch (err) {
    throw mapAskError(err, model);
  }
}

export async function translatePost(req: TranslateApiRequest, signal: AbortSignal): Promise<TranslateApiResponse> {
  const model = getAskModel();
  try {
    return await requestTranslation({ ...req, apiKey: apiKey(), model, baseUrl: getBaseUrl(), signal });
  } catch (err) {
    throw mapAskError(err, model, "translate");
  }
}

const encoder = new TextEncoder();

function sse(data: unknown, event?: string): Uint8Array {
  const payload = typeof data === "string" ? data : JSON.stringify(data);
  return encoder.encode(`${event ? `event: ${event}\n` : ""}data: ${payload}\n\n`);
}

/**
 * Open the upstream stream (errors here become normal JSON error responses),
 * then relay the visible answer as OpenAI-style SSE chunks. Reasoning and
 * `<think>` blocks are filtered out before anything leaves the server.
 */
export async function streamQuestion(req: AskApiRequest, signal: AbortSignal, upstreamAbort: AbortController): Promise<ReadableStream<Uint8Array>> {
  const model = getAskModel();
  let upstream: Response;
  try {
    upstream = await openAnswerStream({ ...req, apiKey: apiKey(), model, baseUrl: getBaseUrl(), signal });
  } catch (err) {
    throw mapAskError(err, model);
  }

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (data: unknown, event?: string) => {
        if (!open) return;
        try {
          controller.enqueue(sse(data, event));
        } catch {
          open = false;
        }
      };
      let sent = "";
      try {
        const out = await readChatStream(upstream, {
          signal,
          onText: (text) => {
            if (text.startsWith(sent)) {
              const delta = text.slice(sent.length);
              if (delta) send({ model, choices: [{ index: 0, delta: { content: delta }, finish_reason: null }] });
            } else {
              // The model's earlier output turned out to be reasoning: start over.
              send({}, "reset");
              if (text) send({ model, choices: [{ index: 0, delta: { content: text }, finish_reason: null }] });
            }
            sent = text;
          },
        });
        const done = finishAnswer(out, model);
        send({ model: done.model, choices: [{ index: 0, delta: {}, finish_reason: done.truncated ? "length" : "stop" }], usage: out.usage ? { prompt_tokens: out.usage.input_tokens, completion_tokens: out.usage.output_tokens } : undefined });
        send("[DONE]");
      } catch (err) {
        if (!signal.aborted || (signal.reason as Error | undefined)?.name === "TimeoutError") {
          const e = mapAskError(err, model);
          send({ error: { code: e.code, message: e.message } }, "error");
        }
      } finally {
        if (open) {
          open = false;
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      }
    },
    cancel() {
      // The extension stopped reading (user pressed stop): stop paying for tokens.
      upstreamAbort.abort();
    },
  });
}
