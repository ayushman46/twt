/**
 * Trimmed-down but structurally faithful samples of X's GraphQL responses,
 * covering both the legacy and the newer user schema.
 */

const legacyUser = (id: string, handle: string, name: string) => ({
  __typename: 'User',
  rest_id: id,
  is_blue_verified: true,
  legacy: {
    name,
    screen_name: handle,
    profile_image_url_https: `https://pbs.twimg.com/profile_images/${id}/a_normal.jpg`,
    followers_count: 12000,
  },
});

/** Current (post July 2026) user shape: no `legacy` block at all. */
const newUser = (id: string, handle: string, name: string) => ({
  __typename: 'User',
  rest_id: id,
  is_blue_verified: false,
  core: { name, screen_name: handle, created_at: 'Mon Jan 01 00:00:00 +0000 2018' },
  avatar: { image_url: `https://pbs.twimg.com/profile_images/${id}/b_normal.png` },
  verification: { verified: false },
  relationship_counts: { followers: 50, following: 10 },
  profile_bio: { description: 'builder' },
});

export const aiTweet = {
  __typename: 'Tweet',
  rest_id: '1790000000000000001',
  core: { user_results: { result: legacyUser('11', 'mayabuilds', 'Maya Chen') } },
  views: { count: '45210', state: 'EnabledWithCount' },
  legacy: {
    id_str: '1790000000000000001',
    created_at: 'Wed May 15 10:00:00 +0000 2024',
    full_text: 'Fine-tuning small LLMs beats prompting for structured extraction. Full write-up &amp; evals: https://t.co/abc123 #AI https://t.co/media1',
    display_text_range: [0, 108],
    lang: 'en',
    favorite_count: 1234,
    retweet_count: 210,
    reply_count: 33,
    quote_count: 9,
    bookmark_count: 880,
    conversation_id_str: '1790000000000000001',
    entities: {
      hashtags: [{ text: 'AI', indices: [100, 103] }],
      user_mentions: [],
      urls: [{ url: 'https://t.co/abc123', expanded_url: 'https://maya.dev/blog/finetune-vs-prompt', display_url: 'maya.dev/blog/finetune-…' }],
      media: [{ url: 'https://t.co/media1' }],
    },
    extended_entities: {
      media: [
        {
          url: 'https://t.co/media1',
          type: 'photo',
          media_url_https: 'https://pbs.twimg.com/media/GNabc.jpg',
          original_info: { width: 1200, height: 675 },
          ext_alt_text: 'Bar chart of eval scores',
        },
      ],
    },
  },
};

const quotedTweet = {
  __typename: 'Tweet',
  rest_id: '1780000000000000000',
  core: { user_results: { result: newUser('22', 'devdan', 'Dan Ortiz') } },
  legacy: {
    created_at: 'Mon Apr 01 08:00:00 +0000 2024',
    full_text: 'Shipped a tiny CLI in Rust today',
    entities: { urls: [], hashtags: [], user_mentions: [] },
  },
};

export const devTweetWrapped = {
  __typename: 'TweetWithVisibilityResults',
  tweet: {
    rest_id: '1790000000000000002',
    core: { user_results: { result: newUser('33', 'rustacean_ri', 'Ri Park') } },
    quoted_status_result: { result: quotedTweet },
    legacy: {
      created_at: 'Thu May 16 12:30:00 +0000 2024',
      full_text: '@devdan This is the cleanest typescript + rust setup I have seen. Repo: https://t.co/gh1 https://t.co/quote1',
      display_text_range: [8, 112],
      lang: 'en',
      favorite_count: 50,
      retweet_count: 4,
      reply_count: 2,
      quote_count: 0,
      in_reply_to_status_id_str: '1780000000000000000',
      in_reply_to_screen_name: 'devdan',
      quoted_status_id_str: '1780000000000000000',
      quoted_status_permalink: { url: 'https://t.co/quote1', expanded: 'https://twitter.com/devdan/status/1780000000000000000' },
      entities: {
        hashtags: [],
        user_mentions: [{ screen_name: 'devdan' }],
        urls: [
          { url: 'https://t.co/gh1', expanded_url: 'https://github.com/ri/ts-rust-starter', display_url: 'github.com/ri/ts-rust-sta…' },
          { url: 'https://t.co/quote1', expanded_url: 'https://twitter.com/devdan/status/1780000000000000000', display_url: 'twitter.com/devdan/status/…' },
        ],
      },
    },
  },
};

export const noteTweet = {
  __typename: 'Tweet',
  rest_id: '1790000000000000003',
  core: { user_results: { result: legacyUser('44', 'foundernotes', 'Founder Notes') } },
  note_tweet: {
    note_tweet_results: {
      result: {
        text: 'How we went from $0 to $1M ARR as a bootstrapped SaaS 🧵\n\n1/ Talk to customers every week. Product-market fit is a feeling and a number.\n\nMore: https://t.co/long1',
        entity_set: {
          urls: [{ url: 'https://t.co/long1', expanded_url: 'https://foundernotes.com/1m-arr', display_url: 'foundernotes.com/1m-arr' }],
          hashtags: [],
          user_mentions: [],
        },
      },
    },
  },
  legacy: {
    created_at: 'Fri May 17 15:00:00 +0000 2024',
    full_text: 'How we went from $0 to $1M ARR as a bootstrapped SaaS 🧵…',
    lang: 'en',
    favorite_count: 9000,
    retweet_count: 1200,
    reply_count: 300,
    quote_count: 40,
    entities: { urls: [], hashtags: [], user_mentions: [] },
  },
};

export const cardTweet = {
  __typename: 'Tweet',
  rest_id: '1790000000000000004',
  core: { user_results: { result: newUser('55', 'typenerd', 'Type Nerd') } },
  card: {
    legacy: {
      name: 'summary_large_image',
      url: 'https://t.co/card1',
      binding_values: [
        { key: 'title', value: { string_value: 'A field guide to variable fonts', type: 'STRING' } },
        { key: 'description', value: { string_value: 'Typography for interfaces', type: 'STRING' } },
        { key: 'vanity_url', value: { string_value: 'fonts.example.com', type: 'STRING' } },
        { key: 'card_url', value: { string_value: 'https://t.co/card1', type: 'STRING' } },
        { key: 'summary_photo_image_large', value: { image_value: { url: 'https://pbs.twimg.com/card_img/1/abc?format=jpg&name=800x419' }, type: 'IMAGE' } },
      ],
    },
  },
  legacy: {
    created_at: 'Sat May 18 09:00:00 +0000 2024',
    full_text: 'Bookmark this: everything about variable fonts in UI design https://t.co/card1',
    display_text_range: [0, 82],
    lang: 'en',
    favorite_count: 300,
    retweet_count: 20,
    reply_count: 3,
    quote_count: 1,
    entities: {
      hashtags: [],
      user_mentions: [],
      urls: [{ url: 'https://t.co/card1', expanded_url: 'https://fonts.example.com/guide', display_url: 'fonts.example.com/guide' }],
    },
  },
};

const entry = (id: string, result: unknown, sortIndex: string) => ({
  entryId: `tweet-${id}`,
  sortIndex,
  content: {
    entryType: 'TimelineTimelineItem',
    __typename: 'TimelineTimelineItem',
    itemContent: { itemType: 'TimelineTweet', __typename: 'TimelineTweet', tweet_results: { result } },
  },
});

/** Sort indexes are snowflakes of the bookmark time (2024-06-01 and earlier). */
export const SORT = {
  a: '1796877213696000000', // ~2024-06-01
  b: '1796877213695000000',
  c: '1796877213694000000',
  d: '1796877213693000000',
  e: '1796877213692000000',
};

export const bookmarksPage = {
  data: {
    bookmark_timeline_v2: {
      timeline: {
        instructions: [
          {
            type: 'TimelineAddEntries',
            entries: [
              entry('1790000000000000001', aiTweet, SORT.a),
              entry('1790000000000000002', devTweetWrapped, SORT.b),
              entry('1790000000000000003', noteTweet, SORT.c),
              entry('1790000000000000004', cardTweet, SORT.d),
              entry('1790000000000000009', { __typename: 'TweetTombstone', tombstone: {} }, SORT.e),
              { entryId: 'cursor-top-1', sortIndex: '1', content: { entryType: 'TimelineTimelineCursor', value: 'TOP', cursorType: 'Top' } },
              { entryId: 'cursor-bottom-1', sortIndex: '0', content: { entryType: 'TimelineTimelineCursor', value: 'NEXT_PAGE', cursorType: 'Bottom' } },
            ],
          },
        ],
      },
    },
  },
};

export const endPage = {
  data: {
    bookmark_timeline_v2: {
      timeline: {
        instructions: [
          {
            type: 'TimelineAddEntries',
            entries: [
              { entryId: 'cursor-top-2', content: { entryType: 'TimelineTimelineCursor', value: 'T', cursorType: 'Top' } },
              { entryId: 'cursor-bottom-2', content: { entryType: 'TimelineTimelineCursor', value: 'B', cursorType: 'Bottom' } },
            ],
          },
        ],
      },
    },
  },
};

export const retweetOfAi = {
  __typename: 'Tweet',
  rest_id: '1790000000000000100',
  core: { user_results: { result: legacyUser('66', 'reposter', 'Re Poster') } },
  legacy: {
    created_at: 'Sun May 19 09:00:00 +0000 2024',
    full_text: 'RT @mayabuilds: Fine-tuning small LLMs…',
    retweeted_status_result: { result: aiTweet },
    entities: { urls: [], hashtags: [], user_mentions: [] },
  },
};
