import { API_PATHS, type LicenseActivateRequest, type LicenseResponse, type LicenseValidateRequest } from '@twtdash/shared';
import { API_BASE } from './ai-config';
import type { LicenseInfo, Settings } from './storage';

function deviceName(): string {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /CrOS/.test(ua) ? 'ChromeOS' : /Linux/.test(ua) ? 'Linux' : 'device';
  return `twtdash · ${browser} on ${os}`;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_BASE + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new Error('Could not reach twtdash.app. Check your connection and try again.');
  }
  const data = (await res.json().catch(() => null)) as T | { error?: { message?: string } } | null;
  if (!data) throw new Error(`License server error (${res.status}).`);
  return data as T;
}

function toInfo(key: string, r: LicenseResponse, prev?: LicenseInfo | null): LicenseInfo {
  return {
    key,
    instanceId: r.instanceId ?? prev?.instanceId,
    status: r.status,
    plan: r.plan ?? prev?.plan,
    email: r.customerEmail ?? prev?.email,
    name: r.customerName ?? prev?.name,
    expiresAt: r.expiresAt ?? null,
    validatedAt: Date.now(),
  };
}

export async function activateLicense(key: string): Promise<LicenseInfo> {
  const body: LicenseActivateRequest = { licenseKey: key.trim(), instanceName: deviceName() };
  const r = await post<LicenseResponse>(API_PATHS.licenseActivate, body);
  if (!r.valid) throw new Error(r.error || 'That license key is not valid.');
  return toInfo(body.licenseKey, r);
}

export async function validateLicense(info: LicenseInfo): Promise<LicenseInfo> {
  const body: LicenseValidateRequest = { licenseKey: info.key, instanceId: info.instanceId };
  const r = await post<LicenseResponse>(API_PATHS.licenseValidate, body);
  return toInfo(info.key, r, info);
}

export function hasPro(s: Settings): boolean {
  return s.license?.status === 'active';
}

/** Re-check the license at most once a day. */
export function licenseNeedsCheck(info: LicenseInfo | null): boolean {
  return !!info && Date.now() - info.validatedAt > 24 * 3_600_000;
}
