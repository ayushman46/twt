/**
 * Sample library so people (and store reviewers) can explore twtdash before
 * syncing. Every person and post here is fictional.
 */
import { db } from './db';
import { buildIndiaDemoPosts } from './demo-india';
import { ingestTweets } from './ingest';
import { domainOf } from './parse';
import type { Media, TweetData } from './types';

export const DEMO_PREFIX = 'demo-';

interface Seed {
  who: number;
  text: string;
  media?: Array<'photo' | 'video'>;
  /** The post's last link, rendered as a preview card (like X does). */
  link?: { url: string; title: string; description?: string; image?: boolean };
  /** Extra links in the post text (no preview card). */
  extra?: string[];
  quote?: number;
  poll?: string[];
  tags?: string[];
  note?: string;
}

const PEOPLE = [
  { name: 'Maya Chen', handle: 'mayabuilds', verified: true },
  { name: 'Dan Ortiz', handle: 'devdan_codes', verified: false },
  { name: 'Priya Raman', handle: 'priyadesigns', verified: true },
  { name: 'Leo Fischer', handle: 'leo_ships', verified: false },
  { name: 'Ama Owusu', handle: 'amagrows', verified: true },
  { name: 'Theo Marsh', handle: 'theo_invests', verified: false },
  { name: 'Sofia Reyes', handle: 'sofiaonchain', verified: false },
  { name: 'Kenji Watanabe', handle: 'kenjiwrites', verified: true },
  { name: 'Nora Lindqvist', handle: 'nora_lifts', verified: false },
  { name: 'Ibrahim Haddad', handle: 'ibrahim_sci', verified: true },
  { name: 'Grace Park', handle: 'gracereads', verified: false },
  { name: 'Ollie Bennett', handle: 'olliememes', verified: false },
];

const SEEDS: Seed[] = [
  { who: 0, text: 'Fine-tuning a small open-weights LLM beat GPT-class prompting on our extraction task — 94% vs 81% accuracy at 1/20th the inference cost. Full write-up with evals 👇', link: { url: 'https://example.com/finetune-vs-prompting', title: 'Fine-tuning vs prompting: a field report', image: true }, tags: ['fine-tuning', 'evals'] },
  { who: 0, text: 'The best AI agents I’ve seen all share one trait: boring, well-defined tools. Give the model 5 sharp tools instead of 50 vague ones.', tags: ['agents'] },
  { who: 0, text: 'RAG checklist that fixed 80% of our retrieval issues:\n\n1. Chunk by meaning, not tokens\n2. Store titles with chunks\n3. Hybrid search (BM25 + embeddings)\n4. Re-rank the top 50\n5. Eval with real user questions', link: { url: 'https://arxiv.org/abs/2005.11401', title: 'Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks', description: 'Large pre-trained language models store factual knowledge in their parameters… we explore a general-purpose fine-tuning recipe for retrieval-augmented generation (RAG).' }, tags: ['rag'] },
  { who: 1, text: 'TIL you can replace half your Node build tooling with the native test runner + --watch. Fewer deps, faster CI.', tags: ['node.js'] },
  { who: 1, text: 'Hot take: most React performance problems are data-fetching problems wearing a costume. Fix the waterfall before you reach for memo.', link: { url: 'https://overreacted.io/a-complete-guide-to-useeffect/', title: 'A Complete Guide to useEffect', description: 'You wrote a few components with Hooks. Maybe even a small app. But something still bugs you…' }, tags: ['react'] },
  { who: 1, text: 'Wrote a tiny Rust CLI that diffs two Postgres schemas and prints the migration. Open source, MIT, ~400 lines.', link: { url: 'https://github.com/example/pg-schema-diff', title: 'example/pg-schema-diff: Diff two Postgres schemas' }, tags: ['rust', 'postgres'] },
  { who: 1, text: 'System design interview tip: always start with the read/write ratio. It decides caching, sharding and consistency for you.', tags: ['system design'] },
  { who: 2, text: 'Typography rule I wish I learned earlier: tighten letter-spacing on large headings, loosen it on small caps. Instantly looks more designed.', media: ['photo'], tags: ['typography'] },
  { who: 2, text: 'New Figma plugin drop: generates an accessible color palette from one brand color, with contrast scores for every pair.', media: ['photo', 'photo'], tags: ['figma', 'color'] },
  { who: 2, text: 'Micro-interactions that make an app feel premium:\n• 150ms ease-out on hover\n• Press states that scale to 0.98\n• Skeletons that match the real layout\n• Optimistic UI everywhere', media: ['video'], extra: ['https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API'], tags: ['motion', 'ui'] },
  { who: 2, text: 'Landing page inspiration thread — 12 SaaS sites with genuinely great hero sections 🧵', media: ['photo', 'photo', 'photo', 'photo'], tags: ['inspiration'] },
  { who: 3, text: 'We hit $25k MRR bootstrapped. No VC, no ads. What worked: talking to 3 customers every single week and shipping what they asked for twice.', tags: ['bootstrapping'] },
  { who: 3, text: 'Founders: your pricing page is a product. A/B testing annual-first pricing raised our ARR per customer by 31%.', tags: ['pricing'] },
  { who: 3, text: 'Product-market fit isn’t a moment, it’s a slope. Watch retention cohorts flatten — that’s the signal.', quote: 0, tags: ['pmf'] },
  { who: 3, text: 'Built in public update: launched on Product Hunt, #2 product of the day, 1,400 signups in 48h. Breakdown of every channel inside.', link: { url: 'https://example.com/launch-retro', title: 'Our launch retro, by the numbers', image: true } },
  { who: 4, text: 'Copywriting framework that keeps converting: Problem → Agitate → Solution. Our landing page conversion rate went from 2.1% to 4.8%.', tags: ['copywriting'] },
  { who: 4, text: 'Growing a newsletter to 50k subscribers: the only 4 distribution channels that mattered (and the 9 that didn’t).', link: { url: 'https://example.com/newsletter-growth', title: 'How we grew to 50k subscribers' } },
  { who: 4, text: 'Your first 10 posts are for the algorithm. Your next 100 are for the audience. Consistency beats virality.' },
  { who: 5, text: 'Index funds, an emergency fund and compound interest. That’s 90% of personal finance. The rest is noise and fees.', tags: ['investing'] },
  { who: 5, text: 'Earnings season cheat sheet: what to actually read in a 10-Q (hint: cash flow, not EPS).', media: ['photo'], tags: ['stocks'] },
  { who: 5, text: 'Where do you keep your emergency fund?', poll: ['High-yield savings', 'Money market fund', 'T-bills', 'Under the mattress'] },
  { who: 6, text: 'Stablecoin volume onchain just passed Visa for the quarter. Whatever you think about crypto, payments rails are changing.', tags: ['stablecoins'] },
  { who: 6, text: 'Ethereum L2 fees are now cheaper than a card swipe. Solana still faster. Bitcoin still Bitcoin.', tags: ['ethereum'] },
  { who: 7, text: 'Atomic habits, but practical: put the guitar on the stand, not in the case. Reduce friction for good habits, add it for bad ones.', extra: ['https://www.amazon.in/Atomic-Habits-Proven-Build-Break/dp/0735211299?tag=demo-21'], tags: ['habits'] },
  { who: 7, text: 'My deep work routine: phone in another room, 90-minute blocks, a single written goal for each block. 3 blocks a day changed my output.', tags: ['deep work'] },
  { who: 7, text: 'Mental model: second-order thinking. Ask “and then what?” three times before every big decision.', tags: ['mental models'] },
  { who: 8, text: 'Zone 2 cardio 3x a week + lifting 3x a week. VO2 max up 12% in 6 months. Longevity is a training plan.', media: ['photo'], tags: ['zone 2', 'longevity'] },
  { who: 8, text: 'Sleep stack that actually works: same wake time daily, morning sunlight, no caffeine after noon, cold dark room.', tags: ['sleep'] },
  { who: 8, text: 'Protein target cheat sheet: 1.6–2.2 g per kg of body weight for muscle growth. Creatine 5 g daily. Done.', tags: ['nutrition'] },
  { who: 9, text: 'The new telescope images of this galaxy cluster are unreal. Light that left 13 billion years ago, captured in a weekend.', media: ['photo'], tags: ['astronomy'] },
  { who: 9, text: 'New study: a 20-minute walk after meals cuts glucose spikes by ~30%. Small habit, big metabolic effect.', link: { url: 'https://example.com/study-walking-glucose', title: 'Post-meal walking and glucose response' } },
  { who: 9, text: 'Quantum computing explained without hype: what qubits can and can’t do in the next decade.', link: { url: 'https://example.com/quantum-explained', title: 'Quantum computing, honestly explained', image: true }, tags: ['quantum'] },
  { who: 10, text: 'Books that changed how I think, in no particular order: The Beginning of Infinity, Thinking in Systems, The Mom Test, Working.', extra: ['https://www.amazon.com/Beginning-Infinity-Explanations-Transform-World/dp/0143121359', 'https://www.amazon.com/Thinking-Systems-Donella-H-Meadows/dp/1603580557', 'https://www.amazon.in/dp/1492180742?ref=demo'], tags: ['books'] },
  { who: 10, text: 'Free course: a complete roadmap to learn data engineering in 2026, step by step, with projects. Bookmark this.', link: { url: 'https://www.coursera.org/specializations/machine-learning-introduction?utm_source=twitter', title: 'Machine Learning Specialization | Coursera', description: 'Build ML models with NumPy & scikit-learn, build & train supervised models for prediction & binary classification tasks.', image: true }, tags: ['roadmap'] },
  { who: 10, text: 'The ultimate guide to note-taking for researchers — Zettelkasten without the cult.', link: { url: 'https://example.com/notes-guide', title: 'A practical guide to research notes' }, note: 'Try this for the thesis notes' },
  { who: 11, text: 'me explaining to my manager that the bug was “technically a feature” 💀', media: ['photo'] },
  { who: 11, text: 'nobody:\nmy code at 2am: works perfectly\nmy code at 9am in the demo: 💀😂', },
  { who: 3, text: 'We’re hiring our first designer — fully remote, competitive salary + equity. DM me your portfolio.', link: { url: 'https://wellfound.com/jobs/2981234-founding-product-designer', title: 'Founding Product Designer at Shipboard', description: 'Remote · Full-time · Equity' }, tags: ['hiring'] },
  { who: 1, text: '20 developer tools I use every day (all free): a terminal, a launcher, a diff tool, an API client, and 16 more you probably haven’t heard of.', media: ['photo'], extra: ['https://linear.app/?ref=twitter', 'https://www.raycast.com/'] },
  { who: 0, text: 'Prompt engineering is becoming context engineering. The model is smart; your job is to give it the right 2,000 tokens.', quote: 1 },
  { who: 2, text: 'Design systems are a product, not a project. Version them, document them, and give them a changelog.', tags: ['design systems'] },
  { who: 4, text: 'Cold email that got a 42% reply rate: 3 sentences, one specific compliment, one clear ask, no links.', tags: ['sales'] },
  { who: 0, text: 'Still the best way to really understand transformers: build GPT from scratch, in code, in two hours. Read the original paper alongside it.', extra: ['https://arxiv.org/pdf/1706.03762v7'], link: { url: 'https://www.youtube.com/watch?v=kCc8FmEb1nY&feature=youtu.be', title: 'Let’s build GPT: from scratch, in code, spelled out. - YouTube', description: 'We build a Generatively Pretrained Transformer (GPT), following the paper “Attention is All You Need”.', image: true }, tags: ['llm', 'learning'] },
  { who: 1, text: 'nanoGPT is still the cleanest codebase to learn LLM training from — the model is ~300 lines. Pairs perfectly with the video walkthrough.', extra: ['https://youtu.be/kCc8FmEb1nY?si=demo'], link: { url: 'https://github.com/karpathy/nanoGPT', title: 'GitHub - karpathy/nanoGPT: The simplest, fastest repository for training/finetuning medium-sized GPTs.', image: true }, tags: ['llm', 'python'] },
  { who: 9, text: 'The 2017 paper that started it all is still a great read — short, clear, and the figures hold up.', link: { url: 'https://arxiv.org/abs/1706.03762', title: '[1706.03762] Attention Is All You Need', description: 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks… We propose a new simple network architecture, the Transformer.' }, tags: ['papers'] },
  { who: 4, text: 'New issue: the 4 distribution channels that took us to 50k subscribers — with the exact numbers for each.', link: { url: 'https://amagrows.substack.com/p/the-4-channels-that-took-us-to-50k?r=demo&utm_campaign=post', title: 'The 4 channels that took us to 50k', description: 'Referrals, SEO, cross-promos and one channel nobody talks about.', image: true }, tags: ['newsletter'] },
  { who: 3, text: 'Launch day 🚀 Shipboard is live on Product Hunt — privacy-first analytics for indie SaaS, no cookie banner needed. Would love your feedback!', link: { url: 'https://www.producthunt.com/posts/shipboard?utm_source=twitter', title: 'Shipboard - Privacy-first analytics for indie SaaS | Product Hunt', description: 'Simple, cookie-free product analytics for small teams.', image: true } },
  { who: 10, text: 'If you want to learn DSA properly and for free, this NPTEL course is gold. Lectures, assignments, and the certificate exam is cheap.', link: { url: 'https://nptel.ac.in/courses/106106145', title: 'Programming, Data Structures and Algorithms using Python - NPTEL', description: 'Basic programming in Python, data structures and algorithms with a focus on problem solving.' }, tags: ['dsa', 'free courses'] },
  { who: 0, text: 'Open weights keep getting better. An 8B instruct model now runs on my laptop and handles most of my summarization work.', link: { url: 'https://huggingface.co/meta-llama/Llama-3.1-8B-Instruct', title: 'meta-llama/Llama-3.1-8B-Instruct · Hugging Face' }, tags: ['open weights'] },
  { who: 7, text: 'Long conversations beat short clips. This podcast is my default for deep, three-hour interviews on science, tech and history.', link: { url: 'https://podcasts.apple.com/in/podcast/lex-fridman-podcast/id1434243584', title: 'Lex Fridman Podcast', description: 'Conversations about science, technology, history, philosophy and the nature of intelligence.' }, tags: ['podcasts'] },
  { who: 3, text: 'Hiring in Bengaluru: backend engineer, 2–5 yrs, Go + Postgres. Small team, real ownership. Apply below or DM me.', link: { url: 'https://www.instahyre.com/job-284512-backend-engineer-go-postgres-at-shipboard-bangalore/', title: 'Backend Engineer (Go, Postgres) at Shipboard', description: 'Bengaluru · 2–5 years' }, tags: ['hiring'] },
  { who: 1, text: 'Saving this for the next time I fight a janky page transition: the docs on the View Transition API are excellent.', link: { url: 'https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API', title: 'View Transition API - Web APIs | MDN' }, tags: ['css'] },
];

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export async function loadDemoLibrary(): Promise<number> {
  const rand = rng(42);
  const now = Date.now();
  const DAY = 86_400_000;
  const tweets = SEEDS.map((s, i) => {
    const p = PEOPLE[s.who]!;
    const savedAt = now - Math.floor(Math.pow(rand(), 1.6) * 330 * DAY) - i * 3_600_000;
    const createdAt = savedAt - Math.floor(rand() * 4 * DAY);
    const id = `${DEMO_PREFIX}${String(i + 1).padStart(3, '0')}`;
    const media: Media[] = (s.media ?? []).map((type, j) => ({
      type,
      url: `https://picsum.photos/seed/twtdash-${i}-${j}/1200/${type === 'video' ? 675 : 800}.jpg`,
      width: 1200,
      height: type === 'video' ? 675 : 800,
      durationMs: type === 'video' ? 42_000 : undefined,
    }));
    const likes = Math.floor(Math.pow(rand(), 2.4) * 18_000) + 12;
    const t: TweetData = {
      id,
      url: `https://example.com/twtdash-demo/${id}`,
      text: s.text,
      lang: 'en',
      createdAt,
      author: { id: String(s.who), name: p.name, handle: p.handle, avatar: '', verified: p.verified, followers: 1000 + Math.floor(rand() * 90_000) },
      media,
      links: [...(s.extra ?? []), ...(s.link ? [s.link.url] : [])].map((url) => ({ url, display: url.replace('https://', '').slice(0, 28) + '…', domain: domainOf(url) })),
      hashtags: [],
      mentions: [],
      card: s.link ? { url: s.link.url, title: s.link.title, description: s.link.description, image: s.link.image ? `https://picsum.photos/seed/twtdash-card-${i}/1200/628.jpg` : undefined, domain: domainOf(s.link.url) } : undefined,
      poll: s.poll ? { options: s.poll.map((label) => ({ label, votes: Math.floor(rand() * 900) + 20 })) } : undefined,
      metrics: { likes, retweets: Math.floor(likes * 0.12), replies: Math.floor(likes * 0.04), quotes: Math.floor(likes * 0.01), views: likes * (30 + Math.floor(rand() * 40)), bookmarks: Math.floor(likes * 0.3) },
      isReply: false,
      isNote: s.text.length > 280,
    };
    return { t, s, savedAt };
  });

  // Quotes reference other demo posts.
  for (const x of tweets) {
    if (x.s.quote === undefined) continue;
    const q = tweets[x.s.quote]!.t;
    x.t.quoted = { id: q.id, url: q.url, text: q.text, createdAt: q.createdAt, author: q.author, media: q.media };
  }

  await ingestTweets(
    tweets.map((x) => ({ tweet: x.t })),
    { source: 'bookmark' },
  );
  // Apply demo saved-times, tags, notes and a few reading states.
  await db.transaction('rw', db.bookmarks, async () => {
    for (const [i, x] of tweets.entries()) {
      await db.bookmarks.update(x.t.id, {
        updatedAt: Date.now(),
        savedAt: x.savedAt,
        tags: x.s.tags ?? [],
        note: x.s.note ?? '',
        read: i % 3 === 0 ? 0 : 1,
        starred: i % 7 === 0 ? 1 : 0,
      });
    }
  });

  // Indian-language posts, appended after the originals (own ids and saved times).
  const india = buildIndiaDemoPosts();
  await ingestTweets(
    india.map((b) => ({ tweet: b })),
    { source: 'bookmark' },
  );
  await db.transaction('rw', db.bookmarks, async () => {
    for (const b of india) {
      await db.bookmarks.update(b.id, { updatedAt: Date.now(), savedAt: b.savedAt, tags: b.tags, note: b.note, read: b.read, starred: b.starred });
    }
  });
  return tweets.length + india.length;
}

export async function hasDemoData(): Promise<boolean> {
  return (await db.bookmarks.where('id').startsWith(DEMO_PREFIX).count()) > 0;
}

export async function removeDemoData(): Promise<number> {
  return db.bookmarks.where('id').startsWith(DEMO_PREFIX).delete();
}
