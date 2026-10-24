/**
 * Contract between the twtdash extension and the hosted twtdash API
 * (apps/web). All endpoints accept and return JSON and allow CORS from any
 * origin — authentication is the license key, never cookies.
 */
import type { AiCategoryInput, AiResult, AiTweetInput, AskHistoryTurn, AskPostInput, TranslateLanguageCode } from './ai';

export const API_PATHS = {
  health: '/api/health',
  categorize: '/api/categorize',
  licenseActivate: '/api/license/activate',
  licenseValidate: '/api/license/validate',
  ask: '/api/ask',
} as const;

/** GET /api/health */
export interface HealthResponse {
  ok: true;
  /** NVIDIA_API_KEY is configured */
  ai: boolean;
  /** License validation is configured (LemonSqueezy store/product or a dev key) */
  licensing: boolean;
}

/** Header carrying the license instance id returned by activation. Required by /api/categorize. */
export const INSTANCE_HEADER = 'x-twtdash-instance';

/**
 * POST /api/categorize
 * Headers: `Authorization: Bearer <licenseKey>`, `x-twtdash-instance: <instanceId>`
 */
export interface CategorizeApiRequest {
  categories: AiCategoryInput[];
  tweets: AiTweetInput[];
  summaries: boolean;
}

export interface CategorizeApiResponse {
  results: AiResult[];
  model: string;
  usage?: { input_tokens: number; output_tokens: number };
}

/**
 * POST /api/ask — "Ask your bookmarks" and post translation for Pro.
 * Same headers as /api/categorize. Limits: see `ASK_LIMITS`.
 *
 * `mode: "ask"` (default) with `stream: true` answers with Server-Sent
 * Events in the OpenAI chat-completions chunk format
 * (`data: {"choices":[{"delta":{"content":"…"}}]}` … `data: [DONE]`);
 * a failure after the stream started arrives as `event: error` with an
 * `ApiErrorBody`. Without `stream` the reply is `AskApiResponse` JSON.
 * Errors before any output are regular `ApiErrorBody` JSON responses.
 */
export interface AskApiRequest {
  mode?: 'ask';
  question: string;
  /** Context posts, cited by the answer as [1]…[n] in this order. */
  posts: AskPostInput[];
  history?: AskHistoryTurn[];
  /** The user's local date (YYYY-MM-DD). */
  today?: string;
  stream?: boolean;
}

export interface AskApiResponse {
  answer: string;
  model: string;
  truncated: boolean;
  usage?: { input_tokens: number; output_tokens: number };
}

/** POST /api/ask with `mode: "translate"` */
export interface TranslateApiRequest {
  mode: 'translate';
  text: string;
  target: TranslateLanguageCode;
}

export interface TranslateApiResponse {
  text: string;
  model: string;
  truncated: boolean;
}

/**
 * POST /api/license/activate
 * License problems (unknown key, expired, activation limit…) return HTTP 200
 * with `valid: false` and an `error` message; `ApiErrorBody` is only used for
 * malformed requests (400) and an unreachable license provider (502).
 */
export interface LicenseActivateRequest {
  licenseKey: string;
  /** Human readable device label, e.g. "Chrome on macOS" */
  instanceName: string;
}

/** POST /api/license/validate */
export interface LicenseValidateRequest {
  licenseKey: string;
  instanceId?: string;
}

export type LicenseStatus = 'active' | 'inactive' | 'expired' | 'disabled' | 'invalid';

export interface LicenseResponse {
  valid: boolean;
  status: LicenseStatus;
  instanceId?: string;
  plan?: string;
  customerName?: string;
  customerEmail?: string;
  expiresAt?: string | null;
  error?: string;
}

export type ApiErrorCode =
  | 'unauthorized'
  | 'license_invalid'
  | 'rate_limited'
  | 'bad_request'
  | 'refusal'
  | 'upstream_error'
  | 'server_misconfigured';

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string };
}
