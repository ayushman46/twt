/**
 * Lightweight AI helpers that don't pull in the Anthropic SDK. The runner
 * (`./ai`) is loaded with a dynamic import only when AI actually runs.
 */
import { db } from './db';
import type { Settings } from './storage';

export const API_BASE: string = (import.meta.env.WXT_API_BASE as string | undefined)?.replace(/\/$/, '') || 'https://twtdash.app';

export type AiErrorCode = 'auth' | 'license' | 'rate' | 'refusal' | 'network' | 'config' | 'other';

export class AiError extends Error {
  constructor(
    message: string,
    public code: AiErrorCode,
    public retryable = false,
  ) {
    super(message);
  }
}

export function aiReady(s: Settings): boolean {
  if (s.ai.provider === 'byok') return !!s.ai.apiKey.trim();
  if (s.ai.provider === 'pro') return s.license?.status === 'active';
  return false;
}

export async function pendingAiCount(): Promise<number> {
  return db.bookmarks.filter((b) => !b.aiAt && !b.partial).count();
}
