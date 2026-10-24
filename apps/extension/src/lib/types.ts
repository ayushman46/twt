export type Source = 'bookmark' | 'like';

export interface Author {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  verified: boolean;
  followers?: number;
}

export interface Media {
  type: 'photo' | 'video' | 'gif';
  url: string;
  width?: number;
  height?: number;
  alt?: string;
  videoUrl?: string;
  durationMs?: number;
}

export interface LinkRef {
  url: string;
  display: string;
  domain: string;
}

export interface LinkCard {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  domain?: string;
}

export interface Poll {
  options: { label: string; votes: number }[];
  endsAt?: number;
}

export interface Article {
  title: string;
  preview?: string;
  cover?: string;
}

export interface QuotedTweet {
  id: string;
  url: string;
  text: string;
  createdAt: number;
  author: Author;
  media: Media[];
}

export interface Metrics {
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  views: number;
  bookmarks: number;
}

/** A post as parsed from X's GraphQL responses. */
export interface TweetData {
  id: string;
  url: string;
  text: string;
  lang: string;
  createdAt: number;
  author: Author;
  media: Media[];
  links: LinkRef[];
  hashtags: string[];
  mentions: string[];
  card?: LinkCard;
  poll?: Poll;
  quoted?: QuotedTweet;
  article?: Article;
  metrics: Metrics;
  isReply: boolean;
  replyTo?: string;
  conversationId?: string;
  isNote: boolean;
}

export type Facet =
  | 'media'
  | 'image'
  | 'video'
  | 'gif'
  | 'link'
  | 'thread'
  | 'long'
  | 'article'
  | 'poll'
  | 'quote'
  | 'reply';

export type CategorySource = 'rule' | 'author' | 'ai' | 'user';

/** A post saved in the user's twtdash library. */
export interface Bookmark extends TweetData {
  sources: Source[];
  /** Best estimate of when the user saved it (bookmark time when X exposes it). */
  savedAt: number;
  capturedAt: number;
  updatedAt: number;
  sortIndex?: string;
  category: string;
  categorySource: CategorySource;
  tags: string[];
  summary?: string;
  aiAt?: number;
  collections: string[];
  starred: 0 | 1;
  archived: 0 | 1;
  read: 0 | 1;
  note: string;
  facets: Facet[];
  /** Captured from the page without full data; refreshed on next sync. */
  partial?: boolean;
}

export interface Category {
  id: string;
  name: string;
  emoji: string;
  color: string;
  description: string;
  /** Extra user keywords (comma separated) */
  keywords: string;
  builtin: boolean;
  enabled: boolean;
  order: number;
}

export interface Collection {
  id: string;
  name: string;
  emoji: string;
  color: string;
  description?: string;
  /** Linked X bookmark folder id, when imported from X Premium folders. */
  xFolderId?: string;
  createdAt: number;
  order: number;
}

/** Spaced-repetition state for one saved post (see lib/recall.ts). */
export interface RecallCard {
  /** Bookmark id */
  id: string;
  /** Next time the post should resurface (ms epoch). */
  due: number;
  /** Current interval in days. */
  interval: number;
  /** SM-2 style ease factor. */
  ease: number;
  reps: number;
  lapses: number;
  state: 'new' | 'learning' | 'review' | 'done';
  lastReviewedAt?: number;
  /** Rating given at the last review. */
  lastRating?: 'again' | 'good' | 'mastered' | 'notUseful';
  /** When the post first entered Recall. */
  firstReviewedAt?: number;
  /** Lifetime number of ratings (reps reset on a lapse; this never does). */
  reviews?: number;
}

export interface SyncRun {
  id: string;
  source: Source;
  mode: 'quick' | 'full';
  startedAt: number;
  finishedAt?: number;
  found: number;
  added: number;
  status: 'done' | 'stopped' | 'error';
  message?: string;
}
