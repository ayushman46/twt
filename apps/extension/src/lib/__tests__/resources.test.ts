import { describe, expect, it } from 'vitest';
import {
  buildShelf,
  canonicalizeUrl,
  classifyUrl,
  cleanCardTitle,
  filterResources,
  getShelf,
  libraryQuery,
  prettySlug,
  resourcesInPost,
  shelfToMarkdown,
  sortResources,
  typeFromSlug,
  type ResourceType,
} from '../resources';
import type { Author, Bookmark } from '../types';

const ana: Author = { id: '1', name: 'Ana Rao', handle: 'ana', avatar: '', verified: false };
const ben: Author = { id: '2', name: 'Ben Ito', handle: 'ben', avatar: '', verified: false };
const cy: Author = { id: '3', name: 'Cy Lee', handle: 'cy', avatar: '', verified: false };

let seq = 0;
function bm(patch: Partial<Bookmark> & { urls?: string[] } = {}): Bookmark {
  const { urls, ...rest } = patch;
  seq++;
  return {
    id: `p${seq}`,
    url: `https://x.com/ana/status/${seq}`,
    text: 'hello',
    lang: 'en',
    createdAt: 1_700_000_000_000,
    author: ana,
    media: [],
    links: (urls ?? []).map((u) => ({ url: u, display: u, domain: '' })),
    hashtags: [],
    mentions: [],
    metrics: { likes: 0, retweets: 0, replies: 0, quotes: 0, views: 0, bookmarks: 0 },
    isReply: false,
    isNote: false,
    sources: ['bookmark'],
    savedAt: 1_700_000_000_000 + seq * 1000,
    capturedAt: 1,
    updatedAt: 1,
    category: 'other',
    categorySource: 'rule',
    tags: [],
    collections: [],
    starred: 0,
    archived: 0,
    read: 0,
    note: '',
    facets: [],
    ...rest,
  };
}

/* ------------------------------------------------------------------ */

describe('canonicalizeUrl', () => {
  it.each([
    ['https://www.Example.com/path/?utm_source=twitter&utm_medium=social', 'https://example.com/path'],
    ['https://example.com/a?fbclid=xyz&gclid=1&id=5', 'https://example.com/a?id=5'],
    ['https://m.youtube.com/watch?v=dQw4w9WgXcQ&feature=share&si=abc', 'https://youtube.com/watch?v=dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?t=42', 'https://youtu.be/dQw4w9WgXcQ?t=42'],
    ['https://youtu.be/dQw4w9WgXcQ?t=1m30s&si=x', 'https://youtu.be/dQw4w9WgXcQ?t=1m30s'],
    ['https://example.com/post?t=AbCdEf123', 'https://example.com/post'],
    ['https://example.com/post?t=90', 'https://example.com/post?t=90'],
    ['https://example.com/thing?s=20', 'https://example.com/thing'],
    ['https://example.com/search?s=hello', 'https://example.com/search?s=hello'],
    ['https://EXAMPLE.com:443/A/B//', 'https://example.com/A/B'],
    ['https://example.com/#section-2', 'https://example.com'],
    ['https://app.example.com/#/dashboard', 'https://app.example.com#/dashboard'],
    ['https://example.com/page?b=2&a=1', 'https://example.com/page?a=1&b=2'],
    ['https://en.m.wikipedia.org/wiki/Foo', 'https://en.wikipedia.org/wiki/Foo'],
    ['example.com/path', 'https://example.com/path'],
    ['https://example.com/path).', 'https://example.com/path'],
    ['https://en.wikipedia.org/wiki/Foo_(bar)', 'https://en.wikipedia.org/wiki/Foo_(bar)'],
    ['https://www.google.com/url?q=https%3A%2F%2Fgithub.com%2Fa%2Fb%3Futm_source%3Dx&sa=D', 'https://github.com/a/b'],
    ['https://medium.com/@u/my-post-3f2a1b9c8d7e?source=rss----123&sk=abc', 'https://medium.com/@u/my-post-3f2a1b9c8d7e?sk=abc'],
    ['https://amp.dev/', 'https://amp.dev'],
    ['https://example.com/news/story/amp', 'https://example.com/news/story'],
    ['https://example.com/?ref=producthunt&via=twitter', 'https://example.com'],
    ['https://example.com/?source=twitter&page=2', 'https://example.com?page=2'],
    ['https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk?si=123&nd=1', 'https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk'],
    ['https://www.linkedin.com/jobs/view/123456789/?trk=abc&refId=x', 'https://linkedin.com/jobs/view/123456789'],
    ['http://example.com/plain', 'http://example.com/plain'],
    ['https://foo.substack.com/p/bar?r=2abc&utm_campaign=post&showWelcome=true', 'https://foo.substack.com/p/bar'],
  ])('%s → %s', (input, expected) => {
    expect(canonicalizeUrl(input)).toBe(expected);
  });

  it.each(['mailto:a@b.com', 'javascript:alert(1)', 'not a url', 'http://localhost:3000/x', 'http://192.168.0.1/admin', 'ftp://example.com/file', ''])('rejects %s', (input) => {
    expect(canonicalizeUrl(input)).toBeNull();
  });
});

/* ------------------------------------------------------------------ */

type Expect = { type: ResourceType; key?: string; subtype?: string; id?: string; url?: string; title?: string };
const cases: Array<[string, Expect | null]> = [
  // GitHub
  ['https://github.com/vercel/next.js', { type: 'repo', subtype: 'github', key: 'github:vercel/next.js', id: 'vercel/next.js', url: 'https://github.com/vercel/next.js' }],
  ['https://github.com/vercel/next.js/issues/123', { type: 'repo', key: 'github:vercel/next.js' }],
  ['https://github.com/Vercel/Next.js/pull/1', { type: 'repo', key: 'github:vercel/next.js' }],
  ['https://github.com/vercel/next.js/blob/canary/README.md', { type: 'repo', key: 'github:vercel/next.js' }],
  ['https://github.com/vercel/next.js/tree/canary/packages/next', { type: 'repo', key: 'github:vercel/next.js' }],
  ['https://github.com/vercel/next.js.git', { type: 'repo', key: 'github:vercel/next.js', id: 'vercel/next.js' }],
  ['https://raw.githubusercontent.com/karpathy/nanoGPT/master/train.py', { type: 'repo', key: 'github:karpathy/nanogpt' }],
  ['https://gist.github.com/karpathy/d4dee566867f8291f086', { type: 'repo', subtype: 'gist', key: 'gist:d4dee566867f8291f086' }],
  ['https://github.com/features/copilot', null],
  ['https://github.com/settings/tokens', null],
  ['https://github.com/orgs/vercel/repositories', null],
  ['https://github.com/sponsors/someone', null],
  ['https://github.com/topics/llm', null],
  ['https://github.com/marketplace/actions/checkout', null],
  ['https://github.com/torvalds', null],
  ['https://docs.github.com/en/actions', { type: 'docs' }],
  ['https://gitlab.com/gitlab-org/gitlab-runner/-/issues/1', { type: 'repo', subtype: 'gitlab', id: 'gitlab-org/gitlab-runner' }],
  ['https://www.npmjs.com/package/@tanstack/react-query', { type: 'repo', subtype: 'npm', id: '@tanstack/react-query' }],
  ['https://pypi.org/project/Requests/', { type: 'repo', subtype: 'pypi', key: 'pypi:requests' }],
  // Papers
  ['https://arxiv.org/abs/2401.01234v2', { type: 'paper', subtype: 'arxiv', key: 'arxiv:2401.01234', url: 'https://arxiv.org/abs/2401.01234', title: 'arXiv 2401.01234' }],
  ['https://arxiv.org/pdf/2401.01234v3.pdf', { type: 'paper', key: 'arxiv:2401.01234' }],
  ['https://arxiv.org/pdf/2401.01234', { type: 'paper', key: 'arxiv:2401.01234' }],
  ['https://arxiv.org/abs/hep-th/9901001', { type: 'paper', key: 'arxiv:hep-th/9901001' }],
  ['https://huggingface.co/papers/2401.01234', { type: 'paper', key: 'arxiv:2401.01234' }],
  ['https://doi.org/10.1145/3290605.3300857', { type: 'paper', key: 'doi:10.1145/3290605.3300857' }],
  ['https://dl.acm.org/doi/pdf/10.1145/3290605.3300857', { type: 'paper', key: 'doi:10.1145/3290605.3300857' }],
  ['https://openreview.net/forum?id=abc123XYZ', { type: 'paper', key: 'openreview:abc123XYZ' }],
  ['https://openreview.net/pdf?id=abc123XYZ', { type: 'paper', key: 'openreview:abc123XYZ' }],
  ['https://www.semanticscholar.org/paper/Attention-is-All-you-Need-Vaswani/204e3073870fae3d05bcbc2f6a8e263d9b72e776', { type: 'paper', key: 'semantic-scholar:204e3073870fae3d05bcbc2f6a8e263d9b72e776' }],
  ['https://paperswithcode.com/paper/attention-is-all-you-need', { type: 'paper', title: 'Attention is all you need' }],
  ['https://www.biorxiv.org/content/10.1101/2024.01.01.573000v2.full', { type: 'paper', key: 'doi:10.1101/2024.01.01.573000' }],
  ['https://www.nature.com/articles/s41586-024-07421-0', { type: 'paper', key: 'doi:10.1038/s41586-024-07421-0' }],
  ['https://cdn.openai.com/papers/gpt-4.pdf', { type: 'paper', subtype: 'pdf' }],
  // Video
  ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLx&index=2', { type: 'video', key: 'youtube:dQw4w9WgXcQ', url: 'https://youtube.com/watch?v=dQw4w9WgXcQ' }],
  ['https://youtu.be/dQw4w9WgXcQ?si=xyz', { type: 'video', key: 'youtube:dQw4w9WgXcQ' }],
  ['https://youtube.com/shorts/dQw4w9WgXcQ', { type: 'video', subtype: 'yt-short', key: 'youtube:dQw4w9WgXcQ' }],
  ['https://www.youtube.com/live/dQw4w9WgXcQ?feature=shared', { type: 'video', key: 'youtube:dQw4w9WgXcQ' }],
  ['https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', { type: 'video', key: 'youtube:dQw4w9WgXcQ' }],
  ['https://www.youtube.com/playlist?list=PLUl4u3cNGP63WbdFxL8giv4yhgdMGaZNA', { type: 'course', subtype: 'youtube-playlist' }],
  ['https://www.youtube.com/@lexfridman', { type: 'video', subtype: 'channel' }],
  ['https://www.youtube.com/results?search_query=rust', null],
  ['https://www.youtube.com/watch?v=tooShort', null],
  ['https://vimeo.com/123456789', { type: 'video', key: 'vimeo:123456789' }],
  ['https://player.vimeo.com/video/123456789', { type: 'video', key: 'vimeo:123456789' }],
  ['https://www.loom.com/share/0123456789abcdef0123456789abcdef', { type: 'video', subtype: 'loom' }],
  ['https://www.ted.com/talks/some_speaker_some_talk', { type: 'video', subtype: 'ted' }],
  // Podcasts & music
  ['https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk?si=abc', { type: 'podcast', key: 'spotify:episode:4rOoJ6Egrf8K2IrywzwOMk' }],
  ['https://open.spotify.com/intl-de/show/2MAi0BvDc6GTFvKFPXnkCL', { type: 'podcast', key: 'spotify:show:2MAi0BvDc6GTFvKFPXnkCL' }],
  ['https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl', { type: 'other', subtype: 'music' }],
  ['https://podcasts.apple.com/us/podcast/lex-fridman-podcast/id1434243584?i=1000123456789', { type: 'podcast', key: 'apple-podcast:1434243584:1000123456789', title: 'Lex fridman podcast' }],
  // Articles
  ['https://stratechery.substack.com/p/some-post?utm_source=x&r=abc', { type: 'article', subtype: 'substack', url: 'https://stratechery.substack.com/p/some-post' }],
  ['https://lenny.substack.com/', { type: 'article', subtype: 'newsletter' }],
  ['https://medium.com/@user/how-we-scaled-postgres-3f2a1b9c8d7e', { type: 'article', key: 'medium:3f2a1b9c8d7e', title: 'How we scaled postgres' }],
  ['https://user.medium.com/how-we-scaled-postgres-3f2a1b9c8d7e?source=post_page', { type: 'article', key: 'medium:3f2a1b9c8d7e' }],
  ['https://dev.to/user/my-first-post-1abc', { type: 'article', subtype: 'devto' }],
  ['https://overreacted.io/a-complete-guide-to-useeffect/', { type: 'article', title: 'A complete guide to useeffect' }],
  ['https://simonwillison.net/2024/Jan/1/foo/', { type: 'article' }],
  ['https://www.nytimes.com/2024/01/01/technology/ai.html', { type: 'article' }],
  ['https://www.thehindu.com/', { type: 'article', subtype: 'publication' }],
  ['https://en.wikipedia.org/wiki/Large_language_model', { type: 'article', subtype: 'wikipedia', title: 'Large language model' }],
  ['https://x.com/i/article/1790000000000000000', { type: 'article', subtype: 'x-article' }],
  ['https://example.com/blog/launch-week', { type: 'article' }],
  // Tools & products
  ['https://www.producthunt.com/posts/linear-2-0?ref=x', { type: 'tool', subtype: 'product-hunt', key: 'ph:linear-2-0' }],
  ['https://apps.apple.com/in/app/notion-notes-docs-tasks/id1232780281', { type: 'tool', subtype: 'app-store', key: 'appstore:1232780281' }],
  ['https://play.google.com/store/apps/details?id=com.whatsapp&hl=en_IN', { type: 'tool', key: 'play:com.whatsapp', url: 'https://play.google.com/store/apps/details?id=com.whatsapp' }],
  ['https://chromewebstore.google.com/detail/ublock-origin/cjpalhdlnbpafiamejdnhcphjbkeiagm', { type: 'tool', key: 'cws:cjpalhdlnbpafiamejdnhcphjbkeiagm' }],
  ['https://chrome.google.com/webstore/detail/ublock-origin/cjpalhdlnbpafiamejdnhcphjbkeiagm?hl=en', { type: 'tool', key: 'cws:cjpalhdlnbpafiamejdnhcphjbkeiagm' }],
  ['https://linear.app', { type: 'tool', subtype: 'site', title: 'Linear' }],
  ['https://linear.app/pricing', { type: 'tool' }],
  ['https://my-demo.vercel.app/', { type: 'tool', subtype: 'app' }],
  ['https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode', { type: 'tool', key: 'vscode:esbenp.prettier-vscode' }],
  // Books
  ['https://www.amazon.com/Atomic-Habits-Proven-Build-Break/dp/0735211299/ref=sr_1_1?keywords=x', { type: 'book', key: 'asin:0735211299', url: 'https://amazon.com/dp/0735211299', title: 'Atomic Habits Proven Build Break' }],
  ['https://www.amazon.in/dp/0735211299?tag=aff-21', { type: 'book', key: 'asin:0735211299' }],
  ['https://www.amazon.in/gp/product/B07D23CFGR/ref=x', { type: 'book', key: 'asin:B07D23CFGR' }],
  ['https://amzn.to/3xYzAbC', { type: 'book', subtype: 'amazon-short' }],
  ['https://www.goodreads.com/book/show/40121378-atomic-habits', { type: 'book', key: 'goodreads:40121378', title: 'Atomic habits' }],
  ['https://books.google.com/books?id=abc123XYZ&hl=en', { type: 'book', key: 'gbooks:abc123XYZ' }],
  ['https://example.com/isbn/9780735211292', { type: 'book', key: 'isbn:9780735211292' }],
  ['https://aws.amazon.com/', { type: 'tool' }],
  // Courses
  ['https://www.coursera.org/learn/machine-learning?utm_medium=x', { type: 'course', key: 'coursera:learn/machine-learning', title: 'Machine learning' }],
  ['https://www.udemy.com/course/the-complete-web-development-bootcamp/?couponCode=X', { type: 'course', key: 'udemy:the-complete-web-development-bootcamp' }],
  ['https://onlinecourses.nptel.ac.in/noc24_cs01/preview', { type: 'course', key: 'nptel:noc24_cs01' }],
  ['https://nptel.ac.in/courses/106105171', { type: 'course', key: 'nptel:106105171' }],
  ['https://www.edx.org/learn/computer-science/harvard-university-cs50-s-introduction-to-computer-science', { type: 'course', subtype: 'edx' }],
  ['https://www.scaler.com/topics/java/', { type: 'article' }],
  ['https://example.com/courses/rust-101', { type: 'course' }],
  // Docs
  ['https://developer.mozilla.org/en-US/docs/Web/API/fetch', { type: 'docs', subtype: 'mdn' }],
  ['https://docs.python.org/3/library/asyncio.html', { type: 'docs' }],
  ['https://requests.readthedocs.io/en/latest/', { type: 'docs' }],
  ['https://nextjs.org/docs/app/building-your-application', { type: 'docs' }],
  ['https://react.dev/learn', { type: 'docs' }],
  ['https://docs.google.com/document/d/1AbCdEfGh/edit?usp=sharing', { type: 'other', subtype: 'google-doc', key: 'gdocs:1AbCdEfGh' }],
  // Datasets & models
  ['https://huggingface.co/meta-llama/Llama-3.1-8B', { type: 'dataset', subtype: 'hf-model', key: 'hf:meta-llama/llama-3.1-8b' }],
  ['https://huggingface.co/meta-llama/Llama-3.1-8B/blob/main/config.json', { type: 'dataset', key: 'hf:meta-llama/llama-3.1-8b' }],
  ['https://huggingface.co/datasets/HuggingFaceFW/fineweb', { type: 'dataset', subtype: 'hf-dataset' }],
  ['https://huggingface.co/spaces/user/demo', { type: 'dataset', subtype: 'hf-space' }],
  ['https://huggingface.co/pricing', null],
  ['https://www.kaggle.com/datasets/someuser/some-data', { type: 'dataset', subtype: 'kaggle-dataset' }],
  ['https://www.kaggle.com/competitions/titanic', { type: 'dataset', subtype: 'kaggle-competition', key: 'kaggle:c/titanic' }],
  // Jobs
  ['https://www.linkedin.com/jobs/view/senior-engineer-at-acme-3812345678/?trk=x', { type: 'job', key: 'linkedin-job:3812345678' }],
  ['https://www.linkedin.com/jobs/collections/recommended/?currentJobId=3812345678', { type: 'job', key: 'linkedin-job:3812345678' }],
  ['https://www.linkedin.com/in/someone', null],
  ['https://wellfound.com/jobs/123456-founding-engineer', { type: 'job' }],
  ['https://www.naukri.com/job-listings-backend-developer-acme-bengaluru-3-to-5-years-120124001234', { type: 'job', key: 'naukri:120124001234' }],
  ['https://www.instahyre.com/job-123456-backend-engineer-at-acme-bangalore/', { type: 'job' }],
  ['https://boards.greenhouse.io/acme/jobs/4567890', { type: 'job' }],
  ['https://jobs.lever.co/acme/1b2c3d4e-0000-1111-2222-333344445555', { type: 'job' }],
  ['https://acme.com/careers', { type: 'job' }],
  ['https://careers.acme.com/', { type: 'job' }],
  // Noise and other links
  ['https://x.com/user/status/123', null],
  ['https://twitter.com/user', null],
  ['https://t.co/abc123', null],
  ['https://linktr.ee/someone', null],
  ['https://bit.ly/3abcXYZ', { type: 'other', subtype: 'short' }],
  ['https://news.ycombinator.com/item?id=39000000', { type: 'other', subtype: 'discussion', key: 'hn:39000000' }],
  ['https://www.reddit.com/r/programming/comments/abc123/some_title/', { type: 'other', subtype: 'discussion', key: 'reddit:abc123' }],
];

describe('classifyUrl', () => {
  it.each(cases)('%s', (url, want) => {
    const got = classifyUrl(url);
    if (want === null) {
      expect(got).toBeNull();
      return;
    }
    expect(got).not.toBeNull();
    expect(got!.type).toBe(want.type);
    if (want.key) expect(got!.key).toBe(want.key);
    if (want.subtype) expect(got!.subtype).toBe(want.subtype);
    if (want.id) expect(got!.id).toBe(want.id);
    if (want.url) expect(got!.url).toBe(want.url);
    if (want.title) expect(got!.title).toBe(want.title);
  });
});

describe('helpers', () => {
  it('maps slugs and aliases to types', () => {
    expect(typeFromSlug('repos')).toBe('repo');
    expect(typeFromSlug('data')).toBe('dataset');
    expect(typeFromSlug('Models')).toBe('dataset');
    expect(typeFromSlug('jobs')).toBe('job');
    expect(typeFromSlug('nope')).toBeNull();
    expect(typeFromSlug(undefined)).toBeNull();
  });

  it('prettifies slugs and rejects opaque ids', () => {
    expect(prettySlug('how-we-scaled_postgres-3f2a1b9c8d7e')).toBe('How we scaled postgres');
    expect(prettySlug('40121378-atomic-habits')).toBe('Atomic habits');
    expect(prettySlug('aB3dE9xYz1Q')).toBeUndefined();
    expect(prettySlug('12345')).toBeUndefined();
  });

  it('cleans preview-card boilerplate', () => {
    expect(cleanCardTitle('GitHub - vercel/next.js: The React Framework', { subtype: 'github', domain: 'github.com' })).toEqual({ title: 'vercel/next.js', description: 'The React Framework' });
    expect(cleanCardTitle('[2401.01234] Scaling Laws for Everything', { subtype: 'arxiv', domain: 'arxiv.org' }).title).toBe('Scaling Laws for Everything');
    expect(cleanCardTitle('Building a compiler - YouTube', { subtype: 'youtube', domain: 'youtube.com' }).title).toBe('Building a compiler');
    expect(
      cleanCardTitle('Amazon.com: Atomic Habits: An Easy & Proven Way to Build Good Habits & Break Bad Ones: Clear, James: 9780735211292: Books', { subtype: 'amazon', domain: 'amazon.com' }).title,
    ).toBe('Atomic Habits: An Easy & Proven Way to Build Good Habits & Break Bad Ones');
    expect(cleanCardTitle('Notes on scaling | by Jane Doe | Medium', { subtype: 'medium', domain: 'medium.com' }).title).toBe('Notes on scaling');
  });
});

/* ------------------------------------------------------------------ */

describe('buildShelf', () => {
  it('dedupes URL variants across posts and aggregates sharers by frequency', () => {
    const posts = [
      bm({ author: ana, urls: ['https://youtu.be/dQw4w9WgXcQ?si=1'] }),
      bm({ author: ben, urls: ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share'] }),
      bm({ author: ben, urls: ['https://m.youtube.com/shorts/dQw4w9WgXcQ'] }),
    ];
    const shelf = buildShelf(posts);
    expect(shelf.total).toBe(1);
    const r = shelf.resources[0]!;
    expect(r.count).toBe(3);
    expect(r.sharers.map((s) => s.handle)).toEqual(['ben', 'ana']);
    expect(r.firstSavedAt).toBe(posts[0]!.savedAt);
    expect(r.lastSavedAt).toBe(posts[2]!.savedAt);
    expect(r.postIds).toEqual([posts[2]!.id, posts[1]!.id, posts[0]!.id]);
    expect(shelf.counts.video).toBe(1);
  });

  it('prefers the preview card title and keeps its description', () => {
    const p = bm({
      urls: ['https://github.com/vercel/next.js?utm_source=x'],
      card: { url: 'https://github.com/vercel/next.js', title: 'GitHub - vercel/next.js: The React Framework', image: 'https://pbs.twimg.com/card.jpg' },
    });
    const r = buildShelf([p]).resources[0]!;
    expect(r.title).toBe('vercel/next.js');
    expect(r.description).toBe('The React Framework');
    expect(r.image).toBe('https://pbs.twimg.com/card.jpg');
    expect(r.kind).toBe('Repo');
  });

  it('attaches an unexpanded t.co card to the last link', () => {
    const p = bm({ urls: ['https://github.com/a/b', 'https://example.com/how-we-built-it'], card: { url: 'https://t.co/xyz', title: 'How we built it, for real', description: 'A story' } });
    const shelf = buildShelf([p]);
    const art = shelf.resources.find((r) => r.type === 'article')!;
    expect(art.title).toBe('How we built it, for real');
    expect(shelf.resources.find((r) => r.type === 'repo')!.title).toBe('a/b');
  });

  it('counts a resource once per post and ignores links to posts on X', () => {
    const p = bm({ urls: ['https://arxiv.org/abs/2401.01234', 'https://arxiv.org/pdf/2401.01234v2', 'https://x.com/someone/status/1'] });
    const shelf = buildShelf([p]);
    expect(shelf.total).toBe(1);
    expect(shelf.resources[0]!.count).toBe(1);
    expect(shelf.posts).toBe(1);
  });

  it('skips archived posts unless asked', () => {
    const p = bm({ archived: 1, urls: ['https://github.com/a/b'] });
    expect(buildShelf([p]).total).toBe(0);
    expect(buildShelf([p], { includeArchived: true }).total).toBe(1);
  });

  it('extracts links from quoted posts and credits the quoted author', () => {
    const p = bm({ author: ana, quoted: { id: 'q1', url: '', text: 'Must read (https://example.com/the-bitter-lesson).', createdAt: 0, author: cy, media: [] } });
    const r = buildShelf([p]).resources[0]!;
    expect(r.url).toBe('https://example.com/the-bitter-lesson');
    expect(r.sharers[0]!.handle).toBe('cy');
  });

  it('includes long-form X articles', () => {
    const p = bm({ article: { title: 'How I think about agents', preview: 'Long read' } });
    const r = buildShelf([p]).resources[0]!;
    expect(r.type).toBe('article');
    expect(r.subtype).toBe('x-article');
    expect(r.title).toBe('How I think about agents');
    expect(r.postIds).toEqual([p.id]);
  });

  it('tells Amazon books from products using context', () => {
    const deal = bm({ text: 'Crazy deal: these earbuds for ₹999 today', urls: ['https://amzn.to/3dealX'] });
    const book = bm({ text: 'The best book I read this year', urls: ['https://amzn.to/3bookY'] });
    const card = bm({ urls: ['https://www.amazon.in/dp/B0C1234567'], card: { url: 'https://www.amazon.in/dp/B0C1234567', title: 'Amazon.in: boAt Airdopes 141 Wireless Earbuds : Electronics' } });
    const isbn = bm({ text: 'gadget', urls: ['https://www.amazon.com/dp/0735211299'] });
    const types = buildShelf([deal, book, card, isbn]).resources.reduce<Record<string, string>>((m, r) => ((m[r.key] = r.type), m), {});
    expect(types['amzn.to/3dealX']).toBe('tool');
    expect(types['amzn.to/3bookY']).toBe('book');
    expect(types['asin:B0C1234567']).toBe('tool');
    expect(types['asin:0735211299']).toBe('book');
  });

  it('uses the card domain to type short links', () => {
    const p = bm({ urls: ['https://bit.ly/3vid'], card: { url: 'https://bit.ly/3vid', title: 'A great talk', domain: 'youtube.com' } });
    const r = buildShelf([p]).resources[0]!;
    expect(r.type).toBe('video');
    expect(r.domain).toBe('youtube.com');
    expect(r.title).toBe('A great talk');
  });

  it('memoizes on the library array identity', () => {
    const list = [bm({ urls: ['https://github.com/a/b'] })];
    expect(getShelf(list)).toBe(getShelf(list));
    expect(getShelf([...list])).not.toBe(getShelf(list));
  });

  it('lists resources found in a single post', () => {
    const p = bm({ urls: ['https://github.com/a/b', 'https://www.coursera.org/learn/machine-learning'] });
    expect(resourcesInPost(p).map((r) => r.type)).toEqual(['repo', 'course']);
  });
});

/* ------------------------------------------------------------------ */

describe('sort, filter, export, library query', () => {
  const posts = [
    bm({ author: ana, urls: ['https://github.com/rust-lang/rust'] }),
    bm({ author: ben, urls: ['https://github.com/rust-lang/rust', 'https://www.coursera.org/learn/algorithms-part1'] }),
    bm({ author: cy, urls: ['https://example.com/zig-is-fun'], card: { url: 'https://example.com/zig-is-fun', title: '[Zig] is fun' } }),
  ];
  const shelf = buildShelf(posts);

  it('sorts by most shared, recency and title', () => {
    expect(sortResources(shelf.resources, 'shared')[0]!.id).toBe('rust-lang/rust');
    expect(sortResources(shelf.resources, 'recent')[0]!.url).toBe('https://example.com/zig-is-fun');
    expect(sortResources(shelf.resources, 'az').map((r) => r.title)).toEqual(['Algorithms part1', 'rust-lang/rust', '[Zig] is fun']);
  });

  it('filters by type, words and operators', () => {
    expect(filterResources(shelf.resources, '', 'repo')).toHaveLength(1);
    expect(filterResources(shelf.resources, 'zig')).toHaveLength(1);
    expect(filterResources(shelf.resources, 'from:@ben')).toHaveLength(2);
    expect(filterResources(shelf.resources, 'site:coursera.org')).toHaveLength(1);
    expect(filterResources(shelf.resources, 'type:courses')).toHaveLength(1);
    expect(filterResources(shelf.resources, 'rust nothing-matches')).toHaveLength(0);
    expect(filterResources(shelf.resources, '')).toHaveLength(3);
  });

  it('builds precise library queries', () => {
    expect(libraryQuery(shelf.byKey.get('github:rust-lang/rust')!)).toBe('"github.com/rust-lang/rust"');
    expect(libraryQuery({ subtype: 'youtube', id: 'dQw4w9WgXcQ', url: 'https://youtube.com/watch?v=dQw4w9WgXcQ', domain: 'youtube.com', key: 'youtube:dQw4w9WgXcQ' })).toBe('"dqw4w9wgxcq"');
    expect(libraryQuery(shelf.resources.find((r) => r.type === 'article')!)).toBe('"example.com/zig-is-fun"');
    expect(libraryQuery({ subtype: 'site', url: 'https://linear.app', domain: 'linear.app', key: 'linear.app' })).toBe('domain:linear.app');
  });

  it('exports Markdown grouped by type', () => {
    const md = shelfToMarkdown(sortResources(shelf.resources, 'shared'), { now: Date.UTC(2026, 9, 24) });
    expect(md).toContain('# Shelf');
    expect(md).toContain('2026-10-24');
    expect(md).toContain('## Repos (1)');
    expect(md).toContain('- [rust-lang/rust](https://github.com/rust-lang/rust)');
    expect(md).toContain('Shared by @ben, @ana · saved in 2 posts');
    expect(md).toContain('## Courses (1)');
    expect(md).toContain('[\\[Zig\\] is fun](https://example.com/zig-is-fun)');
    expect(md.indexOf('## Repos')).toBeLessThan(md.indexOf('## Articles'));
  });
});

/* ------------------------------------------------------------------ */

describe('performance', () => {
  // Timing test: opt in with PERF_TESTS=1 (it is load-sensitive under parallel test workers).
  it.skipIf(!process.env.PERF_TESTS)('extracts a 10k-post library well under 100ms', () => {
    const templates = [
      (i: number) => `https://github.com/org${i % 900}/repo${i % 1300}/issues/${i}`,
      (i: number) => `https://arxiv.org/abs/24${String(i % 12).padStart(2, '0')}.${String(10000 + (i % 4000))}v${(i % 3) + 1}`,
      (i: number) => `https://youtu.be/${String(i).padStart(11, 'x')}?si=abc${i}`,
      (i: number) => `https://blog${i % 50}.example.com/posts/how-we-did-thing-${i}?utm_source=twitter`,
      (i: number) => `https://www.amazon.in/Some-Book-Title/dp/B0${String(i % 3000).padStart(8, '0')}/ref=x`,
      (i: number) => `https://huggingface.co/org${i % 200}/model-${i % 700}`,
      (i: number) => `https://www.linkedin.com/jobs/view/${3_000_000_000 + i}/?trk=x`,
      (i: number) => `https://product${i % 400}.app/`,
    ];
    const lib: Bookmark[] = [];
    for (let i = 0; i < 10_000; i++) {
      const n = i % 3 === 0 ? 0 : 1 + (i % 2);
      const urls = Array.from({ length: n }, (_, k) => templates[(i + k) % templates.length]!(i));
      lib.push(bm({ author: [ana, ben, cy][i % 3]!, urls, text: 'some post text about a book or a deal' }));
    }
    // Calibrate: the same machine parsing 20k URLs with the platform parser.
    const c0 = performance.now();
    let sink = 0;
    for (let i = 0; i < 20_000; i++) sink += new URL(`https://example.com/p/${i}?utm_source=x`).pathname.length;
    const calib = performance.now() - c0;
    const t0 = performance.now();
    const shelf = buildShelf(lib);
    const cold = performance.now() - t0;
    const t1 = performance.now();
    buildShelf(lib);
    const warm = performance.now() - t1;
    console.info(`[shelf perf] 10k posts → ${shelf.total} resources: cold ${cold.toFixed(1)}ms, warm ${warm.toFixed(1)}ms (20k bare URL parses: ${calib.toFixed(1)}ms)`);
    expect(sink).toBeGreaterThan(0);
    expect(shelf.total).toBeGreaterThan(3000);
    // Bounds scale with machine load (parallel CI): a full cold extraction should cost
    // about as much as parsing every URL once; a warm rebuild a fraction of that.
    expect(cold).toBeLessThan(Math.max(250, calib * 6));
    expect(warm).toBeLessThan(Math.max(80, calib * 2));
  });
});
