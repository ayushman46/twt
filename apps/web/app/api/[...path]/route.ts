import { apiError, preflight } from "@/lib/cors";

/**
 * Unknown /api/* paths: answer like the rest of the API (JSON + CORS) instead
 * of the HTML 404 page, so a client calling a wrong endpoint gets a readable
 * error. Real endpoints are more specific and always win.
 */
function notFound() {
  return apiError(404, "not_found", "There is no API endpoint at this path.");
}

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;

export function OPTIONS() {
  return preflight();
}
