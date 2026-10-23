import { isAiConfigured } from "@/lib/anthropic";
import { json, preflight } from "@/lib/cors";
import { isLicensingConfigured } from "@/lib/license";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/health — liveness plus which hosted features are configured. */
export function GET() {
  return json({ ok: true, ai: isAiConfigured(), licensing: isLicensingConfigured() });
}

export function OPTIONS() {
  return preflight();
}
