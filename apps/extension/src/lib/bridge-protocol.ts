import type { TimelineTweet, XFolder } from './parse';
import type { Source, TweetData } from './types';

/** Tag on window.postMessage payloads from the main-world interceptor. */
export const MAIN_SOURCE = 'twtdash:main';

export type MainMessage =
  | { kind: 'timeline'; source: Source; op: string; tweets: TimelineTweet[]; entryCount: number; folderId?: string }
  | { kind: 'saved'; source: Source; tweetId: string; tweet?: TweetData; folderId?: string }
  | { kind: 'removed'; source: Source; tweetId: string }
  | { kind: 'folders'; folders: XFolder[] };

export interface MainEnvelope {
  source: typeof MAIN_SOURCE;
  msg: MainMessage;
}

export function isMainEnvelope(data: unknown): data is MainEnvelope {
  return !!data && typeof data === 'object' && (data as MainEnvelope).source === MAIN_SOURCE && !!(data as MainEnvelope).msg;
}
