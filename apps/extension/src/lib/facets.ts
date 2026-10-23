import type { Facet, TweetData } from './types';

const THREAD_RE = /🧵|\bthread\b|\(1\/\d+\)|^\s*1\s*[/.)]\s|^\s*1\/\d*\s/im;

export function isThread(t: TweetData): boolean {
  if (t.isReply && t.replyTo && t.replyTo.toLowerCase() === t.author.handle.toLowerCase()) return true;
  return THREAD_RE.test(t.text);
}

export function computeFacets(t: TweetData): Facet[] {
  const f = new Set<Facet>();
  if (t.media.length) f.add('media');
  if (t.media.some((m) => m.type === 'photo')) f.add('image');
  if (t.media.some((m) => m.type === 'video')) f.add('video');
  if (t.media.some((m) => m.type === 'gif')) f.add('gif');
  if (t.links.length || t.card) f.add('link');
  if (t.poll) f.add('poll');
  if (t.quoted) f.add('quote');
  if (t.isReply) f.add('reply');
  if (t.article) f.add('article');
  if (t.isNote || t.text.length > 600 || t.article) f.add('long');
  if (isThread(t)) f.add('thread');
  return [...f];
}

export const FACET_LABELS: Record<Facet, string> = {
  media: 'Media',
  image: 'Images',
  video: 'Videos',
  gif: 'GIFs',
  link: 'Links',
  thread: 'Threads',
  long: 'Long reads',
  article: 'Articles',
  poll: 'Polls',
  quote: 'Quotes',
  reply: 'Replies',
};
