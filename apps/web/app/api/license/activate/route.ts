import type { LicenseActivateRequest } from "@twtdash/shared";
import { apiError, isRecord, json, preflight, readJsonBody } from "@/lib/cors";
import { LicenseServerError, activateLicense } from "@/lib/license";
import { requireString } from "@/lib/validate";

export const runtime = "nodejs";

/**
 * POST /api/license/activate
 * Body: LicenseActivateRequest → LicenseResponse.
 * License problems (unknown key, activation limit…) return 200 with `valid: false`.
 */
export async function POST(request: Request) {
  const body = await readJsonBody(request, 10_000);
  if (!body.ok) return body.response;
  if (!isRecord(body.data)) return apiError(400, "bad_request", "Body must be a JSON object.");

  const licenseKey = requireString(body.data, "licenseKey");
  if (!licenseKey.ok) return apiError(400, "bad_request", licenseKey.message);
  const instanceName = requireString(body.data, "instanceName");
  if (!instanceName.ok) return apiError(400, "bad_request", instanceName.message);

  const input: LicenseActivateRequest = { licenseKey: licenseKey.value, instanceName: instanceName.value };

  try {
    return json(await activateLicense(input.licenseKey, input.instanceName));
  } catch (err) {
    if (err instanceof LicenseServerError) return apiError(502, "upstream_error", err.message);
    console.error("[license/activate] unexpected error", { name: err instanceof Error ? err.name : typeof err });
    return apiError(502, "upstream_error", "Could not activate the license. Try again in a moment.");
  }
}

export function OPTIONS() {
  return preflight();
}
