import { describe, expect, it } from 'vitest';
import { bookmarkTimeFromSortIndex, collectTweets, normalizeTweet, parseTimeline, snowflakeToMs } from '../parse';
import { computeFacets } from '../facets';
import { aiTweet, bookmarksPage, cardTweet, devTweetWrapped, endPage, noteTweet, retweetOfAi, SORT } from './fixtures';

describe('parseTimeline', () => {
  it('extracts tweets in order, skips tombstones, and finds the bottom cursor', () => {
    const r = parseTimeline(bookmarksPage);
    expect(r.tweets.map((t) => t.tweet.id)).toEqual(['1790000000000000001', '1790000000000000002', '1790000000000000003', '1790000000000000004']);
    expect(r.tweets[0]!.sortIndex).toBe(SORT.a);
    expect(r.cursorBottom).toBe('NEXT_PAGE');
    expect(r.entryCount).toBe(7);
  });

  it('recognises the final page (cursors only)', () => {
    const r = parseTimeline(endPage);
    expect(r.tweets).toHaveLength(0);
    expect(r.entryCount).toBe(2);
  });
});

describe('normalizeTweet', () => {
  it('parses text, entities, media, metrics and the legacy user schema', () => {
    const t = normalizeTweet(aiTweet)!;
    expect(t.author).toMatchObject({ handle: 'mayabuilds', name: 'Maya Chen', verified: true, followers: 12000 });
    expect(t.author.avatar).toContain('_bigger.jpg');
    expect(t.text).toBe('Fine-tuning small LLMs beats prompting for structured extraction. Full write-up & evals: https://maya.dev/blog/finetune-vs-prompt #AI');
    expect(t.links).toEqual([{ url: 'https://maya.dev/blog/finetune-vs-prompt', display: 'maya.dev/blog/finetune-…', domain: 'maya.dev' }]);
    expect(t.hashtags).toEqual(['AI']);
    expect(t.media[0]).toMatchObject({ type: 'photo', width: 1200, alt: 'Bar chart of eval scores' });
    expect(t.metrics).toEqual({ likes: 1234, retweets: 210, replies: 33, quotes: 9, bookmarks: 880, views: 45210 });
    expect(t.url).toBe('https://x.com/mayabuilds/status/1790000000000000001');
    expect(t.createdAt).toBe(Date.UTC(2024, 4, 15, 10, 0, 0));
  });

  it('unwraps visibility results, strips reply mentions and the quote permalink, and parses the quote', () => {
    const t = normalizeTweet(devTweetWrapped)!;
    expect(t.id).toBe('1790000000000000002');
    expect(t.author).toMatchObject({ handle: 'rustacean_ri', name: 'Ri Park', followers: 50 });
    expect(t.author.avatar).toContain('_bigger.png');
    expect(t.text).toBe('This is the cleanest typescript + rust setup I have seen. Repo: https://github.com/ri/ts-rust-starter');
    expect(t.links.map((l) => l.domain)).toEqual(['github.com']);
    expect(t.quoted).toMatchObject({ id: '1780000000000000000', text: 'Shipped a tiny CLI in Rust today' });
    expect(t.quoted!.author.handle).toBe('devdan');
    expect(t.isReply).toBe(true);
    expect(t.replyTo).toBe('devdan');
  });

  it('prefers long-form note text', () => {
    const t = normalizeTweet(noteTweet)!;
    expect(t.isNote).toBe(true);
    expect(t.text).toContain('1/ Talk to customers every week');
    expect(t.text).toContain('https://foundernotes.com/1m-arr');
    expect(computeFacets(t)).toEqual(expect.arrayContaining(['long', 'thread', 'link']));
  });

  it('parses link cards', () => {
    const t = normalizeTweet(cardTweet)!;
    expect(t.card).toMatchObject({ title: 'A field guide to variable fonts', domain: 'fonts.example.com', url: 'https://fonts.example.com/guide' });
    expect(t.card!.image).toContain('card_img');
  });

  it('stores retweets as the original post', () => {
    expect(normalizeTweet(retweetOfAi)!.id).toBe('1790000000000000001');
  });

  it('returns null for tombstones and garbage', () => {
    expect(normalizeTweet({ __typename: 'TweetTombstone' })).toBeNull();
    expect(normalizeTweet(null)).toBeNull();
    expect(normalizeTweet({ legacy: {} })).toBeNull();
  });
});

describe('collectTweets', () => {
  it('finds every post including quoted ones', () => {
    const ids = collectTweets(bookmarksPage).map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining(['1790000000000000001', '1790000000000000003', '1790000000000000004', '1780000000000000000']));
  });
});

describe('snowflakes', () => {
  it('decodes tweet ids to timestamps', () => {
    // Known: id 1790000000000000001 → 2024-05-13
    const ms = snowflakeToMs('1790000000000000001')!;
    expect(new Date(ms).toISOString().slice(0, 10)).toBe('2024-05-13');
  });

  it('accepts plausible bookmark sort indexes and rejects others', () => {
    const created = Date.UTC(2024, 4, 15);
    expect(bookmarkTimeFromSortIndex(SORT.a, created)).toBeGreaterThan(created);
    expect(bookmarkTimeFromSortIndex('123', created)).toBeUndefined();
    // Bookmark time before the post existed is impossible.
    expect(bookmarkTimeFromSortIndex(SORT.a, Date.UTC(2025, 0, 1))).toBeUndefined();
  });
});
