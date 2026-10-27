import { INSTANCE_HEADER, type ApiErrorBody, type ApiErrorCode } from "@twtdash/shared";

/**
 * Every `/api/*` route is called cross-origin by the extension
 * (chrome-extension://… / moz-extension://…). Authentication is the license
 * key in the `Authorization` header — never cookies — so allowing any origin
 * is safe.
 */
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": `content-type, authorization, ${INSTANCE_HEADER}`,
  "Access-Control-Max-Age": "86400",
};

const BASE_HEADERS: Record<string, string> = {
  ...CORS_HEADERS,
  "Cache-Control": "no-store",
};

/** Response for CORS preflight (`OPTIONS`) requests. */
export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/** JSON response with CORS + no-store headers. */
export function json<T>(body: T, init: { status?: number; headers?: Record<string, string> } = {}): Response {
  return Response.json(body, {
    status: init.status ?? 200,
    headers: { ...BASE_HEADERS, ...init.headers },
  });
}

/** Error response in the shared `ApiErrorBody` shape. */
export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  headers?: Record<string, string>,
): Response {
  const body: ApiErrorBody = { error: { code, message } };
  return json(body, { status, headers });
}

/** Maximum accepted request body, in bytes. */
export const MAX_BODY_BYTES = 1_000_000;

export type JsonBodyResult = { ok: true; data: unknown } | { ok: false; response: Response };

/**
 * Read the body as UTF-8 text, giving up as soon as it exceeds `maxBytes`, so
 * a chunked upload without a Content-Length can't make the server buffer an
 * unbounded body. Returns `null` when the body is too large.
 */
async function readTextCapped(request: Request, maxBytes: number): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Read and parse a JSON request body with a size cap. Returns a ready-made
 * 400 response when the body is missing, too large or not valid JSON.
 */
export async function readJsonBody(request: Request, maxBytes = MAX_BODY_BYTES): Promise<JsonBodyResult> {
  const tooLarge = (): JsonBodyResult => ({ ok: false, response: apiError(400, "bad_request", "Request body is too large.") });
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > maxBytes) return tooLarge();
  let text: string | null;
  try {
    text = await readTextCapped(request, maxBytes);
  } catch {
    return { ok: false, response: apiError(400, "bad_request", "Could not read the request body.") };
  }
  if (text === null) return tooLarge();
  if (!text.trim()) {
    return { ok: false, response: apiError(400, "bad_request", "Request body must be JSON.") };
  }
  try {
    return { ok: true, data: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, response: apiError(400, "bad_request", "Request body is not valid JSON.") };
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
