import { storage } from 'wxt/utils/storage';
import { DEFAULT_AI_MODEL, isKnownModel, type LicenseStatus } from '@twtdash/shared';
import type { Source } from './types';

export type ViewMode = 'grid' | 'list' | 'table' | 'gallery';
export type AiProvider = 'off' | 'pro' | 'byok';

export interface LicenseInfo {
  key: string;
  instanceId?: string;
  status: LicenseStatus;
  plan?: string;
  email?: string;
  name?: string;
  expiresAt?: string | null;
  validatedAt: number;
}

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  defaultView: ViewMode;
  density: 'comfortable' | 'compact';
  showSummaries: boolean;
  showMetrics: boolean;
  /** Remove a post from twtdash when it's un-bookmarked on X. */
  mirrorDeletions: boolean;
  /** Capture posts you like on X in real time. */
  captureLikes: boolean;
  /** Small confirmation toasts on x.com. */
  toasts: boolean;
  /** Floating twtdash pill on the X bookmarks page. */
  pageButton: boolean;
  ai: {
    provider: AiProvider;
    apiKey: string;
    model: string;
    summaries: boolean;
    autoRun: boolean;
  };
  license: LicenseInfo | null;
  onboarded: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  defaultView: 'grid',
  density: 'comfortable',
  showSummaries: true,
  showMetrics: true,
  mirrorDeletions: true,
  captureLikes: false,
  toasts: true,
  pageButton: true,
  ai: { provider: 'off', apiKey: '', model: DEFAULT_AI_MODEL, summaries: true, autoRun: true },
  license: null,
  onboarded: false,
};

export const settingsItem = storage.defineItem<Settings>('local:settings', { fallback: DEFAULT_SETTINGS });

export function mergeSettings(s: Partial<Settings> | null | undefined): Settings {
  const ai = { ...DEFAULT_SETTINGS.ai, ...s?.ai };
  // Earlier builds used Claude: retire stale model ids and Anthropic keys.
  if (!isKnownModel(ai.model)) ai.model = DEFAULT_AI_MODEL;
  if (ai.apiKey.startsWith('sk-ant-')) ai.apiKey = '';
  return { ...DEFAULT_SETTINGS, ...s, ai };
}

export async function getSettings(): Promise<Settings> {
  return mergeSettings(await settingsItem.getValue());
}

export async function updateSettings(patch: Partial<Settings> | ((s: Settings) => Partial<Settings>)): Promise<Settings> {
  const current = await getSettings();
  const next = mergeSettings({ ...current, ...(typeof patch === 'function' ? patch(current) : patch) });
  await settingsItem.setValue(next);
  return next;
}

export type SyncStatus = 'idle' | 'starting' | 'running' | 'done' | 'stopped' | 'error';
export type SyncMode = 'quick' | 'full';

export interface SyncState {
  status: SyncStatus;
  runId?: string;
  source: Source;
  mode: SyncMode;
  tabId?: number;
  startedAt?: number;
  finishedAt?: number;
  found: number;
  added: number;
  message?: string;
}

export const IDLE_SYNC: SyncState = { status: 'idle', source: 'bookmark', mode: 'quick', found: 0, added: 0 };

export const syncStateItem = storage.defineItem<SyncState>('local:syncState', { fallback: IDLE_SYNC });

export const viewerItem = storage.defineItem<{ handle: string; seenAt: number } | null>('local:viewer', { fallback: null });

export const lastSyncItem = storage.defineItem<Record<Source, number | null>>('local:lastSync', {
  fallback: { bookmark: null, like: null },
});

/** Number of posts captured since the dashboard was last opened (toolbar badge). */
export const unseenItem = storage.defineItem<number>('local:unseen', { fallback: 0 });

export function isSyncActive(s: SyncState): boolean {
  return s.status === 'starting' || s.status === 'running';
}
