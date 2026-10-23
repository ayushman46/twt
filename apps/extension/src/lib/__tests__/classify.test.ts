import { describe, expect, it } from 'vitest';
import { classifyTweet, compileCategories, inferFromAuthor } from '../classify';
import { defaultCategories } from '../db';
import { normalizeTweet } from '../parse';
import type { Category, TweetData } from '../types';
import { aiTweet, cardTweet, devTweetWrapped, noteTweet } from './fixtures';

const cats = defaultCategories();
const compiled = compileCategories(cats);

function post(text: string, extra: Partial<TweetData> = {}): TweetData {
  return {
    id: '1',
    url: '',
    text,
    lang: 'en',
    createdAt: 0,
    author: { id: '1', name: 'A', handle: 'a', avatar: '', verified: false },
    media: [],
    links: [],
    hashtags: [],
    mentions: [],
    metrics: { likes: 0, retweets: 0, replies: 0, quotes: 0, views: 0, bookmarks: 0 },
    isReply: false,
    isNote: false,
    ...extra,
  };
}

const cat = (t: TweetData, list = compiled) => classifyTweet(t, list).category;

describe('rule-based categorizer', () => {
  it('sorts the fixture posts sensibly', () => {
    expect(cat(normalizeTweet(aiTweet)!)).toBe('ai');
    expect(cat(normalizeTweet(devTweetWrapped)!)).toBe('dev');
    expect(cat(normalizeTweet(noteTweet)!)).toBe('startups');
    expect(cat(normalizeTweet(cardTweet)!)).toBe('design');
  });

  it.each([
    ['Bitcoin just broke $100k, ETH and Solana following. Onchain volume is wild', 'crypto'],
    ['The Fed held interest rates; S&P 500 and Nasdaq rallied on the inflation print', 'finance'],
    ['My morning routine: no phone, deep work for 3 hours, then journaling. Discipline > motivation', 'productivity'],
    ["We're hiring senior engineers — fully remote, great salary. DM me your resume", 'career'],
    ['Zone 2 cardio, creatine and 8 hours of sleep did more for my longevity than any supplement stack', 'health'],
    ['NASA and SpaceX confirm Starship will carry the new telescope', 'science'],
    ['20 free tools that will save you hours: a chrome extension list for every workflow', 'tools'],
    ['Breaking: Senate passes the immigration bill after a long election-year fight', 'news'],
    ['lmao this meme is so unhinged 💀', 'humor'],
    ['The best album of the year and the movie soundtrack is incredible. Netflix please renew', 'culture'],
    ['Copywriting tip: your headline is 80% of your conversion rate. Hooks matter for distribution', 'marketing'],
    ['A free course + reading list to learn system design step by step', 'learning'],
  ])('%s → %s', (text, expected) => {
    expect(cat(post(text))).toBe(expected);
  });

  it('respects word boundaries ("said" is not AI, "pain" is not AI)', () => {
    expect(cat(post('She said the pain was gone after the trail run'))).not.toBe('ai');
  });

  it('uses linked domains', () => {
    expect(cat(post('look at this', { links: [{ url: 'https://github.com/x/y', display: 'github.com/x/y', domain: 'github.com' }] }))).toBe('dev');
  });

  it('falls back to "other" for posts with no signal', () => {
    expect(cat(post('ok'))).toBe('other');
  });

  it('honours custom categories and user keywords', () => {
    const custom: Category = { id: 'cat_climb', name: 'Climbing', emoji: '🧗', color: '#000', description: '', keywords: 'bouldering, crag, belay', builtin: false, enabled: true, order: 99 };
    const list = compileCategories([...cats, custom]);
    expect(cat(post('Finally sent my first V5 at the crag, bouldering season is here'), list)).toBe('cat_climb');
  });

  it('skips disabled categories', () => {
    const list = compileCategories(cats.map((c) => (c.id === 'crypto' ? { ...c, enabled: false } : c)));
    expect(cat(post('Bitcoin and Ethereum are pumping, defi summer'), list)).not.toBe('crypto');
  });
});

describe('author affinity', () => {
  it('borrows the dominant category of an author', () => {
    const others = [
      { id: '1', category: 'design', categorySource: 'rule' as const },
      { id: '2', category: 'design', categorySource: 'rule' as const },
      { id: '3', category: 'dev', categorySource: 'rule' as const },
    ];
    expect(inferFromAuthor(others, 'x')).toBe('design');
    expect(inferFromAuthor(others.slice(0, 1), 'x')).toBeNull();
  });
});
