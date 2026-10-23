import { browser } from 'wxt/browser';
import type { TimelineTweet, XFolder } from './parse';
import type { SyncMode } from './storage';
import type { Source, TweetData } from './types';

/** Messages sent to the background service worker, with their response types. */
export interface MessageMap {
  'capture/timeline': {
    req: { source: Source; op: string; tweets: TimelineTweet[]; entryCount: number; folderId?: string };
    res: IngestSummary;
  };
  'capture/saved': {
    req: { source: Source; tweetId: string; tweet?: TweetData; partial?: boolean; folderId?: string };
    res: { ok: boolean; category?: { name: string; emoji: string }; isNew: boolean };
  };
  'capture/removed': { req: { source: Source; tweetId: string }; res: { ok: boolean } };
  'capture/folders': { req: { folders: XFolder[] }; res: { ok: boolean } };
  'capture/viewer': { req: { handle: string }; res: { ok: boolean } };
  'sync/start': { req: { source: Source; mode: SyncMode }; res: { ok: boolean; error?: string } };
  'sync/claim': { req: Record<string, never>; res: { task: SyncTask | null } };
  'sync/finish': { req: { runId: string; status: 'done' | 'stopped' | 'error'; message?: string }; res: { ok: boolean } };
  'sync/stop': { req: Record<string, never>; res: { ok: boolean } };
  'open/dashboard': { req: { hash?: string }; res: { ok: boolean } };
  'stats/get': { req: Record<string, never>; res: { total: number; unread: number; categories: Array<{ id: string; count: number }> } };
  'library/recategorize': { req: { keepAi: boolean }; res: { updated: number } };
}

export interface IngestSummary {
  count: number;
  added: number;
  updated: number;
}

export interface SyncTask {
  runId: string;
  source: Source;
  mode: SyncMode;
  viewerHandle?: string;
}

export type MessageType = keyof MessageMap;
export type Message<T extends MessageType = MessageType> = { type: T } & MessageMap[T]['req'];

export async function send<T extends MessageType>(type: T, payload: MessageMap[T]['req']): Promise<MessageMap[T]['res']> {
  const res = await browser.runtime.sendMessage({ type, ...payload });
  if (res && typeof res === 'object' && 'error' in res && Object.keys(res).length === 1) {
    throw new Error(String((res as { error: unknown }).error));
  }
  return res as MessageMap[T]['res'];
}
