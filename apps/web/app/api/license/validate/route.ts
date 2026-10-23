import type { LicenseValidateRequest } from "@twtdash/shared";
import { apiError, isRecord, json, preflight, readJsonBody } from "@/lib/cors";
import { LicenseServerError, validateLicense } from "@/lib/license";
import { requireString } from "@/lib/validate";

export const runtime = "nodejs";

/**
 * POST /api/license/validate
 * Body: LicenseValidateRequest → LicenseResponse.
 * License problems (expired, disabled, unknown instance…) return 200 with `valid: false`.
 */
export async function POST(request: Request) {
  const body = await readJsonBody(request, 10_000);
  if (!body.ok) return body.response;
  if (!isRecord(body.data)) return apiError(400, "bad_request", "Body must be a JSON object.");

  const licenseKey = requireString(body.data, "licenseKey");
  if (!licenseKey.ok) return apiError(400, "bad_request", licenseKey.message);

  const input: LicenseValidateRequest = { licenseKey: licenseKey.value };
  const rawInstance = body.data.instanceId;
  if (rawInstance !== undefined && rawInstance !== null && rawInstance !== "") {
    const instanceId = requireString(body.data, "instanceId");
    if (!instanceId.ok) return apiError(400, "bad_request", instanceId.message);
    input.instanceId = instanceId.value;
  }

  try {
    return json(await validateLicense(input.licenseKey, input.instanceId));
  } catch (err) {
    if (err instanceof LicenseServerError) return apiError(502, "upstream_error", err.message);
    console.error("[license/validate] unexpected error", { name: err instanceof Error ? err.name : typeof err });
    return apiError(502, "upstream_error", "Could not validate the license. Try again in a moment.");
  }
}

export function OPTIONS() {
  return preflight();
}
