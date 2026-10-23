/**
 * Synthetic large library for performance benchmarks (`?bench=10000`).
 * Deterministic: the same N always produces the same posts.
 */
import { defaultCategories } from '@/lib/db';
import { computeFacets } from '@/lib/facets';
import type { Bookmark, Media, TweetData } from '@/lib/types';

const WORDS = (
  'agents model prompt latency ship founders revenue design typography color layout react rust python database index cache ' +
  'growth audience newsletter launch pricing habits focus sleep protein running market stocks inflation bitcoin ethereum ' +
  'research paper physics space climate robots career hiring interview remote book course guide tutorial thread lesson ' +
  'tool app extension template workflow automation news policy court election film music game football travel recipe meme'
).split(' ');

const TAGS = ['llm', 'react', 'design systems', 'pricing', 'habits', 'sleep', 'rust', 'growth', 'typography', 'startups', 'evals', 'books', 'remote', 'stocks', 'ai tools'];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function makeBenchLibrary(n: number): Bookmark[] {
  const rand = rng(1337);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)]!;
  const cats = defaultCategories();
  const authors = Array.from({ length: 600 }, (_, i) => ({
    id: String(10_000 + i),
    name: `Author ${i} ${pick(['Chen', 'Ortiz', 'Raman', 'Fischer', 'Owusu', 'Marsh', 'Reyes', 'Park'])}`,
    handle: `author_${i}`,
    avatar: '',
    verified: rand() < 0.3,
    followers: Math.floor(rand() * 200_000),
  }));
  const now = Date.now();
  const out: Bookmark[] = [];
  for (let i = 0; i < n; i++) {
    const words = 12 + Math.floor(rand() * 70);
    const text = Array.from({ length: words }, () => pick(WORDS)).join(' ') + (rand() < 0.15 ? ' 🧵' : '');
    const mediaCount = rand() < 0.35 ? 1 + Math.floor(rand() * (rand() < 0.7 ? 1 : 4)) : 0;
    const media: Media[] = Array.from({ length: mediaCount }, (_, k) => ({
      type: rand() < 0.15 ? 'video' : 'photo',
      url: `/bench/img-${(i + k) % 5}.jpg`,
      width: 1200,
      height: 800,
      durationMs: 30_000,
    }));
    const hasLink = rand() < 0.25;
    const author = authors[Math.floor(Math.pow(rand(), 1.8) * authors.length)]!;
    const savedAt = now - i * 3 * 3_600_000 - Math.floor(rand() * 3_600_000);
    const tweet: TweetData = {
      id: String(1_800_000_000_000_000_000n - BigInt(i)),
      url: `https://example.com/bench/${i}`,
      text,
      lang: 'en',
      createdAt: savedAt - Math.floor(rand() * 5 * 86_400_000),
      author,
      media,
      links: hasLink ? [{ url: `https://example.com/article/${i}`, display: `example.com/article/${i}`, domain: 'example.com' }] : [],
      hashtags: [],
      mentions: [],
      card: hasLink && !mediaCount ? { url: `https://example.com/article/${i}`, title: `Article ${i}: ${pick(WORDS)} and ${pick(WORDS)}`, domain: 'example.com', image: rand() < 0.5 ? `/bench/img-${i % 5}.jpg` : undefined } : undefined,
      quoted:
        rand() < 0.1
          ? { id: String(1_700_000_000_000_000_000n + BigInt(i)), url: '', text: Array.from({ length: 20 }, () => pick(WORDS)).join(' '), createdAt: savedAt - 86_400_000, author: pick(authors), media: [] }
          : undefined,
      metrics: { likes: Math.floor(rand() * 20_000), retweets: Math.floor(rand() * 2000), replies: Math.floor(rand() * 400), quotes: 0, views: Math.floor(rand() * 900_000), bookmarks: 0 },
      isReply: false,
      isNote: words > 60,
    };
    out.push({
      ...tweet,
      sources: ['bookmark'],
      savedAt,
      capturedAt: savedAt,
      updatedAt: savedAt,
      category: pick(cats).id,
      categorySource: 'rule',
      tags: rand() < 0.4 ? [pick(TAGS), pick(TAGS)].filter((t, j, a) => a.indexOf(t) === j) : [],
      collections: [],
      starred: rand() < 0.08 ? 1 : 0,
      archived: rand() < 0.03 ? 1 : 0,
      read: rand() < 0.6 ? 1 : 0,
      note: rand() < 0.05 ? 'Remember to try this' : '',
      facets: computeFacets(tweet),
    });
  }
  return out;
}
