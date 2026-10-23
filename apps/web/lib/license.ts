import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import type { LicenseResponse, LicenseStatus } from "@twtdash/shared";
import { isRecord } from "./cors";

/**
 * twtdash Pro licensing via the LemonSqueezy License API.
 *
 * The License API is public (no LemonSqueezy API key needed); requests are
 * form-encoded and identified only by the license key itself. Docs:
 * https://docs.lemonsqueezy.com/api/license-api
 *
 * Never log license keys — use `licenseFingerprint()` when an identifier is
 * needed.
 */

const LEMONSQUEEZY_LICENSE_API = "https://api.lemonsqueezy.com/v1/licenses";
const LEMONSQUEEZY_TIMEOUT_MS = 10_000;

/** The license server could not be reached or answered unexpectedly. */
export class LicenseServerError extends Error {
  constructor(message = "Could not reach the license server. Try again in a moment.") {
    super(message);
    this.name = "LicenseServerError";
  }
}

interface LemonSqueezyLicenseResponse {
  activated?: boolean;
  valid?: boolean;
  error?: string | null;
  license_key?: {
    status?: string;
    expires_at?: string | null;
  } | null;
  instance?: { id?: string } | null;
  meta?: {
    store_id?: number | string;
    product_id?: number | string;
    product_name?: string;
    variant_name?: string;
    customer_name?: string;
    customer_email?: string;
  } | null;
}

async function callLemonSqueezy(
  action: "activate" | "validate",
  params: Record<string, string>,
): Promise<LemonSqueezyLicenseResponse> {
  let res: Response;
  try {
    res = await fetch(`${LEMONSQUEEZY_LICENSE_API}/${action}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params).toString(),
      signal: AbortSignal.timeout(LEMONSQUEEZY_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    throw new LicenseServerError();
  }

  // 4xx responses (unknown key, instance not found, activation limit reached…)
  // still carry a JSON body with `error`, so only 429/5xx are treated as outages.
  if (res.status === 429 || res.status >= 500) {
    throw new LicenseServerError(
      res.status === 429
        ? "The license server is busy. Try again in a minute."
        : "The license server is unavailable. Try again in a moment.",
    );
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new LicenseServerError("The license server returned an unexpected response.");
  }
  if (!isRecord(data)) {
    throw new LicenseServerError("The license server returned an unexpected response.");
  }
  return data as LemonSqueezyLicenseResponse;
}

function normalizeStatus(status: string | undefined): LicenseStatus {
  switch (status) {
    case "active":
    case "inactive":
    case "expired":
    case "disabled":
      return status;
    default:
      return "invalid";
  }
}

function parseIdList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function hasProductRestrictions(): boolean {
  return Boolean(process.env.LEMONSQUEEZY_STORE_ID?.trim()) || parseIdList(process.env.LEMONSQUEEZY_PRODUCT_IDS).length > 0;
}

/** Returns an error message when the key belongs to another store/product. */
function productMismatch(meta: LemonSqueezyLicenseResponse["meta"]): string | null {
  const storeId = process.env.LEMONSQUEEZY_STORE_ID?.trim();
  if (storeId && String(meta?.store_id ?? "") !== storeId) {
    return "This license key is not a twtdash license.";
  }
  const productIds = parseIdList(process.env.LEMONSQUEEZY_PRODUCT_IDS);
  if (productIds.length > 0 && !productIds.includes(String(meta?.product_id ?? ""))) {
    return "This license key is not for twtdash Pro.";
  }
  return null;
}

function planName(meta: LemonSqueezyLicenseResponse["meta"]): string {
  const variant = meta?.variant_name?.trim();
  if (variant && variant.toLowerCase() !== "default") return variant;
  return meta?.product_name?.trim() || "Pro";
}

function defaultError(status: LicenseStatus): string {
  switch (status) {
    case "expired":
      return "This license has expired.";
    case "disabled":
      return "This license has been disabled.";
    default:
      return "This license key is not valid.";
  }
}

function toLicenseResponse(ls: LemonSqueezyLicenseResponse, succeeded: boolean): LicenseResponse {
  if (!ls.license_key) {
    return { valid: false, status: "invalid", error: ls.error || "License key not found." };
  }
  const mismatch = productMismatch(ls.meta);
  if (mismatch) {
    return { valid: false, status: "invalid", error: mismatch };
  }

  const status = normalizeStatus(ls.license_key.status);
  const valid = succeeded && (status === "active" || status === "inactive");

  const response: LicenseResponse = {
    valid,
    status,
    plan: planName(ls.meta),
    expiresAt: ls.license_key.expires_at ?? null,
  };
  if (ls.instance?.id) response.instanceId = ls.instance.id;
  if (ls.meta?.customer_name) response.customerName = ls.meta.customer_name;
  if (ls.meta?.customer_email) response.customerEmail = ls.meta.customer_email;
  if (!valid) response.error = ls.error || defaultError(status);
  return response;
}

/* -------------------------------------------------------------------------- */
/* Dev escape hatch                                                           */
/* -------------------------------------------------------------------------- */

let warnedAboutDevLicense = false;

/** Constant-time comparison against `TWTDASH_DEV_LICENSE`. */
export function isDevLicense(licenseKey: string): boolean {
  const dev = process.env.TWTDASH_DEV_LICENSE;
  if (!dev) return false;
  if (!warnedAboutDevLicense && process.env.NODE_ENV === "production") {
    warnedAboutDevLicense = true;
    console.warn("[license] TWTDASH_DEV_LICENSE is set: anyone with that key gets Pro. Unset it for real deployments.");
  }
  const a = createHash("sha256").update(licenseKey).digest();
  const b = createHash("sha256").update(dev).digest();
  return timingSafeEqual(a, b);
}

function devLicense(instanceId?: string): LicenseResponse {
  return {
    valid: true,
    status: "active",
    plan: "Pro (dev)",
    instanceId: instanceId || `dev-${randomUUID()}`,
    expiresAt: null,
  };
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/** Activate a license key for one device ("instance"). */
export async function activateLicense(licenseKey: string, instanceName: string): Promise<LicenseResponse> {
  if (isDevLicense(licenseKey)) return devLicense();

  // Check store/product first so a foreign key never burns an activation slot.
  if (hasProductRestrictions()) {
    const pre = await callLemonSqueezy("validate", { license_key: licenseKey });
    if (!pre.license_key) return toLicenseResponse(pre, false);
    const mismatch = productMismatch(pre.meta);
    if (mismatch) return { valid: false, status: "invalid", error: mismatch };
  }

  const ls = await callLemonSqueezy("activate", { license_key: licenseKey, instance_name: instanceName });
  return toLicenseResponse(ls, ls.activated === true);
}

/** Validate a license key, optionally scoped to an activated instance. */
export async function validateLicense(licenseKey: string, instanceId?: string): Promise<LicenseResponse> {
  if (isDevLicense(licenseKey)) return devLicense(instanceId);

  const params: Record<string, string> = { license_key: licenseKey };
  if (instanceId) params.instance_id = instanceId;
  const ls = await callLemonSqueezy("validate", params);
  return toLicenseResponse(ls, ls.valid === true);
}

/** Stable, non-reversible identifier for a license key (for caches, rate limits, logs). */
export function licenseFingerprint(licenseKey: string, instanceId = ""): string {
  return createHash("sha256").update(`${licenseKey}\u0000${instanceId}`).digest("hex");
}

/*
 * Positive validation results are cached in memory for 10 minutes so the
 * categorize endpoint doesn't hit LemonSqueezy on every batch. Like the rate
 * limiter, this cache is per server instance.
 */
const VALIDATION_TTL_MS = 10 * 60 * 1000;
const VALIDATION_CACHE_MAX = 5_000;
const validationCache = new Map<string, { expires: number; license: LicenseResponse }>();

export async function validateLicenseCached(licenseKey: string, instanceId: string): Promise<LicenseResponse> {
  const key = licenseFingerprint(licenseKey, instanceId);
  const now = Date.now();
  const hit = validationCache.get(key);
  if (hit) {
    if (hit.expires > now) return hit.license;
    validationCache.delete(key);
  }

  const license = await validateLicense(licenseKey, instanceId);
  if (license.valid) {
    if (validationCache.size >= VALIDATION_CACHE_MAX) {
      const oldest = validationCache.keys().next().value;
      if (oldest !== undefined) validationCache.delete(oldest);
    }
    validationCache.set(key, { expires: now + VALIDATION_TTL_MS, license });
  }
  return license;
}

/** True when license checks are locked to a store/product or a dev license is configured. */
export function isLicensingConfigured(): boolean {
  return hasProductRestrictions() || Boolean(process.env.TWTDASH_DEV_LICENSE);
}
